import type {
  ClientSdkContractDiagnostic,
  ClientSdkContractCheckResult,
  ClientSdkContracts
} from './types';

const SDK_SURFACE_FILE = 'contracts/sdk-surface.yaml';
const SDK_GENERATION_SOURCE_FILE = 'contracts/sdk-generation-source.yaml';
const LIBS_EXPORT_SOURCE_FILE = 'contracts/libs-export-source.yaml';
const AUTH_HELPER_FILE = 'contracts/auth-helper.yaml';
const UPLOAD_CLIENT_FILE = 'contracts/upload-client.yaml';

const REQUIRED_SDK_LANGUAGES = ['typescript', 'dart', 'rust'] as const;
const REQUIRED_SDK_BEHAVIORS = [
  'typed fetch operation map',
  'typed fetch runtime foundation',
  'request_id propagation',
  'trace_id propagation',
  'idempotency key propagation',
  'standard error envelope handling',
  'error envelope normalization',
  'timeout option support',
  'abort signal support',
  'pagination handling',
  'upload handoff'
] as const;
const REQUIRED_SDK_FORBIDDEN_OWNERSHIP = [
  'API contract source',
  'refresh token storage',
  'final authorization decisions',
  'product-specific business rules'
] as const;
const REQUIRED_SDK_SURFACE_FORBIDDEN_VALUES = [
  'raw_customer_payload',
  'raw_provider_error',
  'provider_secret',
  'authorization_header',
  'cookie_header',
  'refresh_token_plaintext',
  'stack_trace',
  'screen_component_payload'
] as const;
const REQUIRED_CROSS_LANGUAGE_REQUIREMENTS = [
  'UTC ISO-8601 datetime strings',
  'decimal-safe amount strings',
  'BCP 47 locale strings'
] as const;

const REQUIRED_SDK_GENERATION_SOURCE_REPO = 'zdp-api-contracts';
const REQUIRED_SDK_GENERATION_SOURCE_CONTRACT =
  'contracts/sdk-generation-input.yaml';
const REQUIRED_SDK_GENERATION_TARGETS = ['typescript', 'dart', 'rust'] as const;
const REQUIRED_ROUTE_METADATA = [
  'operation_id',
  'resource',
  'action',
  'method',
  'path',
  'request_schema_ref',
  'response_schema_ref',
  'auth_required',
  'permission_check',
  'audit_event',
  'idempotency',
  'owner_boundary',
  'tenant_boundary',
  'request_id_required',
  'trace_id_required',
  'session_effect',
  'credential_policy',
  'success_statuses',
  'error_codes'
] as const;
const REQUIRED_ERROR_METADATA = [
  'code',
  'message',
  'request_id',
  'trace_id',
  'retry_after_seconds',
  'documentation_url'
] as const;
const REQUIRED_CLIENT_RUNTIME_METADATA = [
  'typed_fetch_operation_map',
  'standard_error_envelope_normalization',
  'request_id_propagation',
  'trace_id_propagation',
  'timeout_ms_option',
  'abort_signal_option',
  'idempotency_key_required_for_mutations'
] as const;
const REQUIRED_WEBHOOK_METADATA = [
  'event_id',
  'event_type',
  'schema_version',
  'signature_verification',
  'idempotency_key',
  'replay_policy',
  'dead_letter_policy'
] as const;
const REQUIRED_SDK_GENERATION_FORBIDDEN_OWNERSHIP = [
  'API contract source',
  'generated SDK source truth',
  'SDK runtime implementation',
  'product-specific business rules',
  'refresh token storage',
  'final authorization decisions',
  'provider credential storage'
] as const;
const REQUIRED_SDK_GENERATION_FORBIDDEN_VALUES = [
  'raw_customer_payload',
  'raw_provider_error',
  'provider_secret',
  'authorization_header',
  'cookie_header',
  'refresh_token_plaintext',
  'stack_trace',
  'screen_component_payload',
  'provider_specific_id_as_primary_id',
  'raw_storage_url',
  'unversioned_payload',
  'provider_secret_in_schema',
  'ledger_mutation_without_money_contract'
] as const;

const REQUIRED_LIBS_EXPORT_SOURCE_REPO = 'zdp-libs-ts';
const REQUIRED_LIBS_EXPORT_SOURCE_PACKAGE = 'zdp-libs-ts';
const REQUIRED_LIBS_SOURCE_EXPORTS = [
  'zdp-libs-ts/schema',
  'zdp-libs-ts/env-contract',
  'zdp-libs-ts/event-contracts',
  'zdp-libs-ts/error',
  'zdp-libs-ts/i18n-contract'
] as const;
const REQUIRED_LIBS_SOURCE_TARGETS = ['typescript', 'dart', 'rust'] as const;
const REQUIRED_LIBS_SOURCE_METADATA = [
  'schema_id',
  'env_var',
  'event_type',
  'error_code',
  'message_key',
  'request_id',
  'trace_id',
  'idempotency'
] as const;
const REQUIRED_LIBS_SOURCE_FORBIDDEN_OWNERSHIP = [
  'zdp-libs-ts package source',
  'API contract source',
  'runtime validation engine',
  'product domain models',
  'final authorization decisions',
  'translation runtime'
] as const;
const REQUIRED_LIBS_SOURCE_FORBIDDEN_VALUES = [
  'authorization_header',
  'cookie_header',
  'raw_customer_payload',
  'raw_provider_error',
  'provider_secret',
  'provider_token',
  'refresh_token_plaintext',
  'secret_value',
  'stack_trace',
  'screen_component_payload'
] as const;

const REQUIRED_AUTH_HELPER_OWNERSHIP = [
  'access token attachment boundary',
  'current user context normalization input'
] as const;
const REQUIRED_AUTH_HELPER_FORBIDDEN_OWNERSHIP = [
  'refresh token storage',
  'session token storage',
  'raw credential storage',
  'membership authority',
  'entitlement authority',
  'provider identity mapping source'
] as const;

const REQUIRED_UPLOAD_CLIENT_OWNERSHIP = [
  'signed upload request shape',
  'upload error mapping',
  'request_id propagation',
  'trace_id propagation',
  'idempotency key propagation'
] as const;
const REQUIRED_UPLOAD_CLIENT_FORBIDDEN_OWNERSHIP = [
  'object storage bucket names',
  'raw provider URLs as public contract',
  'file ownership decisions'
] as const;

const ALLOWED_CONTRACT_STATUSES = [
  'skeleton',
  'draft',
  'reviewed'
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
    ...validateRequiredEntries({
      file: SDK_SURFACE_FILE,
      path: 'sdk_surface.forbidden_values',
      actual: contracts.sdkSurface.forbiddenValues,
      required: REQUIRED_SDK_SURFACE_FORBIDDEN_VALUES,
      code: 'CLIENT_SDK_FORBIDDEN_VALUE_MISSING',
      label: 'SDK forbidden values'
    }),
    ...validateRequiredEntries({
      file: SDK_SURFACE_FILE,
      path: 'sdk_surface.cross_language_requirements',
      actual: contracts.sdkSurface.crossLanguageRequirements,
      required: REQUIRED_CROSS_LANGUAGE_REQUIREMENTS,
      code: 'CLIENT_SDK_CROSS_LANGUAGE_REQUIREMENT_MISSING',
      label: 'SDK cross-language requirements'
    }),
    ...validateAllowedStatus({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.status',
      actual: contracts.sdkGenerationSource.status,
      code: 'CLIENT_SDK_GENERATION_SOURCE_STATUS_DRIFT',
      label: 'SDK generation source'
    }),
    ...validateExactString({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.source_repo',
      actual: contracts.sdkGenerationSource.sourceRepo,
      expected: REQUIRED_SDK_GENERATION_SOURCE_REPO,
      code: 'CLIENT_SDK_GENERATION_SOURCE_REPO_DRIFT',
      label: 'SDK generation source repo'
    }),
    ...validateExactString({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.source_contract',
      actual: contracts.sdkGenerationSource.sourceContract,
      expected: REQUIRED_SDK_GENERATION_SOURCE_CONTRACT,
      code: 'CLIENT_SDK_GENERATION_SOURCE_CONTRACT_DRIFT',
      label: 'SDK generation source contract'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.generation_targets',
      actual: contracts.sdkGenerationSource.generationTargets,
      required: REQUIRED_SDK_GENERATION_TARGETS,
      code: 'CLIENT_SDK_GENERATION_TARGET_MISSING',
      label: 'SDK generation targets'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.required_route_metadata',
      actual: contracts.sdkGenerationSource.requiredRouteMetadata,
      required: REQUIRED_ROUTE_METADATA,
      code: 'CLIENT_SDK_ROUTE_METADATA_MISSING',
      label: 'SDK route metadata'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.required_error_metadata',
      actual: contracts.sdkGenerationSource.requiredErrorMetadata,
      required: REQUIRED_ERROR_METADATA,
      code: 'CLIENT_SDK_ERROR_METADATA_MISSING',
      label: 'SDK error metadata'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.required_client_runtime_metadata',
      actual: contracts.sdkGenerationSource.requiredClientRuntimeMetadata,
      required: REQUIRED_CLIENT_RUNTIME_METADATA,
      code: 'CLIENT_SDK_CLIENT_RUNTIME_METADATA_MISSING',
      label: 'SDK client runtime metadata'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.required_webhook_metadata',
      actual: contracts.sdkGenerationSource.requiredWebhookMetadata,
      required: REQUIRED_WEBHOOK_METADATA,
      code: 'CLIENT_SDK_WEBHOOK_METADATA_MISSING',
      label: 'SDK webhook metadata'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.must_not_own',
      actual: contracts.sdkGenerationSource.mustNotOwn,
      required: REQUIRED_SDK_GENERATION_FORBIDDEN_OWNERSHIP,
      code: 'CLIENT_SDK_GENERATION_FORBIDDEN_OWNERSHIP_MISSING',
      label: 'SDK generation forbidden ownership'
    }),
    ...validateRequiredEntries({
      file: SDK_GENERATION_SOURCE_FILE,
      path: 'sdk_generation_source.forbidden_values',
      actual: contracts.sdkGenerationSource.forbiddenValues,
      required: REQUIRED_SDK_GENERATION_FORBIDDEN_VALUES,
      code: 'CLIENT_SDK_GENERATION_FORBIDDEN_VALUE_MISSING',
      label: 'SDK generation forbidden values'
    }),
    ...validateAllowedStatus({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.status',
      actual: contracts.libsExportSource.status,
      code: 'CLIENT_SDK_LIBS_EXPORT_SOURCE_STATUS_DRIFT',
      label: 'libs export source'
    }),
    ...validateExactString({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.source_repo',
      actual: contracts.libsExportSource.sourceRepo,
      expected: REQUIRED_LIBS_EXPORT_SOURCE_REPO,
      code: 'CLIENT_SDK_LIBS_EXPORT_SOURCE_REPO_DRIFT',
      label: 'libs export source repo'
    }),
    ...validateExactString({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.source_package',
      actual: contracts.libsExportSource.sourcePackage,
      expected: REQUIRED_LIBS_EXPORT_SOURCE_PACKAGE,
      code: 'CLIENT_SDK_LIBS_EXPORT_SOURCE_PACKAGE_DRIFT',
      label: 'libs export source package'
    }),
    ...validateRequiredEntries({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.source_exports',
      actual: contracts.libsExportSource.sourceExports,
      required: REQUIRED_LIBS_SOURCE_EXPORTS,
      code: 'CLIENT_SDK_LIBS_EXPORT_MISSING',
      label: 'libs source exports'
    }),
    ...validateRequiredEntries({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.generation_targets',
      actual: contracts.libsExportSource.generationTargets,
      required: REQUIRED_LIBS_SOURCE_TARGETS,
      code: 'CLIENT_SDK_LIBS_TARGET_MISSING',
      label: 'libs source targets'
    }),
    ...validateRequiredEntries({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.required_metadata',
      actual: contracts.libsExportSource.requiredMetadata,
      required: REQUIRED_LIBS_SOURCE_METADATA,
      code: 'CLIENT_SDK_LIBS_METADATA_MISSING',
      label: 'libs source metadata'
    }),
    ...validateRequiredEntries({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.must_not_own',
      actual: contracts.libsExportSource.mustNotOwn,
      required: REQUIRED_LIBS_SOURCE_FORBIDDEN_OWNERSHIP,
      code: 'CLIENT_SDK_LIBS_FORBIDDEN_OWNERSHIP_MISSING',
      label: 'libs source forbidden ownership'
    }),
    ...validateRequiredEntries({
      file: LIBS_EXPORT_SOURCE_FILE,
      path: 'libs_export_source.forbidden_values',
      actual: contracts.libsExportSource.forbiddenValues,
      required: REQUIRED_LIBS_SOURCE_FORBIDDEN_VALUES,
      code: 'CLIENT_SDK_LIBS_FORBIDDEN_VALUE_MISSING',
      label: 'libs source forbidden values'
    }),
    ...validateAllowedStatus({
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
    ...validateAllowedStatus({
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

function validateExactString(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: string | null;
  readonly expected: string;
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  if (input.actual === input.expected) {
    return [];
  }

  return [
    {
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must be \`${input.expected}\`.`
    }
  ];
}

function validateAllowedStatus(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: string | null;
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  if (isAllowedContractStatus(input.actual)) {
    return [];
  }

  return [
    {
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must be one of ${formatAllowedStatuses()}.`
    }
  ];
}

function formatAllowedStatuses(): string {
  return ALLOWED_CONTRACT_STATUSES.map((status) => `\`${status}\``).join(', ');
}

function isAllowedContractStatus(
  status: string | null
): status is (typeof ALLOWED_CONTRACT_STATUSES)[number] {
  return ALLOWED_CONTRACT_STATUSES.includes(
    status as (typeof ALLOWED_CONTRACT_STATUSES)[number]
  );
}
