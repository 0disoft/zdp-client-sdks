import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageIdentity {
  readonly name: string;
  readonly version: string;
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageIdentity = parsePackageIdentity(
  JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
);
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'zdp-client-sdks-publish-dry-run-')
);
const userConfigPath = join(temporaryDirectory, 'npmrc');
const globalConfigPath = join(temporaryDirectory, 'global-npmrc');

try {
  await assertProjectNpmConfigAbsent();
  await writeFile(
    userConfigPath,
    'registry=https://registry.npmjs.org/\n',
    'utf8'
  );
  await writeFile(globalConfigPath, '', 'utf8');
  const output = await runCapture(
    npmCommand(),
    [
      'publish',
      '--dry-run',
      '--json',
      '--access',
      'public',
      '--userconfig',
      userConfigPath,
      '--globalconfig',
      globalConfigPath
    ],
    repositoryRoot,
    isolatedEnvironment(temporaryDirectory, userConfigPath, globalConfigPath)
  );
  const payload = parsePackagePayload(
    JSON.parse(output),
    packageIdentity.name
  );
  assert.equal(payload.name, packageIdentity.name);
  assert.equal(payload.version, packageIdentity.version);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function parsePackageIdentity(value: unknown): PackageIdentity {
  assert.ok(isRecord(value), 'package.json must contain an object.');
  const name = value.name;
  const version = value.version;
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error('package.json must declare string name and version.');
  }
  return { name, version };
}

function parsePackagePayload(
  value: unknown,
  packageName: string
): Record<string, unknown> {
  assert.ok(isRecord(value), 'npm publish dry-run output must be an object.');
  if (value.name === packageName) {
    return value;
  }
  const keyedPackage = value[packageName];
  assert.ok(
    isRecord(keyedPackage),
    `npm publish dry-run output does not contain ${packageName}.`
  );
  return keyedPackage;
}

function isolatedEnvironment(
  home: string,
  userConfig: string,
  globalConfig: string
): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const key of [
    'PATH',
    'SystemRoot',
    'ComSpec',
    'PATHEXT',
    'TEMP',
    'TMP',
    'TMPDIR',
    'LANG',
    'LC_ALL'
  ]) {
    const value = process.env[key];
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  environment.HOME = home;
  environment.USERPROFILE = home;
  environment.NPM_CONFIG_USERCONFIG = userConfig;
  environment.NPM_CONFIG_GLOBALCONFIG = globalConfig;
  environment.NPM_CONFIG_CACHE = join(home, 'npm-cache');
  environment.NPM_CONFIG_REGISTRY = 'https://registry.npmjs.org/';
  environment.NPM_CONFIG_UPDATE_NOTIFIER = 'false';
  return environment;
}

async function assertProjectNpmConfigAbsent(): Promise<void> {
  try {
    await access(join(repositoryRoot, '.npmrc'));
  } catch {
    return;
  }
  throw new Error('Tokenless dry-run refuses a repository-local .npmrc.');
}

async function runCapture(
  command: string,
  args: readonly string[],
  cwd: string,
  env: Record<string, string>
): Promise<string> {
  const child = Bun.spawn([command, ...args], {
    cwd,
    env,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ]);
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }
  if (exitCode !== 0) {
    throw new Error(`${command} failed with exit code ${exitCode}.`);
  }
  return stdout;
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
