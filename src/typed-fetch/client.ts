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
  ZdpTypedFetchClient,
  ZdpTypedFetchClientOptions
} from './types';

const REQUEST_ID_HEADER = 'x-request-id';
const TRACE_ID_HEADER = 'x-trace-id';
const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const AUTHORIZATION_HEADER = 'authorization';
const JSON_CONTENT_TYPE = 'application/json';
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * mf:anchor zdp.client-sdks.typed-fetch-runtime
 * purpose: Locate typed fetch runtime for request metadata, auth headers, idempotency, timeout, and errors.
 * search: typed fetch, request metadata, authorization, idempotency, timeout, error envelope
 * invariant: request_id, trace_id, access token, and idempotency values are enforced before fetch.
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
      const idempotencyKey = resolveIdempotencyKey(operation, callOptions);
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
      const response = await performFetch({
        fetchLike,
        url,
        init: buildRequestInit({
          method: operation.method,
          headers,
          body,
          signal: callOptions.signal
        }),
        timeoutMs
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
  options: ZdpCallOptions
): string | null {
  const value = options.idempotencyKey;
  if (value !== undefined && value.trim().length > 0) {
    return value;
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

async function performFetch(input: {
  readonly fetchLike: ZdpFetchLike;
  readonly url: URL;
  readonly init: RequestInit;
  readonly timeoutMs: number;
}): Promise<Response> {
  const timeoutController = new AbortController();
  const combinedSignal = mergeAbortSignals(
    input.init.signal ?? null,
    timeoutController.signal
  );
  const timeout = setTimeout(() => timeoutController.abort(), input.timeoutMs);

  try {
    return await input.fetchLike(input.url, {
      ...input.init,
      signal: combinedSignal
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
  }
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
      value: unknown
    ) => ZdpOperationResponse<Operation>;

    return decode(payload);
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

  if (encoded.query !== undefined) {
    for (const [key, value] of Object.entries(encoded.query)) {
      appendQueryValue(url, key, value);
    }
  }

  return url;
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
): AbortSignal {
  if (callerSignal === null) {
    return timeoutSignal;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (callerSignal.aborted || timeoutSignal.aborted) {
    abort();
    return controller.signal;
  }

  callerSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });

  return controller.signal;
}

export type {
  EncodedZdpRequest,
  ZdpCallOptions,
  ZdpFetchLike,
  ZdpIdempotencyPolicy,
  ZdpOperationDefinition,
  ZdpOperationMap,
  ZdpOperationRequest,
  ZdpOperationResponse,
  ZdpTypedFetchClient,
  ZdpTypedFetchClientOptions
} from './types';
