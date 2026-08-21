import type {
  GeneratedPublicSurface,
  OperationSurface,
  RuntimeFieldDescriptor,
  SchemaKind,
  SchemaSurface
} from '../scripts/sdk-semver/index';

export const REQUEST_REF = 'contracts/example.yaml#ExampleRequest';
export const RESPONSE_REF = 'contracts/example.yaml#ExampleResponse';
export const OPERATION_ID = 'example.items.create';

export function surface(input: {
  readonly operations?: Readonly<Record<string, OperationSurface>>;
  readonly requestSchema?: SchemaSurface;
  readonly responseSchema?: SchemaSurface;
  readonly runtimeSchemas?: GeneratedPublicSurface['runtimeSchemas'];
} = {}): GeneratedPublicSurface {
  return {
    operations: input.operations ?? { [OPERATION_ID]: operation() },
    schemas: {
      [REQUEST_REF]: input.requestSchema ?? schema('request'),
      [RESPONSE_REF]: input.responseSchema ?? schema('response')
    },
    runtimeSchemas:
      input.runtimeSchemas ?? {
        [REQUEST_REF]: runtimeSchema({ name: 'string' }, ['name']),
        [RESPONSE_REF]: runtimeSchema({ id: 'string' }, ['id'])
      }
  };
}

export function operation(
  overrides: Partial<OperationSurface> = {}
): OperationSurface {
  return {
    operationId: OPERATION_ID,
    method: 'POST',
    path: '/v1/items',
    successStatuses: [201],
    requestSchemaRef: REQUEST_REF,
    responseSchemaRef: RESPONSE_REF,
    responseBodyMode: 'schema',
    authRequired: true,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['validation_failed'],
    ...overrides
  };
}

export function schema(
  kind: SchemaKind,
  overrides: Partial<SchemaSurface> = {}
): SchemaSurface {
  const schemaRef = kind === 'request' ? REQUEST_REF : RESPONSE_REF;
  return {
    schemaRef,
    schemaId: kind === 'request' ? 'ExampleRequest' : 'ExampleResponse',
    kind,
    carriesSecretMaterial: false,
    requiredFields: kind === 'request' ? ['name'] : ['id'],
    optionalFields: [],
    secretFields: [],
    ...overrides
  };
}

export function runtimeSchema(
  fieldTypes: Readonly<Record<string, RuntimeFieldDescriptor>>,
  requiredFields: readonly string[]
): GeneratedPublicSurface['runtimeSchemas'][string] {
  return { fieldTypes, requiredFields };
}
