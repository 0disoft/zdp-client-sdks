export type CompatibilityLevel = 'none' | 'additive' | 'breaking';
export type RequiredVersionBump = 'none' | 'minor' | 'major';
export type SchemaKind = 'request' | 'response';
export type FieldPresence = 'absent' | 'optional' | 'required';

export interface CompatibilityChange {
  readonly level: Exclude<CompatibilityLevel, 'none'>;
  readonly code: string;
  readonly target: string;
  readonly message: string;
}

export interface CompatibilityReport {
  readonly classification: CompatibilityLevel;
  readonly changes: readonly CompatibilityChange[];
}

export interface OperationSurface {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly successStatuses: readonly number[];
  readonly requestSchemaRef: string;
  readonly responseSchemaRef: string | null;
  readonly responseBodyMode: 'schema' | 'none';
  readonly authRequired: boolean;
  readonly idempotency: string;
  readonly requestIdRequired: boolean;
  readonly traceIdRequired: boolean;
  readonly errorCodes: readonly string[];
}

export interface SchemaSurface {
  readonly schemaRef: string;
  readonly schemaId: string;
  readonly kind: SchemaKind;
  readonly carriesSecretMaterial: boolean;
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
  readonly secretFields: readonly string[];
}

export interface EnumFieldDescriptor {
  readonly enum: readonly string[];
}

export type RuntimeFieldDescriptor = string | EnumFieldDescriptor;

export interface RuntimeSchemaSurface {
  readonly requiredFields: readonly string[];
  readonly fieldTypes: Readonly<Record<string, RuntimeFieldDescriptor>>;
}

export interface GeneratedPublicSurface {
  readonly operations: Readonly<Record<string, OperationSurface>>;
  readonly schemas: Readonly<Record<string, SchemaSurface>>;
  readonly runtimeSchemas: Readonly<Record<string, RuntimeSchemaSurface>>;
}

export interface SemverGateInput {
  readonly baselineVersion: string;
  readonly currentVersion: string;
  readonly compatibility: CompatibilityLevel;
  readonly migrationNote: string | null;
}

export interface SemverGateResult {
  readonly valid: boolean;
  readonly requiredBump: RequiredVersionBump;
  readonly migrationNoteRequired: boolean;
  readonly errors: readonly string[];
}

