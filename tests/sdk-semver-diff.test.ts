import { describe, expect, it } from 'bun:test';
import {
  diffGeneratedPublicSurface,
  extractGeneratedPublicSurface
} from '../scripts/sdk-semver/index';
import {
  OPERATION_ID,
  REQUEST_REF,
  RESPONSE_REF,
  operation,
  runtimeSchema,
  schema,
  surface
} from './sdk-semver-fixtures';

describe('generated SDK public surface parser', () => {
  it('extracts generated JSON constants without evaluating TypeScript', () => {
    const operationsSource = `
export const ZDP_API_SCHEMA_MODEL_MAP = ${JSON.stringify({
      [REQUEST_REF]: schema('request'),
      [RESPONSE_REF]: schema('response')
    })} as const satisfies ZdpGeneratedSchemaModelMap;
export const ZDP_TYPED_FETCH_OPERATION_MAP = ${JSON.stringify({
      [OPERATION_ID]: operation()
    })} as const satisfies ZdpGeneratedOperationMetadataMap;
`;
    const runtimeSource = `
export const ZDP_API_SCHEMA_RUNTIME_TYPE_MAP = ${JSON.stringify({
      [REQUEST_REF]: {
        requiredFields: ['name'],
        fieldTypes: { name: { enum: ['plain', 'value}with-brace'] } }
      },
      [RESPONSE_REF]: {
        requiredFields: ['id'],
        fieldTypes: { id: 'string' }
      }
    })} as const;
`;

    const parsed = extractGeneratedPublicSurface(
      operationsSource,
      runtimeSource
    );

    expect(parsed.operations[OPERATION_ID]?.path).toBe('/v1/items');
    expect(parsed.schemas[REQUEST_REF]?.requiredFields).toEqual(['name']);
    expect(parsed.runtimeSchemas[REQUEST_REF]?.fieldTypes.name).toEqual({
      enum: ['plain', 'value}with-brace']
    });
  });
});

describe('generated SDK compatibility diff', () => {
  it('classifies operation removal and transport identity changes as breaking', () => {
    const baseline = surface();
    const removed = surface({ operations: {} });
    const changed = surface({
      operations: {
        [OPERATION_ID]: operation({ method: 'PUT', path: '/v2/items' })
      }
    });

    expect(diffGeneratedPublicSurface(baseline, removed).classification).toBe(
      'breaking'
    );
    const report = diffGeneratedPublicSurface(baseline, changed);
    expect(report.classification).toBe('breaking');
    expect(report.changes.map((change) => change.code)).toContain(
      'operation.method.changed'
    );
    expect(report.changes.map((change) => change.code)).toContain(
      'operation.path.changed'
    );
  });

  it('classifies stricter request requirements and removed request fields as breaking', () => {
    const baseline = surface({
      requestSchema: schema('request', {
        requiredFields: ['name'],
        optionalFields: ['locale', 'legacy_ref']
      })
    });
    const current = surface({
      requestSchema: schema('request', {
        requiredFields: ['name', 'locale'],
        optionalFields: []
      })
    });

    const report = diffGeneratedPublicSurface(baseline, current);
    expect(report.classification).toBe('breaking');
    expect(report.changes.map((change) => change.code)).toContain(
      'schema.request.field.optional-to-required'
    );
    expect(report.changes.map((change) => change.code)).toContain(
      'schema.request.field.optional-to-absent'
    );
  });

  it('classifies removed or weakened response fields as breaking', () => {
    const baseline = surface({
      responseSchema: schema('response', {
        requiredFields: ['id', 'state'],
        optionalFields: ['note']
      })
    });
    const current = surface({
      responseSchema: schema('response', {
        requiredFields: ['id'],
        optionalFields: ['state']
      })
    });

    const report = diffGeneratedPublicSurface(baseline, current);
    expect(report.classification).toBe('breaking');
    expect(report.changes.map((change) => change.code)).toContain(
      'schema.response.field.required-to-optional'
    );
    expect(report.changes.map((change) => change.code)).toContain(
      'schema.response.field.optional-to-absent'
    );
  });

  it('classifies a new operation and optional request field as additive', () => {
    const baseline = surface({ operations: {} });
    const current = surface({
      requestSchema: schema('request', {
        requiredFields: ['name'],
        optionalFields: ['locale']
      })
    });

    const report = diffGeneratedPublicSurface(baseline, current);
    expect(report.classification).toBe('additive');
    expect(report.changes.map((change) => change.code)).toContain(
      'operation.added'
    );
  });

  it('uses request and response direction when enum values change', () => {
    const baseline = surface({
      runtimeSchemas: {
        [REQUEST_REF]: runtimeSchema({ name: { enum: ['a', 'b'] } }, ['name']),
        [RESPONSE_REF]: runtimeSchema({ id: { enum: ['a'] } }, ['id'])
      }
    });
    const current = surface({
      runtimeSchemas: {
        [REQUEST_REF]: runtimeSchema({ name: { enum: ['a'] } }, ['name']),
        [RESPONSE_REF]: runtimeSchema({ id: { enum: ['a', 'b'] } }, ['id'])
      }
    });

    const report = diffGeneratedPublicSurface(baseline, current);
    expect(report.classification).toBe('breaking');
    expect(
      report.changes.filter(
        (change) => change.code === 'schema.enum-values.removed'
      )
    ).toHaveLength(1);
    expect(
      report.changes.filter(
        (change) => change.code === 'schema.enum-values.added'
      )
    ).toHaveLength(1);
  });
});
