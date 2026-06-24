import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'bun:test';
import {
  parseAuthHelperContract,
  parseLibsExportSourceContract,
  parseSdkGenerationSourceContract,
  parseSdkSurfaceContract,
  parseUploadClientContract
} from '../src/client-sdk-contracts/parser';
import { validateClientSdkContracts } from '../src/client-sdk-contracts/validator';
import type { ClientSdkContracts } from '../src/client-sdk-contracts/types';

describe('client SDK contract checker', () => {
  it('validates the committed client SDK contracts', () => {
    const result = validateClientSdkContracts(loadCommittedContracts());

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('fails when TypeScript SDK language support disappears', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkSurface: {
        ...contracts.sdkSurface,
        languages: contracts.sdkSurface.languages.filter(
          (item) => item !== 'typescript'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LANGUAGE_MISSING'
    );
  });

  it('fails when SDKs stop propagating request ids', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkSurface: {
        ...contracts.sdkSurface,
        requiredBehaviors: contracts.sdkSurface.requiredBehaviors.filter(
          (item) => item !== 'request_id propagation'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_BEHAVIOR_MISSING'
    );
  });

  it('fails when SDKs stop propagating trace ids', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkSurface: {
        ...contracts.sdkSurface,
        requiredBehaviors: contracts.sdkSurface.requiredBehaviors.filter(
          (item) => item !== 'trace_id propagation'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_BEHAVIOR_MISSING'
    );
  });

  it('fails when SDKs become the API contract source', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkSurface: {
        ...contracts.sdkSurface,
        mustNotOwn: contracts.sdkSurface.mustNotOwn.filter(
          (item) => item !== 'API contract source'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_FORBIDDEN_OWNERSHIP_MISSING'
    );
  });

  it('fails when SDK surface allows plaintext refresh tokens', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkSurface: {
        ...contracts.sdkSurface,
        forbiddenValues: contracts.sdkSurface.forbiddenValues.filter(
          (item) => item !== 'refresh_token_plaintext'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_FORBIDDEN_VALUE_MISSING'
    );
  });

  it('fails when SDK surface drops cross-language amount rules', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkSurface: {
        ...contracts.sdkSurface,
        crossLanguageRequirements:
          contracts.sdkSurface.crossLanguageRequirements.filter(
            (item) => item !== 'decimal-safe amount strings'
          )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_CROSS_LANGUAGE_REQUIREMENT_MISSING'
    );
  });

  it('fails when SDKs consume a different generation input source', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        sourceRepo: 'zdp-client-sdks'
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_GENERATION_SOURCE_REPO_DRIFT'
    );
  });

  it('fails when Rust disappears from SDK generation targets', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        generationTargets: contracts.sdkGenerationSource.generationTargets.filter(
          (item) => item !== 'rust'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_GENERATION_TARGET_MISSING'
    );
  });

  it('fails when route idempotency metadata is dropped', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
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
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_ROUTE_METADATA_MISSING'
    );
  });

  it('fails when route credential policy metadata is dropped', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        requiredRouteMetadata:
          contracts.sdkGenerationSource.requiredRouteMetadata.filter(
            (item) => item !== 'credential_policy'
          )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_ROUTE_METADATA_MISSING'
    );
  });

  it('fails when error trace metadata is dropped', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        requiredErrorMetadata:
          contracts.sdkGenerationSource.requiredErrorMetadata.filter(
            (item) => item !== 'trace_id'
          )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_ERROR_METADATA_MISSING'
    );
  });

  it('fails when raw authorization headers become allowed SDK generation values', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        forbiddenValues: contracts.sdkGenerationSource.forbiddenValues.filter(
          (item) => item !== 'authorization_header'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_GENERATION_FORBIDDEN_VALUE_MISSING'
    );
  });

  it('fails when stack traces become allowed SDK generation values', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        forbiddenValues: contracts.sdkGenerationSource.forbiddenValues.filter(
          (item) => item !== 'stack_trace'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_GENERATION_FORBIDDEN_VALUE_MISSING'
    );
  });

  it('fails when SDK generation source owns runtime implementation', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        mustNotOwn: contracts.sdkGenerationSource.mustNotOwn.filter(
          (item) => item !== 'SDK runtime implementation'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_GENERATION_FORBIDDEN_OWNERSHIP_MISSING'
    );
  });

  it('fails when raw storage URLs become allowed SDK generation values', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        forbiddenValues: contracts.sdkGenerationSource.forbiddenValues.filter(
          (item) => item !== 'raw_storage_url'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_GENERATION_FORBIDDEN_VALUE_MISSING'
    );
  });

  it('allows SDK contract sources to move through pre-release lifecycle states', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        status: 'reviewed'
      },
      libsExportSource: {
        ...contracts.libsExportSource,
        status: 'draft'
      },
      authHelper: {
        ...contracts.authHelper,
        status: 'draft'
      },
      uploadClient: {
        ...contracts.uploadClient,
        status: 'reviewed'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('fails when contract sources claim active lifecycle before generated SDKs exist', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      authHelper: {
        ...contracts.authHelper,
        status: 'active'
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_AUTH_HELPER_STATUS_DRIFT'
    );
  });

  it('fails when route success status metadata is dropped', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      sdkGenerationSource: {
        ...contracts.sdkGenerationSource,
        requiredRouteMetadata:
          contracts.sdkGenerationSource.requiredRouteMetadata.filter(
            (item) => item !== 'success_statuses'
          )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_ROUTE_METADATA_MISSING'
    );
  });

  it('fails when SDKs consume a different libs export source', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      libsExportSource: {
        ...contracts.libsExportSource,
        sourceRepo: 'zdp-client-sdks'
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_EXPORT_SOURCE_REPO_DRIFT'
    );
  });

  it('fails when libs schema export disappears from SDK generation metadata', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      libsExportSource: {
        ...contracts.libsExportSource,
        sourceExports: contracts.libsExportSource.sourceExports.filter(
          (item) => item !== 'zdp-libs-ts/schema'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_EXPORT_MISSING'
    );
  });

  it('fails when libs trace metadata disappears from SDK generation handoff', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      libsExportSource: {
        ...contracts.libsExportSource,
        requiredMetadata: contracts.libsExportSource.requiredMetadata.filter(
          (item) => item !== 'trace_id'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_METADATA_MISSING'
    );
  });

  it('fails when libs source allows provider tokens into SDK handoff', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      libsExportSource: {
        ...contracts.libsExportSource,
        forbiddenValues: contracts.libsExportSource.forbiddenValues.filter(
          (item) => item !== 'provider_token'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_FORBIDDEN_VALUE_MISSING'
    );
  });

  it('fails when libs source allows stack traces into SDK handoff', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      libsExportSource: {
        ...contracts.libsExportSource,
        forbiddenValues: contracts.libsExportSource.forbiddenValues.filter(
          (item) => item !== 'stack_trace'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_LIBS_FORBIDDEN_VALUE_MISSING'
    );
  });

  it('fails when auth helpers store refresh tokens', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      authHelper: {
        ...contracts.authHelper,
        mustNotOwn: contracts.authHelper.mustNotOwn.filter(
          (item) => item !== 'refresh token storage'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_AUTH_HELPER_FORBIDDEN_OWNERSHIP_MISSING'
    );
  });

  it('fails when auth helpers store session tokens', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      authHelper: {
        ...contracts.authHelper,
        mustNotOwn: contracts.authHelper.mustNotOwn.filter(
          (item) => item !== 'session token storage'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_AUTH_HELPER_FORBIDDEN_OWNERSHIP_MISSING'
    );
  });

  it('fails when upload clients drop idempotency key propagation', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      uploadClient: {
        ...contracts.uploadClient,
        owns: contracts.uploadClient.owns.filter(
          (item) => item !== 'idempotency key propagation'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_UPLOAD_CLIENT_OWNERSHIP_MISSING'
    );
  });

  it('fails when upload clients expose raw provider URLs as public contracts', () => {
    const contracts = loadCommittedContracts();
    const result = validateClientSdkContracts({
      ...contracts,
      uploadClient: {
        ...contracts.uploadClient,
        mustNotOwn: contracts.uploadClient.mustNotOwn.filter(
          (item) => item !== 'raw provider URLs as public contract'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_UPLOAD_CLIENT_FORBIDDEN_OWNERSHIP_MISSING'
    );
  });
});

function loadCommittedContracts(): ClientSdkContracts {
  return {
    sdkSurface: parseSdkSurfaceContract(readContract('sdk-surface.yaml')),
    sdkGenerationSource: parseSdkGenerationSourceContract(
      readContract('sdk-generation-source.yaml')
    ),
    libsExportSource: parseLibsExportSourceContract(
      readContract('libs-export-source.yaml')
    ),
    authHelper: parseAuthHelperContract(readContract('auth-helper.yaml')),
    uploadClient: parseUploadClientContract(readContract('upload-client.yaml'))
  };
}

function readContract(fileName: string): string {
  return readFileSync(`contracts/${fileName}`, 'utf8');
}
