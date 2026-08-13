import { join } from 'node:path';
import { loadClientSdkContracts } from '../client-sdk-contracts/parser';
import {
  loadApiExportPlanHandoff,
  loadApiSdkGenerationInput
} from './api-input';
import { buildSdkGenerationPlan } from './plan';

export async function runSdkGenerationPlanCli(
  argv: readonly string[]
): Promise<number> {
  const options = readOptions(argv);
  const apiInputSourceFile = 'contracts/sdk-generation-input.yaml';
  const apiExportPlanSourceFile = 'src/api-export-plan/plan.ts';
  const result = buildSdkGenerationPlan(
    await loadClientSdkContracts(options.root),
    {
      apiGenerationInput: await loadApiSdkGenerationInput(
        options.apiContractsRoot
      ),
      apiExportPlan: await loadApiExportPlanHandoff(options.apiContractsRoot),
      apiInputSourceFile: join(options.apiContractsRoot, apiInputSourceFile),
      apiExportPlanSourceFile: join(
        options.apiContractsRoot,
        apiExportPlanSourceFile
      )
    }
  );

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
  console.log(
    `API export plan handoff: ${result.plan?.apiExportPlanOutputKinds.join(', ') ?? 'none'}`
  );

  for (const target of result.plan?.targets ?? []) {
    console.log(
      `- ${target.language}: ${target.plannedPackage} from ${target.apiSourceRepo}/${target.apiSourceContract} with ${target.libsSourcePackage}`
    );
  }

  return 0;
}

function readOptions(argv: readonly string[]): {
  readonly root: string;
  readonly apiContractsRoot: string;
  readonly check: boolean;
  readonly json: boolean;
} {
  const root = readRootOption(argv) ?? process.cwd();

  return {
    root,
    apiContractsRoot:
      readStringOption(argv, '--api-contracts-root') ??
      join(root, '..', 'zdp-api-contracts'),
    check: argv.includes('--check'),
    json: argv.includes('--json')
  };
}

function readRootOption(argv: readonly string[]): string | null {
  return readStringOption(argv, '--root');
}

function readStringOption(
  argv: readonly string[],
  optionName: string
): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== optionName) {
      continue;
    }

    const value = argv[index + 1];
    return value === undefined || value.startsWith('--') ? null : value;
  }

  return null;
}
