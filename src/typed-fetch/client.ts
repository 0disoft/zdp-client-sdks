import {
  ZdpApiError,
  ZdpClientConfigurationError,
  ZdpProtocolError,
  ZdpRequestAbortedError,
  ZdpRequestTimeoutError,
  ZdpTransportError,
  parseZdpErrorEnvelope
} from './errors';
import type {
  AnyZdpOperationDefinition,
  EncodedZdpRequest,
  ZdpCallOptions,
  ZdpFetchLike,
  ZdpOperationDefinition,
  ZdpOperationMap,
  ZdpOperationRequest,
  ZdpOperationResponse,
  ZdpPathValue,
  ZdpQueryValue,
  ZdpResponseContext,
  ZdpRetryOptions,
  ZdpTypedFetchClient,
  ZdpTypedFetchClientOptions
} from './types';

const REQUEST_ID_HEADER = 'x-request-id';
const TRACE_ID_HEADER = 'x-trace-id';
const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const AUTHORIZATION_HEADER = 'authorization';
const RETRY_AFTER_HEADER = 'retry-after';
const JSON_CONTENT_TYPE = 'application/json';
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 200;
const DEFAULT_RETRY_MAX_DELAY_MS = 2_000;
const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;
const MAX_RETRY_ATTEMPTS = 5;
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const RETRYABLE_RESPONSE_STATUSES = new Set([408, 429, 502, 503, 504]);

interface ResolvedRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly maxRetryAfterMs: number;
}

interface MergedAbortSignal {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
}

/**
 * mf:anchor zdp.client-sdks.typed-fetch-runtime
 * purpose: Locate typed fetch runtime for request metadata, auth headers, idempotency, timeout, retry, and errors.
 * search: typed fetch, request metadata, authorization, idempotency, timeout, retry, Retry-After, error envelope
 * invariant: request_id, trace_id, access token, and idempotency values are enforced once and reused across retries.
 * risk: external_request, authz, security, state
 */
export function defineZdpOperation<Request, Response>(
  operation: ZdpOperationDefinitionInput<Request, Response>
): ZdpOperationDefinitionInput<Request, Response> {
  return operation;
}

export function defineZdpOperations<const Operations extends ZdpOperationMap>(
  operations: Operations
): Operations {
  return operations;
}

export function createZdpTypedFetchClient<const Operations extends ZdpOperationMap>(
  operations: Operations,
  options: ZdpTypedFetchClientOptions
): ZdpTypedFetchClient<Operations> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchLike = options.fetch ?? globalThis.fetch.bind(globalThis);
  const defaultTimeoutMs =
    options.defaultTimeoutMs === undefined
      ? DEFAULT_FETCH_TIMEOUT_MS
      : validateTimeout(options.defaultTimeoutMs, 'defaultTimeoutMs');
  const defaultRetryPolicy = resolveRetryPolicy(options.retry, undefined);

  return {
    operations,
    async call<OperationId extends Extract<keyof Operations, string>>(
      operationId: OperationId,
      request: ZdpOperationRequest<Operations[OperationId]>,
      callOptions: ZdpCallOptions = {}
    ): Promise<ZdpOperationResponse<Operations[OperationId]>> {
      const operation = operations[operationId];
      if (operation === undefined) {
        throw new ZdpClientConfigurationError(
          `Unknown ZDP operation \`${operationId}\`.`
        );
      }

      const encoded = encodeOperationRequest(operation, request);
      const requestId = resolveRequiredId({
        explicit: callOptions.requestId,
        factory: options.requestIdFactory,
        required: operation.requestIdRequired,
        label: 'request_id'
      });
      const traceId = resolveRequiredId({
        explicit: callOptions.traceId,
        factory: options.traceIdFactory,
        required: operation.traceIdRequired,
        label: 'trace_id'
      });
      const idempotencyKey = resolveIdempotencyKey(
        operation,
        callOptions,
        options.idempotencyKeyFactory
      );
      const retryPolicy =
        callOptions.retry === undefined
          ? defaultRetryPolicy
          : resolveRetryPolicy(callOptions.retry, 'retry');
      const url = buildUrl(baseUrl, operation.path, encoded);
      const headers = await buildHeaders({
        operation,
        encoded,
        options,
        callOptions,
        requestId,
        traceId,
        idempotencyKey
      });
      const timeoutMs =
        callOptions.timeoutMs === undefined
          ? defaultTimeoutMs
          : validateTimeout(callOptions.timeoutMs, 'timeoutMs');
      const body = encodeBody(encoded, headers);
      const response = await performFetchWithRetry({
        fetchLike,
        url,
        init: buildRequestInit({
          method: operation.method,
          headers,
          body,
          signal: callOptions.signal
        }),
        timeoutMs,
        retryPolicy,
        retrySafe: isRetrySafeOperation(operation, idempotencyKey),
        successStatuses: operation.successStatuses
      });

      return decodeResponse(operation, response);
    }
  };
}

type ZdpOperationDefinitionInput<Request, Response> = ZdpOperationDefinition<
  Request,
  Response
>;

function encodeOperationRequest<Operation extends AnyZdpOperationDefinition>(
  operation: Operation,
  request: ZdpOperationRequest<Operation>
): EncodedZdpRequest {
  const encodeRequest = operation.encodeRequest as (
    value: ZdpOperationRequest<Operation>
  ) => EncodedZdpRequest;

  return encodeRequest(request);
}

function resolveRequiredId(input: {
  readonly explicit: string | undefined;
  readonly factory: (() => string) | undefined;
  readonly required: boolean;
  readonly label: string;
}): string | null {
  const value = input.explicit ?? input.factory?.();
  if (value !== undefined && value.trim().length > 0) {
    return value;
  }

  if (!input.required) {
    return null;
  }

  throw new ZdpClientConfigurationError(
    `ZDP operation requires ${input.label}; pass it explicitly or configure a factory.`
  );
}

function resolveIdempotencyKey(
  operation: AnyZdpOperationDefinition,
  options: ZdpCallOptions,
  factory: ((operationId: string) => string) | undefined
): string | null {
  const explicit = options.idempotencyKey;
  if (explicit !== undefined && explicit.trim().length > 0) {
    return explicit;
  }

  if (operation.idempotency !== 'not_required' && factory !== undefined) {
    const generated = factory(operation.operationId);
    if (typeof generated !== 'string' || generated.trim().length === 0) {
      throw new ZdpClientConfigurationError(
        `Idempotency key factory returned an empty value for \`${operation.operationId}\`.`
      );
    }
    return generated;
  }

  if (operation.idempotency === 'required_idempotency_key') {
    throw new ZdpClientConfigurationError(
      `ZDP operation \`${operation.operationId}\` requires an idempotency key.`
    );
  }

  return null;
}

async function buildHeaders(input: {
  readonly operation: AnyZdpOperationDefinition;
  readonly encoded: EncodedZdpRequest;
  readonly options: ZdpTypedFetchClientOptions;
  readonly callOptions: ZdpCallOptions;
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly idempotencyKey: string | null;
}): Promise<Headers> {
  const headers = new Headers();

  appendHeaderRecord(headers, input.options.defaultHeaders);
  appendHeaderRecord(headers, input.encoded.headers);
  appendHeaderRecord(headers, input.callOptions.headers);

  if (input.requestId !== null) {
    headers.set(REQUEST_ID_HEADER, input.requestId);
  }
  if (input.traceId !== null) {
    headers.set(TRACE_ID_HEADER, input.traceId);
  }
  if (input.idempotencyKey !== null) {
    headers.set(IDEMPOTENCY_KEY_HEADER, input.idempotencyKey);
  }

  if (input.operation.authRequired) {
    const token = await input.options.getAccessToken?.();
    if (token === undefined || token === null || token.trim().length === 0) {
      throw new ZdpClientConfigurationError(
        `ZDP operation \`${input.operation.operationId}\` requires an access token provider.`
      );
    }
    headers.set(AUTHORIZATION_HEADER, `Bearer ${token}`);
  }

  return headers;
}

function appendHeaderRecord(
  headers: Headers,
  values: Readonly<Record<string, string>> | undefined
): void {
  if (values === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(values)) {
    headers.set(key, value);
  }
}

function encodeBody(
  encoded: EncodedZdpRequest,
  headers: Headers
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(encoded, 'body')) {
    return undefined;
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', JSON_CONTENT_TYPE);
  }

  return JSON.stringify(encoded.body);
}

async function performFetchWithRetry(input: {
  readonly fetchLike: ZdpFetchLike;
  readonly url: URL;
  readonly init: RequestInit;
  readonly timeoutMs: number;
  readonly retryPolicy: ResolvedRetryPolicy;
  readonly retrySafe: boolean;
  readonly successStatuses: readonly number[];
}): Promise<Response> {
  let attempt = 1;

  while (true) {
    let response: Response;
    try {
      response = await performFetch({
        fetchLike: input.fetchLike,
        url: input.url,
        init: input.init,
        timeoutMs: input.timeoutMs
      });
    } catch (error) {
      if (
        !shouldRetryTransportError({
          error,
          attempt,
          retryPolicy: input.retryPolicy,
          retrySafe: input.retrySafe,
          callerSignal: input.init.signal ?? null
        })
      ) {
        throw error;
      }

      await waitForRetry(
        calculateBackoffDelayMs(attempt, input.retryPolicy),
        input.init.signal ?? null
      );
      attempt += 1;
      continue;
    }

    if (
      !input.retrySafe ||
      attempt >= input.retryPolicy.maxAttempts ||
      input.successStatuses.includes(response.status) ||
      !RETRYABLE_RESPONSE_STATUSES.has(response.status)
    ) {
      return response;
    }

    const serverDelayMs = await readServerRetryDelayMs(response);
    if (
      serverDelayMs !== null &&
      serverDelayMs > input.retryPolicy.maxRetryAfterMs
    ) {
      return response;
    }

    await discardResponse(response);
    await waitForRetry(
      serverDelayMs ?? calculateBackoffDelayMs(attempt, input.retryPolicy),
      input.init.signal ?? null
    );
    attempt += 1;
  }
}

async function performFetch(input: {
  readonly fetchLike: ZdpFetchLike;
  readonly url: URL;
  readonly init: RequestInit;
  readonly timeoutMs: number;
}): Promise<Response> {
  const timeoutController = new AbortController();
  const mergedSignal = mergeAbortSignals(
    input.init.signal ?? null,
    timeoutController.signal
  );
  const timeout = setTimeout(() => timeoutController.abort(), input.timeoutMs);

  try {
    return await input.fetchLike(input.url, {
      ...input.init,
      signal: mergedSignal.signal
    });
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new ZdpRequestTimeoutError('ZDP request timed out.', error);
    }
    if (input.init.signal?.aborted === true) {
      throw new ZdpRequestAbortedError('ZDP request was aborted.', error);
    }
    throw new ZdpTransportError('ZDP request failed before a response.', error);
  } finally {
    clearTimeout(timeout);
    mergedSignal.cleanup();
  }
}

function shouldRetryTransportError(input: {
  readonly error: unknown;
  readonly attempt: number;
  readonly retryPolicy: ResolvedRetryPolicy;
  readonly retrySafe: boolean;
  readonly callerSignal: AbortSignal | null;
}): boolean {
  if (
    !input.retrySafe ||
    input.attempt >= input.retryPolicy.maxAttempts ||
    input.callerSignal?.aborted === true ||
    input.error instanceof ZdpRequestAbortedError
  ) {
    return false;
  }

  return input.error instanceof ZdpTransportError;
}

function isRetrySafeOperation(
  operation: AnyZdpOperationDefinition,
  idempotencyKey: string | null
): boolean {
  if (operation.method === 'GET') {
    return true;
  }

  return operation.idempotency !== 'not_required' && idempotencyKey !== null;
}

function resolveRetryPolicy(
  configured: false | ZdpRetryOptions | undefined,
  label: string | undefined
): ResolvedRetryPolicy {
  if (configured === undefined || configured === false) {
    return {
      maxAttempts: 1,
      baseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
      maxDelayMs: DEFAULT_RETRY_MAX_DELAY_MS,
      maxRetryAfterMs: DEFAULT_MAX_RETRY_AFTER_MS
    };
  }

  const prefix = label ?? 'retry';
  const maxAttempts = validateIntegerInRange(
    configured.maxAttempts,
    `${prefix}.maxAttempts`,
    1,
    MAX_RETRY_ATTEMPTS
  );
  const baseDelayMs = validateIntegerInRange(
    configured.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    `${prefix}.baseDelayMs`,
    0,
    MAX_TIMER_DELAY_MS
  );
  const maxDelayMs = validateIntegerInRange(
    configured.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS,
    `${prefix}.maxDelayMs`,
    0,
    MAX_TIMER_DELAY_MS
  );
  const maxRetryAfterMs = validateIntegerInRange(
    configured.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS,
    `${prefix}.maxRetryAfterMs`,
    0,
    MAX_TIMER_DELAY_MS
  );

  if (maxDelayMs < baseDelayMs) {
    throw new ZdpClientConfigurationError(
      `${prefix}.maxDelayMs must be greater than or equal to ${prefix}.baseDelayMs.`
    );
  }

  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    maxRetryAfterMs
  };
}

function validateIntegerInRange(
  value: number,
  label: string,
  minimum: number,
  maximum: number
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ZdpClientConfigurationError(
      `${label} must be an integer between ${minimum} and ${maximum}.`
    );
  }

  return value;
}

function calculateBackoffDelayMs(
  attempt: number,
  policy: ResolvedRetryPolicy
): number {
  if (policy.baseDelayMs === 0 || policy.maxDelayMs === 0) {
    return 0;
  }

  const exponentialCeiling = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** Math.max(0, attempt - 1)
  );

  return Math.floor(Math.random() * (exponentialCeiling + 1));
}

async function readServerRetryDelayMs(
  response: Response
): Promise<number | null> {
  const headerDelayMs = parseRetryAfterHeaderMs(
    response.headers.get(RETRY_AFTER_HEADER)
  );
  if (headerDelayMs !== null) {
    return headerDelayMs;
  }

  try {
    const payload: unknown = await response.clone().json();
    if (!isRecord(payload)) {
      return null;
    }

    const seconds = payload.retry_after_seconds;
    if (
      typeof seconds !== 'number' ||
      !Number.isInteger(seconds) ||
      seconds < 0
    ) {
      return null;
    }

    return secondsToMilliseconds(seconds);
  } catch {
    return null;
  }
}

function parseRetryAfterHeaderMs(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const seconds = Number.parseInt(normalized, 10);
    return Number.isSafeInteger(seconds)
      ? secondsToMilliseconds(seconds)
      : MAX_TIMER_DELAY_MS + 1;
  }

  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return clampServerDelayMs(Math.max(0, timestamp - Date.now()));
}

function secondsToMilliseconds(seconds: number): number {
  if (seconds > MAX_TIMER_DELAY_MS / 1_000) {
    return MAX_TIMER_DELAY_MS + 1;
  }

  return seconds * 1_000;
}

function clampServerDelayMs(value: number): number {
  return value > MAX_TIMER_DELAY_MS ? MAX_TIMER_DELAY_MS + 1 : value;
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // A failed body cancellation must not turn a retryable response into a new error.
  }
}

async function waitForRetry(
  delayMs: number,
  signal: AbortSignal | null
): Promise<void> {
  if (signal?.aborted === true) {
    throw new ZdpRequestAbortedError(
      'ZDP request was aborted during retry backoff.',
      signal.reason
    );
  }
  if (delayMs === 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(
        new ZdpRequestAbortedError(
          'ZDP request was aborted during retry backoff.',
          signal?.reason
        )
      );
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function buildRequestInit(input: {
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | undefined;
  readonly signal: AbortSignal | undefined;
}): RequestInit {
  const init: RequestInit = {
    method: input.method,
    headers: input.headers
  };

  if (input.body !== undefined) {
    init.body = input.body;
  }
  if (input.signal !== undefined) {
    init.signal = input.signal;
  }

  return init;
}

async function decodeResponse<Operation extends AnyZdpOperationDefinition>(
  operation: Operation,
  response: Response
): Promise<ZdpOperationResponse<Operation>> {
  const payload = await readJsonResponse(response);

  if (!operation.successStatuses.includes(response.status)) {
    try {
      throw new ZdpApiError({
        status: response.status,
        envelope: parseZdpErrorEnvelope(payload)
      });
    } catch (error) {
      if (error instanceof ZdpApiError) {
        throw error;
      }
      if (error instanceof ZdpProtocolError) {
        throw new ZdpProtocolError({
          status: response.status,
          message: error.message
        });
      }
      throw error;
    }
  }

  try {
    const decode = operation.decodeResponse as (
      value: unknown,
      context: ZdpResponseContext
    ) => ZdpOperationResponse<Operation>;

    return decode(payload, { status: response.status });
  } catch (error) {
    throw new ZdpProtocolError({
      status: response.status,
      message:
        error instanceof Error
          ? error.message
          : 'ZDP response decoder rejected the response.'
    });
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ZdpProtocolError({
      status: response.status,
      message: 'ZDP response body must be valid JSON when present.'
    });
  }
}

function buildUrl(
  baseUrl: URL,
  pathTemplate: string,
  encoded: EncodedZdpRequest
): URL {
  validateOperationPath(pathTemplate);
  const path = pathTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = encoded.pathParams?.[key];
    if (value === undefined) {
      throw new ZdpClientConfigurationError(
        `Missing path parameter \`${key}\` for \`${pathTemplate}\`.`
      );
    }

    return encodeURIComponent(String(value));
  });
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new ZdpClientConfigurationError(
      `Operation path \`${pathTemplate}\` must stay on the configured API origin.`
    );
  }

  if (encoded.query !== undefined) {
    for (const [key, value] of Object.entries(encoded.query)) {
      appendQueryValue(url, key, value);
    }
  }

  return url;
}

function validateOperationPath(path: string): void {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#')
  ) {
    throw new ZdpClientConfigurationError(
      `Operation path \`${path}\` must be a root-relative URL path without a query or fragment.`
    );
  }
}

function appendQueryValue(url: URL, key: string, value: ZdpQueryValue): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      url.searchParams.append(key, String(item));
    }
    return;
  }

  url.searchParams.set(key, String(value));
}

function normalizeBaseUrl(baseUrl: string): URL {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      throw new Error('Only HTTPS or localhost API base URLs are allowed.');
    }
    return url;
  } catch (error) {
    throw new ZdpClientConfigurationError(
      error instanceof Error ? error.message : 'Invalid ZDP API base URL.'
    );
  }
}

function validateTimeout(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ZdpClientConfigurationError(`${label} must be a positive integer.`);
  }

  return value;
}

function mergeAbortSignals(
  callerSignal: AbortSignal | null,
  timeoutSignal: AbortSignal
): MergedAbortSignal {
  if (callerSignal === null) {
    return {
      signal: timeoutSignal,
      cleanup: () => undefined
    };
  }

  const controller = new AbortController();
  const abortFromCaller = (): void => controller.abort(callerSignal.reason);
  const abortFromTimeout = (): void => controller.abort(timeoutSignal.reason);
  const cleanup = (): void => {
    callerSignal.removeEventListener('abort', abortFromCaller);
    timeoutSignal.removeEventListener('abort', abortFromTimeout);
  };

  if (callerSignal.aborted) {
    abortFromCaller();
    return { signal: controller.signal, cleanup };
  }
  if (timeoutSignal.aborted) {
    abortFromTimeout();
    return { signal: controller.signal, cleanup };
  }

  callerSignal.addEventListener('abort', abortFromCaller, { once: true });
  timeoutSignal.addEventListener('abort', abortFromTimeout, { once: true });

  return { signal: controller.signal, cleanup };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type {
  EncodedZdpRequest,
  ZdpCallOptions,
  ZdpFetchLike,
  ZdpIdempotencyKeyFactory,
  ZdpIdempotencyPolicy,
  ZdpOperationDefinition,
  ZdpOperationMap,
  ZdpOperationRequest,
  ZdpOperationResponse,
  ZdpResponseContext,
  ZdpRetryOptions,
  ZdpTypedFetchClient,
  ZdpTypedFetchClientOptions
} from './types';
