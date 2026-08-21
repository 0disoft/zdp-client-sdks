import type {
  GeneratedPublicSurface,
  OperationSurface,
  RuntimeFieldDescriptor,
  RuntimeSchemaSurface,
  SchemaSurface
} from './types';

export function extractGeneratedPublicSurface(
  operationsSource: string,
  runtimeSource: string | null = null
): GeneratedPublicSurface {
  const schemas = parseSchemaMap(
    extractJsonConstant(operationsSource, 'ZDP_API_SCHEMA_MODEL_MAP')
  );
  const operations = parseOperationMap(
    extractJsonConstant(operationsSource, 'ZDP_TYPED_FETCH_OPERATION_MAP')
  );
  const runtimeSchemas =
    runtimeSource === null
      ? {}
      : parseRuntimeSchemaMap(
          extractJsonConstant(runtimeSource, 'ZDP_API_SCHEMA_RUNTIME_TYPE_MAP')
        );

  return { operations, schemas, runtimeSchemas };
}

export function extractJsonConstant(source: string, name: string): unknown {
  const prefix = `export const ${name} =`;
  const declarationIndex = source.indexOf(prefix);
  if (declarationIndex === -1) {
    throw new Error(`Could not find generated constant ${name}.`);
  }

  let start = declarationIndex + prefix.length;
  while (/\s/.test(source[start] ?? '')) {
    start += 1;
  }
  if (source[start] !== '{') {
    throw new Error(`Generated constant ${name} must start with a JSON object.`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) {
      break;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      depth += 1;
      continue;
    }
    if (character !== '}') {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return JSON.parse(source.slice(start, index + 1)) as unknown;
    }
    if (depth < 0) {
      break;
    }
  }

  throw new Error(`Generated constant ${name} has an unterminated object.`);
}

function parseOperationMap(value: unknown): Readonly<Record<string, OperationSurface>> {
  const root = readRecord(value, 'generated operation map');
  const result: Record<string, OperationSurface> = {};

  for (const [operationId, rawOperation] of Object.entries(root)) {
    const operation = readRecord(rawOperation, `operation ${operationId}`);
    const responseSchemaRef = operation.responseSchemaRef;
    if (responseSchemaRef !== null && typeof responseSchemaRef !== 'string') {
      throw new Error(`${operationId}.responseSchemaRef must be string or null.`);
    }
    const responseBodyMode = readString(
      operation,
      'responseBodyMode',
      operationId
    );
    if (responseBodyMode !== 'schema' && responseBodyMode !== 'none') {
      throw new Error(`${operationId}.responseBodyMode is unsupported.`);
    }

    const parsed: OperationSurface = {
      operationId: readString(operation, 'operationId', operationId),
      method: readString(operation, 'method', operationId),
      path: readString(operation, 'path', operationId),
      successStatuses: readNumberArray(
        operation.successStatuses,
        `${operationId}.successStatuses`
      ),
      requestSchemaRef: readString(
        operation,
        'requestSchemaRef',
        operationId
      ),
      responseSchemaRef,
      responseBodyMode,
      authRequired: readBoolean(operation, 'authRequired', operationId),
      idempotency: readString(operation, 'idempotency', operationId),
      requestIdRequired: readBoolean(
        operation,
        'requestIdRequired',
        operationId
      ),
      traceIdRequired: readBoolean(
        operation,
        'traceIdRequired',
        operationId
      ),
      errorCodes: readStringArray(
        operation.errorCodes,
        `${operationId}.errorCodes`
      )
    };
    if (parsed.operationId !== operationId) {
      throw new Error(
        `Generated operation key ${operationId} does not match operationId ${parsed.operationId}.`
      );
    }
    result[operationId] = parsed;
  }

  return result;
}

function parseSchemaMap(value: unknown): Readonly<Record<string, SchemaSurface>> {
  const root = readRecord(value, 'generated schema map');
  const result: Record<string, SchemaSurface> = {};

  for (const [schemaRef, rawSchema] of Object.entries(root)) {
    const schema = readRecord(rawSchema, `schema ${schemaRef}`);
    const kind = readString(schema, 'kind', schemaRef);
    if (kind !== 'request' && kind !== 'response') {
      throw new Error(`${schemaRef}.kind must be request or response.`);
    }
    const parsed: SchemaSurface = {
      schemaRef: readString(schema, 'schemaRef', schemaRef),
      schemaId: readString(schema, 'schemaId', schemaRef),
      kind,
      carriesSecretMaterial: readBoolean(
        schema,
        'carriesSecretMaterial',
        schemaRef
      ),
      requiredFields: readStringArray(
        schema.requiredFields,
        `${schemaRef}.requiredFields`
      ),
      optionalFields: readStringArray(
        schema.optionalFields,
        `${schemaRef}.optionalFields`
      ),
      secretFields: readStringArray(
        schema.secretFields,
        `${schemaRef}.secretFields`
      )
    };
    if (parsed.schemaRef !== schemaRef) {
      throw new Error(
        `Generated schema key ${schemaRef} does not match schemaRef ${parsed.schemaRef}.`
      );
    }
    const overlap = parsed.requiredFields.filter((field) =>
      parsed.optionalFields.includes(field)
    );
    if (overlap.length > 0) {
      throw new Error(
        `Schema ${schemaRef} marks fields as both required and optional: ${overlap.join(', ')}.`
      );
    }
    result[schemaRef] = parsed;
  }

  return result;
}

function parseRuntimeSchemaMap(
  value: unknown
): Readonly<Record<string, RuntimeSchemaSurface>> {
  const root = readRecord(value, 'runtime schema map');
  const result: Record<string, RuntimeSchemaSurface> = {};

  for (const [schemaRef, rawDescriptor] of Object.entries(root)) {
    const descriptor = readRecord(rawDescriptor, `runtime schema ${schemaRef}`);
    const rawFieldTypes = readRecord(
      descriptor.fieldTypes,
      `${schemaRef}.fieldTypes`
    );
    const fieldTypes: Record<string, RuntimeFieldDescriptor> = {};

    for (const [field, rawType] of Object.entries(rawFieldTypes)) {
      if (typeof rawType === 'string') {
        fieldTypes[field] = rawType;
        continue;
      }
      const enumDescriptor = readRecord(
        rawType,
        `${schemaRef}.${field} enum descriptor`
      );
      fieldTypes[field] = {
        enum: readStringArray(
          enumDescriptor.enum,
          `${schemaRef}.${field}.enum`
        )
      };
    }

    result[schemaRef] = {
      requiredFields: readStringArray(
        descriptor.requiredFields,
        `${schemaRef}.requiredFields`
      ),
      fieldTypes
    };
  }

  return result;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  field: string,
  label: string
): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string.`);
  }
  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  field: string,
  label: string
): boolean {
  const value = record[field];
  if (typeof value !== 'boolean') {
    throw new Error(`${label}.${field} must be boolean.`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} must be a string array.`);
  }
  return value;
}

function readNumberArray(value: unknown, label: string): readonly number[] {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === 'number' && Number.isInteger(entry))
  ) {
    throw new Error(`${label} must be an integer array.`);
  }
  return value;
}
