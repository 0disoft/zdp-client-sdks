export interface SdkSurfaceContract {
  readonly languages: readonly string[];
  readonly requiredBehaviors: readonly string[];
  readonly mustNotOwn: readonly string[];
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
