import assert from 'node:assert/strict';
import { access, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageExportTarget {
  readonly types: string;
  readonly import: string;
  readonly default: string;
}

interface PackageManifest {
  readonly types: string;
  readonly files: readonly string[];
  readonly exports: Readonly<Record<string, PackageExportTarget>>;
}

const PUBLIC_EXPORTS = [
  '.',
  './typed-fetch',
  './typed-fetch/api-operations'
] as const;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = join(repositoryRoot, 'dist');
const typescriptCli = join(
  repositoryRoot,
  'node_modules',
  'typescript',
  'bin',
  'tsc'
);

await rm(distRoot, { recursive: true, force: true });
await run(
  process.execPath,
  [typescriptCli, '-p', 'tsconfig.build.json'],
  repositoryRoot
);

const outputFiles = await listFiles(distRoot);
const relativeOutputFiles = new Set(
  outputFiles.map((path) => toPosixPath(relative(repositoryRoot, path)))
);

for (const outputFile of outputFiles) {
  if (!outputFile.endsWith('.js') && !outputFile.endsWith('.d.ts')) {
    continue;
  }

  const relativeOutputFile = toPosixPath(
    relative(repositoryRoot, outputFile)
  );
  const outputExtension = outputFile.endsWith('.d.ts') ? '.d.ts' : '.js';
  const source = await readFile(outputFile, 'utf8');
  const rewritten = rewriteRelativeEsmSpecifiers(
    source,
    relativeOutputFile,
    outputExtension,
    relativeOutputFiles
  );
  await writeFile(outputFile, rewritten, 'utf8');
}

await validatePackageOutput(outputFiles);
console.log('Compiled ESM package build passed.');

function rewriteRelativeEsmSpecifiers(
  source: string,
  outputFile: string,
  outputExtension: '.js' | '.d.ts',
  availableOutputs: ReadonlySet<string>
): string {
  const rewrite = (
    _match: string,
    prefix: string,
    specifier: string,
    suffix: string
  ): string =>
    `${prefix}${resolveRelativeSpecifier(
      specifier,
      outputFile,
      outputExtension,
      availableOutputs
    )}${suffix}`;

  return source
    .replace(
      /(\bfrom\s*["'])(\.{1,2}\/[^"']+)(["'])/gu,
      rewrite
    )
    .replace(
      /(\bimport\s*["'])(\.{1,2}\/[^"']+)(["'])/gu,
      rewrite
    )
    .replace(
      /(\bimport\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/gu,
      rewrite
    );
}

function resolveRelativeSpecifier(
  specifier: string,
  outputFile: string,
  outputExtension: '.js' | '.d.ts',
  availableOutputs: ReadonlySet<string>
): string {
  if (/\.(?:cjs|js|json|mjs|node)$/u.test(specifier)) {
    return specifier;
  }

  const basePath = posix.normalize(
    posix.join(posix.dirname(outputFile), specifier)
  );
  const directOutput = `${basePath}${outputExtension}`;
  if (availableOutputs.has(directOutput)) {
    return `${specifier}.js`;
  }

  const indexOutput = posix.join(basePath, `index${outputExtension}`);
  if (availableOutputs.has(indexOutput)) {
    return `${specifier.replace(/\/$/u, '')}/index.js`;
  }

  throw new Error(
    `Cannot resolve emitted relative import \`${specifier}\` from \`${outputFile}\`.`
  );
}

async function validatePackageOutput(
  outputFiles: readonly string[]
): Promise<void> {
  const manifest = parsePackageManifest(
    JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
  );
  assert.deepEqual(
    Object.keys(manifest.exports).sort(),
    [...PUBLIC_EXPORTS].sort(),
    'package.json must expose only the reviewed public subpaths.'
  );
  assert.equal(
    manifest.types,
    manifest.exports['.']?.types,
    'Root types must match the root export types target.'
  );
  assert.ok(
    manifest.files.includes('dist/'),
    'package.json files must include compiled dist output.'
  );
  assert.ok(
    !manifest.files.includes('src/'),
    'package.json files must not publish TypeScript source.'
  );

  for (const exportName of PUBLIC_EXPORTS) {
    const target = manifest.exports[exportName];
    assert.ok(target, `Missing package export ${exportName}.`);
    assert.match(target.types, /^\.\/dist\/.+\.d\.ts$/u);
    assert.match(target.import, /^\.\/dist\/.+\.js$/u);
    assert.equal(target.default, target.import);
    await access(join(repositoryRoot, target.types.slice(2)));
    await access(join(repositoryRoot, target.import.slice(2)));
  }

  assert.ok(outputFiles.length > 0, 'TypeScript build emitted no files.');
  for (const outputFile of outputFiles) {
    const relativeOutputFile = toPosixPath(
      relative(repositoryRoot, outputFile)
    );
    assert.ok(
      outputFile.endsWith('.js') || outputFile.endsWith('.d.ts'),
      `Unexpected compiled package file: ${relativeOutputFile}`
    );

    const source = await readFile(outputFile, 'utf8');
    for (const specifier of readRelativeEsmSpecifiers(source)) {
      assert.match(
        specifier,
        /\.(?:cjs|js|json|mjs|node)$/u,
        `Emitted import \`${specifier}\` in \`${relativeOutputFile}\` lacks a runtime extension.`
      );
      assert.ok(
        !specifier.endsWith('.ts'),
        `Emitted import \`${specifier}\` in \`${relativeOutputFile}\` exposes TypeScript source.`
      );
    }
  }
}

function readRelativeEsmSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s*["'](\.{1,2}\/[^"']+)["']/gu,
    /\bimport\s*["'](\.{1,2}\/[^"']+)["']/gu,
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/gu
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort();
}

function parsePackageManifest(value: unknown): PackageManifest {
  assert.ok(isRecord(value), 'package.json must contain an object.');
  const types = value.types;
  const files = value.files;
  const exportsValue = value.exports;
  if (typeof types !== 'string') {
    throw new Error('package.json must declare a string types target.');
  }
  if (!Array.isArray(files) || !files.every((entry) => typeof entry === 'string')) {
    throw new Error('package.json files must be a string array.');
  }
  if (!isRecord(exportsValue)) {
    throw new Error('package.json must declare an exports object.');
  }

  const exports: Record<string, PackageExportTarget> = {};
  for (const [name, targetValue] of Object.entries(exportsValue)) {
    if (!isRecord(targetValue)) {
      throw new Error(`package export ${name} must be an object.`);
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
        `package export ${name} must declare types, import, and default targets.`
      );
    }
    exports[name] = {
      types: targetTypes,
      import: targetImport,
      default: targetDefault
    };
  }

  return { types, files, exports };
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

function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
