import { execFileSync } from 'node:child_process';
import { compareExactSemver, parseExactSemver } from '../release-helpers';
import { readPackageVersion } from './metadata';

export interface SurfacePaths {
  readonly packagePath: string;
  readonly apiLockPath: string;
  readonly operationsPath: string;
  readonly runtimeTypesPath: string;
}

export function findBaselineRef(input: {
  readonly repositoryRoot: string;
  readonly currentVersion: string;
  readonly explicitRef: string | null;
  readonly paths: SurfacePaths;
}): string | null {
  if (input.explicitRef !== null) {
    readPackageVersion(
      readGitFile(input.repositoryRoot, input.explicitRef, input.paths.packagePath),
      `${input.explicitRef}:${input.paths.packagePath}`
    );
    return input.explicitRef;
  }

  const head = runGit(input.repositoryRoot, ['rev-parse', 'HEAD']).trim();
  const surfaceDirty = hasWorkingTreeSurfaceChanges(
    input.repositoryRoot,
    input.paths
  );
  const tags = runGit(input.repositoryRoot, ['tag', '--merged', 'HEAD', '--list', 'v*'])
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 1);
  const releases: { readonly ref: string; readonly version: string }[] = [];

  for (const tag of tags) {
    const version = tag.slice(1);
    if (!isExactStableSemver(version)) {
      continue;
    }
    releases.push({ ref: tag, version });
  }

  releases.sort((left, right) =>
    compareExactSemver(right.version, left.version)
  );
  const latest = releases[0];
  if (
    latest !== undefined &&
    compareExactSemver(input.currentVersion, latest.version) < 0
  ) {
    throw new Error(
      `Package version ${input.currentVersion} is older than reachable release ${latest.ref}.`
    );
  }

  const candidates: { readonly ref: string; readonly version: string }[] = [];
  for (const release of releases) {
    const order = compareExactSemver(release.version, input.currentVersion);
    if (order > 0) {
      continue;
    }
    if (order === 0) {
      const tagCommit = runGit(input.repositoryRoot, [
        'rev-list',
        '-n',
        '1',
        release.ref
      ]).trim();
      if (tagCommit === head && !surfaceDirty) {
        continue;
      }
    }
    candidates.push(release);
  }

  return candidates[0]?.ref ?? null;
}

export function readGitFile(
  repositoryRoot: string,
  ref: string,
  path: string
): string {
  try {
    return runGit(repositoryRoot, ['show', `${ref}:${path}`]);
  } catch {
    throw new Error(`Could not read ${path} from baseline ref ${ref}.`);
  }
}

export function readOptionalGitFile(
  repositoryRoot: string,
  ref: string,
  path: string
): string | null {
  try {
    return runGit(repositoryRoot, ['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

function hasWorkingTreeSurfaceChanges(
  repositoryRoot: string,
  paths: SurfacePaths
): boolean {
  try {
    execFileSync(
      'git',
      [
        'diff',
        '--quiet',
        '--',
        paths.packagePath,
        paths.apiLockPath,
        paths.operationsPath,
        paths.runtimeTypesPath
      ],
      { cwd: repositoryRoot, stdio: 'ignore' }
    );
    return false;
  } catch {
    return true;
  }
}

function runGit(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function isExactStableSemver(value: string): boolean {
  try {
    return parseExactSemver(value).prerelease === null;
  } catch {
    return false;
  }
}
