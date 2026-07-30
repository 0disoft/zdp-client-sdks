import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFile,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly files: readonly string[];
  readonly [key: string]: unknown;
}

interface PackResult {
  readonly filename: string;
  readonly integrity: string;
}

interface ReleaseArtifact {
  readonly tarball: string;
  readonly integrity: string;
  readonly manifest: string;
  readonly notes: string;
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const checkGitHead = '0123456789abcdef0123456789abcdef01234567';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--check') {
  const checkDirectory = await mkdtemp(
    join(tmpdir(), 'zdp-client-sdks-release-check-')
  );
  try {
    await buildArtifact(checkGitHead, checkDirectory);
    console.log('Release artifact check passed.');
  } finally {
    await rm(checkDirectory, { recursive: true, force: true });
  }
} else {
  const gitHead = readRequiredArgument(args, '--git-head');
  const githubOutput = readRequiredArgument(args, '--github-output');
  const artifact = await buildArtifact(gitHead, repositoryRoot);
  await appendFile(
    githubOutput,
    [
      `tarball=${basename(artifact.tarball)}`,
      `integrity=${artifact.integrity}`,
      `manifest=${basename(artifact.manifest)}`,
      `notes=${basename(artifact.notes)}`,
      ''
    ].join('\n'),
    'utf8'
  );
}

async function buildArtifact(
  gitHead: string,
  artifactDirectory: string
): Promise<ReleaseArtifact> {
  assert.match(
    gitHead,
    /^[0-9a-f]{40}$/i,
    'gitHead must be a 40-character Git commit SHA.'
  );

  const packageManifest = parsePackageManifest(
    JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
  );
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), 'zdp-client-sdks-release-artifact-')
  );
  const stagingDirectory = join(temporaryRoot, 'package');
  await mkdir(stagingDirectory);

  try {
    for (const entry of packageManifest.files) {
      assertRelativePackagePath(entry);
      await cp(join(repositoryRoot, entry), join(stagingDirectory, entry), {
        recursive: true
      });
    }

    await writeFile(
      join(stagingDirectory, 'package.json'),
      `${JSON.stringify({ ...packageManifest, gitHead }, null, 2)}\n`,
      'utf8'
    );
    await mkdir(artifactDirectory, { recursive: true });

    const packOutput = await runCapture(
      npmCommand(),
      ['pack', '--json', '--pack-destination', artifactDirectory],
      stagingDirectory
    );
    const packed = parsePackResult(JSON.parse(packOutput));
    const tarball = resolve(artifactDirectory, packed.filename);
    assert.equal(
      relative(resolve(artifactDirectory), tarball),
      packed.filename,
      'npm pack returned a path outside the artifact directory.'
    );

    const archive = await readFile(tarball);
    const integrity = `sha512-${createHash('sha512')
      .update(archive)
      .digest('base64')}`;
    assert.equal(
      packed.integrity,
      integrity,
      'npm pack integrity does not match the tarball bytes.'
    );

    const packedManifest = parsePackageManifest(
      JSON.parse(readTarEntry(archive, 'package/package.json').toString('utf8'))
    );
    assert.equal(
      readStringProperty(packedManifest, 'gitHead'),
      gitHead,
      'Packed package.json does not contain the release gitHead.'
    );
    assert.equal(packedManifest.name, packageManifest.name);
    assert.equal(packedManifest.version, packageManifest.version);

    const releaseManifest = resolve(
      artifactDirectory,
      'release-artifact.json'
    );
    await writeFile(
      releaseManifest,
      `${JSON.stringify(
        {
          schemaVersion: 'zdp.npm-release-artifact/v1',
          package: packageManifest.name,
          version: packageManifest.version,
          gitHead,
          tarball: packed.filename,
          integrity
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const releaseNotes = resolve(artifactDirectory, 'release-notes.md');
    await writeFile(
      releaseNotes,
      extractReleaseNotes(
        await readFile(join(repositoryRoot, 'CHANGELOG.md'), 'utf8'),
        packageManifest.version
      ),
      'utf8'
    );

    return {
      tarball,
      integrity,
      manifest: releaseManifest,
      notes: releaseNotes
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function parsePackageManifest(value: unknown): PackageManifest {
  assert.ok(isRecord(value), 'package.json must contain an object.');
  const name = value.name;
  const version = value.version;
  const files = value.files;
  if (typeof name !== 'string') {
    throw new Error('package.json must declare name.');
  }
  if (typeof version !== 'string') {
    throw new Error('package.json must declare version.');
  }
  if (!Array.isArray(files)) {
    throw new Error('package.json must declare files.');
  }
  if (!files.every((entry) => typeof entry === 'string')) {
    throw new Error('package.json files entries must be strings.');
  }
  return {
    ...value,
    name,
    version,
    files
  };
}

function parsePackResult(value: unknown): PackResult {
  assert.ok(Array.isArray(value), 'npm pack output must be an array.');
  assert.equal(value.length, 1, 'npm pack must create exactly one tarball.');
  const result = value[0];
  assert.ok(isRecord(result), 'npm pack result must be an object.');
  const filename = result.filename;
  const integrity = result.integrity;
  if (typeof filename !== 'string' || typeof integrity !== 'string') {
    throw new Error('npm pack result must contain filename and integrity.');
  }
  assert.equal(basename(filename), filename);
  return { filename, integrity };
}

function readTarEntry(archive: Buffer, expectedName: string): Buffer {
  const tar = gunzipSync(archive);
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const readHeaderString = (start: number, end: number): string => {
      const source = header.subarray(start, end).toString('utf8');
      const terminator = source.indexOf('\0');
      return terminator >= 0 ? source.slice(0, terminator) : source;
    };
    const name = readHeaderString(0, 100);
    const prefix = readHeaderString(345, 500);
    const path = prefix.length > 0 ? `${prefix}/${name}` : name;
    const sizeText = readHeaderString(124, 136).trim();
    const size = sizeText.length > 0 ? Number.parseInt(sizeText, 8) : 0;
    assert.ok(Number.isSafeInteger(size) && size >= 0, `Invalid tar size: ${path}`);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    assert.ok(contentEnd <= tar.length, `Truncated tar entry: ${path}`);
    if (path === expectedName) {
      return tar.subarray(contentStart, contentEnd);
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`Tar entry ${expectedName} was not found.`);
}

function extractReleaseNotes(changelog: string, version: string): string {
  const normalized = changelog.replaceAll('\r\n', '\n');
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^##\\s+${escapedVersion}\\b.*$`, 'm');
  const match = heading.exec(normalized);
  assert.ok(match?.index !== undefined, `CHANGELOG.md lacks ${version}.`);
  const bodyStart = match.index;
  const remaining = normalized.slice(bodyStart + match[0].length);
  const nextHeading = remaining.search(/^##\s+/m);
  const bodyEnd =
    nextHeading === -1
      ? normalized.length
      : bodyStart + match[0].length + nextHeading;
  return `${normalized.slice(bodyStart, bodyEnd).trim()}\n`;
}

function assertRelativePackagePath(path: string): void {
  const segments = path.replaceAll('\\', '/').split('/');
  assert.ok(path.length > 0, 'Package file entry must not be empty.');
  assert.ok(!isAbsolute(path), `Package file entry must be relative: ${path}`);
  assert.ok(!segments.includes('..'), `Package file entry escapes root: ${path}`);
}

function readRequiredArgument(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  assert.ok(value, `Missing ${name} value.`);
  return value;
}

function readStringProperty(
  value: Record<string, unknown>,
  name: string
): string | undefined {
  const property = value[name];
  return typeof property === 'string' ? property : undefined;
}

async function runCapture(
  command: string,
  commandArgs: readonly string[],
  cwd: string
): Promise<string> {
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
