import {
  ZdpApiError,
  ZdpClientConfigurationError,
  ZdpProtocolError
} from './errors';
import type { ZdpErrorEnvelope } from './errors';
import { createZdpTypedFetchClient } from './client';
import type {
  AnyZdpOperationDefinition,
  ZdpCallOptions,
  ZdpFetchLike,
  ZdpOperationErrorCode,
  ZdpOperationMap,
  ZdpOperationRequest,
  ZdpOperationResponse,
  ZdpResponseMetadata,
  ZdpSafeCallResult,
  ZdpSafeTypedFetchClient,
  ZdpTypedFetchClientOptions
} from './types';

const REQUEST_ID_HEADER = 'x-request-id';
const TRACE_ID_HEADER = 'x-trace-id';
const RATE_LIMIT_LIMIT_HEADERS = ['ratelimit-limit', 'x-ratelimit-limit'] as const;
const RATE_LIMIT_REMAINING_HEADERS = [
  'ratelimit-remaining',
  'x-ratelimit-remaining'
] as const;
const RATE_LIMIT_RESET_HEADERS = ['ratelimit-reset', 'x-ratelimit-reset'] as const;
const SAFE_RESPONSE_HEADERS = new Set([
  'content-language',
  'content-type',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'x-request-id',
  'x-trace-id'
]);

interface CapturedIdentifiers {
  requestId: string | null;
  traceId: string | null;
}

/**
 * Adds operation-typed API error results and response metadata without
 * changing the throwing semantics of the base typed fetch client.
 *
 * Each safe call creates an isolated response-capturing client so concurrent
 * calls cannot overwrite each other's response metadata. The wrapped client
 * retains the existing timeout, cancellation, auth, and bounded retry logic.
 */
export function createZdpSafeTypedFetchClient<
  const Operations extends ZdpOperationMap
>(
  operations: Operations,
  options: ZdpTypedFetchClientOptions
): ZdpSafeTypedFetchClient<Operations> {
  const baseClient = createZdpTypedFetchClient(operations, options);

  return {
    ...baseClient,
    async safeCall<OperationId extends Extract<keyof Operations, string>>(
      operationId: OperationId,
      request: ZdpOperationRequest<Operations[OperationId]>,
      callOptions: ZdpCallOptions = {}
    ): Promise<
      ZdpSafeCallResult<
        ZdpOperationResponse<Operations[OperationId]>,
        ZdpOperationErrorCode<Operations[OperationId]>
      >
    > {
      const operation = operations[operationId];
      if (operation === undefined) {
        throw new ZdpClientConfigurationError(
          `Unknown ZDP operation \`${operationId}\`.`
        );
      }

      let finalResponse: Response | null = null;
      const fetchLike = options.fetch ?? globalThis.fetch.bind(globalThis);
      const identifiers: CapturedIdentifiers = {
        requestId: normalizeIdentifier(callOptions.requestId),
        traceId: normalizeIdentifier(callOptions.traceId)
      };
      const capturingFetch: ZdpFetchLike = async (input, init) => {
        const response = await fetchLike(input, init);
        finalResponse = response;
        return response;
      };
      const callClient = createZdpTypedFetchClient(
        operations,
        createCapturingClientOptions(options, capturingFetch, identifiers)
      );

      try {
        const data = await callClient.call(operationId, request, callOptions);
        const response = requireResponseMetadata(finalResponse, {
          requestId: identifiers.requestId,
          traceId: identifiers.traceId,
          retryAfterSeconds: undefined,
          preferProvidedIds: false
        });

        return { ok: true, data, response };
      } catch (error) {
        if (!(error instanceof ZdpApiError)) {
          throw error;
        }

        const response = requireResponseMetadata(finalResponse, {
          requestId: error.requestId,
          traceId: error.traceId,
          retryAfterSeconds: error.retryAfterSeconds,
          preferProvidedIds: true
        });
        const declaredCodes: readonly string[] = operation.errorCodes;
        if (!declaredCodes.includes(error.code)) {
          throw new ZdpProtocolError({
            status: response.status,
            message:
              `ZDP operation \`${operation.operationId}\` returned undeclared ` +
              `error code \`${error.code}\`.`,
            response
          });
        }

        const typedError = copyApiError(
          error,
          response,
          error.code as ZdpOperationErrorCode<Operations[OperationId]>
        );
        return { ok: false, error: typedError, response };
      }
    }
  };
}

function createCapturingClientOptions(
  options: ZdpTypedFetchClientOptions,
  fetch: ZdpFetchLike,
  identifiers: CapturedIdentifiers
): ZdpTypedFetchClientOptions {
  return {
    ...options,
    fetch,
    ...(options.requestIdFactory === undefined
      ? {}
      : {
          requestIdFactory: (): string => {
            const value = options.requestIdFactory?.() ?? '';
            identifiers.requestId = normalizeIdentifier(value);
            return value;
          }
        }),
    ...(options.traceIdFactory === undefined
      ? {}
      : {
          traceIdFactory: (): string => {
            const value = options.traceIdFactory?.() ?? '';
            identifiers.traceId = normalizeIdentifier(value);
            return value;
          }
        })
  };
}

function normalizeIdentifier(value: string | undefined): string | null {
  return value !== undefined && value.trim().length > 0 ? value : null;
}

function copyApiError<Code extends string>(
  error: ZdpApiError,
  response: ZdpResponseMetadata,
  code: Code
): ZdpApiError<Code> {
  const envelope: {
    code: Code;
    message: string;
    requestId: string;
    traceId: string;
    details?: unknown;
    retryAfterSeconds?: number;
    documentationUrl?: string;
  } = {
    code,
    message: error.message,
    requestId: error.requestId,
    traceId: error.traceId
  };

  if (error.details !== undefined) {
    envelope.details = error.details;
  }
  if (error.retryAfterSeconds !== undefined) {
    envelope.retryAfterSeconds = error.retryAfterSeconds;
  }
  if (error.documentationUrl !== undefined) {
    envelope.documentationUrl = error.documentationUrl;
  }

  return new ZdpApiError<Code>({
    status: response.status,
    envelope: envelope as ZdpErrorEnvelope<Code>,
    response
  });
}

function requireResponseMetadata(
  response: Response | null,
  input: {
    readonly requestId: string | null;
    readonly traceId: string | null;
    readonly retryAfterSeconds: number | undefined;
    readonly preferProvidedIds: boolean;
  }
): ZdpResponseMetadata {
  if (response === null) {
    throw new ZdpProtocolError({
      status: 0,
      message: 'ZDP request completed without a capturable HTTP response.'
    });
  }

  return createResponseMetadata(response, input);
}

function createResponseMetadata(
  response: Response,
  input: {
    readonly requestId: string | null;
    readonly traceId: string | null;
    readonly retryAfterSeconds: number | undefined;
    readonly preferProvidedIds: boolean;
  }
): ZdpResponseMetadata {
  const headerRequestId = readNonEmptyHeader(response.headers, [
    REQUEST_ID_HEADER
  ]);
  const headerTraceId = readNonEmptyHeader(response.headers, [TRACE_ID_HEADER]);
  const requestId = input.preferProvidedIds
    ? input.requestId ?? headerRequestId
    : headerRequestId ?? input.requestId;
  const traceId = input.preferProvidedIds
    ? input.traceId ?? headerTraceId
    : headerTraceId ?? input.traceId;
  const limit = readNonNegativeIntegerHeader(
    response.headers,
    RATE_LIMIT_LIMIT_HEADERS
  );
  const remaining = readNonNegativeIntegerHeader(
    response.headers,
    RATE_LIMIT_REMAINING_HEADERS
  );
  const reset = readNonEmptyHeader(response.headers, RATE_LIMIT_RESET_HEADERS);
  const retryAfterSeconds =
    input.retryAfterSeconds ?? readRetryAfterSeconds(response.headers);
  const rateLimit =
    limit === null &&
    remaining === null &&
    reset === null &&
    retryAfterSeconds === null
      ? null
      : Object.freeze({ limit, remaining, reset, retryAfterSeconds });

  return Object.freeze({
    status: response.status,
    headers: snapshotResponseHeaders(response.headers),
    requestId,
    traceId,
    rateLimit
  });
}

function snapshotResponseHeaders(
  headers: Headers
): Readonly<Record<string, string>> {
  const entries: Array<readonly [string, string]> = [];
  headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (SAFE_RESPONSE_HEADERS.has(normalizedKey)) {
      entries.push([normalizedKey, value]);
    }
  });
  return Object.freeze(Object.fromEntries(entries));
}

function readNonEmptyHeader(
  headers: Headers,
  names: readonly string[]
): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function readNonNegativeIntegerHeader(
  headers: Headers,
  names: readonly string[]
): number | null {
  const value = readNonEmptyHeader(headers, names);
  if (value === null || !/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readRetryAfterSeconds(headers: Headers): number | null {
  const value = readNonEmptyHeader(headers, ['retry-after']);
  if (value === null) {
    return null;
  }
  if (/^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000));
}
