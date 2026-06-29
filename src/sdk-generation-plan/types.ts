import type {
  ClientSdkContractDiagnostic,
  ClientSdkContracts
} from '../client-sdk-contracts/types';

export type SdkGenerationPlanStatus = 'plan-only';

export interface ApiSdkGenerationInputContract {
  readonly status: string | null;
  readonly sourceContracts: readonly string[];
  readonly generationTargets: readonly string[];
  readonly allowedGenerationTargets: readonly string[];
  readonly requiredRouteMetadata: readonly string[];
  readonly requiredErrorMetadata: readonly string[];
  readonly requiredClientRuntimeMetadata: readonly string[];
  readonly requiredWebhookMetadata: readonly string[];
  readonly forbiddenOwnership: readonly string[];
  readonly forbiddenValues: readonly string[];
}

export interface ApiExportPlanHandoff {
  readonly script: string | null;
  readonly sourceFile: string;
  readonly outputKinds: readonly string[];
  readonly forbiddenValues: readonly string[];
  readonly traceFields: readonly string[];
  readonly clientRuntimeMetadata: readonly string[];
  readonly operationIds: readonly string[];
  readonly typedFetchOperationMap: Readonly<Record<string, ApiTypedFetchOperationHandoff>>;
  readonly schemaModelMap: Readonly<Record<string, ApiSchemaModelHandoff>>;
  readonly mutatingMethodsRequiringIdempotency: readonly string[];
  readonly requiredMutationIdempotencyPolicy: string | null;
  readonly requiredDocsMetadata: readonly string[];
  readonly writesArtifacts: boolean | null;
  readonly publishesSchemas: boolean | null;
}

export type ApiSchemaModelKind = 'request' | 'response';

export interface ApiSchemaModelHandoff {
  readonly schemaRef: string;
  readonly schemaId: string;
  readonly sourceContract: string;
  readonly serviceId: string;
  readonly ownerBoundary: string;
  readonly status: string;
  readonly kind: ApiSchemaModelKind;
  readonly carriesSecretMaterial: boolean;
  readonly requiredFields: readonly string[];
  readonly secretFields: readonly string[];
  readonly sessionEffect: string | null;
}

export interface ApiTypedFetchOperationHandoff {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly successStatuses: readonly number[];
  readonly requestSchemaRef: string;
  readonly responseSchemaRef: string;
  readonly authRequired: boolean;
  readonly idempotency: string;
  readonly requestIdRequired: boolean;
  readonly traceIdRequired: boolean;
  readonly errorCodes: readonly string[];
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
  readonly clientRuntimeMetadata: readonly string[];
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
  readonly apiExportPlanForbiddenValues: readonly string[];
  readonly apiExportPlanTraceFields: readonly string[];
  readonly apiExportPlanClientRuntimeMetadata: readonly string[];
  readonly apiRouteOperationIds: readonly string[];
  readonly apiTypedFetchOperationMap: Readonly<Record<string, ApiTypedFetchOperationHandoff>>;
  readonly apiSchemaModelMap: Readonly<Record<string, ApiSchemaModelHandoff>>;
  readonly mutatingMethodsRequiringIdempotency: readonly string[];
  readonly requiredMutationIdempotencyPolicy: string | null;
  readonly apiExportPlanDocsMetadata: readonly string[];
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
