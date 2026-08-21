import { compareExactSemver, parseExactSemver } from '../release-helpers';
import type {
  CompatibilityLevel,
  RequiredVersionBump,
  SemverGateInput,
  SemverGateResult
} from './types';

export function requiredVersionBump(
  compatibility: CompatibilityLevel,
  baselineVersion: string
): RequiredVersionBump {
  if (compatibility === 'none') {
    return 'none';
  }
  if (compatibility === 'additive') {
    return 'minor';
  }
  return parseExactSemver(baselineVersion).major === 0 ? 'minor' : 'major';
}

export function evaluateSemverGate(input: SemverGateInput): SemverGateResult {
  const errors: string[] = [];
  const baseline = parseExactSemver(input.baselineVersion);
  const current = parseExactSemver(input.currentVersion);
  const requiredBump = requiredVersionBump(
    input.compatibility,
    input.baselineVersion
  );
  const migrationNoteRequired = input.compatibility === 'breaking';

  const versionOrder = compareExactSemver(
    input.currentVersion,
    input.baselineVersion
  );
  if (versionOrder < 0) {
    errors.push(
      `Package version ${input.currentVersion} must not be older than released version ${input.baselineVersion}.`
    );
  }
  if (input.compatibility !== 'none' && versionOrder <= 0) {
    errors.push(
      `Public SDK changes require a version newer than ${input.baselineVersion}.`
    );
  }

  if (requiredBump === 'minor') {
    const hasMinorOrMajorBump =
      current.major > baseline.major ||
      (current.major === baseline.major && current.minor > baseline.minor);
    if (!hasMinorOrMajorBump) {
      errors.push(
        `SDK compatibility requires at least a minor version bump from ${input.baselineVersion}.`
      );
    }
  } else if (requiredBump === 'major' && current.major <= baseline.major) {
    errors.push(
      `SDK compatibility requires a major version bump from ${input.baselineVersion}.`
    );
  }

  if (migrationNoteRequired) {
    if (input.migrationNote === null) {
      errors.push(
        `Breaking SDK changes require a migration note from ${input.baselineVersion} to ${input.currentVersion}.`
      );
    } else {
      errors.push(
        ...validateMigrationNote(
          input.migrationNote,
          input.baselineVersion,
          input.currentVersion
        )
      );
    }
  }

  return {
    valid: errors.length === 0,
    requiredBump,
    migrationNoteRequired,
    errors
  };
}

export function migrationNotePath(
  baselineVersion: string,
  currentVersion: string
): string {
  return `docs/migrations/v${baselineVersion}-to-v${currentVersion}.md`;
}

export function validateMigrationNote(
  source: string,
  baselineVersion: string,
  currentVersion: string
): readonly string[] {
  const errors: string[] = [];
  const normalized = source.replaceAll('\r\n', '\n').trim();

  if (!normalized.includes(`v${baselineVersion}`)) {
    errors.push(`Migration note must mention baseline v${baselineVersion}.`);
  }
  if (!normalized.includes(`v${currentVersion}`)) {
    errors.push(`Migration note must mention current v${currentVersion}.`);
  }
  if (!/^##\s+(Breaking changes|호환성 중단 변경)\s*$/im.test(normalized)) {
    errors.push(
      'Migration note must include a `## Breaking changes` or `## 호환성 중단 변경` section.'
    );
  }

  const prose = normalized
    .replace(/<!--[^]*?-->/g, '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (prose.length < 80) {
    errors.push('Migration note must contain actionable migration guidance.');
  }

  return errors;
}

