export type ZdpUploadPhase =
  | 'hashing'
  | 'authorizing'
  | 'uploading'
  | 'completing'
  | 'completed';

export interface ZdpUploadChecksum {
  readonly algorithm: 'sha256';
  readonly value: string;
}

export interface ZdpSignedUploadInput {
  readonly source: Blob;
  readonly fileName: string;
  readonly contentType?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly checksum?: ZdpUploadChecksum;
}

export interface ZdpUploadProgress {
  readonly phase: ZdpUploadPhase;
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly attempt: number | null;
}

export interface ZdpUploadCallOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly idempotencyKey?: string;
  readonly onProgress?: (progress: ZdpUploadProgress) => void;
}

export interface ZdpUploadCallContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}

export interface ZdpUploadAuthorizationRequest {
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: ZdpUploadChecksum;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ZdpProviderUploadReceipt {
  readonly status: number;
  readonly etag: string | null;
}

export type ZdpUploadCompletionState = 'accepted' | 'processing' | 'ready';

export interface ZdpUploadCompletion {
  readonly uploadRef: string;
  readonly objectRef: string | null;
  readonly state: ZdpUploadCompletionState;
}

export interface ZdpUploadCompletionRequest {
  readonly uploadRef: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: ZdpUploadChecksum;
  readonly provider: ZdpProviderUploadReceipt;
}

export interface ZdpPreparedUpload {
  readonly uploadRef: string;
  readonly expiresAt: string | null;
  readonly replaySafe: boolean;
  readonly maxFileSizeBytes: number | null;
  readonly allowedContentTypes: readonly string[] | null;
  readonly createRequest: () => Request;
  readonly complete: (
    request: ZdpUploadCompletionRequest,
    context: ZdpUploadCallContext
  ) => Promise<ZdpUploadCompletion>;
}

export interface ZdpUploadLimits {
  readonly maxFileSizeBytes: number;
  readonly allowedContentTypes: readonly string[];
}

export interface ZdpUploadRetryPolicy {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly retryableStatuses?: readonly number[];
}

export interface ZdpUploadTransferInput {
  readonly request: Request;
  readonly body: Blob;
  readonly signal: AbortSignal;
  readonly totalBytes: number;
  readonly onProgress: (loadedBytes: number, totalBytes: number) => void;
}

export type ZdpUploadTransport = (
  input: ZdpUploadTransferInput
) => Promise<Response>;

export type ZdpUploadFetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type ZdpUploadChecksumProvider = (input: {
  readonly source: Blob;
  readonly signal: AbortSignal;
}) => Promise<ZdpUploadChecksum>;

export type ZdpUploadIdFactory = () => string;

export interface ZdpSignedUploadClientOptions {
  readonly authorize: (
    request: ZdpUploadAuthorizationRequest,
    context: ZdpUploadCallContext
  ) => Promise<ZdpPreparedUpload>;
  readonly limits: ZdpUploadLimits;
  readonly transfer?: ZdpUploadTransport;
  readonly fetch?: ZdpUploadFetchLike;
  readonly retryPolicy?: ZdpUploadRetryPolicy;
  readonly defaultTimeoutMs?: number;
  readonly checksumProvider?: ZdpUploadChecksumProvider;
  readonly requestIdFactory?: ZdpUploadIdFactory;
  readonly traceIdFactory?: ZdpUploadIdFactory;
  readonly idempotencyKeyFactory?: ZdpUploadIdFactory;
}

export interface ZdpSignedUploadResult {
  readonly uploadRef: string;
  readonly objectRef: string | null;
  readonly state: ZdpUploadCompletionState;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: ZdpUploadChecksum;
}

export interface ZdpSignedUploadClient {
  upload(
    input: ZdpSignedUploadInput,
    options?: ZdpUploadCallOptions
  ): Promise<ZdpSignedUploadResult>;
}
