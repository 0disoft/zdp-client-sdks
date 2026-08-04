import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadApiExportPlanHandoff } from '../src/sdk-generation-plan/api-input';

const DEFAULT_API_CONTRACTS_ROOT = '../zdp-api-contracts';
const DEFAULT_OUTPUT_FILE = 'src/typed-fetch/api-operations.ts';

interface SyncOptions {
  readonly apiContractsRoot: string;
  readonly outputFile: string;
  readonly check: boolean;
}

export function replaceConstInitializer(
  source: string,
  name: string,
  satisfiesType: string,
  value: Readonly<Record<string, unknown>>
): string {
  const prefix = `export const ${name} = `;
  const suffix = ` as const satisfies ${satisfiesType};`;
  const start = source.indexOf(prefix);

  if (start === -1) {
    throw new Error(`Could not find generated constant ${name}.`);
  }

  const valueStart = start + prefix.length;
  const valueEnd = source.indexOf(suffix, valueStart);

  if (valueEnd === -1) {
    throw new Error(`Could not find generated constant terminator for ${name}.`);
  }

  const renderedValue = JSON.stringify(value, null, 2);
  return `${source.slice(0, valueStart)}${renderedValue}${source.slice(valueEnd)}`;
}

export async function renderApiOperations(options: SyncOptions): Promise<{
  readonly outputPath: string;
  readonly source: string;
  readonly changed: boolean;
}> {
  const outputPath = resolve(options.outputFile);
  const currentSource = await readFile(outputPath, 'utf8');
  const apiExportPlan = await loadApiExportPlanHandoff(
    resolve(options.apiContractsRoot)
  );
  const withSchemaModels = replaceConstInitializer(
    currentSource,
    'ZDP_API_SCHEMA_MODEL_MAP',
    'ZdpGeneratedSchemaModelMap',
    apiExportPlan.schemaModelMap
  );
  const source = replaceConstInitializer(
    withSchemaModels,
    'ZDP_TYPED_FETCH_OPERATION_MAP',
    'ZdpGeneratedOperationMetadataMap',
    apiExportPlan.typedFetchOperationMap
  );

  return {
    outputPath,
    source,
    changed: source !== currentSource
  };
}

function parseOptions(args: readonly string[]): SyncOptions {
  let apiContractsRoot = DEFAULT_API_CONTRACTS_ROOT;
  let outputFile = DEFAULT_OUTPUT_FILE;
  let check = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--check') {
      check = true;
      continue;
    }

    if (argument === '--api-contracts-root' || argument === '--output') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }

      if (argument === '--api-contracts-root') {
        apiContractsRoot = value;
      } else {
        outputFile = value;
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return { apiContractsRoot, outputFile, check };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const rendered = await renderApiOperations(options);

  if (options.check) {
    if (rendered.changed) {
      throw new Error(
        `${rendered.outputPath} is out of sync with the API export plan.`
      );
    }
    console.log('Generated API operation metadata is synchronized.');
    return;
  }

  if (!rendered.changed) {
    console.log('Generated API operation metadata is already synchronized.');
    return;
  }

  await writeFile(rendered.outputPath, rendered.source, 'utf8');
  console.log(`Synchronized ${rendered.outputPath}.`);
}

if (import.meta.main) {
  await main();
}
