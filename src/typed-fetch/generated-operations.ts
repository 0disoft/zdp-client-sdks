import { createZdpTypedFetchClient, defineZdpOperation, defineZdpOperations } from './client';
import {
  ZdpClientConfigurationError,
  ZdpProtocolError
} from './errors';
import type {
  EncodedZdpRequest,
  ZdpHttpMethod,
  ZdpIdempotencyPolicy,
  ZdpOperationDefinition,
  ZdpResponseContext,
  ZdpTypedFetchClient,
  ZdpTypedFetchClientOptions
} from './types';

const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const SUPPORTED_IDEMPOTENCY_POLICIES = [
  'required_idempotency_key',
  'optional_idempotency_key',
  'not_required'
] as const;

export interface ZdpGeneratedOperationMetadata {
  readonly operationId: string;
  readonly method: ZdpHttpMethod;
  readonly path: string;
  readonly successStatuses: readonly number[];
  readonly requestSchemaRef: string;
  readonly responseSchemaRef: string | null;
  readonly responseBodyMode: 'schema' | 'none';
  readonly authRequired: boolean;
  readonly idempotency: ZdpIdempotencyPolicy;
  readonly requestIdRequired: boolean;
  readonly traceIdRequired: boolean;
  readonly errorCodes: readonly string[];
}

export type ZdpGeneratedSchemaKind = 'request' | 'response';

export interface ZdpGeneratedSchemaModel {
  readonly schemaRef: string;
  readonly schemaId: string;
  readonly sourceContract: string;
  readonly serviceId: string;
  readonly ownerBoundary: string;
  readonly status: string;
  readonly kind: ZdpGeneratedSchemaKind;
  readonly carriesSecretMaterial: boolean;
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
  readonly secretFields: readonly string[];
  readonly sessionEffect: string | null;
}

export type ZdpGeneratedSchemaModelMap = Readonly<
  Record<string, ZdpGeneratedSchemaModel>
>;

export type ZdpGeneratedSchemaPayload<
  Model extends ZdpGeneratedSchemaModel
> = Readonly<
  Record<Model['requiredFields'][number], unknown> &
    Partial<Record<Model['optionalFields'][number], unknown>>
>;

export type ZdpGeneratedOperationRequest<
  Operation extends ZdpGeneratedOperationMetadata = ZdpGeneratedOperationMetadata,
  SchemaModels extends ZdpGeneratedSchemaModelMap = ZdpGeneratedSchemaModelMap
> = EncodedZdpRequest & {
  readonly body?: Operation['requestSchemaRef'] extends keyof SchemaModels
    ? ZdpGeneratedSchemaPayload<SchemaModels[Operation['requestSchemaRef']]>
    : unknown;
};

type ZdpGeneratedOperationResponsePayload<
  Operation extends ZdpGeneratedOperationMetadata = ZdpGeneratedOperationMetadata,
  SchemaModels extends ZdpGeneratedSchemaModelMap = ZdpGeneratedSchemaModelMap
> = Operation['responseBodyMode'] extends 'none'
  ? undefined
  : Operation['responseSchemaRef'] extends keyof SchemaModels
    ? ZdpGeneratedSchemaPayload<SchemaModels[Operation['responseSchemaRef']]>
    : unknown;

export type ZdpGeneratedOperationResponse<
  Operation extends ZdpGeneratedOperationMetadata = ZdpGeneratedOperationMetadata,
  SchemaModels extends ZdpGeneratedSchemaModelMap = ZdpGeneratedSchemaModelMap
> = ZdpGeneratedOperationResponsePayload<Operation, SchemaModels>;

export type ZdpGeneratedOperationDefinition<
  Operation extends ZdpGeneratedOperationMetadata = ZdpGeneratedOperationMetadata,
  SchemaModels extends ZdpGeneratedSchemaModelMap = ZdpGeneratedSchemaModelMap
> = ZdpOperationDefinition<
  ZdpGeneratedOperationRequest<Operation, SchemaModels>,
  ZdpGeneratedOperationResponse<Operation, SchemaModels>
>;

export type ZdpGeneratedOperationMetadataMap = Readonly<
  Record<string, ZdpGeneratedOperationMetadata>
>;

export type ZdpGeneratedOperationDefinitionMap = Readonly<
  Record<string, ZdpGeneratedOperationDefinition>
>;

export type ZdpGeneratedOperationDefinitions<
  OperationMap extends ZdpGeneratedOperationMetadataMap,
  SchemaModels extends ZdpGeneratedSchemaModelMap
> = Readonly<{
  readonly [OperationId in keyof OperationMap]: ZdpGeneratedOperationDefinition<
    OperationMap[OperationId],
    SchemaModels
  >;
}>;

export function createZdpGeneratedOperationDefinitions<
  const OperationMap extends ZdpGeneratedOperationMetadataMap,
  const SchemaModels extends ZdpGeneratedSchemaModelMap
>(
  operationMap: OperationMap,
  schemaModels: SchemaModels
): ZdpGeneratedOperationDefinitions<OperationMap, SchemaModels> {
  const operations: Partial<
    ZdpGeneratedOperationDefinitions<OperationMap, SchemaModels>
  > = {};

  for (const operationId of Object.keys(operationMap) as (keyof OperationMap)[]) {
    const metadata = operationMap[operationId];
    operations[operationId] = createOperationDefinition(
      String(operationId),
      metadata,
      schemaModels
    );
  }

  return defineZdpOperations(
    operations as ZdpGeneratedOperationDefinitions<OperationMap, SchemaModels>
  );
}

export function createZdpGeneratedTypedFetchClient<
  const OperationMap extends ZdpGeneratedOperationMetadataMap,
  const SchemaModels extends ZdpGeneratedSchemaModelMap
>(
  operationMap: OperationMap,
  schemaModels: SchemaModels,
  options: ZdpTypedFetchClientOptions
): ZdpTypedFetchClient<ZdpGeneratedOperationDefinitions<OperationMap, SchemaModels>> {
  return createZdpTypedFetchClient(
    createZdpGeneratedOperationDefinitions(operationMap, schemaModels),
    options
  );
}

function createOperationDefinition<
  const Operation extends ZdpGeneratedOperationMetadata,
  const SchemaModels extends ZdpGeneratedSchemaModelMap
>(
  operationId: string,
  metadata: Operation,
  schemaModels: SchemaModels
): ZdpGeneratedOperationDefinition<Operation, SchemaModels> {
  validateOperationMetadata(operationId, metadata);
  const requestSchema = readSchemaModel(
    schemaModels,
    metadata.requestSchemaRef,
    'request'
  );
  const responseSchema =
    metadata.responseSchemaRef === null
      ? null
      : readSchemaModel(schemaModels, metadata.responseSchemaRef, 'response');

  return defineZdpOperation<
    ZdpGeneratedOperationRequest<Operation, SchemaModels>,
    ZdpGeneratedOperationResponse<Operation, SchemaModels>
  >({
    operationId: metadata.operationId,
    method: metadata.method,
    path: metadata.path,
    successStatuses: [...metadata.successStatuses],
    authRequired: metadata.authRequired,
    idempotency: metadata.idempotency,
    requestIdRequired: metadata.requestIdRequired,
    traceIdRequired: metadata.traceIdRequired,
    errorCodes: [...metadata.errorCodes],
    encodeRequest: (request) =>
      encodeGeneratedOperationRequest(metadata, requestSchema, request),
    decodeResponse: (response, context) =>
      decodeGeneratedOperationResponse<Operation, SchemaModels>(
        metadata,
        responseSchema,
        response,
        context
      )
  });
}

function validateOperationMetadata(
  operationId: string,
  metadata: ZdpGeneratedOperationMetadata
): void {
  if (metadata.operationId !== operationId) {
    throw new ZdpClientConfigurationError(
      `Generated operation key \`${operationId}\` must match operationId \`${metadata.operationId}\`.`
    );
  }
  if (!SUPPORTED_METHODS.includes(metadata.method)) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` has unsupported method \`${metadata.method}\`.`
    );
  }
  if (!SUPPORTED_IDEMPOTENCY_POLICIES.includes(metadata.idempotency)) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` has unsupported idempotency policy \`${metadata.idempotency}\`.`
    );
  }
  if (
    !metadata.path.startsWith('/') ||
    metadata.path.startsWith('//') ||
    metadata.path.includes('\\') ||
    metadata.path.includes('?') ||
    metadata.path.includes('#')
  ) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` must use a root-relative path without a query or fragment.`
    );
  }
  if (metadata.successStatuses.length === 0) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` must include success statuses.`
    );
  }
  if (metadata.errorCodes.length === 0) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` must include error codes.`
    );
  }
  if (
    (metadata.responseBodyMode === 'none' &&
      metadata.responseSchemaRef !== null) ||
    (metadata.responseBodyMode === 'schema' &&
      metadata.responseSchemaRef === null)
  ) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` response body mode must match its response schema reference.`
    );
  }
}

function encodeGeneratedOperationRequest<
  Operation extends ZdpGeneratedOperationMetadata,
  SchemaModels extends ZdpGeneratedSchemaModelMap
>(
  metadata: Operation,
  requestSchema: ZdpGeneratedSchemaModel,
  request: ZdpGeneratedOperationRequest<Operation, SchemaModels>
): EncodedZdpRequest {
  if (!isRecord(request)) {
    throw new ZdpClientConfigurationError(
      'Generated operation request must be an encoded request object.'
    );
  }

  validateRequestRequiredFields(metadata, requestSchema, request);
  validateSecretFieldLocations(metadata, requestSchema, request);

  return request;
}

function validateSecretFieldLocations(
  metadata: ZdpGeneratedOperationMetadata,
  requestSchema: ZdpGeneratedSchemaModel,
  request: EncodedZdpRequest
): void {
  for (const field of requestSchema.secretFields) {
    if (
      request.query !== undefined &&
      Object.prototype.hasOwnProperty.call(request.query, field)
    ) {
      throw new ZdpClientConfigurationError(
        `Generated operation \`${metadata.operationId}\` secret field \`${field}\` must not be encoded in the URL query.`
      );
    }
    if (
      request.pathParams !== undefined &&
      Object.prototype.hasOwnProperty.call(request.pathParams, field)
    ) {
      throw new ZdpClientConfigurationError(
        `Generated operation \`${metadata.operationId}\` secret field \`${field}\` must not be encoded in the URL path.`
      );
    }
  }
}

function decodeGeneratedOperationResponse<
  Operation extends ZdpGeneratedOperationMetadata,
  SchemaModels extends ZdpGeneratedSchemaModelMap
>(
  metadata: Operation,
  responseSchema: ZdpGeneratedSchemaModel | null,
  response: unknown,
  context: ZdpResponseContext
): ZdpGeneratedOperationResponse<Operation, SchemaModels> {
  if (metadata.responseBodyMode === 'none') {
    if (response !== null) {
      throw new ZdpProtocolError({
        status: context.status,
        message:
          `Generated operation \`${metadata.operationId}\` received a response ` +
          `body for bodyless HTTP ${context.status}.`
      });
    }

    return undefined as ZdpGeneratedOperationResponse<Operation, SchemaModels>;
  }

  if (responseSchema === null) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${metadata.operationId}\` requires a response schema.`
    );
  }

  if (response === undefined) {
    throw new ZdpProtocolError({
      status: context.status,
      message: 'Generated operation response decoder received undefined.'
    });
  }
  if (!isRecord(response)) {
    throw new ZdpProtocolError({
      status: context.status,
      message:
        `Generated operation \`${metadata.operationId}\` response must be ` +
        `an object matching \`${responseSchema.schemaRef}\`.`
    });
  }

  for (const field of responseSchema.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(response, field)) {
      throw new ZdpProtocolError({
        status: context.status,
        message:
          `Generated operation \`${metadata.operationId}\` response schema ` +
          `\`${responseSchema.schemaRef}\` requires field \`${field}\`.`
      });
    }
  }

  return response as ZdpGeneratedOperationResponse<Operation, SchemaModels>;
}

function readSchemaModel(
  schemaModels: ZdpGeneratedSchemaModelMap,
  schemaRef: string,
  expectedKind: ZdpGeneratedSchemaKind
): ZdpGeneratedSchemaModel {
  const model = schemaModels[schemaRef];
  if (model === undefined) {
    throw new ZdpClientConfigurationError(
      `Generated schema model map must include \`${schemaRef}\`.`
    );
  }
  if (model.kind !== expectedKind) {
    throw new ZdpClientConfigurationError(
      `Generated schema model \`${schemaRef}\` must be a ${expectedKind} schema.`
    );
  }

  return model;
}

function validateRequestRequiredFields(
  metadata: ZdpGeneratedOperationMetadata,
  requestSchema: ZdpGeneratedSchemaModel,
  request: EncodedZdpRequest
): void {
  for (const field of requestSchema.requiredFields) {
    if (hasEncodedRequestField(request, field)) {
      continue;
    }

    throw new ZdpClientConfigurationError(
      `Generated operation \`${metadata.operationId}\` request schema ` +
        `\`${requestSchema.schemaRef}\` requires field \`${field}\`.`
    );
  }
}

function hasEncodedRequestField(
  request: EncodedZdpRequest,
  field: string
): boolean {
  if (
    isRecord(request.body) &&
    Object.prototype.hasOwnProperty.call(request.body, field)
  ) {
    return true;
  }
  if (
    request.pathParams !== undefined &&
    Object.prototype.hasOwnProperty.call(request.pathParams, field)
  ) {
    return true;
  }
  if (
    request.query !== undefined &&
    Object.prototype.hasOwnProperty.call(request.query, field)
  ) {
    return true;
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
