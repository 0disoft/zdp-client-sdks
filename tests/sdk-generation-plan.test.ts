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
        'contracts/apis/catalog.yaml',
        'contracts/apis/core-api/auth-session.yaml',
        'contracts/apis/core-api/referral.yaml',
        'contracts/apis/money-api/referral-reward.yaml'
      ],
      apiExportPlanSourceFile: '../zdp-api-contracts/src/api-export-plan/plan.ts',
      apiExportPlanOutputKinds: [
        'openapi',
        'sdk_generation_input',
        'webhook_schema',
        'docs_contract'
      ],
      apiExportPlanForbiddenValues: expect.arrayContaining([
        'provider_specific_id_as_primary_id',
        'raw_storage_url',
        'unversioned_payload',
        'provider_secret_in_schema',
        'ledger_mutation_without_money_contract'
      ]),
      apiExportPlanTraceFields: ['request_id', 'trace_id'],
      apiExportPlanClientRuntimeMetadata: [
        'typed_fetch_operation_map',
        'standard_error_envelope_normalization',
        'request_id_propagation',
        'trace_id_propagation',
        'timeout_ms_option',
        'abort_signal_option',
        'idempotency_key_required_for_mutations'
      ],
      apiRouteOperationIds: [
        'core.auth.registrations.create',
        'core.auth.sessions.create',
        'core.auth.sessions.refresh',
        'core.auth.sessions.revoke_current',
        'core.auth.recovery_requests.create',
        'core.auth.passkey_challenges.create',
        'core.auth.passkey_assertions.verify',
        'core.auth.oauth_callbacks.accept',
        'core.referral.uses.create',
        'money.referral_rewards.status.get'
      ],
      apiTypedFetchOperationMap: {
        'core.auth.registrations.create': expect.objectContaining({
          operationId: 'core.auth.registrations.create',
          method: 'POST',
          path: '/v1/auth/registrations',
          successStatuses: [202],
          authRequired: false,
          idempotency: 'required_idempotency_key',
          requestIdRequired: true,
          traceIdRequired: true
        }),
        'core.auth.sessions.create': expect.objectContaining({
          operationId: 'core.auth.sessions.create',
          method: 'POST',
          path: '/v1/auth/sessions',
          successStatuses: [201],
          requestSchemaRef:
            'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest',
          responseSchemaRef:
            'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse',
          authRequired: false,
          idempotency: 'required_idempotency_key',
          requestIdRequired: true,
          traceIdRequired: true,
          errorCodes: expect.arrayContaining([
            'authentication_failed',
            'idempotency_conflict'
          ])
        }),
        'core.auth.sessions.refresh': expect.any(Object),
        'core.auth.sessions.revoke_current': expect.any(Object),
        'core.auth.recovery_requests.create': expect.any(Object),
        'core.auth.passkey_challenges.create': expect.any(Object),
        'core.auth.passkey_assertions.verify': expect.any(Object),
        'core.auth.oauth_callbacks.accept': expect.any(Object),
        'core.referral.uses.create': expect.any(Object),
        'money.referral_rewards.status.get': expect.objectContaining({
          operationId: 'money.referral_rewards.status.get',
          method: 'GET',
          path: '/v1/referrals/uses/{referral_use_ref}/reward-status',
          authRequired: true,
          idempotency: 'not_required'
        })
      },
      mutatingMethodsRequiringIdempotency: ['POST', 'PUT', 'PATCH', 'DELETE'],
      requiredMutationIdempotencyPolicy: 'required_idempotency_key',
      apiExportPlanDocsMetadata: [
        'permission_check',
        'audit_event',
        'idempotency',
        'success_statuses'
      ],
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
            'owner_boundary',
            'tenant_boundary',
            'request_id_required',
            'trace_id_required',
            'session_effect',
            'credential_policy',
            'success_statuses'
          ]),
          errorMetadata: expect.arrayContaining(['request_id', 'trace_id']),
          clientRuntimeMetadata: expect.arrayContaining([
            'typed_fetch_operation_map',
            'standard_error_envelope_normalization',
            'timeout_ms_option',
            'abort_signal_option',
            'idempotency_key_required_for_mutations'
          ]),
          forbiddenValues: expect.arrayContaining([
            'authorization_header',
            'provider_token',
            'raw_customer_payload',
            'refresh_token_plaintext',
            'stack_trace',
            'provider_specific_id_as_primary_id',
            'raw_storage_url',
            'unversioned_payload'
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

  it('fails when API SDK generation input drops typed fetch runtime metadata', async () => {
    const contracts = await loadClientSdkContracts();
    const apiGenerationInput = await loadApiSdkGenerationInput('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: {
        ...apiGenerationInput,
        requiredClientRuntimeMetadata:
          apiGenerationInput.requiredClientRuntimeMetadata.filter(
            (item) => item !== 'abort_signal_option'
          )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_INPUT_CLIENT_RUNTIME_METADATA_DRIFT'
    );
  });

  it('fails when API SDK generation input forbidden values drift from client SDK source', async () => {
    const contracts = await loadClientSdkContracts();
    const apiGenerationInput = await loadApiSdkGenerationInput('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: {
        ...apiGenerationInput,
        forbiddenValues: apiGenerationInput.forbiddenValues.filter(
          (item) => item !== 'stack_trace'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_INPUT_FORBIDDEN_VALUE_DRIFT'
    );
  });

  it('fails when API SDK generation input forbidden ownership drifts from client SDK source', async () => {
    const contracts = await loadClientSdkContracts();
    const apiGenerationInput = await loadApiSdkGenerationInput('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: {
        ...apiGenerationInput,
        forbiddenOwnership: apiGenerationInput.forbiddenOwnership.filter(
          (item) => item !== 'sdk_runtime_implementation'
        )
      },
      apiExportPlan: await loadApiExportPlanHandoff('../zdp-api-contracts')
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_INPUT_FORBIDDEN_OWNERSHIP_DRIFT'
    );
  });

  it('fails when API SDK generation input adds an unhandled source contract', async () => {
    const contracts = await loadClientSdkContracts();
    const apiGenerationInput = await loadApiSdkGenerationInput('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: {
        ...apiGenerationInput,
        sourceContracts: [
          ...apiGenerationInput.sourceContracts,
          'contracts/apis/core-api/payments.yaml'
        ]
      },
      apiExportPlan: await loadApiExportPlanHandoff('../zdp-api-contracts')
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_INPUT_SOURCE_CONTRACT_UNEXPECTED'
    );
  });

  it('fails when API export plan introduces an unhandled output kind', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        outputKinds: [...apiExportPlan.outputKinds, 'graphql_schema']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_OUTPUT_UNEXPECTED'
    );
  });

  it('fails when API export plan forbidden values are missing from SDK generation source', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        forbiddenValues: [...apiExportPlan.forbiddenValues, 'new_api_secret_shape']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_FORBIDDEN_VALUE_DRIFT'
    );
  });

  it('fails when API export plan docs metadata is incomplete', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        requiredDocsMetadata: apiExportPlan.requiredDocsMetadata.filter(
          (item) => item !== 'idempotency'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_DOCS_METADATA_MISSING'
    );
  });

  it('fails when API export plan drops typed fetch client runtime metadata', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        clientRuntimeMetadata: apiExportPlan.clientRuntimeMetadata.filter(
          (item) => item !== 'timeout_ms_option'
        )
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_CLIENT_RUNTIME_METADATA_MISSING'
    );
  });

  it('fails when API export plan no longer exposes route catalog operations', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        operationIds: []
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_ROUTE_CATALOG_EMPTY'
    );
  });

  it('fails when API export plan no longer exposes typed fetch operation metadata', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        typedFetchOperationMap: {}
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_MAP_EMPTY'
    );
  });

  it('fails when typed fetch operation metadata drifts from route catalog ids', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const { 'core.auth.sessions.create': _removed, ...operationMap } =
      apiExportPlan.typedFetchOperationMap;
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        typedFetchOperationMap: operationMap
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_MAP_DRIFT'
    );
  });

  it('fails when API export plan weakens mutation idempotency policy', async () => {
    const contracts = await loadClientSdkContracts();
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...apiExportPlan,
        requiredMutationIdempotencyPolicy: 'optional_idempotency_key'
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_MUTATION_IDEMPOTENCY_POLICY_DRIFT'
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

  it('fails when API export plan can publish schemas before SDK generation', async () => {
    const contracts = await loadClientSdkContracts();
    const result = buildSdkGenerationPlan(contracts, {
      apiGenerationInput: await loadApiSdkGenerationInput('../zdp-api-contracts'),
      apiExportPlan: {
        ...(await loadApiExportPlanHandoff('../zdp-api-contracts')),
        publishesSchemas: true
      }
    });

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'CLIENT_SDK_API_EXPORT_PLAN_PUBLISHES_SCHEMAS'
    );
  });
});
