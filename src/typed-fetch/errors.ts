import type { ZdpResponseMetadata } from './types';

export interface ZdpErrorEnvelope<Code extends string = string> {
  readonly code: Code;
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
  readonly response: ZdpResponseMetadata | null;

  constructor(input: {
    readonly status: number;
    readonly message: string;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
    readonly response?: ZdpResponseMetadata;
  }) {
    super(input.message);
    this.response = input.response ?? null;
    this.status = input.response?.status ?? input.status;
    this.requestId = input.response?.requestId ?? input.requestId ?? null;
    this.traceId = input.response?.traceId ?? input.traceId ?? null;
  }
}

export class ZdpApiError<Code extends string = string> extends ZdpSdkError {
  readonly status: number;
  readonly code: Code;
  readonly requestId: string;
  readonly traceId: string;
  readonly response: ZdpResponseMetadata;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;
  readonly documentationUrl?: string;

  constructor(input: {
    readonly status: number;
    readonly envelope: ZdpErrorEnvelope<Code>;
    readonly response?: ZdpResponseMetadata;
  }) {
    super(input.envelope.message);
    this.response =
      input.response ?? createErrorResponseMetadata(input.status, input.envelope);
    this.status = this.response.status;
    this.code = input.envelope.code;
    this.requestId = input.envelope.requestId;
    this.traceId = input.envelope.traceId;

    if (input.envelope.details !== undefined) {
      this.details = input.envelope.details;
    }
    const retryAfterSeconds =
      input.envelope.retryAfterSeconds ??
      this.response.rateLimit?.retryAfterSeconds ??
      undefined;
    if (retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = retryAfterSeconds;
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

const EMPTY_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({});

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

function createErrorResponseMetadata(
  status: number,
  envelope: ZdpErrorEnvelope
): ZdpResponseMetadata {
  const rateLimit =
    envelope.retryAfterSeconds === undefined
      ? null
      : {
          limit: null,
          remaining: null,
          reset: null,
          retryAfterSeconds: envelope.retryAfterSeconds
        };

  return {
    status,
    headers: EMPTY_RESPONSE_HEADERS,
    requestId: envelope.requestId,
    traceId: envelope.traceId,
    rateLimit
  };
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
  if (
    typeof candidate !== 'number' ||
    !Number.isInteger(candidate) ||
    candidate < 0
  ) {
    throw new ZdpProtocolError({
      status: 0,
      message: `API error response field \`${field}\` must be a non-negative integer when set.`
    });
  }

  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
