import type {
  ClientSdkContractDiagnostic,
  ClientSdkContracts
} from '../client-sdk-contracts/types';

export type SdkGenerationPlanStatus = 'plan-only';

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
  readonly targets: readonly SdkGenerationPlanTarget[];
}

export interface SdkGenerationPlanResult {
  readonly ok: boolean;
  readonly plan: SdkGenerationPlan | null;
  readonly diagnostics: readonly ClientSdkContractDiagnostic[];
}

export interface SdkGenerationPlanInput {
  readonly contracts: ClientSdkContracts;
}
