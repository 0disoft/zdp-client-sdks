import {
  ZDP_API_SCHEMA_MODEL_MAP,
  ZDP_TYPED_FETCH_OPERATION_MAP,
  createZdpApiClient
} from './api-operations';
import type { ZdpApiOperationId } from './api-operations';
import { ZDP_API_SCHEMA_RUNTIME_TYPE_MAP } from './api-model-runtime';
import type {
  ZdpApiRuntimeFieldDescriptor,
  ZdpApiSchemaTypeMap,
  ZdpJsonValue
} from './api-models';
import {
  ZdpClientConfigurationError,
  ZdpProtocolError
} from './errors';
import type {
  EncodedZdpRequest,
  ZdpCallOptions,
  ZdpQueryValue,
  ZdpTypedFetchClientOptions
} from './types';

const PATH_PARAMETER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

type ApiOperationMap = typeof ZDP_TYPED_FETCH_OPERATION_MAP;

type RequestSchemaRef<OperationId extends ZdpApiOperationId> =
  ApiOperationMap[OperationId]['requestSchemaRef'] & keyof ZdpApiSchemaTypeMap;

type ResponseSchemaRef<OperationId extends ZdpApiOperationId> =
  ApiOperationMap[OperationId]['responseSchemaRef'];

type PathParameterNames<Path extends string> =
  Path extends `${string}{${infer Parameter}}${infer Rest}`
    ? Parameter | PathParameterNames<Rest>
    : never;

type PathParameters<Path extends string> = [PathParameterNames<Path>] extends [
  never
]
  ? Readonly<Record<never, never>>
  : Readonly<Record<PathParameterNames<Path>, string>>;

type Simplify<Value> = Readonly<{ [Key in keyof Value]: Value[Key] }>;

export type ZdpApiRequest<OperationId extends ZdpApiOperationId> = Simplify<
  ZdpApiSchemaTypeMap[RequestSchemaRef<OperationId>] &
    PathParameters<ApiOperationMap[OperationId]['path']>
>;

export type ZdpApiResponse<OperationId extends ZdpApiOperationId> =
  ResponseSchemaRef<OperationId> extends keyof ZdpApiSchemaTypeMap
    ? ZdpApiSchemaTypeMap[ResponseSchemaRef<OperationId>]
    : undefined;

export type ZdpApiCallArguments<OperationId extends ZdpApiOperationId> =
  keyof ZdpApiRequest<OperationId> extends never
    ? readonly [options?: ZdpCallOptions]
    : readonly [
        request: ZdpApiRequest<OperationId>,
        options?: ZdpCallOptions
      ];

export type ZdpApiOperationMethod<OperationId extends ZdpApiOperationId> = (
  ...args: ZdpApiCallArguments<OperationId>
) => Promise<ZdpApiResponse<OperationId>>;

type SnakeToCamel<Value extends string> =
  Value extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : Value;

type OperationTree<Path extends string, Method> =
  Path extends `${infer Head}.${infer Tail}`
    ? Readonly<{
        [Key in SnakeToCamel<Head>]: OperationTree<Tail, Method>;
      }>
    : Readonly<{ [Key in SnakeToCamel<Path>]: Method }>;

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

type ZdpApiOperationTree = UnionToIntersection<
  {
    [OperationId in ZdpApiOperationId]: OperationTree<
      OperationId,
      ZdpApiOperationMethod<OperationId>
    >;
  }[ZdpApiOperationId]
>;

export type ZdpApiCall = <OperationId extends ZdpApiOperationId>(
  operationId: OperationId,
  ...args: ZdpApiCallArguments<OperationId>
) => Promise<ZdpApiResponse<OperationId>>;

export type ZdpApiClient = ZdpApiOperationTree &
  Readonly<{
    raw: ReturnType<typeof createZdpApiClient>;
    call: ZdpApiCall;
  }>;

/**
 * Creates the ergonomic TypeScript SDK facade.
 *
 * Operation ids become camel-cased namespaces, while request payloads stay in
 * the API contract's snake_case wire shape. Path and query encoding is derived
 * from the generated operation metadata instead of being rebuilt by callers.
 */
export function createZdpClient(
  options: ZdpTypedFetchClientOptions
): ZdpApiClient {
  const raw = createZdpApiClient(options);
  const rawCall = raw.call as (
    operationId: ZdpApiOperationId,
    request: EncodedZdpRequest,
    options?: ZdpCallOptions
  ) => Promise<unknown>;
  const namespaces: Record<string, unknown> = {};

  const invoke = async (
    operationId: ZdpApiOperationId,
    args: readonly unknown[]
  ): Promise<unknown> => {
    const operation = ZDP_TYPED_FETCH_OPERATION_MAP[operationId];
    const requestSchema = ZDP_API_SCHEMA_MODEL_MAP[operation.requestSchemaRef];
    const pathParameters = readPathParameters(operation.path);
    const hasRequest =
      requestSchema.requiredFields.length > 0 ||
      requestSchema.optionalFields.length > 0 ||
      pathParameters.length > 0;
    const maximumArguments = hasRequest ? 2 : 1;
    if (args.length > maximumArguments) {
      throw new ZdpClientConfigurationError(
        `ZDP operation \`${operationId}\` received too many arguments.`
      );
    }

    const request = hasRequest ? args[0] : {};
    const callOptions = (hasRequest ? args[1] : args[0]) as
      | ZdpCallOptions
      | undefined;

    if (!isRecord(request)) {
      throw new ZdpClientConfigurationError(
        `ZDP operation \`${operationId}\` requires a request object.`
      );
    }

    validateRequestPayload(
      operationId,
      operation.requestSchemaRef,
      request,
      pathParameters
    );
    const encoded = encodeDomainRequest(
      operation.method,
      request,
      pathParameters
    );
    const response = await rawCall(operationId, encoded, callOptions);

    if (operation.responseSchemaRef === null) {
      return undefined;
    }

    validateResponsePayload(
      operationId,
      operation.responseSchemaRef,
      response
    );
    return response;
  };

  const call = ((operationId: ZdpApiOperationId, ...args: unknown[]) =>
    invoke(operationId, args)) as ZdpApiCall;

  for (const operationId of Object.keys(
    ZDP_TYPED_FETCH_OPERATION_MAP
  ) as ZdpApiOperationId[]) {
    installOperationMethod(namespaces, operationId, (...args: unknown[]) =>
      invoke(operationId, args)
    );
  }

  return Object.assign(namespaces, { raw, call }) as ZdpApiClient;
}

function installOperationMethod(
  root: Record<string, unknown>,
  operationId: ZdpApiOperationId,
  method: (...args: unknown[]) => Promise<unknown>
): void {
  const segments = operationId.split('.').map(snakeToCamel);
  let cursor = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined) {
      throw new ZdpClientConfigurationError(
        `Invalid ZDP operation id \`${operationId}\`.`
      );
    }

    const current = cursor[segment];
    if (current === undefined) {
      const child: Record<string, unknown> = {};
      cursor[segment] = child;
      cursor = child;
      continue;
    }
    if (!isRecord(current)) {
      throw new ZdpClientConfigurationError(
        `Operation namespace collision at \`${operationId}\`.`
      );
    }
    cursor = current;
  }

  const leaf = segments.at(-1);
  if (leaf === undefined || Object.hasOwn(cursor, leaf)) {
    throw new ZdpClientConfigurationError(
      `Operation method collision at \`${operationId}\`.`
    );
  }
  cursor[leaf] = method;
}

function encodeDomainRequest(
  method: string,
  request: Readonly<Record<string, unknown>>,
  pathParameters: readonly string[]
): EncodedZdpRequest {
  const pathParameterSet = new Set(pathParameters);
  const encodedPath: Record<string, string> = {};
  const payload: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(request)) {
    if (pathParameterSet.has(field)) {
      if (typeof value !== 'string' || value.length === 0) {
        throw new ZdpClientConfigurationError(
          `Path parameter \`${field}\` must be a non-empty string.`
        );
      }
      encodedPath[field] = value;
    } else {
      payload[field] = value;
    }
  }

  const encoded: {
    pathParams?: Readonly<Record<string, string>>;
    query?: Readonly<Record<string, ZdpQueryValue>>;
    body?: unknown;
  } = {};

  if (pathParameters.length > 0) {
    encoded.pathParams = encodedPath;
  }

  if (method === 'GET') {
    if (Object.keys(payload).length > 0) {
      encoded.query = encodeQuery(payload);
    }
  } else if (Object.keys(payload).length > 0) {
    encoded.body = payload;
  }

  return encoded;
}

function encodeQuery(
  payload: Readonly<Record<string, unknown>>
): Readonly<Record<string, ZdpQueryValue>> {
  const query: Record<string, ZdpQueryValue> = {};

  for (const [field, value] of Object.entries(payload)) {
    if (!isQueryValue(value)) {
      throw new ZdpClientConfigurationError(
        `GET request field \`${field}\` is not query-serializable.`
      );
    }
    query[field] = value;
  }

  return query;
}

function validateRequestPayload(
  operationId: ZdpApiOperationId,
  schemaRef: keyof typeof ZDP_API_SCHEMA_RUNTIME_TYPE_MAP,
  request: Readonly<Record<string, unknown>>,
  pathParameters: readonly string[]
): void {
  const schema = ZDP_API_SCHEMA_RUNTIME_TYPE_MAP[schemaRef];
  const allowedFields = new Set([
    ...Object.keys(schema.fieldTypes),
    ...pathParameters
  ]);

  for (const field of Object.keys(request)) {
    if (!allowedFields.has(field)) {
      throw new ZdpClientConfigurationError(
        `ZDP operation \`${operationId}\` does not accept field \`${field}\`.`
      );
    }
  }
  for (const field of pathParameters) {
    if (!Object.hasOwn(request, field)) {
      throw new ZdpClientConfigurationError(
        `ZDP operation \`${operationId}\` requires path field \`${field}\`.`
      );
    }
  }

  validateSchemaFields({
    operationId,
    schemaRef,
    value: request,
    mode: 'request'
  });
}

function validateResponsePayload(
  operationId: ZdpApiOperationId,
  schemaRef: keyof typeof ZDP_API_SCHEMA_RUNTIME_TYPE_MAP,
  response: unknown
): void {
  if (!isRecord(response)) {
    throw new ZdpProtocolError({
      status: 0,
      message: `ZDP operation \`${operationId}\` returned a non-object response.`
    });
  }

  validateSchemaFields({
    operationId,
    schemaRef,
    value: response,
    mode: 'response'
  });
}

function validateSchemaFields(input: {
  readonly operationId: ZdpApiOperationId;
  readonly schemaRef: keyof typeof ZDP_API_SCHEMA_RUNTIME_TYPE_MAP;
  readonly value: Readonly<Record<string, unknown>>;
  readonly mode: 'request' | 'response';
}): void {
  const schema = ZDP_API_SCHEMA_RUNTIME_TYPE_MAP[input.schemaRef];

  for (const field of schema.requiredFields) {
    if (!Object.hasOwn(input.value, field)) {
      throwSchemaValueError(
        input,
        `required field \`${field}\` is missing`
      );
    }
  }

  for (const [field, descriptor] of Object.entries(schema.fieldTypes)) {
    if (!Object.hasOwn(input.value, field)) {
      continue;
    }
    const value = input.value[field];
    if (!matchesFieldType(value, descriptor)) {
      throwSchemaValueError(
        input,
        `field \`${field}\` does not match ${describeFieldType(descriptor)}`
      );
    }
  }
}

function throwSchemaValueError(
  input: {
    readonly operationId: ZdpApiOperationId;
    readonly schemaRef: string;
    readonly mode: 'request' | 'response';
  },
  detail: string
): never {
  const message =
    `ZDP operation \`${input.operationId}\` ${input.mode} schema ` +
    `\`${input.schemaRef}\` ${detail}.`;

  if (input.mode === 'request') {
    throw new ZdpClientConfigurationError(message);
  }
  throw new ZdpProtocolError({ status: 0, message });
}

function matchesFieldType(
  value: unknown,
  descriptor: ZdpApiRuntimeFieldDescriptor
): boolean {
  if (typeof descriptor !== 'string') {
    return typeof value === 'string' && descriptor.enum.includes(value);
  }

  switch (descriptor) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'json':
      return isJsonValue(value, new Set());
    case 'json_object':
      return isPlainRecord(value) && isJsonValue(value, new Set());
    case 'string[]':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'json_object[]':
      return (
        Array.isArray(value) &&
        value.every(
          (item) => isPlainRecord(item) && isJsonValue(item, new Set())
        )
      );
    default:
      return typeof value === 'string';
  }
}

function describeFieldType(
  descriptor: ZdpApiRuntimeFieldDescriptor
): string {
  return typeof descriptor === 'string'
    ? descriptor
    : `enum(${descriptor.enum.join(', ')})`;
}

function isJsonValue(value: unknown, seen: Set<object>): value is ZdpJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value !== 'object') {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, seen))
    : isPlainRecord(value) &&
      Object.values(value).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

function readPathParameters(path: string): readonly string[] {
  return [...path.matchAll(PATH_PARAMETER_PATTERN)].map((match) => {
    const parameter = match[1];
    if (parameter === undefined) {
      throw new ZdpClientConfigurationError(
        `Invalid path parameter in \`${path}\`.`
      );
    }
    return parameter;
  });
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-zA-Z0-9])/g, (_match, character: string) =>
    character.toUpperCase()
  );
}

function isQueryValue(value: unknown): value is ZdpQueryValue {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
