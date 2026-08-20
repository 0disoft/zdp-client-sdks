import {
  ZdpUploadAbortedError,
  ZdpUploadConfigurationError,
  ZdpUploadError,
  ZdpUploadProtocolError,
  ZdpUploadTimeoutError,
  ZdpUploadTransferError,
  ZdpUploadValidationError
} from './errors';
import { createZdpFetchUploadTransport } from './transports';
import type {
  ZdpPreparedUpload,
  ZdpProviderUploadReceipt,
  ZdpSignedUploadClient,
  ZdpSignedUploadClientOptions,
  ZdpSignedUploadInput,
  ZdpSignedUploadResult,
  ZdpUploadCallContext,
  ZdpUploadCallOptions,
  ZdpUploadChecksum,
  ZdpUploadChecksumProvider,
  ZdpUploadCompletion,
  ZdpUploadLimits,
  ZdpUploadProgress,
  ZdpUploadRetryPolicy,
  ZdpUploadTransport
} from './types';

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504] as const;
const FORBIDDEN_PROVIDER_HEADERS = [
  'authorization',
  'cookie',
  'proxy-authorization',
  'x-request-id',
  'x-trace-id',
  'idempotency-key'
] as const;
const UPLOAD_METHODS = ['POST', 'PUT'] as const;
const COMPLETION_STATES = ['accepted', 'processing', 'ready'] as const;

interface NormalizedRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableStatuses: ReadonlySet<number>;
}

interface ActiveUploadContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly callerSignal: AbortSignal | null;
  readonly timeoutSignal: AbortSignal;
}

/**
 * mf:anchor zdp.client-sdks.signed-upload-runtime
 * purpose: Locate signed upload authorization, provider transfer, completion,
 *   limits, checksum, cancellation, and bounded retry.
 * search: signed upload, upload progress, sha256, replay safe, provider transfer
 * invariant: signed provider URLs stay inside ephemeral Request factories and
 *   never appear in results or errors.
 * risk: external_request, security, state, resource_exhaustion
 */
export function createZdpSignedUploadClient(
  options: ZdpSignedUploadClientOptions
): ZdpSignedUploadClient {
  if (typeof options.authorize !== 'function') {
    throw new ZdpUploadConfigurationError(
      'Signed upload authorize callback is required.'
    );
  }

  const limits = normalizeLimits(options.limits);
  const retryPolicy = normalizeRetryPolicy(options.retryPolicy);
  const defaultTimeoutMs = validateTimeout(
    options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    'defaultTimeoutMs'
  );
  const transfer =
    options.transfer ??
    (options.fetch === undefined
      ? createZdpFetchUploadTransport()
      : createZdpFetchUploadTransport({ fetch: options.fetch }));
  const checksumProvider = options.checksumProvider ?? computeSha256Checksum;
  const requestIdFactory = options.requestIdFactory ?? createRandomId;
  const traceIdFactory = options.traceIdFactory ?? createRandomId;
  const idempotencyKeyFactory = options.idempotencyKeyFactory ?? createRandomId;

  return {
    async upload(
      input: ZdpSignedUploadInput,
      callOptions: ZdpUploadCallOptions = {}
    ): Promise<ZdpSignedUploadResult> {
      const normalizedInput = normalizeInput(input, limits);
      const requestId = resolveId(
        callOptions.requestId,
        requestIdFactory,
        'requestId'
      );
      const traceId = resolveId(callOptions.traceId, traceIdFactory, 'traceId');
      const idempotencyKey = resolveId(
        callOptions.idempotencyKey,
        idempotencyKeyFactory,
        'idempotencyKey'
      );
      const timeoutMs = validateTimeout(
        callOptions.timeoutMs ?? defaultTimeoutMs,
        'timeoutMs'
      );
      const timeoutController = new AbortController();
      const merged = mergeAbortSignals(
        callOptions.signal ?? null,
        timeoutController.signal
      );
      const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
      const activeContext: ActiveUploadContext = {
        requestId,
        traceId,
        idempotencyKey,
        signal: merged.signal,
        callerSignal: callOptions.signal ?? null,
        timeoutSignal: timeoutController.signal
      };
      const callbackContext: ZdpUploadCallContext = {
        requestId,
        traceId,
        idempotencyKey,
        signal: merged.signal
      };
      let uploadRef: string | null = null;

      try {
        throwIfAborted(activeContext, uploadRef);
        emitProgress(callOptions.onProgress, {
          phase: 'hashing',
          loadedBytes: 0,
          totalBytes: normalizedInput.source.size,
          attempt: null
        });
        const checksum = await resolveChecksum(
          normalizedInput,
          checksumProvider,
          merged.signal
        );
        throwIfAborted(activeContext, uploadRef);
        emitProgress(callOptions.onProgress, {
          phase: 'hashing',
          loadedBytes: normalizedInput.source.size,
          totalBytes: normalizedInput.source.size,
          attempt: null
        });
        emitProgress(callOptions.onProgress, {
          phase: 'authorizing',
          loadedBytes: 0,
          totalBytes: normalizedInput.source.size,
          attempt: null
        });

        const prepared = await options.authorize(
          {
            fileName: normalizedInput.fileName,
            contentType: normalizedInput.contentType,
            sizeBytes: normalizedInput.source.size,
            checksum,
            metadata: normalizedInput.metadata
          },
          callbackContext
        );
        uploadRef = validatePreparedUpload(prepared, normalizedInput, limits);
        throwIfAborted(activeContext, uploadRef);

        const provider = await uploadWithRetry({
          prepared,
          body: normalizedInput.source,
          transfer,
          retryPolicy,
          context: activeContext,
          onProgress: callOptions.onProgress
        });
        throwIfAborted(activeContext, uploadRef);
        emitProgress(callOptions.onProgress, {
          phase: 'completing',
          loadedBytes: normalizedInput.source.size,
          totalBytes: normalizedInput.source.size,
          attempt: null
        });

        const completion = await prepared.complete(
          {
            uploadRef,
            contentType: normalizedInput.contentType,
            sizeBytes: normalizedInput.source.size,
            checksum,
            provider
          },
          callbackContext
        );
        const validatedCompletion = validateCompletion(completion, uploadRef);
        throwIfAborted(activeContext, uploadRef);
        emitProgress(callOptions.onProgress, {
          phase: 'completed',
          loadedBytes: normalizedInput.source.size,
          totalBytes: normalizedInput.source.size,
          attempt: null
        });

        return {
          uploadRef,
          objectRef: validatedCompletion.objectRef,
          state: validatedCompletion.state,
          contentType: normalizedInput.contentType,
          sizeBytes: normalizedInput.source.size,
          checksum
        };
      } catch (error) {
        if (error instanceof ZdpUploadError) {
          throw error;
        }
        if (timeoutController.signal.aborted) {
          throw new ZdpUploadTimeoutError('Signed upload timed out.', {
            requestId,
            traceId,
            uploadRef
          });
        }
        if (callOptions.signal?.aborted === true) {
          throw new ZdpUploadAbortedError('Signed upload was aborted.', {
            requestId,
            traceId,
            uploadRef
          });
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        merged.cleanup();
      }
    }
  };
}

interface NormalizedUploadInput {
  readonly source: Blob;
  readonly fileName: string;
  readonly contentType: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly checksum: ZdpUploadChecksum | null;
}

function normalizeInput(
  input: ZdpSignedUploadInput,
  limits: ZdpUploadLimits
): NormalizedUploadInput {
  if (!isBlobLike(input.source)) {
    throw new ZdpUploadValidationError(
      'invalid_source',
      'Signed upload source must be a Blob or File.'
    );
  }
  if (input.source.size > limits.maxFileSizeBytes) {
    throw new ZdpUploadValidationError(
      'file_too_large',
      `Upload size ${input.source.size} exceeds ${limits.maxFileSizeBytes} bytes.`
    );
  }

  const fileName = validateFileName(input.fileName);
  const contentType = normalizeContentType(input.contentType ?? input.source.type);
  if (!matchesContentType(contentType, limits.allowedContentTypes)) {
    throw new ZdpUploadValidationError(
      'content_type_not_allowed',
      `Content type \`${contentType}\` is not allowed.`
    );
  }
  if (
    input.source.type.trim().length > 0 &&
    normalizeContentType(input.source.type) !== contentType
  ) {
    throw new ZdpUploadValidationError(
      'content_type_not_allowed',
      'Explicit content type must match the Blob content type.'
    );
  }

  return {
    source: input.source,
    fileName,
    contentType,
    metadata: normalizeMetadata(input.metadata),
    checksum: input.checksum === undefined ? null : validateChecksum(input.checksum)
  };
}

function normalizeLimits(limits: ZdpUploadLimits): ZdpUploadLimits {
  if (
    !Number.isSafeInteger(limits.maxFileSizeBytes) ||
    limits.maxFileSizeBytes <= 0
  ) {
    throw new ZdpUploadConfigurationError(
      'maxFileSizeBytes must be a positive safe integer.'
    );
  }
  if (!Array.isArray(limits.allowedContentTypes) || limits.allowedContentTypes.length === 0) {
    throw new ZdpUploadConfigurationError(
      'allowedContentTypes must contain at least one media type.'
    );
  }

  return {
    maxFileSizeBytes: limits.maxFileSizeBytes,
    allowedContentTypes: limits.allowedContentTypes.map(normalizeContentTypePattern)
  };
}

function normalizeRetryPolicy(
  policy: ZdpUploadRetryPolicy | undefined
): NormalizedRetryPolicy {
  const maxAttempts = policy?.maxAttempts ?? 3;
  const baseDelayMs = policy?.baseDelayMs ?? 250;
  const maxDelayMs = policy?.maxDelayMs ?? 2_000;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new ZdpUploadConfigurationError(
      'Upload retry maxAttempts must be an integer from 1 through 5.'
    );
  }
  if (!Number.isInteger(baseDelayMs) || baseDelayMs < 0) {
    throw new ZdpUploadConfigurationError(
      'Upload retry baseDelayMs must be a non-negative integer.'
    );
  }
  if (!Number.isInteger(maxDelayMs) || maxDelayMs < baseDelayMs) {
    throw new ZdpUploadConfigurationError(
      'Upload retry maxDelayMs must be an integer not smaller than baseDelayMs.'
    );
  }

  const statuses = policy?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  if (
    !statuses.every(
      (status) => Number.isInteger(status) && status >= 400 && status <= 599
    )
  ) {
    throw new ZdpUploadConfigurationError(
      'Upload retry statuses must be HTTP error status integers.'
    );
  }

  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    retryableStatuses: new Set(statuses)
  };
}

async function resolveChecksum(
  input: NormalizedUploadInput,
  provider: ZdpUploadChecksumProvider,
  signal: AbortSignal
): Promise<ZdpUploadChecksum> {
  if (input.checksum !== null) {
    return input.checksum;
  }
  const checksum = await provider({ source: input.source, signal });
  return validateChecksum(checksum);
}

async function computeSha256Checksum(input: {
  readonly source: Blob;
  readonly signal: AbortSignal;
}): Promise<ZdpUploadChecksum> {
  if (input.signal.aborted) {
    throw new DOMException('Upload aborted.', 'AbortError');
  }
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new ZdpUploadConfigurationError(
      'Web Crypto is unavailable; configure checksumProvider or pass a checksum.'
    );
  }
  const bytes = await input.source.arrayBuffer();
  if (input.signal.aborted) {
    throw new DOMException('Upload aborted.', 'AbortError');
  }
  const digest = await subtle.digest('SHA-256', bytes);
  return {
    algorithm: 'sha256',
    value: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  };
}

function validatePreparedUpload(
  prepared: ZdpPreparedUpload,
  input: NormalizedUploadInput,
  clientLimits: ZdpUploadLimits
): string {
  if (!isRecord(prepared)) {
    throw new ZdpUploadProtocolError(
      'Upload authorization must return a prepared upload object.'
    );
  }
  const uploadRef = requireOpaqueRef(prepared.uploadRef, 'uploadRef');
  if (typeof prepared.createRequest !== 'function') {
    throw new ZdpUploadProtocolError(
      'Prepared upload must provide createRequest().',
      { uploadRef }
    );
  }
  if (typeof prepared.complete !== 'function') {
    throw new ZdpUploadProtocolError(
      'Prepared upload must provide complete().',
      { uploadRef }
    );
  }
  if (typeof prepared.replaySafe !== 'boolean') {
    throw new ZdpUploadProtocolError(
      'Prepared upload must declare replaySafe.',
      { uploadRef }
    );
  }

  if (prepared.expiresAt !== null) {
    const expiresAt = Date.parse(prepared.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      throw new ZdpUploadProtocolError(
        'Prepared upload expiresAt must be an ISO-8601 timestamp or null.',
        { uploadRef }
      );
    }
    if (expiresAt <= Date.now()) {
      throw new ZdpUploadProtocolError('Prepared upload is already expired.', {
        uploadRef
      });
    }
  }

  if (prepared.maxFileSizeBytes !== null) {
    if (
      !Number.isSafeInteger(prepared.maxFileSizeBytes) ||
      prepared.maxFileSizeBytes <= 0
    ) {
      throw new ZdpUploadProtocolError(
        'Prepared upload maxFileSizeBytes must be a positive safe integer or null.',
        { uploadRef }
      );
    }
    if (input.source.size > prepared.maxFileSizeBytes) {
      throw new ZdpUploadValidationError(
        'file_too_large',
        `Upload size ${input.source.size} exceeds the authorized ` +
          `${prepared.maxFileSizeBytes} bytes.`,
        { uploadRef }
      );
    }
  }

  if (prepared.allowedContentTypes !== null) {
    if (
      !Array.isArray(prepared.allowedContentTypes) ||
      prepared.allowedContentTypes.length === 0
    ) {
      throw new ZdpUploadProtocolError(
        'Prepared upload allowedContentTypes must be a non-empty list or null.',
        { uploadRef }
      );
    }
    const authorizedTypes = prepared.allowedContentTypes.map(
      normalizeContentTypePattern
    );
    if (!matchesContentType(input.contentType, authorizedTypes)) {
      throw new ZdpUploadValidationError(
        'content_type_not_allowed',
        `Content type \`${input.contentType}\` is not authorized for this upload.`,
        { uploadRef }
      );
    }
  }

  return uploadRef;
}

async function uploadWithRetry(input: {
  readonly prepared: ZdpPreparedUpload;
  readonly body: Blob;
  readonly transfer: ZdpUploadTransport;
  readonly retryPolicy: NormalizedRetryPolicy;
  readonly context: ActiveUploadContext;
  readonly onProgress: ((progress: ZdpUploadProgress) => void) | undefined;
}): Promise<ZdpProviderUploadReceipt> {
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= input.retryPolicy.maxAttempts; attempt += 1) {
    throwIfAborted(input.context, input.prepared.uploadRef);
    const request = validateProviderRequest(
      input.prepared.createRequest(),
      input.prepared.uploadRef
    );

    try {
      const response = await input.transfer({
        request,
        body: input.body,
        signal: input.context.signal,
        totalBytes: input.body.size,
        onProgress: (loadedBytes, totalBytes) =>
          emitProgress(input.onProgress, {
            phase: 'uploading',
            loadedBytes: clampProgress(loadedBytes, input.body.size),
            totalBytes: normalizeProgressTotal(totalBytes, input.body.size),
            attempt
          })
      });
      if (!(response instanceof Response)) {
        throw new ZdpUploadProtocolError(
          'Upload transport must resolve with a Response.',
          { uploadRef: input.prepared.uploadRef }
        );
      }

      if (response.ok) {
        emitProgress(input.onProgress, {
          phase: 'uploading',
          loadedBytes: input.body.size,
          totalBytes: input.body.size,
          attempt
        });
        const receipt = readProviderReceipt(response);
        await cancelResponseBody(response);
        return receipt;
      }

      lastStatus = response.status;
      const retryable = input.retryPolicy.retryableStatuses.has(response.status);
      const delayMs = retryDelayMs(
        input.retryPolicy,
        attempt,
        response.headers.get('retry-after')
      );
      await cancelResponseBody(response);
      if (
        input.prepared.replaySafe &&
        retryable &&
        attempt < input.retryPolicy.maxAttempts
      ) {
        await abortableDelay(delayMs, input.context.signal);
        continue;
      }

      throw new ZdpUploadTransferError({
        message: `Signed upload provider returned HTTP ${response.status}.`,
        status: response.status,
        attempts: attempt,
        retryable: input.prepared.replaySafe && retryable,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        uploadRef: input.prepared.uploadRef
      });
    } catch (error) {
      if (error instanceof ZdpUploadError) {
        throw error;
      }
      throwIfAborted(input.context, input.prepared.uploadRef);
      if (
        input.prepared.replaySafe &&
        attempt < input.retryPolicy.maxAttempts
      ) {
        await abortableDelay(
          retryDelayMs(input.retryPolicy, attempt, null),
          input.context.signal
        );
        continue;
      }

      throw new ZdpUploadTransferError({
        message: 'Signed upload failed before the provider accepted the file.',
        status: null,
        attempts: attempt,
        retryable: input.prepared.replaySafe,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        uploadRef: input.prepared.uploadRef
      });
    }
  }

  throw new ZdpUploadTransferError({
    message: 'Signed upload exhausted its transfer attempts.',
    status: lastStatus,
    attempts: input.retryPolicy.maxAttempts,
    retryable: input.prepared.replaySafe,
    requestId: input.context.requestId,
    traceId: input.context.traceId,
    uploadRef: input.prepared.uploadRef
  });
}

function validateProviderRequest(request: Request, uploadRef: string): Request {
  if (!(request instanceof Request)) {
    throw new ZdpUploadProtocolError(
      'Prepared upload createRequest() must return a Request.',
      { uploadRef }
    );
  }
  const method = request.method.toUpperCase();
  if (!UPLOAD_METHODS.includes(method as (typeof UPLOAD_METHODS)[number])) {
    throw new ZdpUploadProtocolError(
      'Signed provider request method must be POST or PUT.',
      { uploadRef }
    );
  }
  if (request.body !== null) {
    throw new ZdpUploadProtocolError(
      'Signed provider request must not include a body; the SDK attaches the file.',
      { uploadRef }
    );
  }

  const url = new URL(request.url);
  if (url.username.length > 0 || url.password.length > 0) {
    throw new ZdpUploadProtocolError(
      'Signed provider request URL must not contain user info.',
      { uploadRef }
    );
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new ZdpUploadProtocolError(
      'Signed provider request must use HTTPS or localhost.',
      { uploadRef }
    );
  }
  if (url.hash.length > 0) {
    throw new ZdpUploadProtocolError(
      'Signed provider request URL must not contain a fragment.',
      { uploadRef }
    );
  }
  for (const header of FORBIDDEN_PROVIDER_HEADERS) {
    if (request.headers.has(header)) {
      throw new ZdpUploadProtocolError(
        `Signed provider request must not include \`${header}\`.`,
        { uploadRef }
      );
    }
  }

  return request;
}

function readProviderReceipt(response: Response): ZdpProviderUploadReceipt {
  const rawEtag = response.headers.get('etag');
  const etag =
    rawEtag !== null && rawEtag.length <= 512 && !/[\r\n]/.test(rawEtag)
      ? rawEtag
      : null;
  return { status: response.status, etag };
}

function validateCompletion(
  completion: ZdpUploadCompletion,
  expectedUploadRef: string
): ZdpUploadCompletion {
  if (!isRecord(completion)) {
    throw new ZdpUploadProtocolError(
      'Upload completion callback must return an object.',
      { uploadRef: expectedUploadRef }
    );
  }
  const uploadRef = requireOpaqueRef(completion.uploadRef, 'uploadRef');
  if (uploadRef !== expectedUploadRef) {
    throw new ZdpUploadProtocolError(
      'Upload completion uploadRef does not match the authorization.',
      { uploadRef: expectedUploadRef }
    );
  }
  const objectRef =
    completion.objectRef === null
      ? null
      : requireOpaqueRef(completion.objectRef, 'objectRef');
  if (
    !COMPLETION_STATES.includes(
      completion.state as (typeof COMPLETION_STATES)[number]
    )
  ) {
    throw new ZdpUploadProtocolError(
      'Upload completion state must be accepted, processing, or ready.',
      { uploadRef }
    );
  }

  return { uploadRef, objectRef, state: completion.state };
}

function requireOpaqueRef(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ZdpUploadProtocolError(`${label} must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length > 512 ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) ||
    /[\r\n]/.test(normalized)
  ) {
    throw new ZdpUploadProtocolError(
      `${label} must be an opaque server-owned reference.`
    );
  }
  return normalized;
}

function validateFileName(value: string): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 255 ||
    /[\0/\\]/.test(value)
  ) {
    throw new ZdpUploadValidationError(
      'invalid_file_name',
      'fileName must be a plain file name without path separators.'
    );
  }
  return value;
}

function normalizeContentType(value: string): string {
  if (typeof value !== 'string') {
    throw new ZdpUploadValidationError(
      'content_type_not_allowed',
      'contentType is required.'
    );
  }
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) {
    throw new ZdpUploadValidationError(
      'content_type_not_allowed',
      'contentType must be a valid media type.'
    );
  }
  return normalized;
}

function normalizeContentTypePattern(value: string): string {
  if (typeof value !== 'string') {
    throw new ZdpUploadConfigurationError(
      'Upload content type patterns must be strings.'
    );
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '*/*') {
    return normalized;
  }
  if (/^[a-z0-9!#$&^_.+-]+\/\*$/.test(normalized)) {
    return normalized;
  }
  try {
    return normalizeContentType(normalized);
  } catch {
    throw new ZdpUploadConfigurationError(
      `Invalid upload content type pattern \`${value}\`.`
    );
  }
}

function matchesContentType(
  contentType: string,
  patterns: readonly string[]
): boolean {
  const type = contentType.split('/', 1)[0] ?? '';
  return patterns.some(
    (pattern) =>
      pattern === '*/*' || pattern === contentType || pattern === `${type}/*`
  );
}

function normalizeMetadata(
  metadata: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
  if (metadata === undefined) {
    return {};
  }
  const entries = Object.entries(metadata);
  if (entries.length > 32) {
    throw new ZdpUploadValidationError(
      'invalid_metadata',
      'Upload metadata must not exceed 32 entries.'
    );
  }
  const normalized: [string, string][] = [];
  for (const [key, value] of entries) {
    if (
      key.length === 0 ||
      key.length > 64 ||
      !/^[a-zA-Z0-9_.-]+$/.test(key) ||
      typeof value !== 'string' ||
      value.length > 512 ||
      /[\r\n]/.test(value)
    ) {
      throw new ZdpUploadValidationError(
        'invalid_metadata',
        'Upload metadata keys or values are invalid.'
      );
    }
    normalized.push([key, value]);
  }
  return Object.fromEntries(normalized);
}

function validateChecksum(checksum: ZdpUploadChecksum): ZdpUploadChecksum {
  if (
    !isRecord(checksum) ||
    checksum.algorithm !== 'sha256' ||
    typeof checksum.value !== 'string' ||
    !/^[a-fA-F0-9]{64}$/.test(checksum.value)
  ) {
    throw new ZdpUploadValidationError(
      'invalid_checksum',
      'Upload checksum must be a SHA-256 lowercase hexadecimal digest.'
    );
  }
  return { algorithm: 'sha256', value: checksum.value.toLowerCase() };
}

function resolveId(
  explicit: string | undefined,
  factory: () => string,
  label: string
): string {
  const value = explicit ?? factory();
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 255 ||
    /[\r\n]/.test(value)
  ) {
    throw new ZdpUploadConfigurationError(
      `${label} must be a non-empty string no longer than 255 characters.`
    );
  }
  return value.trim();
}

function createRandomId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID === undefined) {
    throw new ZdpUploadConfigurationError(
      'Web Crypto randomUUID is unavailable; configure upload id factories.'
    );
  }
  return randomUUID.call(globalThis.crypto);
}

function validateTimeout(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ZdpUploadConfigurationError(
      `${label} must be a positive safe integer.`
    );
  }
  return value;
}

function emitProgress(
  callback: ((progress: ZdpUploadProgress) => void) | undefined,
  progress: ZdpUploadProgress
): void {
  if (callback === undefined) {
    return;
  }
  try {
    callback(progress);
  } catch {
    throw new ZdpUploadConfigurationError(
      'Upload progress callback must not throw.'
    );
  }
}

function clampProgress(value: number, totalBytes: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(totalBytes, Math.max(0, Math.floor(value)));
}

function normalizeProgressTotal(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function retryDelayMs(
  policy: NormalizedRetryPolicy,
  attempt: number,
  retryAfter: string | null
): number {
  const exponential = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** Math.max(0, attempt - 1)
  );
  const serverDelay = parseRetryAfter(retryAfter);
  return Math.min(policy.maxDelayMs, Math.max(exponential, serverDelay));
}

function parseRetryAfter(value: string | null): number {
  if (value === null) {
    return 0;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1_000);
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms === 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Upload aborted.', 'AbortError'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function throwIfAborted(
  context: ActiveUploadContext,
  uploadRef: string | null
): void {
  if (context.timeoutSignal.aborted) {
    throw new ZdpUploadTimeoutError('Signed upload timed out.', {
      requestId: context.requestId,
      traceId: context.traceId,
      uploadRef
    });
  }
  if (context.callerSignal?.aborted === true) {
    throw new ZdpUploadAbortedError('Signed upload was aborted.', {
      requestId: context.requestId,
      traceId: context.traceId,
      uploadRef
    });
  }
}

function mergeAbortSignals(
  callerSignal: AbortSignal | null,
  timeoutSignal: AbortSignal
): { readonly signal: AbortSignal; readonly cleanup: () => void } {
  if (callerSignal === null) {
    return { signal: timeoutSignal, cleanup: () => undefined };
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  callerSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });
  if (callerSignal.aborted || timeoutSignal.aborted) {
    abort();
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      callerSignal.removeEventListener('abort', abort);
      timeoutSignal.removeEventListener('abort', abort);
    }
  };
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Response bodies are never exposed or logged by the upload client.
  }
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).stream === 'function' &&
    Number.isSafeInteger((value as Blob).size) &&
    typeof (value as Blob).type === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
