import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { ApiSdkGenerationInputContract } from './types';

const SDK_GENERATION_INPUT_FILE = 'contracts/sdk-generation-input.yaml';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
