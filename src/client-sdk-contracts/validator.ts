import type {
  ClientSdkContractDiagnostic,
  ClientSdkContractCheckResult,
  ClientSdkContracts
} from './types';

const SDK_SURFACE_FILE = 'contracts/sdk-surface.yaml';
const AUTH_HELPER_FILE = 'contracts/auth-helper.yaml';
const UPLOAD_CLIENT_FILE = 'contracts/upload-client.yaml';

const REQUIRED_SDK_LANGUAGES = ['typescript', 'dart', 'rust'] as const;
const REQUIRED_SDK_BEHAVIORS = [
  'request_id propagation',
  'standard error envelope handling',
  'pagination handling',
  'upload handoff'
] as const;
const REQUIRED_SDK_FORBIDDEN_OWNERSHIP = [
  'API contract source',
  'refresh token storage',
  'final authorization decisions',
  'product-specific business rules'
] as const;

const REQUIRED_AUTH_HELPER_OWNERSHIP = [
  'access token attachment boundary',
  'current user context normalization input'
] as const;
const REQUIRED_AUTH_HELPER_FORBIDDEN_OWNERSHIP = [
  'refresh token storage',
  'membership authority',
  'entitlement authority',
  'provider identity mapping source'
] as const;

const REQUIRED_UPLOAD_CLIENT_OWNERSHIP = [
  'signed upload request shape',
  'upload error mapping',
  'request_id propagation'
] as const;
const REQUIRED_UPLOAD_CLIENT_FORBIDDEN_OWNERSHIP = [
  'object storage bucket names',
  'raw provider URLs as public contract',
  'file ownership decisions'
] as const;

export function validateClientSdkContracts(
  contracts: ClientSdkContracts
): ClientSdkContractCheckResult {
  const diagnostics: ClientSdkContractDiagnostic[] = [
    ...validateRequiredEntries({
      file: SDK_SURFACE_FILE,
      path: 'sdk_surface.languages',
      actual: contracts.sdkSurface.languages,
      required: REQUIRED_SDK_LANGUAGES,
      code: 'CLIENT_SDK_LANGUAGE_MISSING',
      label: 'SDK surface languages'
    }),
    ...validateRequiredEntries({
      file: SDK_SURFACE_FILE,
      path: 'sdk_surface.required_behaviors',
      actual: contracts.sdkSurface.requiredBehaviors,
      required: REQUIRED_SDK_BEHAVIORS,
      code: 'CLIENT_SDK_BEHAVIOR_MISSING',
      label: 'SDK required behaviors'
    }),
    ...validateRequiredEntries({
      file: SDK_SURFACE_FILE,
      path: 'sdk_surface.must_not_own',
      actual: contracts.sdkSurface.mustNotOwn,
      required: REQUIRED_SDK_FORBIDDEN_OWNERSHIP,
      code: 'CLIENT_SDK_FORBIDDEN_OWNERSHIP_MISSING',
      label: 'SDK forbidden ownership'
    }),
    ...validateSkeletonStatus({
      file: AUTH_HELPER_FILE,
      path: 'auth_helper.status',
      actual: contracts.authHelper.status,
      code: 'CLIENT_SDK_AUTH_HELPER_STATUS_DRIFT',
      label: 'auth helper'
    }),
    ...validateRequiredEntries({
      file: AUTH_HELPER_FILE,
      path: 'auth_helper.owns',
      actual: contracts.authHelper.owns,
      required: REQUIRED_AUTH_HELPER_OWNERSHIP,
      code: 'CLIENT_SDK_AUTH_HELPER_OWNERSHIP_MISSING',
      label: 'auth helper ownership'
    }),
    ...validateRequiredEntries({
      file: AUTH_HELPER_FILE,
      path: 'auth_helper.must_not_own',
      actual: contracts.authHelper.mustNotOwn,
      required: REQUIRED_AUTH_HELPER_FORBIDDEN_OWNERSHIP,
      code: 'CLIENT_SDK_AUTH_HELPER_FORBIDDEN_OWNERSHIP_MISSING',
      label: 'auth helper forbidden ownership'
    }),
    ...validateSkeletonStatus({
      file: UPLOAD_CLIENT_FILE,
      path: 'upload_client.status',
      actual: contracts.uploadClient.status,
      code: 'CLIENT_SDK_UPLOAD_CLIENT_STATUS_DRIFT',
      label: 'upload client'
    }),
    ...validateRequiredEntries({
      file: UPLOAD_CLIENT_FILE,
      path: 'upload_client.owns',
      actual: contracts.uploadClient.owns,
      required: REQUIRED_UPLOAD_CLIENT_OWNERSHIP,
      code: 'CLIENT_SDK_UPLOAD_CLIENT_OWNERSHIP_MISSING',
      label: 'upload client ownership'
    }),
    ...validateRequiredEntries({
      file: UPLOAD_CLIENT_FILE,
      path: 'upload_client.must_not_own',
      actual: contracts.uploadClient.mustNotOwn,
      required: REQUIRED_UPLOAD_CLIENT_FORBIDDEN_OWNERSHIP,
      code: 'CLIENT_SDK_UPLOAD_CLIENT_FORBIDDEN_OWNERSHIP_MISSING',
      label: 'upload client forbidden ownership'
    })
  ];

  return {
    ok: diagnostics.length === 0,
    diagnostics
  };
}

function validateRequiredEntries(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: readonly string[];
  readonly required: readonly string[];
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  const diagnostics: ClientSdkContractDiagnostic[] = [];

  for (const requiredEntry of input.required) {
    if (input.actual.includes(requiredEntry)) {
      continue;
    }

    diagnostics.push({
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must include \`${requiredEntry}\`.`
    });
  }

  return diagnostics;
}

function validateSkeletonStatus(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: string | null;
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  if (input.actual === 'skeleton') {
    return [];
  }

  return [
    {
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must stay skeleton until generated SDK packages exist.`
    }
  ];
}
