import { validateClientSdkContracts } from '../client-sdk-contracts/validator';
import type {
  ClientSdkContractDiagnostic,
  ClientSdkContracts
} from '../client-sdk-contracts/types';
import type {
  ApiSdkGenerationInputContract,
  SdkGenerationPlan,
  SdkGenerationPlanResult,
  SdkGenerationPlanTarget
} from './types';

const TARGET_ORDER = ['typescript', 'dart', 'rust'] as const;
const PLANNED_PACKAGE_BY_TARGET = {
  typescript: '@zdp/client-sdk',
  dart: 'zdp_client_sdk',
  rust: 'zdp-client-sdk'
} as const;

export function buildSdkGenerationPlan(
  contracts: ClientSdkContracts,
  options: {
    readonly apiGenerationInput?: ApiSdkGenerationInputContract;
    readonly apiInputSourceFile?: string;
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

  const diagnostics = validatePlanInputs(contracts, options.apiGenerationInput);

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
  apiGenerationInput: ApiSdkGenerationInputContract | undefined
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

  return diagnostics;
}

function validateApiGenerationInput(
  contracts: ClientSdkContracts,
  apiGenerationInput: ApiSdkGenerationInputContract
): readonly ClientSdkContractDiagnostic[] {
  return [
    ...validateExactString({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.status',
      actual: apiGenerationInput.status,
      expected: 'skeleton',
      code: 'CLIENT_SDK_API_INPUT_STATUS_DRIFT',
      label: 'API SDK generation input status'
    }),
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
      required: [
        'contracts/route-contract.yaml',
        'contracts/error-envelope.yaml',
        'contracts/webhook-contract.yaml'
      ],
      code: 'CLIENT_SDK_API_INPUT_SOURCE_CONTRACT_MISSING',
      label: 'API SDK generation input source contracts'
    }),
    ...validateRequiredEntries({
      file: '../zdp-api-contracts/contracts/sdk-generation-input.yaml',
      path: 'sdk_generation_input.forbidden_values',
      actual: apiGenerationInput.forbiddenValues,
      required: contracts.sdkGenerationSource.forbiddenValues,
      code: 'CLIENT_SDK_API_INPUT_FORBIDDEN_VALUE_MISSING',
      label: 'API SDK generation input forbidden values'
    })
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

function requireString(value: string | null, path: string): string {
  if (value !== null) {
    return value;
  }

  throw new Error(`Validated SDK generation plan input missing ${path}.`);
}

type SupportedTarget = (typeof TARGET_ORDER)[number];
