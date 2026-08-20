import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const smokeRoot = await mkdtemp(join(tmpdir(), 'zdp-client-sdks-pack-smoke-'));
const packageRoot = join(smokeRoot, 'package');
const consumerRoot = join(smokeRoot, 'consumer');

await mkdir(packageRoot, { recursive: true });

try {
  const requestedTarball = readTarballArgument(process.argv.slice(2));
  const tarball =
    requestedTarball === undefined
      ? await packRepository(packageRoot)
      : resolve(repositoryRoot, requestedTarball);
  await access(tarball);
  await verifyConsumer(tarball, consumerRoot);
  console.log('zdp-client-sdks packed consumer smoke passed.');
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}

async function packRepository(packageRoot: string): Promise<string> {
  await run(
    npmCommand(),
    ['pack', '--json', '--pack-destination', packageRoot],
    repositoryRoot
  );
  const tarballs = (await readdir(packageRoot)).filter((file) =>
    file.endsWith('.tgz')
  );
  assert.equal(tarballs.length, 1, 'npm pack must create one tarball.');
  return join(packageRoot, tarballs[0] ?? '');
}

async function verifyConsumer(tarball: string, consumerRoot: string): Promise<void> {
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    join(consumerRoot, 'package.json'),
    `${JSON.stringify(
      { name: 'zdp-client-sdks-pack-smoke', private: true, type: 'module' },
      null,
      2
    )}\n`,
    'utf8'
  );
  await writeFile(join(consumerRoot, 'smoke.ts'), smokeSource(), 'utf8');
  await run(
    npmCommand(),
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarball
    ],
    consumerRoot
  );
  await run(bunCommand(), ['smoke.ts'], consumerRoot);
}

function smokeSource(): string {
  return `import {
  createZdpClient,
  createZdpTypedFetchClient,
  defineZdpOperation
} from 'zdp-client-sdks';
import { defineZdpOperations } from 'zdp-client-sdks/typed-fetch';
import {
  ZDP_API_SCHEMA_MODEL_MAP,
  ZDP_TYPED_FETCH_OPERATION_MAP
} from 'zdp-client-sdks/typed-fetch/api-operations';
import {
  createZdpFetchUploadTransport,
  createZdpSignedUploadClient,
  createZdpXhrUploadTransport
} from 'zdp-client-sdks/upload';

if (
  typeof createZdpClient !== 'function' ||
  typeof createZdpTypedFetchClient !== 'function' ||
  typeof defineZdpOperation !== 'function' ||
  typeof defineZdpOperations !== 'function' ||
  typeof createZdpSignedUploadClient !== 'function' ||
  typeof createZdpFetchUploadTransport !== 'function' ||
  typeof createZdpXhrUploadTransport !== 'function'
) {
  throw new Error('Public runtime exports were not consumable.');
}
if (
  Object.keys(ZDP_API_SCHEMA_MODEL_MAP).length === 0 ||
  Object.keys(ZDP_TYPED_FETCH_OPERATION_MAP).length === 0
) {
  throw new Error('Generated API operation metadata was not consumable.');
}
`;
}

function readTarballArgument(args: readonly string[]): string | undefined {
  if (args.length === 0) {
    return undefined;
  }
  if (args.length !== 2 || args[0] !== '--tarball' || !args[1]) {
    throw new Error(
      'Usage: bun scripts/smoke-packed-package.ts [--tarball <path>]'
    );
  }
  return args[1];
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

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function bunCommand(): string {
  return process.execPath;
}
