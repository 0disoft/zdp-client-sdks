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

export interface ZdpOperationDefinition<Request, Response> {
  readonly operationId: string;
  readonly method: ZdpHttpMethod;
  readonly path: string;
  readonly successStatuses: readonly number[];
  readonly authRequired: boolean;
  readonly idempotency: ZdpIdempotencyPolicy;
  readonly requestIdRequired: boolean;
  readonly traceIdRequired: boolean;
  readonly errorCodes: readonly string[];
  readonly encodeRequest: (request: Request) => EncodedZdpRequest;
  readonly decodeResponse: (response: unknown) => Response;
}

export type AnyZdpOperationDefinition = ZdpOperationDefinition<never, unknown>;

export type ZdpOperationRequest<Operation> =
  Operation extends ZdpOperationDefinition<infer Request, unknown>
    ? Request
    : never;

export type ZdpOperationResponse<Operation> =
  Operation extends ZdpOperationDefinition<never, infer Response>
    ? Response
    : never;

export type ZdpOperationMap = Readonly<Record<string, AnyZdpOperationDefinition>>;

export type ZdpFetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type ZdpAccessTokenProvider = () => string | null | Promise<string | null>;

export type ZdpIdFactory = () => string;

export interface ZdpTypedFetchClientOptions {
  readonly baseUrl: string;
  readonly fetch?: ZdpFetchLike;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  readonly defaultTimeoutMs?: number;
  readonly getAccessToken?: ZdpAccessTokenProvider;
  readonly requestIdFactory?: ZdpIdFactory;
  readonly traceIdFactory?: ZdpIdFactory;
}

export interface ZdpCallOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly idempotencyKey?: string;
}

export interface ZdpTypedFetchClient<Operations extends ZdpOperationMap> {
  readonly operations: Operations;
  call<OperationId extends Extract<keyof Operations, string>>(
    operationId: OperationId,
    request: ZdpOperationRequest<Operations[OperationId]>,
    options?: ZdpCallOptions
  ): Promise<ZdpOperationResponse<Operations[OperationId]>>;
}
