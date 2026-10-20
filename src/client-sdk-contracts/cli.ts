import { loadClientSdkContracts } from './parser';
import { validateClientSdkContracts } from './validator';

export async function runClientSdkContractCheckCli(
  argv: readonly string[]
): Promise<number> {
  let root: string;
  try {
    root = readRootOption(argv) ?? process.cwd();
  } catch (error) {
    console.error(
      `CLIENT_SDK_INVALID_ARGUMENT ${error instanceof Error ? error.message : String(error)}`
    );
    return 2;
  }
  const result = validateClientSdkContracts(await loadClientSdkContracts(root));

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
    if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
      throw new Error('--root 옵션 뒤에 저장소 경로를 지정해야 합니다.');
    }
    return value;
  }

  return null;
}
