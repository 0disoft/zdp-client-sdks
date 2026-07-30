import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareExactSemver, readNpmErrorCode } from './release-helpers';

interface PackageIdentity {
  readonly name: string;
  readonly version: string;
}

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageIdentity = parsePackageIdentity(
  JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
);
const args = process.argv.slice(2);
const expectedGitHead = readRequiredArgument(args, '--git-head');
const githubOutput = readRequiredArgument(args, '--github-output');
assert.match(expectedGitHead, /^[0-9a-f]{40}$/i);

const latest = await readRegistryJson(
  [packageIdentity.name, 'dist-tags.latest'],
  true
);
const latestVersion = readOptionalVersion(latest, 'dist-tags.latest');
const exactSpec = `${packageIdentity.name}@${packageIdentity.version}`;
const exact = await readRegistryJson(
  [exactSpec, 'version', 'gitHead', 'dist.integrity'],
  true
);

let alreadyPublished = false;
if (exact !== null) {
  assert.ok(isRecord(exact), 'Exact npm version metadata must be an object.');
  assert.equal(exact.version, packageIdentity.version);
  assert.equal(
    exact.gitHead,
    expectedGitHead,
    `Published ${exactSpec} gitHead does not match the release SHA.`
  );
  alreadyPublished = true;
} else if (
  latestVersion !== null &&
  compareExactSemver(packageIdentity.version, latestVersion) <= 0
) {
  throw new Error(
    `Refusing to publish ${exactSpec}: npm latest is already ${latestVersion}.`
  );
}

await appendFile(
  githubOutput,
  `already_published=${alreadyPublished ? 'true' : 'false'}\n`,
  'utf8'
);
console.log(
  alreadyPublished
    ? `${exactSpec} already exists with the expected gitHead.`
    : `${exactSpec} is absent and is newer than npm latest ${latestVersion ?? '(none)'}.`
);

async function readRegistryJson(
  npmArgs: readonly string[],
  allowNotFound: boolean
): Promise<unknown | null> {
  const result = await runCapture(
    npmCommand(),
    ['view', ...npmArgs, '--json'],
    repositoryRoot
  );
  if (result.exitCode !== 0) {
    const errorCode = readNpmErrorCode(result.stdout, result.stderr);
    if (allowNotFound && errorCode === 'E404') {
      return null;
    }
    throw new Error(
      `npm view failed closed with ${errorCode ?? `exit ${result.exitCode}`}.`
    );
  }
  return JSON.parse(result.stdout) as unknown;
}

function readOptionalVersion(
  value: unknown | null,
  label: string
): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    const candidate = value['dist-tags'] ?? value.latest;
    if (typeof candidate === 'string') return candidate;
    if (isRecord(candidate) && typeof candidate.latest === 'string') {
      return candidate.latest;
    }
  }
  throw new Error(`npm ${label} output did not contain a version.`);
}

function parsePackageIdentity(value: unknown): PackageIdentity {
  assert.ok(isRecord(value));
  const name = value.name;
  const version = value.version;
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error('package.json must declare string name and version.');
  }
  return { name, version };
}

function readRequiredArgument(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  assert.ok(value, `Missing ${name} value.`);
  return value;
}

async function runCapture(
  command: string,
  commandArgs: readonly string[],
  cwd: string
): Promise<CommandResult> {
  const child = Bun.spawn([command, ...commandArgs], {
    cwd,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ]);
  return { exitCode, stdout, stderr };
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
