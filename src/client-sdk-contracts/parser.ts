import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type {
  AuthHelperContract,
  ClientSdkContracts,
  SdkSurfaceContract,
  UploadClientContract
} from './types';

const SDK_SURFACE_FILE = 'sdk-surface.yaml';
const AUTH_HELPER_FILE = 'auth-helper.yaml';
const UPLOAD_CLIENT_FILE = 'upload-client.yaml';

export function loadClientSdkContracts(root: string = process.cwd()): ClientSdkContracts {
  return {
    sdkSurface: parseSdkSurfaceContract(readContract(root, SDK_SURFACE_FILE)),
    authHelper: parseAuthHelperContract(readContract(root, AUTH_HELPER_FILE)),
    uploadClient: parseUploadClientContract(readContract(root, UPLOAD_CLIENT_FILE))
  };
}

export function parseSdkSurfaceContract(source: string): SdkSurfaceContract {
  const document = parseYamlRecord(source);
  const sdkSurface = readRecord(document, 'sdk_surface');

  return {
    languages: readStringArray(sdkSurface, 'languages'),
    requiredBehaviors: readStringArray(sdkSurface, 'required_behaviors'),
    mustNotOwn: readStringArray(sdkSurface, 'must_not_own')
  };
}

export function parseAuthHelperContract(source: string): AuthHelperContract {
  const document = parseYamlRecord(source);
  const authHelper = readRecord(document, 'auth_helper');

  return {
    status: readString(authHelper, 'status'),
    owns: readStringArray(authHelper, 'owns'),
    mustNotOwn: readStringArray(authHelper, 'must_not_own')
  };
}

export function parseUploadClientContract(source: string): UploadClientContract {
  const document = parseYamlRecord(source);
  const uploadClient = readRecord(document, 'upload_client');

  return {
    status: readString(uploadClient, 'status'),
    owns: readStringArray(uploadClient, 'owns'),
    mustNotOwn: readStringArray(uploadClient, 'must_not_own')
  };
}

function readContract(root: string, fileName: string): string {
  return readFileSync(join(root, 'contracts', fileName), 'utf8');
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
