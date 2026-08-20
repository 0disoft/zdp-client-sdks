import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadApiExportPlanHandoff } from '../src/sdk-generation-plan/api-input';
import type {
  ApiExportPlanHandoff,
  ApiSchemaModelHandoff
} from '../src/sdk-generation-plan/types';

const DEFAULT_API_CONTRACTS_ROOT = '../zdp-api-contracts';
const DEFAULT_CONTRACT_FILE = 'contracts/typescript-sdk-models.yaml';
const DEFAULT_MODELS_OUTPUT_FILE = 'src/typed-fetch/api-models.ts';
const DEFAULT_RUNTIME_OUTPUT_FILE = 'src/typed-fetch/api-model-runtime.ts';

const SIMPLE_FIELD_TYPES = [
  'string',
  'boolean',
  'integer',
  'datetime',
  'locale',
  'uri',
  'currency',
  'decimal',
  'json',
  'json_object',
  'string[]',
  'json_object[]'
] as const;

type SimpleFieldType = (typeof SIMPLE_FIELD_TYPES)[number];

interface EnumFieldType {
  readonly enum: readonly string[];
}

type FieldType = SimpleFieldType | EnumFieldType;

type SchemaFieldTypeMap = Readonly<
  Record<string, Readonly<Record<string, FieldType>>>
>;

interface SyncOptions {
  readonly apiContractsRoot: string;
  readonly contractFile: string;
  readonly modelsOutputFile: string;
  readonly runtimeOutputFile: string;
  readonly check: boolean;
}

interface RenderedFile {
  readonly outputPath: string;
  readonly source: string;
  readonly changed: boolean;
}

export async function renderTypescriptApiModels(
  options: SyncOptions
): Promise<{
  readonly models: RenderedFile;
  readonly runtime: RenderedFile;
}> {
  const modelsOutputPath = resolve(options.modelsOutputFile);
  const runtimeOutputPath = resolve(options.runtimeOutputFile);
  const apiExportPlan = await loadApiExportPlanHandoff(
    resolve(options.apiContractsRoot)
  );
  const schemaFieldTypes = await loadSchemaFieldTypes(
    resolve(options.contractFile)
  );
  const models = selectOperationSchemaModels(apiExportPlan, schemaFieldTypes);
  const modelsSource = renderModelsSource(models, schemaFieldTypes);
  const runtimeSource = renderRuntimeSource(models, schemaFieldTypes);
  const [currentModelsSource, currentRuntimeSource] = await Promise.all([
    readOptionalFile(modelsOutputPath),
    readOptionalFile(runtimeOutputPath)
  ]);

  return {
    models: {
      outputPath: modelsOutputPath,
      source: modelsSource,
      changed: modelsSource !== currentModelsSource
    },
    runtime: {
      outputPath: runtimeOutputPath,
      source: runtimeSource,
      changed: runtimeSource !== currentRuntimeSource
    }
  };
}

async function loadSchemaFieldTypes(path: string): Promise<SchemaFieldTypeMap> {
  const parsed = Bun.YAML.parse(await readFile(path, 'utf8')) as unknown;
  const root = readRecord(parsed, 'root');
  const contract = readRecord(
    root.typescript_sdk_models,
    'typescript_sdk_models'
  );
  const schemas = readRecord(
    contract.schema_field_types,
    'schema_field_types'
  );
  const result: Record<string, Readonly<Record<string, FieldType>>> = {};

  for (const [schemaRef, rawFields] of Object.entries(schemas)) {
    const fields = readRecord(rawFields, `schema ${schemaRef}`);
    const parsedFields: Record<string, FieldType> = {};

    for (const [field, rawType] of Object.entries(fields)) {
      parsedFields[field] = parseFieldType(rawType, schemaRef, field);
    }

    result[schemaRef] = parsedFields;
  }

  return result;
}

function parseFieldType(
  value: unknown,
  schemaRef: string,
  field: string
): FieldType {
  if (
    typeof value === 'string' &&
    SIMPLE_FIELD_TYPES.includes(value as SimpleFieldType)
  ) {
    return value as SimpleFieldType;
  }

  if (isRecord(value) && Array.isArray(value.enum)) {
    const values = value.enum;
    if (
      values.length > 0 &&
      values.every(
        (entry) => typeof entry === 'string' && entry.trim().length > 0
      ) &&
      new Set(values).size === values.length
    ) {
      return { enum: values };
    }
  }

  throw new Error(
    `Unsupported TypeScript field type for ${schemaRef}#${field}.`
  );
}

function selectOperationSchemaModels(
  apiExportPlan: ApiExportPlanHandoff,
  schemaFieldTypes: SchemaFieldTypeMap
): readonly ApiSchemaModelHandoff[] {
  const usedSchemaRefs = new Set<string>();

  for (const operation of Object.values(apiExportPlan.typedFetchOperationMap)) {
    usedSchemaRefs.add(operation.requestSchemaRef);
    if (operation.responseSchemaRef !== null) {
      usedSchemaRefs.add(operation.responseSchemaRef);
    }
  }

  const configuredSchemaRefs = Object.keys(schemaFieldTypes);
  const missing = [...usedSchemaRefs].filter(
    (schemaRef) => !Object.hasOwn(schemaFieldTypes, schemaRef)
  );
  const unused = configuredSchemaRefs.filter(
    (schemaRef) => !usedSchemaRefs.has(schemaRef)
  );

  if (missing.length > 0) {
    throw new Error(
      `TypeScript SDK model contract lacks operation schemas: ${missing.sort().join(', ')}.`
    );
  }
  if (unused.length > 0) {
    throw new Error(
      `TypeScript SDK model contract contains unused schemas: ${unused.sort().join(', ')}.`
    );
  }

  const models = [...usedSchemaRefs]
    .sort((left, right) => left.localeCompare(right))
    .map((schemaRef) => {
      const model = apiExportPlan.schemaModelMap[schemaRef];
      if (model === undefined) {
        throw new Error(`API export plan lacks schema model ${schemaRef}.`);
      }
      validateSchemaFieldCoverage(model, schemaFieldTypes[schemaRef] ?? {});
      return model;
    });

  const schemaIds = new Set<string>();
  for (const model of models) {
    if (!isTypescriptIdentifier(model.schemaId)) {
      throw new Error(
        `API schema id ${model.schemaId} is not a valid TypeScript identifier.`
      );
    }
    if (schemaIds.has(model.schemaId)) {
      throw new Error(`Duplicate TypeScript schema id ${model.schemaId}.`);
    }
    schemaIds.add(model.schemaId);
  }

  return models;
}

function validateSchemaFieldCoverage(
  model: ApiSchemaModelHandoff,
  configured: Readonly<Record<string, FieldType>>
): void {
  const expected = [...model.requiredFields, ...model.optionalFields];
  const duplicateFields = expected.filter(
    (field, index) => expected.indexOf(field) !== index
  );
  if (duplicateFields.length > 0) {
    throw new Error(
      `API schema ${model.schemaRef} repeats fields: ${[
        ...new Set(duplicateFields)
      ].join(', ')}.`
    );
  }

  const missing = expected.filter((field) => !Object.hasOwn(configured, field));
  const extra = Object.keys(configured).filter(
    (field) => !expected.includes(field)
  );

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `TypeScript field coverage drift for ${model.schemaRef}; ` +
        `missing=[${missing.join(', ')}], extra=[${extra.join(', ')}].`
    );
  }
}

function renderModelsSource(
  models: readonly ApiSchemaModelHandoff[],
  schemaFieldTypes: SchemaFieldTypeMap
): string {
  const lines: string[] = [
    '/* Generated by scripts/sync-typescript-api-models.ts. Do not edit. */',
    '',
    'export type ZdpIsoDateTimeString = string;',
    'export type ZdpLocaleString = string;',
    'export type ZdpUriString = string;',
    'export type ZdpCurrencyString = string;',
    'export type ZdpDecimalString = string;',
    '',
    'export type ZdpJsonPrimitive = string | number | boolean | null;',
    'export type ZdpJsonValue = ZdpJsonPrimitive | readonly ZdpJsonValue[] | { readonly [key: string]: ZdpJsonValue };',
    'export type ZdpJsonObject = Readonly<Record<string, ZdpJsonValue>>;',
    '',
    `export type ZdpApiRuntimeFieldType = ${SIMPLE_FIELD_TYPES.map((fieldType) =>
      JSON.stringify(fieldType)
    ).join(' | ')};`,
    'export interface ZdpApiRuntimeEnumFieldType { readonly enum: readonly string[]; }',
    'export type ZdpApiRuntimeFieldDescriptor = ZdpApiRuntimeFieldType | ZdpApiRuntimeEnumFieldType;',
    'export interface ZdpApiRuntimeSchemaDescriptor { readonly requiredFields: readonly string[]; readonly fieldTypes: Readonly<Record<string, ZdpApiRuntimeFieldDescriptor>>; }',
    ''
  ];

  for (const model of models) {
    const fieldTypes = readFieldTypes(schemaFieldTypes, model.schemaRef);
    const fields = [
      ...model.requiredFields.map(
        (field) =>
          `readonly ${field}: ${renderTypescriptFieldType(
            fieldTypes[field],
            model.schemaRef,
            field
          )};`
      ),
      ...model.optionalFields.map(
        (field) =>
          `readonly ${field}?: ${renderTypescriptFieldType(
            fieldTypes[field],
            model.schemaRef,
            field
          )};`
      )
    ];
    lines.push(`export interface ${model.schemaId} { ${fields.join(' ')} }`);
  }

  lines.push('');
  lines.push('export interface ZdpApiSchemaTypeMap {');
  for (const model of models) {
    lines.push(
      `  readonly ${JSON.stringify(model.schemaRef)}: ${model.schemaId};`
    );
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function renderRuntimeSource(
  models: readonly ApiSchemaModelHandoff[],
  schemaFieldTypes: SchemaFieldTypeMap
): string {
  const lines = [
    '/* Generated by scripts/sync-typescript-api-models.ts. Do not edit. */',
    '',
    "import type { ZdpApiRuntimeSchemaDescriptor, ZdpApiSchemaTypeMap } from './api-models';",
    '',
    'export const ZDP_API_SCHEMA_RUNTIME_TYPE_MAP = {'
  ];

  models.forEach((model, index) => {
    const descriptor = {
      requiredFields: model.requiredFields,
      fieldTypes: readFieldTypes(schemaFieldTypes, model.schemaRef)
    };
    const suffix = index === models.length - 1 ? '' : ',';
    lines.push(
      `  ${JSON.stringify(model.schemaRef)}: ${JSON.stringify(descriptor)}${suffix}`
    );
  });

  lines.push(
    '} as const satisfies Readonly<Record<keyof ZdpApiSchemaTypeMap, ZdpApiRuntimeSchemaDescriptor>>;'
  );
  lines.push('');

  return lines.join('\n');
}

function readFieldTypes(
  schemaFieldTypes: SchemaFieldTypeMap,
  schemaRef: string
): Readonly<Record<string, FieldType>> {
  const fieldTypes = schemaFieldTypes[schemaRef];
  if (fieldTypes === undefined) {
    throw new Error(`Missing field types for ${schemaRef}.`);
  }
  return fieldTypes;
}

function renderTypescriptFieldType(
  fieldType: FieldType | undefined,
  schemaRef: string,
  field: string
): string {
  if (fieldType === undefined) {
    throw new Error(`Missing field type for ${schemaRef}#${field}.`);
  }
  if (typeof fieldType !== 'string') {
    return fieldType.enum.map((value) => JSON.stringify(value)).join(' | ');
  }

  const rendered: Record<SimpleFieldType, string> = {
    string: 'string',
    boolean: 'boolean',
    integer: 'number',
    datetime: 'ZdpIsoDateTimeString',
    locale: 'ZdpLocaleString',
    uri: 'ZdpUriString',
    currency: 'ZdpCurrencyString',
    decimal: 'ZdpDecimalString',
    json: 'ZdpJsonValue',
    json_object: 'ZdpJsonObject',
    'string[]': 'readonly string[]',
    'json_object[]': 'readonly ZdpJsonObject[]'
  };

  return rendered[fieldType];
}

function parseOptions(args: readonly string[]): SyncOptions {
  let apiContractsRoot = DEFAULT_API_CONTRACTS_ROOT;
  let contractFile = DEFAULT_CONTRACT_FILE;
  let modelsOutputFile = DEFAULT_MODELS_OUTPUT_FILE;
  let runtimeOutputFile = DEFAULT_RUNTIME_OUTPUT_FILE;
  let check = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--check') {
      check = true;
      continue;
    }

    if (
      argument === '--api-contracts-root' ||
      argument === '--contract' ||
      argument === '--models-output' ||
      argument === '--runtime-output'
    ) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }

      if (argument === '--api-contracts-root') {
        apiContractsRoot = value;
      } else if (argument === '--contract') {
        contractFile = value;
      } else if (argument === '--models-output') {
        modelsOutputFile = value;
      } else {
        runtimeOutputFile = value;
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    apiContractsRoot,
    contractFile,
    modelsOutputFile,
    runtimeOutputFile,
    check
  };
}

async function readOptionalFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTypescriptIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const rendered = await renderTypescriptApiModels(options);
  const outputs = [rendered.models, rendered.runtime];

  if (options.check) {
    const changed = outputs.filter((output) => output.changed);
    if (changed.length > 0) {
      throw new Error(
        `Generated TypeScript API model files are out of sync: ${changed
          .map((output) => output.outputPath)
          .join(', ')}.`
      );
    }
    console.log('Generated TypeScript API models are synchronized.');
    return;
  }

  const changed = outputs.filter((output) => output.changed);
  if (changed.length === 0) {
    console.log('Generated TypeScript API models are already synchronized.');
    return;
  }

  await Promise.all(
    changed.map((output) => writeFile(output.outputPath, output.source, 'utf8'))
  );
  console.log(
    `Synchronized ${changed.map((output) => output.outputPath).join(', ')}.`
  );
}

if (import.meta.main) {
  await main();
}
