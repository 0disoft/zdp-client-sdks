import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareExactSemver,
  readNpmErrorCode
} from '../scripts/release-helpers';

const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
const workflowSource = readFileSync(workflowPath, 'utf8');
const workflow = readRecord(Bun.YAML.parse(workflowSource), 'workflow');
const publishJob = readRecord(
  readRecord(workflow.jobs, 'workflow.jobs').publish,
  'workflow.jobs.publish'
);
const steps = readArray(publishJob.steps, 'workflow.jobs.publish.steps');

describe('npm Trusted Publisher release workflow', () => {
  it('is tag-only, globally serialized, and bound to the npm environment', () => {
    const trigger = readRecord(workflow.on, 'workflow.on');
    const push = readRecord(trigger.push, 'workflow.on.push');
    expect(push.tags).toEqual(['v*']);

    const concurrency = readRecord(workflow.concurrency, 'workflow.concurrency');
    expect(concurrency.group).toBe('npm-release-${{ github.repository }}');
    expect(concurrency['cancel-in-progress']).toBe(false);
    expect(publishJob.environment).toBe('npm');

    const permissions = readRecord(
      publishJob.permissions,
      'workflow.jobs.publish.permissions'
    );
    expect(permissions.contents).toBe('write');
    expect(permissions['id-token']).toBe('write');
  });

  it('pins actions, API input, Node, npm, and Bun exactly', () => {
    expect(stepUses('Checkout client SDKs')).toBe(
      'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0'
    );
    expect(stepUses('Set up Node')).toBe(
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e'
    );
    expect(stepUses('Set up Bun')).toBe(
      'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'
    );
    expect(stepWith('Checkout client SDKs')).toMatchObject({
      'fetch-depth': 0,
      'persist-credentials': false
    });
    expect(stepWith('Checkout API contracts')).toMatchObject({
      'persist-credentials': false,
      ref: 'b9c351c10e4fdbb678cab521b9f853dcfc34cc4e'
    });
    expect(stepWith('Set up Node')['node-version']).toBe('24.18.0');
    expect(stepWith('Set up Bun')['bun-version']).toBe('1.3.14');
    expect(stepRun('Verify trusted publishing runtime')).toContain(
      '"11.16.0"'
    );
  });

  it('requires main ancestry, an exact version tag, and OIDC provenance', () => {
    expect(stepRun('Verify tagged commit is on main')).toContain(
      'git merge-base --is-ancestor "$GITHUB_SHA" "origin/main"'
    );
    expect(stepRun('Verify release tag')).toContain(
      'expected_tag="v${package_version}"'
    );
    expect(stepRun('Check npm registry state')).toContain(
      'scripts/check-registry-release-state.ts'
    );
    expect(stepRun('Publish package')).toContain('--access public');
    expect(stepRun('Publish package')).toContain('--provenance');
    expect(workflowSource).not.toContain('NODE_AUTH_TOKEN');
    expect(workflowSource).not.toContain('NPM_TOKEN');
    expect(workflowSource).not.toContain('secrets.');
  });

  it('publishes the exact smoke-tested artifact and verifies immutable anchors', () => {
    expect(stepRun('Verify packed consumer')).toContain(
      '--tarball "${{ steps.package_artifact.outputs.tarball }}"'
    );
    expect(stepRun('Publish package')).toContain(
      'npm publish "${{ steps.package_artifact.outputs.tarball }}"'
    );
    const registryVerification = stepRun('Verify npm registry result');
    expect(registryVerification).toContain('published_git_head');
    expect(registryVerification).toContain('published_integrity');
    expect(registryVerification).toContain(
      'steps.package_artifact.outputs.integrity'
    );
  });

  it('checks the published consumer, signatures, provenance, and release assets', () => {
    const publishedSmoke = readFileSync(
      join(process.cwd(), 'scripts', 'smoke-published-package.ts'),
      'utf8'
    );
    expect(stepRun('Verify published consumer and provenance')).toContain(
      'scripts/smoke-published-package.ts'
    );
    expect(stepRun('Verify published consumer and provenance')).toContain(
      '--git-head "$GITHUB_SHA"'
    );
    expect(publishedSmoke).toContain("['audit', 'signatures']");
    expect(publishedSmoke).toContain("'https://slsa.dev/provenance/v1'");
    const releaseStep = stepRun('Create GitHub release');
    expect(releaseStep).toContain('gh release create');
    expect(releaseStep).toContain('gh release download');
    expect(releaseStep).toContain('cmp "$RELEASE_TARBALL"');
    expect(releaseStep).toContain('cmp "$RELEASE_MANIFEST"');
    expect(releaseStep).toContain('cmp "$RELEASE_NOTES"');
  });
});

describe('release registry helpers', () => {
  it('orders exact semver versions without allowing latest rollback', () => {
    expect(compareExactSemver('0.13.1', '0.11.1')).toBeGreaterThan(0);
    expect(compareExactSemver('0.13.1', '0.13.2')).toBeLessThan(0);
    expect(compareExactSemver('0.13.1', '0.13.1-rc.1')).toBeGreaterThan(0);
    expect(compareExactSemver('0.13.1-rc.2', '0.13.1-rc.10')).toBeLessThan(0);
  });

  it('accepts only an explicit npm E404 as an absent version', () => {
    expect(readNpmErrorCode('{"error":{"code":"E404"}}')).toBe('E404');
    expect(
      readNpmErrorCode(
        'npm error code E404\nnpm error 404 Not Found\n{"error":{"code":"E404"}}'
      )
    ).toBe('E404');
    expect(readNpmErrorCode('{"error":{"code":"E429"}}')).toBe('E429');
    expect(readNpmErrorCode('network timeout')).toBeNull();
  });
});

function step(name: string): Record<string, unknown> {
  const result = steps.find(
    (candidate) => readRecord(candidate, 'workflow step').name === name
  );
  return readRecord(result, `workflow step ${name}`);
}

function stepRun(name: string): string {
  const run = step(name).run;
  if (typeof run !== 'string') {
    throw new Error(`Workflow step ${name} must declare run.`);
  }
  return run;
}

function stepUses(name: string): string {
  const uses = step(name).uses;
  if (typeof uses !== 'string') {
    throw new Error(`Workflow step ${name} must declare uses.`);
  }
  return uses;
}

function stepWith(name: string): Record<string, unknown> {
  return readRecord(step(name).with, `workflow step ${name}.with`);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}
