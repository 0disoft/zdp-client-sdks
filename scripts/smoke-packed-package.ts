import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

interface SmokeOptions {
  readonly tarball?: string;
  readonly vite: boolean;
}

interface PackageExportTarget {
  readonly types: string;
  readonly import: string;
  readonly default: string;
}

interface InstalledPackageManifest {
  readonly name: string;
  readonly version: string;
  readonly types: string;
  readonly files: readonly string[];
  readonly exports: Readonly<Record<string, PackageExportTarget>>;
}

const PACKAGE_NAME = 'zdp-client-sdks';
const PUBLIC_EXPORTS = [
  '.',
  './typed-fetch',
  './typed-fetch/api-operations'
] as const;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const smokeRoot = await mkdtemp(join(tmpdir(), 'zdp-client-sdks-pack-smoke-'));
const packageRoot = join(smokeRoot, 'package');
const consumerRoot = join(smokeRoot, 'consumer');
const options = readOptions(process.argv.slice(2));

await mkdir(packageRoot, { recursive: true });

try {
  const tarball =
    options.tarball === undefined
      ? await packRepository(packageRoot)
      : resolve(repositoryRoot, options.tarball);
  await access(tarball);
  await verifyConsumer(tarball, consumerRoot, options.vite);
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

async function verifyConsumer(
  tarball: string,
  consumerRoot: string,
  verifyVite: boolean
): Promise<void> {
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
  await run(
    npmCommand(),
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--save-exact',
      tarball
    ],
    consumerRoot
  );

  const manifest = await verifyInstalledPackageShape(consumerRoot);
  await verifyRuntimeConsumers(consumerRoot, manifest.version);
  await verifyTypeScriptConsumer(consumerRoot);
  if (verifyVite) {
    await verifyViteConsumer(consumerRoot);
  }
}

async function verifyInstalledPackageShape(
  consumerRoot: string
): Promise<InstalledPackageManifest> {
  const installedRoot = join(consumerRoot, 'node_modules', PACKAGE_NAME);
  const manifest = parseInstalledPackageManifest(
    JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'))
  );

  assert.equal(manifest.name, PACKAGE_NAME);
  assert.deepEqual(
    Object.keys(manifest.exports).sort(),
    [...PUBLIC_EXPORTS].sort()
  );
  assert.equal(manifest.types, manifest.exports['.']?.types);
  assert.ok(manifest.files.includes('dist/'));
  assert.ok(!manifest.files.includes('src/'));

  for (const exportName of PUBLIC_EXPORTS) {
    const target = manifest.exports[exportName];
    assert.ok(target, `Installed package is missing export ${exportName}.`);
    assert.match(target.types, /^\.\/dist\/.+\.d\.ts$/u);
    assert.match(target.import, /^\.\/dist\/.+\.js$/u);
    assert.equal(target.default, target.import);
    await access(join(installedRoot, target.types.slice(2)));
    await access(join(installedRoot, target.import.slice(2)));
  }

  await assertPathMissing(join(installedRoot, 'src'));
  return manifest;
}

async function verifyRuntimeConsumers(
  consumerRoot: string,
  expectedVersion: string
): Promise<void> {
  await writeFile(
    join(consumerRoot, 'runtime-smoke.mjs'),
    `import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createZdpApiClient,
  createZdpTypedFetchClient
} from 'zdp-client-sdks';
import {
  defineZdpOperation,
  defineZdpOperations
} from 'zdp-client-sdks/typed-fetch';
import {
  ZDP_API_SCHEMA_MODEL_MAP,
  ZDP_TYPED_FETCH_OPERATION_MAP
} from 'zdp-client-sdks/typed-fetch/api-operations';

const expectedVersion = process.argv[2];
const manifest = JSON.parse(
  await readFile(
    join(process.cwd(), 'node_modules', 'zdp-client-sdks', 'package.json'),
    'utf8'
  )
);
if (manifest.version !== expectedVersion) {
  throw new Error(
    \`Expected zdp-client-sdks@\${expectedVersion}, installed \${manifest.version}.\`
  );
}
if (
  typeof createZdpApiClient !== 'function' ||
  typeof createZdpTypedFetchClient !== 'function' ||
  typeof defineZdpOperation !== 'function' ||
  typeof defineZdpOperations !== 'function'
) {
  throw new Error('Compiled runtime exports were not consumable.');
}
if (
  Object.keys(ZDP_API_SCHEMA_MODEL_MAP).length === 0 ||
  Object.keys(ZDP_TYPED_FETCH_OPERATION_MAP).length === 0
) {
  throw new Error('Compiled generated API metadata was not consumable.');
}
const client = createZdpApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async () => new Response(null, { status: 204 })
});
if (typeof client.call !== 'function') {
  throw new Error('Compiled API client factory returned an invalid client.');
}
console.log(\`zdp-client-sdks@\${expectedVersion} runtime smoke passed.\`);
`,
    'utf8'
  );

  await run(
    nodeCommand(),
    ['runtime-smoke.mjs', expectedVersion],
    consumerRoot
  );
  await run(
    process.execPath,
    ['runtime-smoke.mjs', expectedVersion],
    consumerRoot
  );
}

async function verifyTypeScriptConsumer(consumerRoot: string): Promise<void> {
  await writeFile(
    join(consumerRoot, 'type-smoke.ts'),
    `import {
  createZdpApiClient,
  type ZdpApiOperationId,
  type ZdpApiOperationRequest,
  type ZdpApiOperationResponse
} from 'zdp-client-sdks';
import type {
  ZdpTypedFetchClientOptions
} from 'zdp-client-sdks/typed-fetch';
import {
  ZDP_TYPED_FETCH_OPERATION_MAP
} from 'zdp-client-sdks/typed-fetch/api-operations';

const operationId =
  'core.auth.sessions.get_current' satisfies ZdpApiOperationId;
const request: ZdpApiOperationRequest<typeof operationId> = {};
type CurrentSessionResponse = ZdpApiOperationResponse<typeof operationId>;
const options: ZdpTypedFetchClientOptions = {
  baseUrl: 'https://api.example.test'
};
const client = createZdpApiClient(options);
const metadata = ZDP_TYPED_FETCH_OPERATION_MAP[operationId];
const preserveResponseType = (
  response: CurrentSessionResponse
): CurrentSessionResponse => response;

void request;
void client;
void metadata;
void preserveResponseType;
`,
    'utf8'
  );
  await writeFile(
    join(consumerRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          skipLibCheck: false,
          noEmit: true,
          types: []
        },
        include: ['type-smoke.ts']
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  await run(
    nodeCommand(),
    [
      join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '-p',
      'tsconfig.json'
    ],
    consumerRoot
  );
}

async function verifyViteConsumer(consumerRoot: string): Promise<void> {
  await mkdir(join(consumerRoot, 'src'), { recursive: true });
  await writeFile(
    join(consumerRoot, 'index.html'),
    '<!doctype html><html><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>\n',
    'utf8'
  );
  await writeFile(
    join(consumerRoot, 'src', 'main.ts'),
    `import { createZdpApiClient } from 'zdp-client-sdks';
import {
  ZDP_TYPED_FETCH_OPERATION_MAP
} from 'zdp-client-sdks/typed-fetch/api-operations';

const client = createZdpApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async () => new Response(null, { status: 204 })
});
const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('Vite smoke root element was not found.');
}
app.textContent = \`\${Object.keys(ZDP_TYPED_FETCH_OPERATION_MAP).length}:\${typeof client.call}\`;
`,
    'utf8'
  );

  await run(
    npmCommand(),
    [
      'exec',
      '--yes',
      '--package=vite@8',
      '--',
      'vite',
      'build',
      '--logLevel',
      'warn'
    ],
    consumerRoot
  );
  await access(join(consumerRoot, 'dist', 'index.html'));
}

function readOptions(args: readonly string[]): SmokeOptions {
  let tarball: string | undefined;
  let vite = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--vite') {
      vite = true;
      continue;
    }
    if (argument === '--tarball') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--tarball requires a path.');
      }
      tarball = value;
      index += 1;
      continue;
    }
    throw new Error(
      'Usage: bun scripts/smoke-packed-package.ts [--tarball <path>] [--vite]'
    );
  }

  return tarball === undefined ? { vite } : { tarball, vite };
}

function parseInstalledPackageManifest(value: unknown): InstalledPackageManifest {
  assert.ok(isRecord(value), 'Installed package.json must be an object.');
  const name = value.name;
  const version = value.version;
  const types = value.types;
  const files = value.files;
  const exportsValue = value.exports;
  if (
    typeof name !== 'string' ||
    typeof version !== 'string' ||
    typeof types !== 'string'
  ) {
    throw new Error('Installed package must declare name, version, and types.');
  }
  if (!Array.isArray(files) || !files.every((entry) => typeof entry === 'string')) {
    throw new Error('Installed package files must be a string array.');
  }
  if (!isRecord(exportsValue)) {
    throw new Error('Installed package exports must be an object.');
  }

  const exports: Record<string, PackageExportTarget> = {};
  for (const [exportName, targetValue] of Object.entries(exportsValue)) {
    if (!isRecord(targetValue)) {
      throw new Error(`Installed export ${exportName} must be an object.`);
    }
    const targetTypes = targetValue.types;
    const targetImport = targetValue.import;
    const targetDefault = targetValue.default;
    if (
      typeof targetTypes !== 'string' ||
      typeof targetImport !== 'string' ||
      typeof targetDefault !== 'string'
    ) {
      throw new Error(
        `Installed export ${exportName} must declare types, import, and default targets.`
      );
    }
    exports[exportName] = {
      types: targetTypes,
      import: targetImport,
      default: targetDefault
    };
  }

  return { name, version, types, files, exports };
}

async function assertPathMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  throw new Error(`Unexpected packaged path: ${path}`);
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

function nodeCommand(): string {
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function isNodeError(error: unknown): error is Error & { readonly code: string } {
  return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
