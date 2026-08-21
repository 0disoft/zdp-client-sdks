import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOptions } from './cli-options';
import { printGateReport, printSkippedReport } from './cli-report';
import type { GateReport, SkippedReport } from './cli-report';
import {
  diffGeneratedPublicSurface,
  evaluateSemverGate,
  extractGeneratedPublicSurface,
  migrationNotePath
} from './index';
import {
  findBaselineRef,
  readGitFile,
  readOptionalGitFile
} from './git-baseline';
import type { SurfacePaths } from './git-baseline';
import {
  readApiRevision,
  readOptionalFile,
  readPackageVersion
} from './metadata';

const PATHS: SurfacePaths = {
  packagePath: 'package.json',
  apiLockPath: 'contracts/api-contracts.lock.json',
  operationsPath: 'src/typed-fetch/api-operations.ts',
  runtimeTypesPath: 'src/typed-fetch/api-model-runtime.ts'
};
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export async function runSdkSemverCli(args: readonly string[]): Promise<void> {
  const options = parseOptions(args);
  const currentPackageSource = await readFile(
    join(repositoryRoot, PATHS.packagePath),
    'utf8'
  );
  const currentVersion = readPackageVersion(
    currentPackageSource,
    PATHS.packagePath
  );
  const baselineRef = findBaselineRef({
    repositoryRoot,
    currentVersion,
    explicitRef: options.baselineRef,
    paths: PATHS
  });

  if (baselineRef === null) {
    if (!options.allowInitialRelease) {
      throw new Error(
        'No reachable stable release tag exists. Fetch full history and tags, or pass --allow-initial-release for the first public release.'
      );
    }
    const report: SkippedReport = {
      schemaVersion: 'zdp.sdk-semver-report/v1',
      skipped: true,
      currentVersion,
      reason: 'No earlier reachable release tag exists; treating this as the initial SDK release.'
    };
    printSkippedReport(report, options.json);
    return;
  }

  const baselinePackageSource = readGitFile(
    repositoryRoot,
    baselineRef,
    PATHS.packagePath
  );
  const baselineVersion = readPackageVersion(
    baselinePackageSource,
    `${baselineRef}:${PATHS.packagePath}`
  );
  const [currentOperationsSource, currentRuntimeSource, currentLockSource] =
    await Promise.all([
      readFile(join(repositoryRoot, PATHS.operationsPath), 'utf8'),
      readOptionalFile(join(repositoryRoot, PATHS.runtimeTypesPath)),
      readFile(join(repositoryRoot, PATHS.apiLockPath), 'utf8')
    ]);
  const baselineOperationsSource = readGitFile(
    repositoryRoot,
    baselineRef,
    PATHS.operationsPath
  );
  const baselineRuntimeSource = readOptionalGitFile(
    repositoryRoot,
    baselineRef,
    PATHS.runtimeTypesPath
  );
  const baselineLockSource = readOptionalGitFile(
    repositoryRoot,
    baselineRef,
    PATHS.apiLockPath
  );

  const compatibility = diffGeneratedPublicSurface(
    extractGeneratedPublicSurface(
      baselineOperationsSource,
      baselineRuntimeSource
    ),
    extractGeneratedPublicSurface(currentOperationsSource, currentRuntimeSource)
  );
  const notePath =
    compatibility.classification === 'breaking'
      ? migrationNotePath(baselineVersion, currentVersion)
      : null;
  const migrationNote =
    notePath === null
      ? null
      : await readOptionalFile(join(repositoryRoot, notePath));
  const gate = evaluateSemverGate({
    baselineVersion,
    currentVersion,
    compatibility: compatibility.classification,
    migrationNote
  });
  const report: GateReport = {
    schemaVersion: 'zdp.sdk-semver-report/v1',
    baseline: {
      ref: baselineRef,
      version: baselineVersion,
      apiRevision:
        baselineLockSource === null
          ? null
          : readApiRevision(
              baselineLockSource,
              `${baselineRef}:${PATHS.apiLockPath}`
            )
    },
    current: {
      version: currentVersion,
      apiRevision: readApiRevision(currentLockSource, PATHS.apiLockPath)
    },
    classification: compatibility.classification,
    requiredBump: gate.requiredBump,
    migrationNotePath: notePath,
    valid: gate.valid,
    errors: gate.errors,
    changes: compatibility.changes
  };

  printGateReport(report, options.json);
  if (!gate.valid) {
    throw new Error(gate.errors.join('\n'));
  }
}
