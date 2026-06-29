export interface ZdpErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;
  readonly documentationUrl?: string;
}

export class ZdpSdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ZdpClientConfigurationError extends ZdpSdkError {}

export class ZdpProtocolError extends ZdpSdkError {
  readonly status: number;
  readonly requestId: string | null;
  readonly traceId: string | null;

  constructor(input: {
    readonly status: number;
    readonly message: string;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
  }) {
    super(input.message);
    this.status = input.status;
    this.requestId = input.requestId ?? null;
    this.traceId = input.traceId ?? null;
  }
}

export class ZdpApiError extends ZdpSdkError {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;
  readonly documentationUrl?: string;

  constructor(input: {
    readonly status: number;
    readonly envelope: ZdpErrorEnvelope;
  }) {
    super(input.envelope.message);
    this.status = input.status;
    this.code = input.envelope.code;
    this.requestId = input.envelope.requestId;
    this.traceId = input.envelope.traceId;

    if (input.envelope.details !== undefined) {
      this.details = input.envelope.details;
    }
    if (input.envelope.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = input.envelope.retryAfterSeconds;
    }
    if (input.envelope.documentationUrl !== undefined) {
      this.documentationUrl = input.envelope.documentationUrl;
    }
  }
}

export class ZdpTransportError extends ZdpSdkError {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class ZdpRequestTimeoutError extends ZdpTransportError {}

export class ZdpRequestAbortedError extends ZdpTransportError {}

const FORBIDDEN_ERROR_ENVELOPE_FIELDS = [
  'raw_customer_payload',
  'raw_provider_error',
  'provider_secret',
  'authorization_header',
  'cookie_header',
  'refresh_token_plaintext',
  'stack_trace',
  'screen_component_payload'
] as const;

export function parseZdpErrorEnvelope(input: unknown): ZdpErrorEnvelope {
  if (!isRecord(input)) {
    throw new ZdpProtocolError({
      status: 0,
      message: 'API error response must be an object.'
    });
  }

  for (const field of FORBIDDEN_ERROR_ENVELOPE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw new ZdpProtocolError({
        status: 0,
        message: `API error response must not include forbidden field \`${field}\`.`
      });
    }
  }

  const code = readRequiredString(input, 'code');
  const message = readRequiredString(input, 'message');
  const requestId = readRequiredString(input, 'request_id');
  const traceId = readRequiredString(input, 'trace_id');
  const retryAfterSeconds = readOptionalInteger(input, 'retry_after_seconds');
  const documentationUrl = readOptionalString(input, 'documentation_url');

  const envelope: {
    code: string;
    message: string;
    requestId: string;
    traceId: string;
    details?: unknown;
    retryAfterSeconds?: number;
    documentationUrl?: string;
  } = {
    code,
    message,
    requestId,
    traceId
  };

  if (Object.prototype.hasOwnProperty.call(input, 'details')) {
    envelope.details = input.details;
  }
  if (retryAfterSeconds !== undefined) {
    envelope.retryAfterSeconds = retryAfterSeconds;
  }
  if (documentationUrl !== undefined) {
    envelope.documentationUrl = documentationUrl;
  }

  return envelope;
}

function readRequiredString(
  value: Record<string, unknown>,
  field: string
): string {
  const candidate = value[field];
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new ZdpProtocolError({
      status: 0,
      message: `API error response must include string field \`${field}\`.`
    });
  }

  return candidate;
}

function readOptionalString(
  value: Record<string, unknown>,
  field: string
): string | undefined {
  const candidate = value[field];
  if (candidate === undefined || candidate === null) {
    return undefined;
  }
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new ZdpProtocolError({
      status: 0,
      message: `API error response field \`${field}\` must be a string when set.`
    });
  }

  return candidate;
}

function readOptionalInteger(
  value: Record<string, unknown>,
  field: string
): number | undefined {
  const candidate = value[field];
  if (candidate === undefined || candidate === null) {
    return undefined;
  }
  if (typeof candidate !== 'number' || !Number.isInteger(candidate)) {
    throw new ZdpProtocolError({
      status: 0,
      message: `API error response field \`${field}\` must be an integer when set.`
    });
  }

  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
