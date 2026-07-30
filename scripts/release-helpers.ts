import assert from 'node:assert/strict';

export interface ExactSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
}

export function compareExactSemver(left: string, right: string): number {
  const a = parseExactSemver(left);
  const b = parseExactSemver(right);
  for (const field of ['major', 'minor', 'patch'] as const) {
    if (a[field] !== b[field]) {
      return a[field] < b[field] ? -1 : 1;
    }
  }
  if (a.prerelease === b.prerelease) {
    return 0;
  }
  if (a.prerelease === null) {
    return 1;
  }
  if (b.prerelease === null) {
    return -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function parseExactSemver(value: string): ExactSemver {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(
    value
  );
  assert.ok(match, `Expected an exact semver version, received ${value}.`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  };
}

export function readNpmErrorCode(...sources: readonly string[]): string | null {
  for (const source of sources) {
    const trimmed = source.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    const candidates = [
      trimmed,
      jsonStart >= 0 && jsonEnd > jsonStart
        ? trimmed.slice(jsonStart, jsonEnd + 1)
        : ''
    ];
    for (const candidate of candidates) {
      if (candidate.length === 0) continue;
      try {
        const parsed: unknown = JSON.parse(candidate);
        if (isRecord(parsed)) {
          const directCode = parsed.code;
          if (typeof directCode === 'string') {
            return directCode;
          }
          const error = parsed.error;
          if (isRecord(error) && typeof error.code === 'string') {
            return error.code;
          }
        }
      } catch {
        // Continue to the bounded JSON candidate.
      }
    }
  }
  return null;
}

function comparePrerelease(left: string, right: string): number {
  const leftParts = left.split('.');
  const rightParts = right.split('.');
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNumber = /^\d+$/.test(a) ? Number(a) : null;
    const bNumber = /^\d+$/.test(b) ? Number(b) : null;
    if (aNumber !== null && bNumber !== null) return aNumber < bNumber ? -1 : 1;
    if (aNumber !== null) return -1;
    if (bNumber !== null) return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
