import type { ZdpApiError } from './errors';

export type ZdpHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ZdpIdempotencyPolicy =
  | 'required_idempotency_key'
  | 'optional_idempotency_key'
  | 'not_required';

export type ZdpPathValue = string | number | boolean;

export type ZdpQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[];

export interface EncodedZdpRequest {
  readonly pathParams?: Readonly<Record<string, ZdpPathValue>>;
  readonly query?: Readonly<Record<string, ZdpQueryValue>>;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ZdpOperationDefinition<
  Request,
  Response,
  ErrorCode extends string = string
> {
  readonly operationId: string;
  readonly method: ZdpHttpMethod;
  readonly path: string;
  readonly successStatuses: readonly number[];
  readonly authRequired: boolean;
  readonly idempotency: ZdpIdempotencyPolicy;
  readonly requestIdRequired: boolean;
  readonly traceIdRequired: boolean;
  readonly errorCodes: readonly ErrorCode[];
  readonly encodeRequest: (request: Request) => EncodedZdpRequest;
  readonly decodeResponse: (
    response: unknown,
    context: ZdpResponseContext
  ) => Response;
}

export interface ZdpResponseContext {
  readonly status: number;
}

export interface ZdpRateLimitMetadata {
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly reset: string | null;
  readonly retryAfterSeconds: number | null;
}

export interface ZdpResponseMetadata {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly rateLimit: ZdpRateLimitMetadata | null;
}

export type AnyZdpOperationDefinition = ZdpOperationDefinition<
  never,
  unknown,
  string
>;

export type ZdpOperationRequest<Operation> =
  Operation extends ZdpOperationDefinition<
    infer Request,
    infer _Response,
    infer _ErrorCode
  >
    ? Request
    : never;

export type ZdpOperationResponse<Operation> =
  Operation extends ZdpOperationDefinition<
    infer _Request,
    infer Response,
    infer _ErrorCode
  >
    ? Response
    : never;

export type ZdpOperationErrorCode<Operation> =
  Operation extends ZdpOperationDefinition<
    infer _Request,
    infer _Response,
    infer ErrorCode
  >
    ? ErrorCode
    : never;

export type ZdpOperationMap = Readonly<Record<string, AnyZdpOperationDefinition>>;

export type ZdpFetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type ZdpAccessTokenProvider = () => string | null | Promise<string | null>;

export type ZdpIdFactory = () => string;

/**
 * Creates one idempotency key for a logical SDK call. The runtime invokes the
 * factory at most once and reuses the returned value for every retry attempt.
 */
export type ZdpIdempotencyKeyFactory = (operationId: string) => string;

/**
 * Bounded retry policy. `maxAttempts` counts the initial request, so `1`
 * disables retries. Automatic retries remain disabled when this option is not
 * configured.
 */
export interface ZdpRetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly maxRetryAfterMs?: number;
}

export interface ZdpTypedFetchClientOptions {
  readonly baseUrl: string;
  readonly fetch?: ZdpFetchLike;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  readonly defaultTimeoutMs?: number;
  /**
   * Maximum decoded response body bytes accepted before JSON parsing.
   * Defaults to 4 MiB and applies to both success and error responses.
   */
  readonly maxResponseBodyBytes?: number;
  readonly getAccessToken?: ZdpAccessTokenProvider;
  readonly requestIdFactory?: ZdpIdFactory;
  readonly traceIdFactory?: ZdpIdFactory;
  readonly idempotencyKeyFactory?: ZdpIdempotencyKeyFactory;
  readonly retry?: false | ZdpRetryOptions;
}

export interface ZdpCallOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly idempotencyKey?: string;
  /** Overrides the client response body byte limit for this call. */
  readonly maxResponseBodyBytes?: number;
  /** Overrides the client retry policy for this call. */
  readonly retry?: false | ZdpRetryOptions;
}

export type ZdpSafeCallResult<
  Response,
  ErrorCode extends string = string
> =
  | Readonly<{
      ok: true;
      data: Response;
      response: ZdpResponseMetadata;
    }>
  | Readonly<{
      ok: false;
      error: ZdpApiError<ErrorCode>;
      response: ZdpResponseMetadata;
    }>;

export interface ZdpTypedFetchClient<Operations extends ZdpOperationMap> {
  readonly operations: Operations;
  call<OperationId extends Extract<keyof Operations, string>>(
    operationId: OperationId,
    request: ZdpOperationRequest<Operations[OperationId]>,
    options?: ZdpCallOptions
  ): Promise<ZdpOperationResponse<Operations[OperationId]>>;
}

export interface ZdpSafeTypedFetchClient<Operations extends ZdpOperationMap>
  extends ZdpTypedFetchClient<Operations> {
  safeCall<OperationId extends Extract<keyof Operations, string>>(
    operationId: OperationId,
    request: ZdpOperationRequest<Operations[OperationId]>,
    options?: ZdpCallOptions
  ): Promise<
    ZdpSafeCallResult<
      ZdpOperationResponse<Operations[OperationId]>,
      ZdpOperationErrorCode<Operations[OperationId]>
    >
  >;
}
