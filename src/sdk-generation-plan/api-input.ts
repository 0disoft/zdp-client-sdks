import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  ApiExportPlanHandoff,
  ApiSchemaModelHandoff,
  ApiSdkGenerationInputContract,
  ApiTypedFetchOperationHandoff
} from './types';

const SDK_GENERATION_INPUT_FILE = 'contracts/sdk-generation-input.yaml';
const PACKAGE_FILE = 'package.json';
const API_EXPORT_PLAN_FILE = 'src/api-export-plan/plan.ts';
const REQUIRED_EXPORT_TRACE_FIELDS = ['request_id', 'trace_id'] as const;
export const REQUIRED_API_EXPORT_DOCS_METADATA = [
  'permission_check',
  'audit_event',
  'idempotency',
  'success_statuses'
] as const;

/**
 * mf:anchor zdp.client-sdks.api-handoff-reader
 * purpose: Locate the cross-repo reader for zdp-api-contracts SDK input and export plan data.
 * search: API handoff, SDK input, export plan, sibling import, typed fetch map
 * invariant: Client planning rejects missing API export metadata instead of inventing SDK runtime facts.
 * risk: dependency, data_consistency
 */
export async function loadApiSdkGenerationInput(
  apiContractsRoot: string
): Promise<ApiSdkGenerationInputContract> {
  const source = await readFile(
    join(apiContractsRoot, SDK_GENERATION_INPUT_FILE),
    'utf8'
  );
  const document = parseYamlRecord(source);
  const input = readRecord(document, 'sdk_generation_input');

  return {
    status: readString(input, 'status'),
    sourceContracts: readStringArray(input, 'source_contracts'),
    generationTargets: readStringArray(input, 'generation_targets'),
    allowedGenerationTargets: readStringArray(
      input,
      'allowed_generation_targets'
    ),
    requiredRouteMetadata: readStringArray(input, 'required_route_metadata'),
    requiredErrorMetadata: readStringArray(input, 'required_error_metadata'),
    requiredClientRuntimeMetadata: readStringArray(
      input,
      'required_client_runtime_metadata'
    ),
    requiredWebhookMetadata: readStringArray(input, 'required_webhook_metadata'),
    forbiddenOwnership: readStringArray(input, 'forbidden_ownership'),
    forbiddenValues: readStringArray(input, 'forbidden_values')
  };
}

export async function loadApiExportPlanHandoff(
  apiContractsRoot: string
): Promise<ApiExportPlanHandoff> {
  const packageJson = await readJsonRecord(join(apiContractsRoot, PACKAGE_FILE));
  const scripts = readRecord(packageJson, 'scripts');
  const plan = await buildApiExportPlan(apiContractsRoot);

  return {
    script: readString(scripts, 'export:plan'),
    sourceFile: API_EXPORT_PLAN_FILE,
    outputKinds: readExportPlanOutputKinds(plan),
    forbiddenValues: readExportPlanForbiddenValues(plan),
    traceFields: readStringArray(plan, 'traceFields'),
    clientRuntimeMetadata: readStringArray(plan, 'clientRuntimeMetadata'),
    operationIds: readStringArray(plan, 'operationIds'),
    typedFetchOperationMap: readTypedFetchOperationMap(plan),
    schemaModelMap: readSchemaModelMap(plan),
    mutatingMethodsRequiringIdempotency: readStringArray(
      plan,
      'mutatingMethodsRequiringIdempotency'
    ),
    requiredMutationIdempotencyPolicy: readString(
      plan,
      'requiredMutationIdempotencyPolicy'
    ),
    requiredDocsMetadata: readDocsContractMetadata(plan),
    writesArtifacts: readBoolean(plan, 'writesArtifacts'),
    publishesSchemas: readBoolean(plan, 'publishesSchemas')
  };
}

export async function loadApiSchemaModelHandoff(
  apiContractsRoot: string
): Promise<Readonly<Record<string, ApiSchemaModelHandoff>>> {
  const exportPlan = await loadApiExportPlanHandoff(apiContractsRoot);
  if (Object.keys(exportPlan.schemaModelMap).length > 0) {
    return exportPlan.schemaModelMap;
  }

  const apiInput = await loadApiSdkGenerationInput(apiContractsRoot);
  const schemaModels: Record<string, ApiSchemaModelHandoff> = {};

  for (const sourceContract of apiInput.sourceContracts) {
    if (!isApiSchemaContract(sourceContract)) {
      continue;
    }

    const document = parseYamlRecord(
      await readFile(join(apiContractsRoot, sourceContract), 'utf8')
    );
    const bundle = readRecord(document, 'schema_bundle');
    const serviceId = readString(bundle, 'service_id');
    const ownerBoundary = readString(bundle, 'owner_boundary');
    const status = readString(bundle, 'status');
    const schemas = bundle.schemas;

    if (
      serviceId === null ||
      ownerBoundary === null ||
      status === null ||
      !Array.isArray(schemas)
    ) {
      continue;
    }

    for (const schema of schemas) {
      if (!isRecord(schema)) {
        continue;
      }

      const model = readSchemaModel({
        schema,
        sourceContract,
        serviceId,
        ownerBoundary,
        status
      });
      if (model !== null) {
        schemaModels[model.schemaRef] = model;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(schemaModels).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
}

async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseYamlRecord(source: string): Record<string, unknown> {
  const parsed = Bun.YAML.parse(source) as unknown;

  if (isRecord(parsed)) {
    return parsed;
  }

  return {};
}

async function buildApiExportPlan(
  apiContractsRoot: string
): Promise<Record<string, unknown>> {
  const loadApiContracts = await loadSiblingFunction(
    apiContractsRoot,
    'src/api-contracts/parser.ts',
    'loadApiContracts'
  );
  const buildPlan = await loadSiblingFunction(
    apiContractsRoot,
    API_EXPORT_PLAN_FILE,
    'buildApiExportPlan'
  );
  const result = buildPlan(await loadApiContracts(apiContractsRoot));

  if (!isRecord(result)) {
    return {};
  }

  const plan = result.plan;
  return isRecord(plan) ? plan : {};
}

async function loadSiblingFunction(
  root: string,
  fileName: string,
  exportName: string
): Promise<(...args: unknown[]) => unknown> {
  const moduleUrl = pathToFileURL(join(root, fileName)).href;
  const moduleRecord = (await import(moduleUrl)) as Record<string, unknown>;
  const exported = moduleRecord[exportName];

  if (typeof exported !== 'function') {
    throw new Error(`${fileName} must export function \`${exportName}\`.`);
  }

  return exported as (...args: unknown[]) => unknown;
}

function readSchemaModel(input: {
  readonly schema: Record<string, unknown>;
  readonly sourceContract: string;
  readonly serviceId: string;
  readonly ownerBoundary: string;
  readonly status: string;
}): ApiSchemaModelHandoff | null {
  const schemaId = readString(input.schema, 'id');
  const kind = readString(input.schema, 'kind');
  const carriesSecretMaterial = readBoolean(
    input.schema,
    'carries_secret_material'
  );

  if (
    schemaId === null ||
    !isApiSchemaModelKind(kind) ||
    carriesSecretMaterial === null
  ) {
    return null;
  }

  return {
    schemaRef: `${input.sourceContract}#${schemaId}`,
    schemaId,
    sourceContract: input.sourceContract,
    serviceId: input.serviceId,
    ownerBoundary: input.ownerBoundary,
    status: input.status,
    kind,
    carriesSecretMaterial,
    requiredFields: readStringArray(input.schema, 'required_fields'),
    secretFields: readStringArray(input.schema, 'secret_fields'),
    sessionEffect: readString(input.schema, 'session_effect')
  };
}

function readSchemaModelMap(
  plan: Record<string, unknown>
): Readonly<Record<string, ApiSchemaModelHandoff>> {
  const schemaModelMap = plan.schemaModelMap;
  if (!isRecord(schemaModelMap)) {
    return {};
  }

  const parsed: Record<string, ApiSchemaModelHandoff> = {};

  for (const [schemaRef, value] of Object.entries(schemaModelMap)) {
    if (!isRecord(value)) {
      continue;
    }

    const model = readSchemaModelHandoff(schemaRef, value);
    if (model !== null) {
      parsed[schemaRef] = model;
    }
  }

  return Object.fromEntries(
    Object.entries(parsed).sort(([left], [right]) => left.localeCompare(right))
  );
}

function readSchemaModelHandoff(
  schemaRef: string,
  value: Record<string, unknown>
): ApiSchemaModelHandoff | null {
  const declaredSchemaRef = readString(value, 'schemaRef');
  const schemaId = readString(value, 'schemaId');
  const sourceContract = readString(value, 'sourceContract');
  const serviceId = readString(value, 'serviceId');
  const ownerBoundary = readString(value, 'ownerBoundary');
  const status = readString(value, 'status');
  const kind = readString(value, 'kind');
  const carriesSecretMaterial = readBoolean(value, 'carriesSecretMaterial');

  if (
    declaredSchemaRef !== schemaRef ||
    schemaId === null ||
    sourceContract === null ||
    serviceId === null ||
    ownerBoundary === null ||
    status === null ||
    !isApiSchemaModelKind(kind) ||
    carriesSecretMaterial === null
  ) {
    return null;
  }

  return {
    schemaRef,
    schemaId,
    sourceContract,
    serviceId,
    ownerBoundary,
    status,
    kind,
    carriesSecretMaterial,
    requiredFields: readStringArray(value, 'requiredFields'),
    secretFields: readStringArray(value, 'secretFields'),
    sessionEffect: readString(value, 'sessionEffect')
  };
}

function readExportPlanOutputKinds(
  plan: Record<string, unknown>
): readonly string[] {
  const outputs = plan.outputs;
  if (!Array.isArray(outputs)) {
    return [];
  }

  return outputs.flatMap((output) => {
    if (!isRecord(output)) {
      return [];
    }

    return readString(output, 'kind') ?? [];
  });
}

function readExportPlanForbiddenValues(
  plan: Record<string, unknown>
): readonly string[] {
  const outputs = plan.outputs;
  if (!Array.isArray(outputs)) {
    return [];
  }

  return uniqueSorted(
    outputs.flatMap((output) =>
      isRecord(output) ? readStringArray(output, 'forbiddenValues') : []
    )
  );
}

function readDocsContractMetadata(
  plan: Record<string, unknown>
): readonly string[] {
  const outputs = plan.outputs;
  if (!Array.isArray(outputs)) {
    return [];
  }

  const docsContract = outputs.find(
    (output) => isRecord(output) && output.kind === 'docs_contract'
  );
  if (!isRecord(docsContract)) {
    return [];
  }

  const metadata = readStringArray(docsContract, 'requiredMetadata');
  return REQUIRED_API_EXPORT_DOCS_METADATA.filter((field) =>
    metadata.includes(field)
  );
}

function readTypedFetchOperationMap(
  plan: Record<string, unknown>
): Readonly<Record<string, ApiTypedFetchOperationHandoff>> {
  const operationMap = plan.typedFetchOperationMap;
  if (!isRecord(operationMap)) {
    return {};
  }

  const parsed: Record<string, ApiTypedFetchOperationHandoff> = {};

  for (const [operationId, value] of Object.entries(operationMap)) {
    if (!isRecord(value)) {
      continue;
    }

    const operation = readTypedFetchOperation(operationId, value);
    if (operation !== null) {
      parsed[operationId] = operation;
    }
  }

  return parsed;
}

function readTypedFetchOperation(
  operationId: string,
  value: Record<string, unknown>
): ApiTypedFetchOperationHandoff | null {
  const declaredOperationId = readString(value, 'operationId');
  const method = readString(value, 'method');
  const path = readString(value, 'path');
  const requestSchemaRef = readString(value, 'requestSchemaRef');
  const responseSchemaRef = readString(value, 'responseSchemaRef');
  const idempotency = readString(value, 'idempotency');
  const authRequired = readBoolean(value, 'authRequired');
  const requestIdRequired = readBoolean(value, 'requestIdRequired');
  const traceIdRequired = readBoolean(value, 'traceIdRequired');
  const successStatuses = readNumberArray(value, 'successStatuses');
  const errorCodes = readStringArray(value, 'errorCodes');

  if (
    declaredOperationId !== operationId ||
    method === null ||
    path === null ||
    requestSchemaRef === null ||
    responseSchemaRef === null ||
    idempotency === null ||
    authRequired === null ||
    requestIdRequired === null ||
    traceIdRequired === null ||
    successStatuses.length === 0 ||
    errorCodes.length === 0
  ) {
    return null;
  }

  return {
    operationId,
    method,
    path,
    successStatuses,
    requestSchemaRef,
    responseSchemaRef,
    authRequired,
    idempotency,
    requestIdRequired,
    traceIdRequired,
    errorCodes
  };
}

function readRecord(
  value: Record<string, unknown>,
  field: string
): Record<string, unknown> {
  const candidate = value[field];

  return isRecord(candidate) ? candidate : {};
}

function readString(
  value: Record<string, unknown>,
  field: string
): string | null {
  const candidate = value[field];

  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : null;
}

function readStringArray(
  value: Record<string, unknown>,
  field: string
): readonly string[] {
  const candidate = value[field];

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.flatMap((entry) =>
    typeof entry === 'string' && entry.trim().length > 0 ? [entry.trim()] : []
  );
}

function readNumberArray(
  value: Record<string, unknown>,
  field: string
): readonly number[] {
  const candidate = value[field];

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.flatMap((entry) =>
    typeof entry === 'number' && Number.isInteger(entry) ? [entry] : []
  );
}

function readBoolean(
  value: Record<string, unknown>,
  field: string
): boolean | null {
  const candidate = value[field];
  return typeof candidate === 'boolean' ? candidate : null;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function isApiSchemaContract(sourceContract: string): boolean {
  return (
    sourceContract.startsWith('contracts/apis/') &&
    sourceContract.endsWith('.yaml')
  );
}

function isApiSchemaModelKind(value: string | null): value is 'request' | 'response' {
  return value === 'request' || value === 'response';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
