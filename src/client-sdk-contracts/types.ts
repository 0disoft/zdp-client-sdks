export interface SdkSurfaceContract {
  readonly languages: readonly string[];
  readonly requiredBehaviors: readonly string[];
  readonly mustNotOwn: readonly string[];
  readonly forbiddenValues: readonly string[];
  readonly crossLanguageRequirements: readonly string[];
}

export interface SdkGenerationSourceContract {
  readonly status: string | null;
  readonly sourceRepo: string | null;
  readonly sourceContract: string | null;
  readonly generationTargets: readonly string[];
  readonly requiredRouteMetadata: readonly string[];
  readonly requiredErrorMetadata: readonly string[];
  readonly requiredWebhookMetadata: readonly string[];
  readonly mustNotOwn: readonly string[];
  readonly forbiddenValues: readonly string[];
}

export interface LibsExportSourceContract {
  readonly status: string | null;
  readonly sourceRepo: string | null;
  readonly sourcePackage: string | null;
  readonly sourceExports: readonly string[];
  readonly generationTargets: readonly string[];
  readonly requiredMetadata: readonly string[];
  readonly mustNotOwn: readonly string[];
  readonly forbiddenValues: readonly string[];
}

export interface AuthHelperContract {
  readonly status: string | null;
  readonly owns: readonly string[];
  readonly mustNotOwn: readonly string[];
}

export interface UploadClientContract {
  readonly status: string | null;
  readonly owns: readonly string[];
  readonly mustNotOwn: readonly string[];
}

export interface ClientSdkContracts {
  readonly sdkSurface: SdkSurfaceContract;
  readonly sdkGenerationSource: SdkGenerationSourceContract;
  readonly libsExportSource: LibsExportSourceContract;
  readonly authHelper: AuthHelperContract;
  readonly uploadClient: UploadClientContract;
}

export interface ClientSdkContractDiagnostic {
  readonly code: string;
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

export interface ClientSdkContractCheckResult {
  readonly ok: boolean;
  readonly diagnostics: readonly ClientSdkContractDiagnostic[];
}
