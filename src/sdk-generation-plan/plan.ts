import { validateClientSdkContracts } from '../client-sdk-contracts/validator';
import type {
  ClientSdkContractDiagnostic,
  ClientSdkContracts
} from '../client-sdk-contracts/types';
import { REQUIRED_API_EXPORT_DOCS_METADATA } from './api-input';
import type {
  ApiExportPlanHandoff,
  ApiSchemaModelHandoff,
  ApiSdkGenerationInputContract,
  SdkGenerationPlan,
  SdkGenerationPlanResult,
  SdkGenerationPlanTarget
} from './types';

const TARGET_ORDER = ['typescript', 'dart', 'rust'] as const;
const REQUIRED_API_EXPORT_OUTPUT_KINDS = [
  'openapi',
  'sdk_generation_input',
  'webhook_schema',
  'docs_contract'
] as const;
const REQUIRED_API_INPUT_SOURCE_CONTRACTS = [
  'contracts/route-contract.yaml',
  'contracts/error-envelope.yaml',
  'contracts/webhook-contract.yaml',
  'contracts/sdk-generation-input.yaml',
  'contracts/apis/catalog.yaml',
  'contracts/apis/core-api/auth-session.yaml',
  'contracts/apis/core-api/referral.yaml',
  'contracts/apis/money-api/referral-reward.yaml'
] as const;
const REQUIRED_API_INPUT_FORBIDDEN_VALUES = [
  'raw_customer_payload',
  'raw_provider_error',
  'provider_secret',
  'authorization_header',
  'cookie_header',
  'refresh_token_plaintext',
  'stack_trace',
  'screen_component_payload'
] as const;
const REQUIRED_API_EXPORT_TRACE_FIELDS = ['request_id', 'trace_id'] as const;
const REQUIRED_API_EXPORT_CLIENT_RUNTIME_METADATA = [
  'typed_fetch_operation_map',
  'standard_error_envelope_normalization',
  'request_id_propagation',
  'trace_id_propagation',
  'timeout_ms_option',
  'abort_signal_option',
  'idempotency_key_required_for_mutations'
] as const;
const REQUIRED_MUTATING_METHODS_REQUIRING_IDEMPOTENCY = [
  'POST',
  'PUT',
  'PATCH',
  'DELETE'
] as const;
const REQUIRED_MUTATION_IDEMPOTENCY_POLICY = 'required_idempotency_key';
const PLANNED_PACKAGE_BY_TARGET = {
  typescript: '@zdp/client-sdk',
  dart: 'zdp_client_sdk',
  rust: 'zdp-client-sdk'
} as const;
const API_FORBIDDEN_OWNERSHIP_TO_SDK_BOUNDARY = {
  generated_sdk_source: 'generated SDK source truth',
  sdk_runtime_implementation: 'SDK runtime implementation',
  product_business_logic: 'product-specific business rules',
  refresh_token_storage: 'refresh token storage',
  final_authorization_decision: 'final authorization decisions',
  provider_credential_storage: 'provider credential storage'
} as const;

/**
 * mf:anchor zdp.client-sdks.generation-plan
 * purpose: Locate SDK generation planning where API handoff data becomes per-language package plans.
 * search: SDK generation plan, API handoff, language target, package plan, dry run
 * invariant: Plans stay dry-run and never publish packages or write generated SDK artifacts.
 * risk: dependency, data_consistency
 */
export function buildSdkGenerationPlan(
  contracts: ClientSdkContracts,
  options: {
    readonly apiGenerationInput?: ApiSdkGenerationInputContract;
    readonly apiExportPlan?: ApiExportPlanHandoff;
    readonly apiSchemaModels?: Readonly<Record<string, ApiSchemaModelHandoff>>;
    readonly apiInputSourceFile?: string;
    readonly apiExportPlanSourceFile?: string;
  } = {}
): SdkGenerationPlanResult {
  const contractCheck = validateClientSdkContracts(contracts);

  if (!contractCheck.ok) {
    return {
      ok: false,
      plan: null,
      diagnostics: contractCheck.diagnostics
    };
  }

  const diagnostics = validatePlanInputs(
    contracts,
    options.apiGenerationInput,
    options.apiExportPlan,
    options.apiSchemaModels
  );

  if (diagnostics.length > 0) {
    return {
      ok: false,
      plan: null,
      diagnostics
    };
  }

  const targets = sortTargets(
    contracts.sdkGenerationSource.generationTargets
  ).map((target) => createPlanTarget(contracts, target));

  const plan: SdkGenerationPlan = {
    status: 'plan-only',
    writesArtifacts: false,
    publishesPackages: false,
    apiInputSourceFile: options.apiInputSourceFile ?? null,
    apiInputSourceContracts: options.apiGenerationInput?.sourceContracts ?? [],
    apiExportPlanSourceFile: options.apiExportPlanSourceFile ?? null,
    apiExportPlanOutputKinds: options.apiExportPlan?.outputKinds ?? [],
    apiExportPlanForbiddenValues: options.apiExportPlan?.forbiddenValues ?? [],
    apiExportPlanTraceFields: options.apiExportPlan?.traceFields ?? [],
    apiExportPlanClientRuntimeMetadata:
      options.apiExportPlan?.clientRuntimeMetadata ?? [],
    apiRouteOperationIds: options.apiExportPlan?.operationIds ?? [],
    apiTypedFetchOperationMap: options.apiExportPlan?.typedFetchOperationMap ?? {},
    apiSchemaModelMap: options.apiSchemaModels ?? {},
    mutatingMethodsRequiringIdempotency:
      options.apiExportPlan?.mutatingMethodsRequiringIdempotency ?? [],
    requiredMutationIdempotencyPolicy:
      options.apiExportPlan?.requiredMutationIdempotencyPolicy ?? null,
    apiExportPlanDocsMetadata:
      options.apiExportPlan?.requiredDocsMetadata ?? [],
    targets
  };

  return {
    ok: true,
    plan,
    diagnostics: []
  };
}

function validatePlanInputs(
  contracts: ClientSdkContracts,
  apiGenerationInput: ApiSdkGenerationInputContract | undefined,
  apiExportPlan: ApiExportPlanHandoff | undefined,
  apiSchemaModels: Readonly<Record<string, ApiSchemaModelHandoff>> | undefined
): readonly ClientSdkContractDiagnostic[] {
  const diagnostics: ClientSdkContractDiagnostic[] = [];
  const sdkTargets = new Set(contracts.sdkGenerationSource.generationTargets);
  const libsTargets = new Set(contracts.libsExportSource.generationTargets);

  for (const target of sdkTargets) {
    if (!isSupportedTarget(target)) {
      diagnostics.push({
        code: 'CLIENT_SDK_GENERATION_PLAN_TARGET_UNSUPPORTED',
        file: 'contracts/sdk-generation-source.yaml',
        path: 'sdk_generation_source.generation_targets',
        message: `SDK generation plan does not know target \`${target}\`.`
      });
      continue;
    }

    if (!libsTargets.has(target)) {
      diagnostics.push({
        code: 'CLIENT_SDK_GENERATION_PLAN_LIBS_TARGET_MISSING',
        file: 'contracts/libs-export-source.yaml',
        path: 'libs_export_source.generation_targets',
        message: `SDK generation plan target \`${target}\` must be covered by libs export source.`
      });
    }
  }

  if (apiGenerationInput !== undefined) {
    diagnostics.push(
      ...validateApiGenerationInput(contracts, apiGenerationInput)
    );
  }

  if (apiExportPlan !== undefined) {
    diagnostics.push(...validateApiExportPlanHandoff(contracts, apiExportPlan));
  }
  if (apiSchemaModels !== undefined) {
    diagnostics.push(
      ...validateApiSchemaModelHandoff(apiExportPlan, apiSchemaModels)
    );
  }

  return diagnostics;
}

function validateApiSchemaModelHandoff(
  apiExportPlan: ApiExportPlanHandoff | undefined,
  apiSchemaModels: Readonly<Record<string, ApiSchemaModelHandoff>>
): readonly ClientSdkContractDiagnostic[] {
  const schemaRefs = Object.keys(apiSchemaModels);
  const diagnostics: ClientSdkContractDiagnostic[] = [
    ...validateNonEmptyEntries({
      file: '../zdp-api-contracts/contracts/apis/*.yaml',
      path: 'schema_bundle.schemas',
      actual: schemaRefs,
      code: 'CLIENT_SDK_API_SCHEMA_MODEL_MAP_EMPTY',
      label: 'API schema model map'
    })
  ];

  if (apiExportPlan === undefined) {
    return diagnostics;
  }

  for (const operation of Object.values(apiExportPlan.typedFetchOperationMap)) {
    if (!schemaRefs.includes(operation.requestSchemaRef)) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_SCHEMA_MODEL_REQUEST_REF_MISSING',
          file: '../zdp-api-contracts/contracts/apis/*.yaml',
          path: 'schema_bundle.schemas',
          message:
            `API schema model map must include request schema ref ` +
            `\`${operation.requestSchemaRef}\` for operation ` +
            `\`${operation.operationId}\`.`
        })
      );
    }
    if (!schemaRefs.includes(operation.responseSchemaRef)) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_SCHEMA_MODEL_RESPONSE_REF_MISSING',
          file: '../zdp-api-contracts/contracts/apis/*.yaml',
          path: 'schema_bundle.schemas',
          message:
            `API schema model map must include response schema ref ` +
            `\`${operation.responseSchemaRef}\` for operation ` +
            `\`${operation.operationId}\`.`
        })
      );
    }
  }

  return diagnostics;
}

function validateApiGenerationInput(
  contracts: ClientSdkContracts,
  apiGenerationInput: ApiSdkGenerationInputContract
): readonly ClientSdkContractDiagnostic[] {
  return [
    ...validateAllowedStatus({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.status',
      actual: apiGenerationInput.status,
      code: 'CLIENT_SDK_API_INPUT_STATUS_DRIFT',
      label: 'API SDK generation input status'
    }),
    ...validateTargetsAllowedByApiInput(contracts, apiGenerationInput),
    ...validateSameEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.generation_targets',
      left: contracts.sdkGenerationSource.generationTargets,
      right: apiGenerationInput.generationTargets,
      code: 'CLIENT_SDK_API_INPUT_TARGET_DRIFT',
      label: 'API SDK generation targets'
    }),
    ...validateSameEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.required_route_metadata',
      left: contracts.sdkGenerationSource.requiredRouteMetadata,
      right: apiGenerationInput.requiredRouteMetadata,
      code: 'CLIENT_SDK_API_INPUT_ROUTE_METADATA_DRIFT',
      label: 'API route metadata'
    }),
    ...validateSameEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.required_error_metadata',
      left: contracts.sdkGenerationSource.requiredErrorMetadata,
      right: apiGenerationInput.requiredErrorMetadata,
      code: 'CLIENT_SDK_API_INPUT_ERROR_METADATA_DRIFT',
      label: 'API error metadata'
    }),
    ...validateSameEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.required_client_runtime_metadata',
      left: contracts.sdkGenerationSource.requiredClientRuntimeMetadata,
      right: apiGenerationInput.requiredClientRuntimeMetadata,
      code: 'CLIENT_SDK_API_INPUT_CLIENT_RUNTIME_METADATA_DRIFT',
      label: 'API client runtime metadata'
    }),
    ...validateSameEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.required_webhook_metadata',
      left: contracts.sdkGenerationSource.requiredWebhookMetadata,
      right: apiGenerationInput.requiredWebhookMetadata,
      code: 'CLIENT_SDK_API_INPUT_WEBHOOK_METADATA_DRIFT',
      label: 'API webhook metadata'
    }),
    ...validateRequiredEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.source_contracts',
      actual: apiGenerationInput.sourceContracts,
      required: REQUIRED_API_INPUT_SOURCE_CONTRACTS,
      code: 'CLIENT_SDK_API_INPUT_SOURCE_CONTRACT_MISSING',
      label: 'API SDK generation input source contracts'
    }),
    ...validateUnexpectedEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.source_contracts',
      actual: apiGenerationInput.sourceContracts,
      allowed: REQUIRED_API_INPUT_SOURCE_CONTRACTS,
      code: 'CLIENT_SDK_API_INPUT_SOURCE_CONTRACT_UNEXPECTED',
      label: 'API SDK generation input source contracts'
    }),
    ...validateForbiddenOwnershipHandoff(contracts, apiGenerationInput),
    ...validateRequiredEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.forbidden_values',
      actual: apiGenerationInput.forbiddenValues,
      required: REQUIRED_API_INPUT_FORBIDDEN_VALUES,
      code: 'CLIENT_SDK_API_INPUT_FORBIDDEN_VALUE_DRIFT',
      label: 'API SDK generation input forbidden values'
    }),
    ...validateRequiredEntries({
      file: 'contracts/sdk-generation-source.yaml',
      path: 'sdk_generation_source.forbidden_values',
      actual: contracts.sdkGenerationSource.forbiddenValues,
      required: apiGenerationInput.forbiddenValues,
      code: 'CLIENT_SDK_API_INPUT_FORBIDDEN_VALUE_DRIFT',
      label: 'Client SDK generation source forbidden values from API input'
    })
  ];
}

function validateApiExportPlanHandoff(
  contracts: ClientSdkContracts,
  apiExportPlan: ApiExportPlanHandoff
): readonly ClientSdkContractDiagnostic[] {
  return [
    ...(typeof apiExportPlan.script === 'string' &&
    apiExportPlan.script.includes('plan-api-exports')
      ? []
      : [
          createDiagnostic({
            code: 'CLIENT_SDK_API_EXPORT_PLAN_SCRIPT_MISSING',
            file: '../zdp-api-contracts/package.json',
            path: 'scripts.export:plan',
            message:
              'Client SDK generation plan requires zdp-api-contracts to expose `export:plan`.'
          })
        ]),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'outputs.kind',
      actual: apiExportPlan.outputKinds,
      required: REQUIRED_API_EXPORT_OUTPUT_KINDS,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_OUTPUT_MISSING',
      label: 'API export plan outputs'
    }),
    ...validateUnexpectedEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'outputs.kind',
      actual: apiExportPlan.outputKinds,
      allowed: REQUIRED_API_EXPORT_OUTPUT_KINDS,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_OUTPUT_UNEXPECTED',
      label: 'API export plan outputs'
    }),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'outputs.forbiddenValues',
      actual: contracts.sdkGenerationSource.forbiddenValues,
      required: apiExportPlan.forbiddenValues,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_FORBIDDEN_VALUE_DRIFT',
      label: 'SDK generation forbidden values for API export plan'
    }),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'traceFields',
      actual: apiExportPlan.traceFields,
      required: REQUIRED_API_EXPORT_TRACE_FIELDS,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_TRACE_FIELD_MISSING',
      label: 'API export plan trace fields'
    }),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'clientRuntimeMetadata',
      actual: apiExportPlan.clientRuntimeMetadata,
      required: REQUIRED_API_EXPORT_CLIENT_RUNTIME_METADATA,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_CLIENT_RUNTIME_METADATA_MISSING',
      label: 'API export plan client runtime metadata'
    }),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'clientRuntimeMetadata',
      actual: apiExportPlan.clientRuntimeMetadata,
      required: contracts.sdkGenerationSource.requiredClientRuntimeMetadata,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_CLIENT_RUNTIME_METADATA_DRIFT',
      label: 'API export plan client runtime metadata'
    }),
    ...validateNonEmptyEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'operationIds',
      actual: apiExportPlan.operationIds,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_ROUTE_CATALOG_EMPTY',
      label: 'API export plan route catalog operation ids'
    }),
    ...validateTypedFetchOperationMap(apiExportPlan),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'mutatingMethodsRequiringIdempotency',
      actual: apiExportPlan.mutatingMethodsRequiringIdempotency,
      required: REQUIRED_MUTATING_METHODS_REQUIRING_IDEMPOTENCY,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_MUTATION_METHOD_MISSING',
      label: 'API export plan mutating methods requiring idempotency'
    }),
    ...(apiExportPlan.requiredMutationIdempotencyPolicy ===
    REQUIRED_MUTATION_IDEMPOTENCY_POLICY
      ? []
      : [
          createDiagnostic({
            code: 'CLIENT_SDK_API_EXPORT_PLAN_MUTATION_IDEMPOTENCY_POLICY_DRIFT',
            file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
            path: 'requiredMutationIdempotencyPolicy',
            message:
              'API export plan must require mutation idempotency policy ' +
              `\`${REQUIRED_MUTATION_IDEMPOTENCY_POLICY}\`.`
          })
        ]),
    ...validateRequiredEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'docs_contract.requiredMetadata',
      actual: apiExportPlan.requiredDocsMetadata,
      required: REQUIRED_API_EXPORT_DOCS_METADATA,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_DOCS_METADATA_MISSING',
      label: 'API export plan docs metadata'
    }),
    ...(apiExportPlan.writesArtifacts === false
      ? []
      : [
          createDiagnostic({
            code: 'CLIENT_SDK_API_EXPORT_PLAN_WRITES_ARTIFACTS',
            file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
            path: 'writesArtifacts',
            message:
              'API export plan consumed by SDK planning must stay dry-run and not write artifacts.'
          })
        ]),
    ...(apiExportPlan.publishesSchemas === false
      ? []
      : [
          createDiagnostic({
            code: 'CLIENT_SDK_API_EXPORT_PLAN_PUBLISHES_SCHEMAS',
            file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
            path: 'publishesSchemas',
            message:
              'API export plan consumed by SDK planning must not publish schemas.'
          })
        ])
  ];
}

function validateTypedFetchOperationMap(
  apiExportPlan: ApiExportPlanHandoff
): readonly ClientSdkContractDiagnostic[] {
  const operationIds = Object.keys(apiExportPlan.typedFetchOperationMap);
  const diagnostics: ClientSdkContractDiagnostic[] = [
    ...validateNonEmptyEntries({
      file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
      path: 'typedFetchOperationMap',
      actual: operationIds,
      code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_MAP_EMPTY',
      label: 'API export plan typed fetch operation map'
    }),
    ...validateOperationMapKeysMatchRouteOperations(apiExportPlan, operationIds)
  ];

  for (const operationId of operationIds) {
    const operation = apiExportPlan.typedFetchOperationMap[operationId];
    if (operation === undefined) {
      continue;
    }

    const path = `typedFetchOperationMap.${operationId}`;
    if (operation.operationId !== operationId) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_ID_DRIFT',
          file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
          path,
          message:
            `Typed fetch operation map key \`${operationId}\` must match ` +
            `operationId \`${operation.operationId}\`.`
        })
      );
    }
    if (!apiExportPlan.operationIds.includes(operation.operationId)) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_UNKNOWN',
          file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
          path,
          message:
            `Typed fetch operation \`${operation.operationId}\` must come ` +
            'from the API route catalog operation ids.'
        })
      );
    }
    if (operation.successStatuses.length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_SUCCESS_STATUS_MISSING',
          file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
          path: `${path}.successStatuses`,
          message:
            `Typed fetch operation \`${operationId}\` must include at least ` +
            'one success status.'
        })
      );
    }
    if (operation.errorCodes.length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_ERROR_CODE_MISSING',
          file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
          path: `${path}.errorCodes`,
          message:
            `Typed fetch operation \`${operationId}\` must include at least ` +
            'one error code.'
        })
      );
    }
    if (!apiExportPlan.clientRuntimeMetadata.includes('typed_fetch_operation_map')) {
      diagnostics.push(
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_METADATA_MISSING',
          file: `../zdp-api-contracts/${apiExportPlan.sourceFile}`,
          path: 'clientRuntimeMetadata',
          message:
            'API export plan must declare typed_fetch_operation_map metadata ' +
            'before SDK planning can consume typed fetch operations.'
        })
      );
    }
  }

  return diagnostics;
}

function validateOperationMapKeysMatchRouteOperations(
  apiExportPlan: ApiExportPlanHandoff,
  operationMapKeys: readonly string[]
): readonly ClientSdkContractDiagnostic[] {
  const file = `../zdp-api-contracts/${apiExportPlan.sourceFile}`;
  return [
    ...apiExportPlan.operationIds
      .filter((operationId) => !operationMapKeys.includes(operationId))
      .map((operationId) =>
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_MAP_DRIFT',
          file,
          path: 'typedFetchOperationMap',
          message:
            'API export plan typed fetch operation map must include route ' +
            `catalog operation id \`${operationId}\`.`
        })
      ),
    ...operationMapKeys
      .filter((operationId) => !apiExportPlan.operationIds.includes(operationId))
      .map((operationId) =>
        createDiagnostic({
          code: 'CLIENT_SDK_API_EXPORT_PLAN_TYPED_FETCH_OPERATION_MAP_DRIFT',
          file,
          path: 'typedFetchOperationMap',
          message:
            'API export plan typed fetch operation map must not include ' +
            `operation id \`${operationId}\` outside the route catalog.`
        })
      )
  ];
}

function createPlanTarget(
  contracts: ClientSdkContracts,
  target: SupportedTarget
): SdkGenerationPlanTarget {
  return {
    language: target,
    plannedPackage: PLANNED_PACKAGE_BY_TARGET[target],
    apiSourceRepo: requireString(
      contracts.sdkGenerationSource.sourceRepo,
      'sdk_generation_source.source_repo'
    ),
    apiSourceContract: requireString(
      contracts.sdkGenerationSource.sourceContract,
      'sdk_generation_source.source_contract'
    ),
    libsSourceRepo: requireString(
      contracts.libsExportSource.sourceRepo,
      'libs_export_source.source_repo'
    ),
    libsSourcePackage: requireString(
      contracts.libsExportSource.sourcePackage,
      'libs_export_source.source_package'
    ),
    libsExports: [...contracts.libsExportSource.sourceExports],
    routeMetadata: [...contracts.sdkGenerationSource.requiredRouteMetadata],
    errorMetadata: [...contracts.sdkGenerationSource.requiredErrorMetadata],
    clientRuntimeMetadata: [
      ...contracts.sdkGenerationSource.requiredClientRuntimeMetadata
    ],
    webhookMetadata: [...contracts.sdkGenerationSource.requiredWebhookMetadata],
    libsMetadata: [...contracts.libsExportSource.requiredMetadata],
    forbiddenValues: uniqueSorted([
      ...contracts.sdkGenerationSource.forbiddenValues,
      ...contracts.libsExportSource.forbiddenValues
    ])
  };
}

function sortTargets(targets: readonly string[]): SupportedTarget[] {
  return TARGET_ORDER.filter((target) => targets.includes(target));
}

function isSupportedTarget(target: string): target is SupportedTarget {
  return Object.prototype.hasOwnProperty.call(
    PLANNED_PACKAGE_BY_TARGET,
    target
  );
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function validateAllowedStatus(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: string | null;
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  if (
    input.actual === 'skeleton' ||
    input.actual === 'draft' ||
    input.actual === 'reviewed'
  ) {
    return [];
  }

  return [
    {
      code: input.code,
      file: input.file,
      path: input.path,
      message:
        `${input.label} must be one of ` +
        '`skeleton`, `draft`, `reviewed`.'
    }
  ];
}

function validateTargetsAllowedByApiInput(
  contracts: ClientSdkContracts,
  apiGenerationInput: ApiSdkGenerationInputContract
): readonly ClientSdkContractDiagnostic[] {
  return contracts.sdkGenerationSource.generationTargets
    .filter(
      (target) => !apiGenerationInput.allowedGenerationTargets.includes(target)
    )
    .map((target) => ({
      code: 'CLIENT_SDK_API_INPUT_TARGET_NOT_ALLOWED',
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.allowed_generation_targets',
      message: `Client SDK target \`${target}\` must be allowed by API SDK generation input.`
    }));
}

function validateForbiddenOwnershipHandoff(
  contracts: ClientSdkContracts,
  apiGenerationInput: ApiSdkGenerationInputContract
): readonly ClientSdkContractDiagnostic[] {
  const diagnostics: ClientSdkContractDiagnostic[] = [];
  const knownApiOwnership = Object.keys(
    API_FORBIDDEN_OWNERSHIP_TO_SDK_BOUNDARY
  );

  for (const ownership of apiGenerationInput.forbiddenOwnership) {
    const sdkBoundary =
      API_FORBIDDEN_OWNERSHIP_TO_SDK_BOUNDARY[
        ownership as keyof typeof API_FORBIDDEN_OWNERSHIP_TO_SDK_BOUNDARY
      ];

    if (sdkBoundary === undefined) {
      diagnostics.push({
        code: 'CLIENT_SDK_API_INPUT_FORBIDDEN_OWNERSHIP_UNMAPPED',
        file: 'contracts/sdk-generation-source.yaml',
        path: 'sdk_generation_source.must_not_own',
        message:
          `Client SDK generation source must map API forbidden ownership ` +
          `\`${ownership}\` before SDK planning can consume it.`
      });
      continue;
    }

    if (!contracts.sdkGenerationSource.mustNotOwn.includes(sdkBoundary)) {
      diagnostics.push({
        code: 'CLIENT_SDK_API_INPUT_FORBIDDEN_OWNERSHIP_DRIFT',
        file: 'contracts/sdk-generation-source.yaml',
        path: 'sdk_generation_source.must_not_own',
        message:
          `Client SDK generation source must include \`${sdkBoundary}\` ` +
          `from API forbidden ownership \`${ownership}\`.`
      });
    }
  }

  for (const ownership of knownApiOwnership) {
    if (apiGenerationInput.forbiddenOwnership.includes(ownership)) {
      continue;
    }

    diagnostics.push({
      code: 'CLIENT_SDK_API_INPUT_FORBIDDEN_OWNERSHIP_DRIFT',
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.forbidden_ownership',
      message:
        `API SDK generation input must include \`${ownership}\` ` +
        'required by the client SDK forbidden ownership mapping.'
    });
  }

  return diagnostics;
}

function validateSameEntries(input: {
  readonly file: string;
  readonly path: string;
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  const missingFromRight = input.left.filter((entry) => !input.right.includes(entry));
  const missingFromLeft = input.right.filter((entry) => !input.left.includes(entry));

  return [
    ...missingFromRight.map((entry) => ({
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must include \`${entry}\` from client SDK generation source.`
    })),
    ...missingFromLeft.map((entry) => ({
      code: input.code,
      file: 'contracts/sdk-generation-source.yaml',
      path: input.path.replace('sdk_generation_input', 'sdk_generation_source'),
      message: `Client SDK generation source must include \`${entry}\` from ${input.label}.`
    }))
  ];
}

function validateRequiredEntries(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: readonly string[];
  readonly required: readonly string[];
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  return input.required
    .filter((entry) => !input.actual.includes(entry))
    .map((entry) => ({
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must include \`${entry}\`.`
    }));
}

function validateUnexpectedEntries(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: readonly string[];
  readonly allowed: readonly string[];
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  return input.actual
    .filter((entry) => !input.allowed.includes(entry))
    .map((entry) => ({
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must not introduce unhandled entry \`${entry}\`.`
    }));
}

function validateNonEmptyEntries(input: {
  readonly file: string;
  readonly path: string;
  readonly actual: readonly string[];
  readonly code: string;
  readonly label: string;
}): readonly ClientSdkContractDiagnostic[] {
  if (input.actual.length > 0) {
    return [];
  }

  return [
    {
      code: input.code,
      file: input.file,
      path: input.path,
      message: `${input.label} must not be empty.`
    }
  ];
}

function createDiagnostic(input: {
  readonly code: string;
  readonly file: string;
  readonly path: string;
  readonly message: string;
}): ClientSdkContractDiagnostic {
  return input;
}

function requireString(value: string | null, path: string): string {
  if (value !== null) {
    return value;
  }

  throw new Error(`Validated SDK generation plan input missing ${path}.`);
}

type SupportedTarget = (typeof TARGET_ORDER)[number];
