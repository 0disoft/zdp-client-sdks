import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'bun:test';
import {
  parseAuthHelperContract,
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
    authHelper: parseAuthHelperContract(readContract('auth-helper.yaml')),
    uploadClient: parseUploadClientContract(readContract('upload-client.yaml'))
  };
}

function readContract(fileName: string): string {
  return readFileSync(`contracts/${fileName}`, 'utf8');
}
