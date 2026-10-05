import { describe, expect, test } from 'bun:test';
import { createServerCouponUsageClient, CouponUsageConfigurationError } from '../src/server-coupon-usage';
import type { DurableCouponUsage, ServerCouponUsageFetch } from '../src/server-coupon-usage';

const credential = 'synthetic-product-credential-00000000';
const operation = { usageRef: 'usage_export_saved', holdRef: 'hold_export_saved',
  requestId: 'request_capture_saved', traceId: 'trace_capture_saved' } as const;
const receipt = { settlement_id: 'coupon_settle_saved', source_kind: 'usage', source_ref: operation.holdRef,
  inventory_id: 'coupon_inventory_saved', original_credit_unit: '9007199254740993',
  benefit_credit_unit: '200', settled_credit_unit: '9007199254740793',
  effect_ledger_transaction_id: 'coupon_ledger_saved', bonus_credit_lot_id: null, replayed: false };
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store',
  'x-request-id': operation.requestId, 'x-trace-id': operation.traceId };
function response(body: unknown = receipt, status = 200, changes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, ...changes } });
}
function client(transport: ServerCouponUsageFetch, timeoutMs = 1000) {
  return createServerCouponUsageClient({ environment: 'local', origin: 'http://127.0.0.1:3004',
    getServiceCredential: async () => credential, fetch: transport, timeoutMs });
}

describe('server coupon capture', () => {
  test('sends only saved references, accepts exact large strings and refreshes credentials on retries', async () => {
    const seen: Request[] = [];
    const initOptions: RequestInit[] = [];
    let credentials = 0;
    const sdk = createServerCouponUsageClient({ environment: 'local', origin: 'http://127.0.0.1:3004',
      getServiceCredential: async () => { credentials++; return credential; },
      fetch: (async (input, init) => { initOptions.push(init); seen.push(new Request(input, init)); return response({ ...receipt, replayed: seen.length > 1 }); }) });
    for (let i = 0; i < 2; i++) {
      const result = await sdk.capture(operation);
      expect(result.state).toBe('captured');
      if (result.state === 'captured') {
        expect(result.receipt.original_credit_unit).toBe('9007199254740993');
        expect(result.receipt.replayed).toBe(i > 0);
      }
    }
    expect(credentials).toBe(2);
    expect(seen).toHaveLength(2);
    for (const request of seen) {
      expect(request.url).toBe('http://127.0.0.1:3004/v1/internal/coupons/usage/capture');
      expect(request.redirect).toBe('error');
      expect(request.headers.get('authorization')).toBe(`Bearer ${credential}`);
      expect(request.headers.get('cookie')).toBeNull();
      expect(request.headers.get('x-request-id')).toBe(operation.requestId);
      expect(await request.json()).toEqual({ hold_ref: operation.holdRef, usage_ref: operation.usageRef });
    }
    expect(initOptions.every((init) => init.credentials === 'omit')).toBe(true);
  });

  test('runs a real loopback HTTP exchange without cookies or browser headers', async () => {
    let calls = 0;
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
      calls++;
      expect(new URL(request.url).pathname).toBe('/v1/internal/coupons/usage/capture');
      expect(request.headers.get('authorization')).toBe(`Bearer ${credential}`);
      expect(request.headers.get('cookie')).toBeNull();
      expect(request.headers.get('origin')).toBeNull();
      expect(await request.json()).toEqual({ hold_ref: operation.holdRef, usage_ref: operation.usageRef });
      return response();
    } });
    try {
      const sdk = createServerCouponUsageClient({ environment: 'local', origin: `http://127.0.0.1:${server.port}`,
        getServiceCredential: async () => credential });
      expect((await sdk.capture(operation)).state).toBe('captured');
      expect(calls).toBe(1);
    } finally { server.stop(true); }
  });

  test('recognizes only matching rejection codes and never retries automatically', async () => {
    for (const [status, code] of [[400, 'invalid_usage_request'], [401, 'service_authentication_required'],
      [403, 'usage_capture_denied'], [404, 'usage_hold_not_found'], [409, 'usage_capture_conflict']] as const) {
      let calls = 0;
      const result = await client((async () => { calls++; return response({ code }, status); }) as ServerCouponUsageFetch).capture(operation);
      expect(result).toEqual({ state: 'rejected', status, code });
      expect(calls).toBe(1);
    }
    for (const status of [200, 202, 302, 503]) {
      expect((await client((async () => response({ code: 'usage_capture_unavailable' }, status)) as ServerCouponUsageFetch)
        .capture(operation)).state).toBe('unknown');
    }
  });

  test('rejects foreign, inconsistent, unsafe numeric and extra-field receipts', async () => {
    for (const body of [
      { ...receipt, source_ref: 'hold_foreign' }, { ...receipt, source_kind: 'topup' },
      { ...receipt, original_credit_unit: 9007199254740993 },
      { ...receipt, original_credit_unit: '9223372036854775808' },
      { ...receipt, benefit_credit_unit: '01' }, { ...receipt, settled_credit_unit: '0' },
      { ...receipt, inventory_id: null }, { ...receipt, bonus_credit_lot_id: 'foreign_lot' },
      { ...receipt, effect_ledger_transaction_id: null }, { ...receipt, replayed: 'true' },
      { ...receipt, account_id: 'account_foreign' }
    ]) {
      expect((await client((async () => response(body)) as ServerCouponUsageFetch).capture(operation)).state).toBe('unknown');
    }
    for (const changes of [{ 'x-request-id': 'request_foreign' }, { 'x-trace-id': 'trace_foreign' },
      { 'cache-control': 'public' }, { 'content-type': 'text/html' }]) {
      expect((await client((async () => response(receipt, 200, changes)) as ServerCouponUsageFetch).capture(operation)).state).toBe('unknown');
    }
  });

  test('supports full free action and no-benefit receipts without converting money to numbers', async () => {
    for (const body of [
      { ...receipt, original_credit_unit: '1000', benefit_credit_unit: '1000', settled_credit_unit: '0' },
      { ...receipt, original_credit_unit: '1000', benefit_credit_unit: '0', settled_credit_unit: '1000', inventory_id: null }
    ]) {
      expect((await client((async () => response(body)) as ServerCouponUsageFetch).capture(operation)).state).toBe('captured');
    }
  });

  test('timeout, abort, transport and oversized/unfinished body failures preserve unknown outcome', async () => {
    let calls = 0;
    const pending = client((async () => { calls++; return new Promise<Response>(() => {}); }) as ServerCouponUsageFetch, 10);
    expect((await pending.capture(operation)).state).toBe('unknown');
    expect(calls).toBe(1);
    const controller = new AbortController();
    const capture = pending.capture(operation, { signal: controller.signal });
    await Bun.sleep(1);
    controller.abort();
    expect((await capture).state).toBe('unknown');
    expect((await client((async () => { throw new Error('sensitive provider detail'); }) as ServerCouponUsageFetch).capture(operation))
      .state).toBe('unknown');
    let cancelled = 0;
    for (const large of [true, false]) {
      const stream = new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(new TextEncoder().encode(large ? 'x'.repeat(16385) : '{')); },
        cancel() { cancelled++; }
      });
      const result = await client((async () => new Response(stream, { headers })) as ServerCouponUsageFetch, 10).capture(operation);
      expect(result.state).toBe('unknown');
    }
    expect(cancelled).toBe(2);
  });

  test('unavailable credential and pre-abort never submit or expose credentials/errors', async () => {
    let calls = 0;
    const config = { environment: 'local' as const, origin: 'http://127.0.0.1:3004', timeoutMs: 10,
      fetch: (async () => { calls++; return response(); }) as ServerCouponUsageFetch };
    for (const provider of [async () => 'invalid', async () => { throw new Error(credential); },
      async () => new Promise<string>(() => {})]) {
      const result = await createServerCouponUsageClient({ ...config, getServiceCredential: provider }).capture(operation);
      expect(result.state).toBe('not_submitted');
      expect(JSON.stringify(result)).not.toContain(credential);
    }
    const controller = new AbortController(); controller.abort();
    const result = await createServerCouponUsageClient({ ...config, getServiceCredential: async () => credential })
      .capture(operation, { signal: controller.signal });
    expect(result.state).toBe('not_submitted');
    expect(calls).toBe(0);
  });

  test('cancels a late response even when an injected transport ignores abort', async () => {
    let finish!: (value: Response) => void;
    let cancelled = false;
    const sdk = client(async () => new Promise<Response>((resolve) => { finish = resolve; }), 10);
    expect((await sdk.capture(operation)).state).toBe('unknown');
    finish(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers }));
    await Bun.sleep(1);
    expect(cancelled).toBe(true);
  });

  test('captures configuration and operation before asynchronous lookup', async () => {
    let complete!: (token: string) => void;
    const mutable = { ...operation };
    const config = { environment: 'local' as const, origin: 'http://127.0.0.1:3004',
      getServiceCredential: () => new Promise<string>((resolve) => { complete = resolve; }),
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        expect(request.url).toStartWith('http://127.0.0.1:3004/');
        expect(await request.json()).toEqual({ hold_ref: operation.holdRef, usage_ref: operation.usageRef });
        return response();
      }) as ServerCouponUsageFetch };
    const sdk = createServerCouponUsageClient(config);
    const result = sdk.capture(mutable);
    config.origin = 'http://foreign.invalid';
    mutable.holdRef = 'hold_mutated' as typeof operation.holdRef;
    complete(credential);
    expect((await result).state).toBe('captured');
  });

  test('rejects browser usage, unsafe origins, caller amounts and correlation injection before I/O', async () => {
    for (const origin of ['http://foreign.invalid', 'http://127.0.0.1:3004/path',
      'http://user:password@127.0.0.1:3004', 'http://127.0.0.1:3004/?query=1']) {
      expect(() => createServerCouponUsageClient({ environment: 'local', origin,
        getServiceCredential: async () => credential })).toThrow(CouponUsageConfigurationError);
    }
    const sdk = client((async () => { throw new Error('should not submit'); }) as ServerCouponUsageFetch);
    for (const op of [{ ...operation, price: 0 }, { ...operation, requestId: 'request\r\ninjected' },
      { ...operation, holdRef: '' }]) {
      await expect(sdk.capture(op as DurableCouponUsage)).rejects.toThrow(CouponUsageConfigurationError);
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { value: {}, configurable: true });
    try { expect(() => client(fetch)).toThrow(CouponUsageConfigurationError); }
    finally { if (prior) Object.defineProperty(globalThis, 'document', prior); else Reflect.deleteProperty(globalThis, 'document'); }
  });
});
