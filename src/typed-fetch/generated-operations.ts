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
  readonly responseSchemaRef: string;
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
  readonly secretFields: readonly string[];
  readonly sessionEffect: string | null;
}

export type ZdpGeneratedSchemaModelMap = Readonly<
  Record<string, ZdpGeneratedSchemaModel>
>;

export type ZdpGeneratedSchemaPayload<
  Model extends ZdpGeneratedSchemaModel
> = Readonly<Record<Model['requiredFields'][number], unknown>>;

export type ZdpGeneratedOperationRequest = EncodedZdpRequest;

export type ZdpGeneratedOperationResponse = unknown;

export type ZdpGeneratedOperationDefinition = ZdpOperationDefinition<
  ZdpGeneratedOperationRequest,
  ZdpGeneratedOperationResponse
>;

export type ZdpGeneratedOperationMetadataMap = Readonly<
  Record<string, ZdpGeneratedOperationMetadata>
>;

export type ZdpGeneratedOperationDefinitionMap = Readonly<
  Record<string, ZdpGeneratedOperationDefinition>
>;

export type ZdpGeneratedOperationDefinitions<
  OperationMap extends ZdpGeneratedOperationMetadataMap
> = Readonly<{
  readonly [OperationId in keyof OperationMap]: ZdpGeneratedOperationDefinition;
}>;

export function createZdpGeneratedOperationDefinitions<
  const OperationMap extends ZdpGeneratedOperationMetadataMap
>(
  operationMap: OperationMap
): ZdpGeneratedOperationDefinitions<OperationMap> {
  const operations: Partial<
    Record<keyof OperationMap, ZdpGeneratedOperationDefinition>
  > = {};

  for (const [operationId, metadata] of Object.entries(operationMap)) {
    operations[operationId as keyof OperationMap] = createOperationDefinition(
      operationId,
      metadata
    );
  }

  return defineZdpOperations(
    operations as ZdpGeneratedOperationDefinitions<OperationMap>
  );
}

export function createZdpGeneratedTypedFetchClient<
  const OperationMap extends ZdpGeneratedOperationMetadataMap
>(
  operationMap: OperationMap,
  options: ZdpTypedFetchClientOptions
): ZdpTypedFetchClient<ZdpGeneratedOperationDefinitions<OperationMap>> {
  return createZdpTypedFetchClient(
    createZdpGeneratedOperationDefinitions(operationMap),
    options
  );
}

function createOperationDefinition(
  operationId: string,
  metadata: ZdpGeneratedOperationMetadata
): ZdpGeneratedOperationDefinition {
  validateOperationMetadata(operationId, metadata);

  return defineZdpOperation<ZdpGeneratedOperationRequest, unknown>({
    operationId: metadata.operationId,
    method: metadata.method,
    path: metadata.path,
    successStatuses: [...metadata.successStatuses],
    authRequired: metadata.authRequired,
    idempotency: metadata.idempotency,
    requestIdRequired: metadata.requestIdRequired,
    traceIdRequired: metadata.traceIdRequired,
    errorCodes: [...metadata.errorCodes],
    encodeRequest: encodeGeneratedOperationRequest,
    decodeResponse: decodeGeneratedOperationResponse
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
  if (metadata.path.trim().length === 0) {
    throw new ZdpClientConfigurationError(
      `Generated operation \`${operationId}\` must include a path.`
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
}

function encodeGeneratedOperationRequest(
  request: ZdpGeneratedOperationRequest
): EncodedZdpRequest {
  if (!isRecord(request)) {
    throw new ZdpClientConfigurationError(
      'Generated operation request must be an encoded request object.'
    );
  }

  return request;
}

function decodeGeneratedOperationResponse(response: unknown): unknown {
  if (response === undefined) {
    throw new ZdpProtocolError({
      status: 0,
      message: 'Generated operation response decoder received undefined.'
    });
  }

  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
