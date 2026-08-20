import { ZdpUploadConfigurationError } from './errors';
import type {
  ZdpUploadFetchLike,
  ZdpUploadTransferInput,
  ZdpUploadTransport
} from './types';

export interface ZdpFetchUploadTransportOptions {
  readonly fetch?: ZdpUploadFetchLike;
}

export function createZdpFetchUploadTransport(
  options: ZdpFetchUploadTransportOptions = {}
): ZdpUploadTransport {
  const fetchLike = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (fetchLike === undefined) {
    throw new ZdpUploadConfigurationError(
      'A fetch implementation is required for signed uploads.'
    );
  }

  return async (input) => {
    input.onProgress(0, input.totalBytes);
    const response = await fetchLike(input.request.url, {
      method: input.request.method,
      headers: input.request.headers,
      body: input.body,
      signal: input.signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store'
    });
    input.onProgress(input.totalBytes, input.totalBytes);
    return response;
  };
}

export interface ZdpXhrUploadTransportOptions {
  readonly createXhr?: () => XMLHttpRequest;
}

export function createZdpXhrUploadTransport(
  options: ZdpXhrUploadTransportOptions = {}
): ZdpUploadTransport {
  const createXhr =
    options.createXhr ??
    (() => {
      if (typeof XMLHttpRequest === 'undefined') {
        throw new ZdpUploadConfigurationError(
          'XMLHttpRequest is unavailable in this runtime.'
        );
      }
      return new XMLHttpRequest();
    });

  return (input) => transferWithXhr(createXhr(), input);
}

function transferWithXhr(
  xhr: XMLHttpRequest,
  input: ZdpUploadTransferInput
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      input.signal.removeEventListener('abort', abort);
      xhr.upload.removeEventListener('progress', progress);
      xhr.removeEventListener('load', load);
      xhr.removeEventListener('error', fail);
      xhr.removeEventListener('abort', aborted);
    };
    const finish = (action: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      action();
    };
    const abort = () => xhr.abort();
    const progress = (event: ProgressEvent<EventTarget>) => {
      input.onProgress(
        event.loaded,
        event.lengthComputable ? event.total : input.totalBytes
      );
    };
    const load = () => {
      finish(() => {
        if (xhr.status === 0) {
          reject(new TypeError('Signed upload transfer failed.'));
          return;
        }
        input.onProgress(input.totalBytes, input.totalBytes);
        const body = [101, 204, 205, 304].includes(xhr.status)
          ? null
          : (xhr.response as BodyInit | null);
        resolve(
          new Response(body, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseXhrHeaders(xhr.getAllResponseHeaders())
          })
        );
      });
    };
    const fail = () =>
      finish(() => reject(new TypeError('Signed upload transfer failed.')));
    const aborted = () =>
      finish(() => reject(new DOMException('Upload aborted.', 'AbortError')));

    try {
      xhr.open(input.request.method, input.request.url, true);
      xhr.responseType = 'arraybuffer';
      for (const [name, value] of input.request.headers) {
        xhr.setRequestHeader(name, value);
      }
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    input.signal.addEventListener('abort', abort, { once: true });
    xhr.upload.addEventListener('progress', progress);
    xhr.addEventListener('load', load);
    xhr.addEventListener('error', fail);
    xhr.addEventListener('abort', aborted);

    if (input.signal.aborted) {
      abort();
      return;
    }

    input.onProgress(0, input.totalBytes);
    xhr.send(input.body);
  });
}

function parseXhrHeaders(source: string): Headers {
  const headers = new Headers();
  for (const line of source.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return headers;
}
