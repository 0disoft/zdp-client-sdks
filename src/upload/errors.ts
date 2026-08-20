import { ZdpSdkError } from '../typed-fetch/errors';

export type ZdpUploadValidationCode =
  | 'file_too_large'
  | 'content_type_not_allowed'
  | 'invalid_file_name'
  | 'invalid_source'
  | 'invalid_checksum'
  | 'invalid_metadata';

interface ZdpUploadErrorContext {
  readonly requestId?: string | null;
  readonly traceId?: string | null;
  readonly uploadRef?: string | null;
}

export class ZdpUploadError extends ZdpSdkError {
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly uploadRef: string | null;

  constructor(message: string, context: ZdpUploadErrorContext = {}) {
    super(message);
    this.requestId = context.requestId ?? null;
    this.traceId = context.traceId ?? null;
    this.uploadRef = context.uploadRef ?? null;
  }
}

export class ZdpUploadConfigurationError extends ZdpUploadError {}

export class ZdpUploadValidationError extends ZdpUploadError {
  readonly code: ZdpUploadValidationCode;

  constructor(
    code: ZdpUploadValidationCode,
    message: string,
    context: ZdpUploadErrorContext = {}
  ) {
    super(message, context);
    this.code = code;
  }
}

export class ZdpUploadProtocolError extends ZdpUploadError {}

export class ZdpUploadAbortedError extends ZdpUploadError {}

export class ZdpUploadTimeoutError extends ZdpUploadError {}

export class ZdpUploadTransferError extends ZdpUploadError {
  readonly status: number | null;
  readonly attempts: number;
  readonly retryable: boolean;
  constructor(input: {
    readonly message: string;
    readonly status?: number | null;
    readonly attempts: number;
    readonly retryable: boolean;
    readonly requestId: string;
    readonly traceId: string;
    readonly uploadRef: string;
  }) {
    super(input.message, input);
    this.status = input.status ?? null;
    this.attempts = input.attempts;
    this.retryable = input.retryable;
  }
}
