import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type {
  ApiExportPlanHandoff,
  ApiSdkGenerationInputContract
} from './types';

const SDK_GENERATION_INPUT_FILE = 'contracts/sdk-generation-input.yaml';
const PACKAGE_FILE = 'package.json';
const API_EXPORT_PLAN_FILE = 'src/api-export-plan/plan.ts';
const REQUIRED_EXPORT_PLAN_OUTPUT_KINDS = [
  'openapi',
  'sdk_generation_input',
  'webhook_schema',
  'docs_contract'
] as const;
const REQUIRED_EXPORT_TRACE_FIELDS = ['request_id', 'trace_id'] as const;
const REQUIRED_EXPORT_DOCS_METADATA = [
  'permission_check',
  'audit_event',
  'idempotency'
] as const;

export function loadApiSdkGenerationInput(
  apiContractsRoot: string
): ApiSdkGenerationInputContract {
  const source = readFileSync(
    join(apiContractsRoot, SDK_GENERATION_INPUT_FILE),
    'utf8'
  );
  const document = parseYamlRecord(source);
  const input = readRecord(document, 'sdk_generation_input');

  return {
    status: readString(input, 'status'),
    sourceContracts: readStringArray(input, 'source_contracts'),
    generationTargets: readStringArray(input, 'generation_targets'),
    requiredRouteMetadata: readStringArray(input, 'required_route_metadata'),
    requiredErrorMetadata: readStringArray(input, 'required_error_metadata'),
    requiredWebhookMetadata: readStringArray(input, 'required_webhook_metadata'),
    forbiddenOwnership: readStringArray(input, 'forbidden_ownership'),
    forbiddenValues: readStringArray(input, 'forbidden_values')
  };
}

export function loadApiExportPlanHandoff(
  apiContractsRoot: string
): ApiExportPlanHandoff {
  const packageJson = readJsonRecord(join(apiContractsRoot, PACKAGE_FILE));
  const scripts = readRecord(packageJson, 'scripts');
  const source = readFileSync(join(apiContractsRoot, API_EXPORT_PLAN_FILE), 'utf8');

  return {
    script: readString(scripts, 'export:plan'),
    sourceFile: API_EXPORT_PLAN_FILE,
    outputKinds: REQUIRED_EXPORT_PLAN_OUTPUT_KINDS.filter((kind) =>
      source.includes(kind)
    ),
    traceFields: REQUIRED_EXPORT_TRACE_FIELDS.filter((field) =>
      source.includes(field)
    ),
    requiredDocsMetadata: REQUIRED_EXPORT_DOCS_METADATA.filter((field) =>
      source.includes(field)
    ),
    writesArtifacts: readPinnedBoolean(source, 'writesArtifacts'),
    publishesSchemas: readPinnedBoolean(source, 'publishesSchemas')
  };
}

function readJsonRecord(path: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseYamlRecord(source: string): Record<string, unknown> {
  const parsed = parse(source) as unknown;

  if (isRecord(parsed)) {
    return parsed;
  }

  return {};
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

function readPinnedBoolean(source: string, field: string): boolean | null {
  if (source.includes(`${field}: false`)) {
    return false;
  }

  if (source.includes(`${field}: true`)) {
    return true;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
