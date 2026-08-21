import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  evaluateSemverGate,
  migrationNotePath,
  validateMigrationNote
} from '../scripts/sdk-semver/index';

const migrationNote = `# SDK migration v0.15.3 to v0.16.0

## Breaking changes

Remove the retired request fields from referral calls and switch consumers to the generated domain method. Update typed fixtures and run the consumer build before publishing.
`;

describe('SDK SemVer release gate', () => {
  it('requires a minor bump and migration note for pre-1.0 breaking changes', () => {
    expect(
      evaluateSemverGate({
        baselineVersion: '0.15.3',
        currentVersion: '0.15.4',
        compatibility: 'breaking',
        migrationNote
      }).valid
    ).toBe(false);

    const result = evaluateSemverGate({
      baselineVersion: '0.15.3',
      currentVersion: '0.16.0',
      compatibility: 'breaking',
      migrationNote
    });
    expect(result.valid).toBe(true);
    expect(result.requiredBump).toBe('minor');
    expect(result.migrationNoteRequired).toBe(true);
  });

  it('requires a major bump for stable breaking changes', () => {
    expect(
      evaluateSemverGate({
        baselineVersion: '1.4.2',
        currentVersion: '1.5.0',
        compatibility: 'breaking',
        migrationNote: migrationNote
          .replace('v0.15.3', 'v1.4.2')
          .replace('v0.16.0', 'v1.5.0')
      }).valid
    ).toBe(false);

    expect(
      evaluateSemverGate({
        baselineVersion: '1.4.2',
        currentVersion: '2.0.0',
        compatibility: 'breaking',
        migrationNote: migrationNote
          .replace('v0.15.3', 'v1.4.2')
          .replace('v0.16.0', 'v2.0.0')
      }).valid
    ).toBe(true);
  });

  it('rejects version regression even when the generated surface is unchanged', () => {
    const result = evaluateSemverGate({
      baselineVersion: '0.16.0',
      currentVersion: '0.15.9',
      compatibility: 'none',
      migrationNote: null
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('must not be older');
  });

  it('validates the transition-specific migration note contract', () => {
    expect(migrationNotePath('0.15.3', '0.16.0')).toBe(
      'docs/migrations/v0.15.3-to-v0.16.0.md'
    );
    expect(validateMigrationNote(migrationNote, '0.15.3', '0.16.0')).toEqual(
      []
    );
    expect(
      validateMigrationNote('# Missing detail', '0.15.3', '0.16.0')
    ).not.toEqual([]);
  });

  it('keeps the checker wired into full-history CI', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    const ci = readFileSync(
      join(process.cwd(), '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(packageJson.scripts?.check).toContain('sdk-semver:check');
    expect(packageJson.scripts?.['release:check']).toContain(
      'sdk-semver:check'
    );
    expect(ci).toContain('fetch-depth: 0');
  });
});
