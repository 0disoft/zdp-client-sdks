import type {
  ClientSdkContractDiagnostic,
  ClientSdkContracts
} from '../client-sdk-contracts/types';

export type SdkGenerationPlanStatus = 'plan-only';

export interface ApiSdkGenerationInputContract {
  readonly status: string | null;
  readonly sourceContracts: readonly string[];
  readonly generationTargets: readonly string[];
  readonly requiredRouteMetadata: readonly string[];
  readonly requiredErrorMetadata: readonly string[];
  readonly requiredWebhookMetadata: readonly string[];
  readonly forbiddenOwnership: readonly string[];
  readonly forbiddenValues: readonly string[];
}

export interface ApiExportPlanHandoff {
  readonly script: string | null;
  readonly sourceFile: string;
  readonly outputKinds: readonly string[];
  readonly traceFields: readonly string[];
  readonly requiredDocsMetadata: readonly string[];
  readonly writesArtifacts: boolean | null;
  readonly publishesSchemas: boolean | null;
}

export interface SdkGenerationPlanTarget {
  readonly language: string;
  readonly plannedPackage: string;
  readonly apiSourceRepo: string;
  readonly apiSourceContract: string;
  readonly libsSourceRepo: string;
  readonly libsSourcePackage: string;
  readonly libsExports: readonly string[];
  readonly routeMetadata: readonly string[];
  readonly errorMetadata: readonly string[];
  readonly webhookMetadata: readonly string[];
  readonly libsMetadata: readonly string[];
  readonly forbiddenValues: readonly string[];
}

export interface SdkGenerationPlan {
  readonly status: SdkGenerationPlanStatus;
  readonly writesArtifacts: false;
  readonly publishesPackages: false;
  readonly apiInputSourceFile: string | null;
  readonly apiInputSourceContracts: readonly string[];
  readonly apiExportPlanSourceFile: string | null;
  readonly apiExportPlanOutputKinds: readonly string[];
  readonly apiExportPlanTraceFields: readonly string[];
  readonly targets: readonly SdkGenerationPlanTarget[];
}

export interface SdkGenerationPlanResult {
  readonly ok: boolean;
  readonly plan: SdkGenerationPlan | null;
  readonly diagnostics: readonly ClientSdkContractDiagnostic[];
}

export interface SdkGenerationPlanInput {
  readonly contracts: ClientSdkContracts;
  readonly apiGenerationInput?: ApiSdkGenerationInputContract;
  readonly apiExportPlan?: ApiExportPlanHandoff;
  readonly apiInputSourceFile?: string;
  readonly apiExportPlanSourceFile?: string;
}
