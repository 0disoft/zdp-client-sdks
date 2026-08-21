import { readFile } from 'node:fs/promises';
import { parseExactSemver } from '../release-helpers';

export async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function readPackageVersion(source: string, label: string): string {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed) || typeof parsed.version !== 'string') {
    throw new Error(`${label} must declare a string version.`);
  }
  parseExactSemver(parsed.version);
  return parsed.version;
}

export function readApiRevision(source: string, label: string): string {
  const parsed: unknown = JSON.parse(source);
  if (
    !isRecord(parsed) ||
    typeof parsed.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(parsed.revision)
  ) {
    throw new Error(`${label} must declare a full API contract revision.`);
  }
  return parsed.revision;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
