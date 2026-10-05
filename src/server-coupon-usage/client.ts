import { COUPON_USAGE_RECEIPT_RULES, COUPON_USAGE_TRANSPORT as wire } from './models';
import type { CouponUsageCaptureReceipt } from './models';

export interface DurableCouponUsage {
  readonly usageRef: string;
  readonly holdRef: string;
  readonly requestId: string;
  readonly traceId: string;
}
export interface ServerCouponUsageOptions {
  readonly environment: 'local' | 'staging';
  readonly origin: string;
  readonly getServiceCredential: (signal: AbortSignal) => Promise<string>;
  readonly fetch?: ServerCouponUsageFetch;
  readonly timeoutMs?: number;
}
export type ServerCouponUsageFetch = (input: string, init: RequestInit) => Promise<Response>;
export type CouponUsageCaptureResult =
  | { readonly state: 'captured'; readonly receipt: CouponUsageCaptureReceipt }
  | { readonly state: 'rejected'; readonly status: number; readonly code: string }
  | { readonly state: 'unknown'; readonly code: 'capture_result_unknown'; readonly retry: 'same_operation' }
  | { readonly state: 'not_submitted'; readonly code: 'capture_not_submitted'; readonly retry: 'same_operation' };
export interface ServerCouponUsageClient {
  capture(operation: DurableCouponUsage, options?: { readonly signal?: AbortSignal }): Promise<CouponUsageCaptureResult>;
}
export class CouponUsageConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'CouponUsageConfigurationError'; }
}
interface Rule {
  readonly type?: string | readonly string[];
  readonly const?: unknown;
  readonly pattern?: string;
}
const rules: Readonly<Record<string, Rule>> = COUPON_USAGE_RECEIPT_RULES;
const unknown = (): CouponUsageCaptureResult => ({ state: 'unknown', code: 'capture_result_unknown', retry: 'same_operation' });

/** One attempt only. The product must persist operation/hold and the returned receipt. */
export function createServerCouponUsageClient(config: ServerCouponUsageOptions): ServerCouponUsageClient {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new CouponUsageConfigurationError('Coupon usage client requires a server runtime.');
  }
  let origin: URL;
  try { origin = new URL(config.origin); } catch { throw new CouponUsageConfigurationError('Invalid Money origin.'); }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || (config.environment === 'local'
      ? origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
      : config.environment !== 'staging' || origin.protocol !== 'https:')) {
    throw new CouponUsageConfigurationError('Money origin must match the explicit local/staging environment.');
  }
  if (typeof config.getServiceCredential !== 'function') throw new CouponUsageConfigurationError('Service credential callback is required.');
  const timeoutMs = config.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new CouponUsageConfigurationError('Timeout must be 1–60000 ms.');
  const transport = config.fetch ?? globalThis.fetch;
  if (typeof transport !== 'function') throw new CouponUsageConfigurationError('Fetch transport is required.');
  const endpoint = new URL(wire.path, origin).href;
  // Capture configuration once; changing the caller's object cannot redirect a credential.
  const credential = config.getServiceCredential;
  return {
    async capture(operation, options = {}) {
      // Copy the durable pair before asynchronous credential lookup.
      const pair = { ...operation };
      validateOperation(pair);
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      let submitted = false;
      let response: Response | undefined;
      try {
        controller.signal.throwIfAborted();
        const token = await wait(credential(controller.signal), controller.signal);
        if (typeof token !== 'string' || !/^[A-Za-z0-9\-._~+/=]{32,4096}$/.test(token)) {
          return { state: 'not_submitted', code: 'capture_not_submitted', retry: 'same_operation' };
        }
        controller.signal.throwIfAborted();
        submitted = true;
        const received = await wait<Response>(transport(endpoint, {
          method: wire.method, redirect: 'error', credentials: 'omit', cache: 'no-store',
          signal: controller.signal,
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json',
            accept: 'application/json', 'x-request-id': pair.requestId, 'x-trace-id': pair.traceId },
          body: JSON.stringify({ hold_ref: pair.holdRef, usage_ref: pair.usageRef })
        }).then((returned) => {
          if (controller.signal.aborted && returned.body && !returned.bodyUsed) {
            void returned.body.cancel().catch(() => undefined);
          }
          return returned;
        }), controller.signal);
        response = received;
        if (received.headers.get('x-request-id') !== pair.requestId
          || received.headers.get('x-trace-id') !== pair.traceId
          || received.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json'
          || !received.headers.get('cache-control')?.split(',').some((v) => v.trim().toLowerCase() === 'no-store')) return unknown();
        const body: unknown = JSON.parse(await readBody(received, controller.signal));
        if (received.status === wire.successStatus) {
          const receipt = decodeReceipt(body, pair.holdRef);
          return receipt ? { state: 'captured', receipt } : unknown();
        }
        const code = (wire.rejections as Readonly<Record<string, string>>)[String(received.status)];
        if (code && record(body) && Object.keys(body).length === 1 && body.code === code) {
          return { state: 'rejected', status: received.status, code };
        }
        return unknown();
      } catch {
        // Submitted timeouts/abort/protocol errors are not evidence of rollback.
        return submitted ? unknown() : { state: 'not_submitted', code: 'capture_not_submitted', retry: 'same_operation' };
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        if (response?.body && !response.bodyUsed) void response.body.cancel().catch(() => undefined);
      }
    }
  };
}

function validateOperation(op: DurableCouponUsage): void {
  if (!record(op) || Object.keys(op).length !== 4
    || !['usageRef', 'holdRef', 'requestId', 'traceId'].every((key) => typeof op[key] === 'string')
    || !new RegExp(wire.referencePattern).test(op.usageRef)
    || !new RegExp(wire.referencePattern).test(op.holdRef)
    || !new RegExp(wire.correlationPattern).test(op.requestId)
    || !new RegExp(wire.correlationPattern).test(op.traceId)) {
    throw new CouponUsageConfigurationError('Capture requires a saved operation/hold pair and valid correlation IDs.');
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function decodeReceipt(value: unknown, hold: string): CouponUsageCaptureReceipt | null {
  if (!record(value) || Object.keys(value).length !== Object.keys(rules).length) return null;
  for (const [key, rule] of Object.entries(rules)) {
    const field = value[key];
    if ('const' in rule) { if (field !== rule.const) return null; continue; }
    const kinds = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!kinds.includes(field === null ? 'null' : typeof field)) return null;
    if (typeof field === 'string' && rule.pattern && !new RegExp(rule.pattern).test(field)) return null;
  }
  // All fields have been checked against the generated, closed schema above.
  const receipt = value as unknown as CouponUsageCaptureReceipt;
  const original = BigInt(receipt.original_credit_unit);
  const benefit = BigInt(receipt.benefit_credit_unit);
  const net = BigInt(receipt.settled_credit_unit);
  if (receipt.source_ref !== hold || original > BigInt(wire.maxCreditUnit)
    || benefit > original || original - benefit !== net
    || (benefit > 0n && receipt.inventory_id === null)) return null;
  return Object.freeze({ ...receipt });
}
function wait<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined);
    return Promise.reject(new Error('Capture aborted.'));
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new Error('Capture aborted.')); };
    signal.addEventListener('abort', abort, { once: true });
    promise.then((value) => { signal.removeEventListener('abort', abort); resolve(value); },
      (error: unknown) => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
async function readBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) throw new Error('Missing capture body.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let complete = false;
  try {
    while (true) {
      const result = await wait(reader.read(), signal);
      if (result.done) { complete = true; break; }
      length += result.value.byteLength;
      if (length > wire.maxResponseBytes) throw new Error('Capture response too large.');
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    if (!complete) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
