import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  ApiExportPlanHandoff,
  ApiSdkGenerationInputContract
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
