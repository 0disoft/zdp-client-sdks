import { loadClientSdkContracts } from '../client-sdk-contracts/parser';
import { buildSdkGenerationPlan } from './plan';

export async function runSdkGenerationPlanCli(
  argv: readonly string[]
): Promise<number> {
  const options = readOptions(argv);
  const result = buildSdkGenerationPlan(loadClientSdkContracts(options.root));

  if (!result.ok) {
    for (const diagnostic of result.diagnostics) {
      console.error(
        `${diagnostic.code} ${diagnostic.file}:${diagnostic.path} ${diagnostic.message}`
      );
    }

    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify(result.plan, null, 2));
    return 0;
  }

  if (options.check) {
    console.log('SDK generation plan check passed.');
    return 0;
  }

  console.log(`SDK generation plan: ${result.plan?.targets.length ?? 0} target(s)`);

  for (const target of result.plan?.targets ?? []) {
    console.log(
      `- ${target.language}: ${target.plannedPackage} from ${target.apiSourceRepo}/${target.apiSourceContract} with ${target.libsSourcePackage}`
    );
  }

  return 0;
}

function readOptions(argv: readonly string[]): {
  readonly root: string;
  readonly check: boolean;
  readonly json: boolean;
} {
  return {
    root: readRootOption(argv) ?? process.cwd(),
    check: argv.includes('--check'),
    json: argv.includes('--json')
  };
}

function readRootOption(argv: readonly string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--root') {
      continue;
    }

    const value = argv[index + 1];
    return value === undefined || value.startsWith('--') ? null : value;
  }

  return null;
}
