import { describe, expect, it } from 'bun:test';
import { loadClientSdkContracts } from '../src/client-sdk-contracts/parser';
import {
  loadApiExportPlanHandoff,
  loadApiSdkGenerationInput
} from '../src/sdk-generation-plan/api-input';
import { buildSdkGenerationPlan } from '../src/sdk-generation-plan/plan';

describe('SDK generation plan', () => {
  it('builds a deterministic SDK generation plan', async () => {
    const result = buildSdkGenerationPlan(await loadClientSdkContracts(), {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: await loadApiExportPlanHandoff('../zdp-api-contracts'),
      apiInputSourceFile: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      apiExportPlanSourceFile: '../zdp-api-contracts/src/api-export-plan/plan.ts'
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toEqual({
      status: 'plan-only',
      writesArtifacts: false,
      publishesPackages: false,
      apiInputSourceFile: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      apiInputSourceContracts: [
        'contracts/route-contract.yaml',
        'contracts/error-envelope.yaml',
        'contracts/webhook-contract.yaml',
        'contracts/sdk-generation-input.yaml',
        'contracts/apis/catalog.yaml'
      ],
      apiExportPlanSourceFile: '../zdp-api-contracts/src/api-export-plan/plan.ts',
      apiExportPlanOutputKinds: [
        'openapi',
        'sdk_generation_input',
        'webhook_schema',
        'docs_contract'
      ],
      apiExportPlanTraceFields: ['request_id', 'trace_id'],
      targets: [
        expect.objectContaining({
          language: 'typescript',
          plannedPackage: '@zdp/client-sdk',
          apiSourceRepo: 'zdp-api-contracts',
          apiSourceContract: 'contracts/sdk-generation-input.yaml',
          libsSourceRepo: 'zdp-libs-ts',
          libsSourcePackage: 'zdp-libs-ts',
          libsExports: expect.arrayContaining(['zdp-libs-ts/schema']),
          routeMetadata: expect.arrayContaining([
            'idempotency',
            'success_statuses'
          ]),
          errorMetadata: expect.arrayContaining(['request_id', 'trace_id']),
          forbiddenValues: expect.arrayContaining([
            'authorization_header',
            'provider_token',
            'raw_customer_payload'
          ])
        }),
        expect.objectContaining({
          language: 'dart',
          plannedPackage: 'zdp_client_sdk'
        }),
        expect.objectContaining({
          language: 'rust',
          plannedPackage: 'zdp-client-sdk'
        })
      ]
    });
  });

  it('fails when contract validation fails before planning', async () => {
    const contracts = await loadClientSdkContracts();
    const result = buildSdkGenerationPlan(
      {
        ...contracts,
        sdkGenerationSource: {
          ...contracts.sdkGenerationSource,
          requiredRouteMetadata:
            contracts.sdkGenerationSource.requiredRouteMetadata.filter(
              (item) => item !== 'idempotency'
            )
        }
      },
      {
        apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
        apiExportPlan: await loadApiExportPlanHandoff('../zdp-api-contracts')
      }
    );

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_ROUTE_METADATA_MISSING'
    );
  });

  it('fails when libs source does not cover an SDK generation target', async () => {
    const contracts = await loadClientSdkContracts();
    const result = buildSdkGenerationPlan(
      {
        ...contracts,
        libsExportSource: {
          ...contracts.libsExportSource,
          generationTargets: contracts.libsExportSource.generationTargets.filter(
            (item) => item !== 'rust'
          )
        }
      },
      {
        apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
        apiExportPlan: await loadApiExportPlanHandoff('../zdp-api-contracts')
      }
    );

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_TARGET_MISSING'
    );
  });

  it('fails when API SDK generation input drifts from client SDK source', async () => {
    const contracts = await loadClientSdkContracts();
    const apiGenerationInput = await loadApiSdkGenerationInput('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: {
        ...apiGenerationInput,
        requiredErrorMetadata: apiGenerationInput.requiredErrorMetadata.filter(
          (item) => item !== 'trace_id'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_INPUT_ERROR_METADATA_DRIFT'
    );
  });

  it('fails when API export plan no longer exposes SDK generation output', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        outputKinds: apiExportPlan.outputKinds.filter(
          (item) => item !== 'sdk_generation_input'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_OUTPUT_MISSING'
    );
  });

  it('fails when API export plan can write artifacts before SDK generation', async () => {
    const contracts = await loadClientSdkContracts();
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...(await loadApiExportPlanHandoff('../zdp-api-contracts')),
        writesArtifacts: true
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_WRITES_ARTIFACTS'
    );
  });
});
