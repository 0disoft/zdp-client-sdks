import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  loadApiExportPlanHandoff, loadApiSchemaModelHandoff, loadApiSdkGenerationInput
} from '../src/sdk-generation-plan/api-input';

for (const scenario of [
  { file: 'contracts/sdk-generation-input.yaml', load: loadApiSdkGenerationInput },
  { file: 'contracts/apis/fixture/widget.yaml', load: loadApiSchemaModelHandoff },
  { file: 'contracts/apis/catalog.yaml', load: loadApiExportPlanHandoff },
  { file: 'package.json', load: loadApiExportPlanHandoff }
]) {
  test(`preserves the file and parse cause for invalid API input ${scenario.file}`, async () => {
    const fixture = mkdtempSync(join(tmpdir(), 'sdk-api-input-'));
    try {
      mkdirSync(join(fixture, 'contracts'));
      writeFileSync(join(fixture, 'contracts/sdk-generation-input.yaml'), JSON.stringify({
        sdk_generation_input: { source_contracts: scenario.load === loadApiSchemaModelHandoff ? [scenario.file] : [] }
      }));
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({ scripts: { 'export:plan': 'fixture' } }));
      const invalidFile = join(fixture, scenario.file);
      mkdirSync(dirname(invalidFile), { recursive: true });
      writeFileSync(invalidFile, scenario.file.endsWith('.json') ? '{' : 'broken: [\n');
      let failure: unknown;
      try { await scenario.load(fixture); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain(invalidFile);
      expect((failure as Error).cause).toBeInstanceOf(Error);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

test('preserves the original missing package error instead of inspecting later files', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'sdk-api-missing-'));
  try {
    await expect(loadApiExportPlanHandoff(fixture)).rejects.toMatchObject({
      code: 'ENOENT', path: join(fixture, 'package.json')
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
