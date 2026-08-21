import type {
  CompatibilityChange,
  CompatibilityLevel,
  RequiredVersionBump
} from './types';

export interface GateReport {
  readonly schemaVersion: 'zdp.sdk-semver-report/v1';
  readonly baseline: {
    readonly ref: string;
    readonly version: string;
    readonly apiRevision: string | null;
  };
  readonly current: {
    readonly version: string;
    readonly apiRevision: string;
  };
  readonly classification: CompatibilityLevel;
  readonly requiredBump: RequiredVersionBump;
  readonly migrationNotePath: string | null;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly changes: readonly CompatibilityChange[];
}

export interface SkippedReport {
  readonly schemaVersion: 'zdp.sdk-semver-report/v1';
  readonly skipped: true;
  readonly currentVersion: string;
  readonly reason: string;
}

export function printSkippedReport(
  report: SkippedReport,
  json: boolean
): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`SDK SemVer gate skipped: ${report.reason}`);
}

export function printGateReport(report: GateReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('SDK public surface SemVer gate');
  console.log(`baseline: ${report.baseline.ref} (${report.baseline.version})`);
  console.log(`current: ${report.current.version}`);
  console.log(`classification: ${report.classification}`);
  console.log(`required bump: ${report.requiredBump}`);
  console.log(
    `API revisions: ${report.baseline.apiRevision ?? 'unknown'} -> ${report.current.apiRevision}`
  );
  if (report.migrationNotePath !== null) {
    console.log(`migration note: ${report.migrationNotePath}`);
  }
  if (report.changes.length === 0) {
    console.log('changes: none');
  } else {
    console.log('changes:');
    for (const change of report.changes) {
      console.log(
        `  [${change.level}] ${change.code} ${change.target}: ${change.message}`
      );
    }
  }
  console.log(`result: ${report.valid ? 'pass' : 'fail'}`);
  for (const error of report.errors) {
    console.error(`error: ${error}`);
  }
}
