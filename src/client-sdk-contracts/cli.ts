import { loadClientSdkContracts } from './parser';
import { validateClientSdkContracts } from './validator';

export async function runClientSdkContractCheckCli(
  argv: readonly string[]
): Promise<number> {
  const root = readRootOption(argv) ?? process.cwd();
  const result = validateClientSdkContracts(loadClientSdkContracts(root));

  if (result.ok) {
    console.log('Client SDK contract check passed.');
    return 0;
  }

  for (const diagnostic of result.diagnostics) {
    console.error(
      `${diagnostic.code} ${diagnostic.file}:${diagnostic.path} ${diagnostic.message}`
    );
  }

  return 1;
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
