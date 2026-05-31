import { validateClientSdkContracts } from '../client-sdk-contracts/validator';
import type {
  ClientSdkContractDiagnostic,
  ClientSdkContracts
} from '../client-sdk-contracts/types';
import type {
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
  contracts: ClientSdkContracts
): SdkGenerationPlanResult {
  const contractCheck = validateClientSdkContracts(contracts);

  if (!contractCheck.ok) {
    return {
      ok: false,
      plan: null,
      diagnostics: contractCheck.diagnostics
    };
  }

  const diagnostics = validatePlanInputs(contracts);

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
    targets
  };

  return {
    ok: true,
    plan,
    diagnostics: []
  };
}

function validatePlanInputs(
  contracts: ClientSdkContracts
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

  return diagnostics;
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

function requireString(value: string | null, path: string): string {
  if (value !== null) {
    return value;
  }

  throw new Error(`Validated SDK generation plan input missing ${path}.`);
}

type SupportedTarget = (typeof TARGET_ORDER)[number];
