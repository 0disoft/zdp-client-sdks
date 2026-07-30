import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

interface PackageIdentity {
  readonly name: string;
  readonly version: string;
}

interface SmokeOptions {
  readonly packageSpec?: string;
  readonly gitHead: string;
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageIdentity = parsePackageIdentity(
  JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
);
const options = readOptions(process.argv.slice(2));
const requestedSpec =
  options.packageSpec ?? `${packageIdentity.name}@${packageIdentity.version}`;
const expectedVersion = parseExpectedVersion(requestedSpec, packageIdentity.name);
const smokeRoot = await mkdtemp(
  join(tmpdir(), 'zdp-client-sdks-registry-smoke-')
);

try {
  await writeFile(
    join(smokeRoot, 'package.json'),
    `${JSON.stringify(
      { name: 'zdp-client-sdks-registry-smoke', private: true, type: 'module' },
      null,
      2
    )}\n`,
    'utf8'
  );
  await writeFile(
    join(smokeRoot, 'smoke.ts'),
    `import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createZdpTypedFetchClient } from 'zdp-client-sdks';
import { defineZdpOperation } from 'zdp-client-sdks/typed-fetch';
import { ZDP_TYPED_FETCH_OPERATION_MAP } from 'zdp-client-sdks/typed-fetch/api-operations';

const expectedVersion = process.argv[2];
const manifest = JSON.parse(
  await readFile(join(process.cwd(), 'node_modules', 'zdp-client-sdks', 'package.json'), 'utf8')
);
if (manifest.version !== expectedVersion) {
  throw new Error(\`Expected zdp-client-sdks@\${expectedVersion}, installed \${manifest.version}.\`);
}
if (
  typeof createZdpTypedFetchClient !== 'function' ||
  typeof defineZdpOperation !== 'function' ||
  Object.keys(ZDP_TYPED_FETCH_OPERATION_MAP).length === 0
) {
  throw new Error('Published exports were not consumable.');
}
console.log(\`zdp-client-sdks@\${expectedVersion} registry smoke passed.\`);
`,
    'utf8'
  );

  await run(
    npmCommand(),
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--save-exact',
      requestedSpec
    ],
    smokeRoot
  );
  await run(process.execPath, ['smoke.ts', expectedVersion], smokeRoot);
  await run(npmCommand(), ['audit', 'signatures'], smokeRoot);
  await verifyProvenance(
    requestedSpec,
    expectedVersion,
    options.gitHead,
    smokeRoot
  );
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}

async function verifyProvenance(
  packageSpec: string,
  expectedVersion: string,
  expectedGitHead: string,
  cwd: string
): Promise<void> {
  assert.match(expectedGitHead, /^[0-9a-f]{40}$/i);
  const attestations: unknown = JSON.parse(
    await runCapture(
      npmCommand(),
      ['view', packageSpec, 'dist.attestations', '--json'],
      cwd
    )
  );
  const integrity: unknown = JSON.parse(
    await runCapture(
      npmCommand(),
      ['view', packageSpec, 'dist.integrity', '--json'],
      cwd
    )
  );
  assert.ok(isRecord(attestations));
  const attestationUrl = attestations.url;
  const provenanceSummary = attestations.provenance;
  if (typeof attestationUrl !== 'string') {
    throw new Error('Published attestation URL is missing.');
  }
  assert.ok(isRecord(provenanceSummary));
  assert.equal(
    provenanceSummary.predicateType,
    'https://slsa.dev/provenance/v1'
  );
  if (typeof integrity !== 'string') {
    throw new Error('Published package integrity is missing.');
  }

  const response = await fetch(attestationUrl);
  if (!response.ok) {
    throw new Error(`Attestation endpoint returned HTTP ${response.status}.`);
  }
  const document: unknown = await response.json();
  assert.ok(isRecord(document) && Array.isArray(document.attestations));
  const provenance = document.attestations.find(
    (entry) =>
      isRecord(entry) &&
      entry.predicateType === 'https://slsa.dev/provenance/v1'
  );
  assert.ok(isRecord(provenance), 'SLSA provenance bundle was not found.');
  const bundle = provenance.bundle;
  assert.ok(isRecord(bundle));
  const envelope = bundle.dsseEnvelope;
  assert.ok(isRecord(envelope) && typeof envelope.payload === 'string');
  const statement: unknown = JSON.parse(
    Buffer.from(envelope.payload, 'base64').toString('utf8')
  );
  assertProvenanceStatement(
    statement,
    expectedVersion,
    expectedGitHead,
    integrity
  );
}

function assertProvenanceStatement(
  value: unknown,
  expectedVersion: string,
  expectedGitHead: string,
  integrity: string
): void {
  assert.ok(isRecord(value));
  assert.equal(value.predicateType, 'https://slsa.dev/provenance/v1');
  assert.ok(Array.isArray(value.subject) && value.subject.length === 1);
  const subject = value.subject[0];
  assert.ok(isRecord(subject));
  assert.equal(subject.name, `pkg:npm/zdp-client-sdks@${expectedVersion}`);
  assert.ok(isRecord(subject.digest));
  assert.equal(subject.digest.sha512, integrityToHex(integrity));

  const predicate = value.predicate;
  assert.ok(isRecord(predicate));
  const definition = predicate.buildDefinition;
  assert.ok(isRecord(definition));
  const external = definition.externalParameters;
  assert.ok(isRecord(external));
  const workflow = external.workflow;
  assert.ok(isRecord(workflow));
  assert.equal(workflow.repository, 'https://github.com/0disoft/zdp-client-sdks');
  assert.equal(workflow.path, '.github/workflows/release.yml');
  assert.equal(workflow.ref, `refs/tags/v${expectedVersion}`);

  const dependencies = definition.resolvedDependencies;
  assert.ok(Array.isArray(dependencies));
  const source = dependencies.find(
    (entry) =>
      isRecord(entry) &&
      entry.uri ===
        `git+https://github.com/0disoft/zdp-client-sdks@refs/tags/v${expectedVersion}`
  );
  assert.ok(isRecord(source) && isRecord(source.digest));
  assert.equal(source.digest.gitCommit, expectedGitHead);
}

function integrityToHex(integrity: string): string {
  const prefix = 'sha512-';
  assert.ok(integrity.startsWith(prefix));
  return Buffer.from(integrity.slice(prefix.length), 'base64').toString('hex');
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

function readOptions(args: readonly string[]): SmokeOptions {
  let packageSpec: string | undefined;
  let gitHead: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name || !value) {
      throw new Error('Release smoke options must be name/value pairs.');
    }
    if (name === '--package-spec') {
      packageSpec = value;
    } else if (name === '--git-head') {
      gitHead = value;
    } else {
      throw new Error(`Unknown release smoke option ${name}.`);
    }
  }
  if (!gitHead) {
    throw new Error('Published smoke requires --git-head <40-char SHA>.');
  }
  return packageSpec === undefined ? { gitHead } : { packageSpec, gitHead };
}

function parseExpectedVersion(packageSpec: string, packageName: string): string {
  const prefix = `${packageName}@`;
  assert.ok(packageSpec.startsWith(prefix));
  const version = packageSpec.slice(prefix.length);
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  return version;
}

async function run(
  command: string,
  args: readonly string[],
  cwd: string
): Promise<void> {
  const child = Bun.spawn([command, ...args], {
    cwd,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit'
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${command} failed with exit code ${exitCode}.`);
  }
}

async function runCapture(
  command: string,
  args: readonly string[],
  cwd: string
): Promise<string> {
  const child = Bun.spawn([command, ...args], {
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
  if (stderr.length > 0) process.stderr.write(stderr);
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
