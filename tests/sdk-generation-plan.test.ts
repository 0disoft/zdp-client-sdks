import { describe, expect, it } from 'bun:test';
import { loadClientSdkContracts } from '../src/client-sdk-contracts/parser';
import { buildSdkGenerationPlan } from '../src/sdk-generation-plan/plan';

describe('SDK generation plan', () => {
  it('builds a deterministic SDK generation plan', () => {
    const result = buildSdkGenerationPlan(loadClientSdkContracts());

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toEqual({
      status: 'plan-only',
      writesArtifacts: false,
      publishesPackages: false,
      targets: [
        expect.objectContaining({
          language: 'typescript',
          plannedPackage: '@zdp/client-sdk',
          apiSourceRepo: 'zdp-api-contracts',
          apiSourceContract: 'contracts/sdk-generation-input.yaml',
          libsSourceRepo: 'zdp-libs-ts',
          libsSourcePackage: 'zdp-libs-ts',
          libsExports: expect.arrayContaining(['zdp-libs-ts/schema']),
          routeMetadata: expect.arrayContaining(['idempotency']),
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

  it('fails when contract validation fails before planning', () => {
    const contracts = loadClientSdkContracts();
    const result = buildSdkGenerationPlan({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        requiredRouteMetadata:
          contracts.sdkGenerationSource.requiredRouteMetadata.filter(
            (item) => item !== 'idempotency'
          )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_ROUTE_METADATA_MISSING'
    );
  });

  it('fails when libs source does not cover an SDK generation target', () => {
    const contracts = loadClientSdkContracts();
    const result = buildSdkGenerationPlan({
      ...contracts,
      libsExportSource: {
        ...contracts.libsExportSource,
        generationTargets: contracts.libsExportSource.generationTargets.filter(
          (item) => item !== 'rust'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_TARGET_MISSING'
    );
  });
});
