import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadApiExportPlanHandoff, loadApiSchemaModelHandoff } from '../src/sdk-generation-plan/api-input';

const schemaFile = 'contracts/apis/fixture/widgets.yaml';
const schema = { id: 'Widget', kind: 'response', carries_secret_material: false, required_fields: ['id'] };
const route = {
  operation_id: 'fixture.widgets.get', method: 'GET', path: '/widgets',
  request_schema_ref: `${schemaFile}#Widget`, response_schema_ref: `${schemaFile}#Widget`,
  auth_required: false, idempotency: 'not_required', request_id_required: true,
  trace_id_required: true, success_statuses: [200], error_codes: ['unavailable']
};

async function withInput(
  routes: readonly unknown[], schemas: readonly unknown[], check: (root: string) => Promise<void>
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'sdk-api-duplicates-'));
  try {
    const files: Record<string, unknown> = {
      'package.json': { scripts: { 'export:plan': 'fixture' } },
      'contracts/sdk-generation-input.yaml': { sdk_generation_input: { source_contracts: [schemaFile] } },
      'contracts/apis/catalog.yaml': { api_catalog: {}, routes },
      'contracts/route-contract.yaml': { route_contract: {} },
      'contracts/error-envelope.yaml': { error_envelope: {} },
      'contracts/webhook-contract.yaml': { webhook_contract: {} },
      [schemaFile]: { schema_bundle: { service_id: 'fixture', owner_boundary: 'fixture', status: 'draft', schemas } }
    };
    for (const [file, value] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), JSON.stringify(value));
    }
    await check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('rejects duplicate operation ids instead of selecting the last route', async () => {
  await withInput([route, { ...route, path: '/different-widgets' }], [schema], async root => {
    const result = loadApiExportPlanHandoff(root);
    await expect(result).rejects.toThrow(route.operation_id);
    await expect(result).rejects.toThrow(join(root, 'contracts/apis/catalog.yaml'));
  });
});

test('rejects duplicate schema ids instead of selecting the last field set', async () => {
  await withInput([route], [schema, { ...schema, required_fields: ['changed'] }], async root => {
    const result = loadApiSchemaModelHandoff(root);
    await expect(result).rejects.toThrow(`${schemaFile}#Widget`);
    await expect(result).rejects.toThrow(join(root, schemaFile));
  });
});

test('keeps distinct operations and schemas in the handoff', async () => {
  await withInput([route, { ...route, operation_id: 'fixture.widgets.list', path: '/widget-list' }],
    [schema, { ...schema, id: 'WidgetList' }], async root => {
      const handoff = await loadApiExportPlanHandoff(root);
      expect(handoff.operationIds).toEqual(['fixture.widgets.get', 'fixture.widgets.list']);
      expect(Object.keys(handoff.schemaModelMap)).toEqual([`${schemaFile}#Widget`, `${schemaFile}#WidgetList`]);
    });
});
