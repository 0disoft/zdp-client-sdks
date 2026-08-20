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
const jobs = readRecord(workflow.jobs, 'workflow.jobs');
const buildJob = readRecord(jobs.build, 'workflow.jobs.build');
const publishJob = readRecord(
  jobs.publish,
  'workflow.jobs.publish'
);
const verifyJob = readRecord(jobs.verify, 'workflow.jobs.verify');
const buildSteps = readArray(buildJob.steps, 'workflow.jobs.build.steps');
const publishSteps = readArray(publishJob.steps, 'workflow.jobs.publish.steps');
const verifySteps = readArray(verifyJob.steps, 'workflow.jobs.verify.steps');

describe('npm Trusted Publisher release workflow', () => {
  it('is tag-only, globally serialized, and bound to the npm environment', () => {
    const trigger = readRecord(workflow.on, 'workflow.on');
    const push = readRecord(trigger.push, 'workflow.on.push');
    expect(push.tags).toEqual(['v*']);

    const concurrency = readRecord(workflow.concurrency, 'workflow.concurrency');
    expect(concurrency.group).toBe('npm-release-${{ github.repository }}');
    expect(concurrency['cancel-in-progress']).toBe(false);
    expect(publishJob.environment).toBe('npm');
    expect(buildJob.environment).toBeUndefined();
    expect(verifyJob.environment).toBeUndefined();

    const permissions = readRecord(
      publishJob.permissions,
      'workflow.jobs.publish.permissions'
    );
    expect(permissions.contents).toBeUndefined();
    expect(permissions['id-token']).toBe('write');
  });

  it('isolates OIDC from repository and dependency code', () => {
    expect(readRecord(buildJob.permissions, 'build permissions')).toEqual({ contents: 'read' });
    expect(readRecord(publishJob.permissions, 'publish permissions')).toEqual({ 'id-token': 'write' });
    expect(readRecord(verifyJob.permissions, 'verify permissions')).toEqual({ contents: 'write' });
    expect(publishJob.needs).toBe('build');
    expect(verifyJob.needs).toBe('publish');
    expect(stepUses(buildSteps, 'Upload verified package artifact')).toContain('actions/upload-artifact@');
    expect(stepUses(publishSteps, 'Download verified package artifact')).toContain('actions/download-artifact@');
    const oidcJobSource = JSON.stringify(publishJob);
    expect(oidcJobSource).not.toContain('bun install');
    expect(oidcJobSource).not.toContain('bun run');
    expect(oidcJobSource).not.toContain('actions/checkout');
  });

  it('pins actions, API input, Node, npm, and Bun exactly', () => {
    expect(stepUses(buildSteps, 'Checkout client SDKs')).toBe(
      'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0'
    );
    expect(stepUses(buildSteps, 'Set up Node')).toBe(
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e'
    );
    expect(stepUses(buildSteps, 'Set up Bun')).toBe(
      'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'
    );
    expect(stepWith(buildSteps, 'Checkout client SDKs')).toMatchObject({
      'fetch-depth': 0,
      'persist-credentials': false
    });
    expect(stepWith(buildSteps, 'Checkout API contracts')).toMatchObject({
      'persist-credentials': false,
      ref: 'f7d63f2d9e713869e5b020be451b526dc442eec2'
    });
    expect(stepWith(buildSteps, 'Set up Node')['node-version']).toBe('24.18.0');
    expect(stepWith(buildSteps, 'Set up Bun')['bun-version']).toBe('1.3.14');
    expect(stepRun(buildSteps, 'Verify trusted publishing runtime')).toContain(
      '"11.16.0"'
    );
  });

  it('requires main ancestry, an exact version tag, and OIDC provenance', () => {
    expect(stepRun(buildSteps, 'Verify tagged commit is on main')).toContain(
      'git merge-base --is-ancestor "$GITHUB_SHA" "origin/main"'
    );
    expect(stepRun(buildSteps, 'Verify release tag')).toContain(
      'expected_tag="v${package_version}"'
    );
    expect(stepRun(publishSteps, 'Check npm registry state')).toContain('npm view');
    expect(stepRun(publishSteps, 'Publish package')).toContain('--access public');
    expect(stepRun(publishSteps, 'Publish package')).toContain('--provenance');
    expect(workflowSource).not.toContain('NODE_AUTH_TOKEN');
    expect(workflowSource).not.toContain('NPM_TOKEN');
    expect(workflowSource).not.toContain('secrets.');
  });

  it('publishes the exact smoke-tested artifact and verifies immutable anchors', () => {
    expect(stepRun(buildSteps, 'Verify packed consumer')).toContain(
      '--tarball "${{ steps.package_artifact.outputs.tarball }}"'
    );
    expect(stepRun(publishSteps, 'Publish package')).toContain(
      'npm publish "${{ steps.artifact.outputs.tarball }}"'
    );
    const registryVerification = stepRun(verifySteps, 'Verify npm registry result');
    expect(registryVerification).toContain('published_git_head');
    expect(registryVerification).toContain('published_integrity');
    expect(registryVerification).toContain(
      'steps.artifact.outputs.integrity'
    );
  });

  it('checks the published consumer, signatures, provenance, and release assets', () => {
    const publishedSmoke = readFileSync(
      join(process.cwd(), 'scripts', 'smoke-published-package.ts'),
      'utf8'
    );
    expect(stepRun(verifySteps, 'Verify published consumer and provenance')).toContain(
      'scripts/smoke-published-package.ts'
    );
    expect(stepRun(verifySteps, 'Verify published consumer and provenance')).toContain(
      '--git-head "$GITHUB_SHA"'
    );
    expect(publishedSmoke).toContain("['audit', 'signatures']");
    expect(publishedSmoke).toContain("'https://slsa.dev/provenance/v1'");
    const releaseStep = stepRun(verifySteps, 'Create GitHub release');
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

function step(steps: readonly unknown[], name: string): Record<string, unknown> {
  const result = steps.find(
    (candidate) => readRecord(candidate, 'workflow step').name === name
  );
  return readRecord(result, `workflow step ${name}`);
}

function stepRun(steps: readonly unknown[], name: string): string {
  const run = step(steps, name).run;
  if (typeof run !== 'string') {
    throw new Error(`Workflow step ${name} must declare run.`);
  }
  return run;
}

function stepUses(steps: readonly unknown[], name: string): string {
  const uses = step(steps, name).uses;
  if (typeof uses !== 'string') {
    throw new Error(`Workflow step ${name} must declare uses.`);
  }
  return uses;
}

function stepWith(steps: readonly unknown[], name: string): Record<string, unknown> {
  return readRecord(step(steps, name).with, `workflow step ${name}.with`);
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
