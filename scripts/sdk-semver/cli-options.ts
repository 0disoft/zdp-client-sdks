export interface CliOptions {
  readonly baselineRef: string | null;
  readonly json: boolean;
  readonly allowInitialRelease: boolean;
}

export function parseOptions(args: readonly string[]): CliOptions {
  let baselineRef = process.env.SDK_SEMVER_BASELINE_REF ?? null;
  let json = false;
  let allowInitialRelease = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      json = true;
      continue;
    }
    if (argument === '--allow-initial-release') {
      allowInitialRelease = true;
      continue;
    }
    if (argument === '--baseline-ref') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('--baseline-ref requires a Git ref.');
      }
      baselineRef = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return { baselineRef, json, allowInitialRelease };
}
