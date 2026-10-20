import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import { createZdpXhrUploadTransport } from '../src/upload';
import type { ZdpUploadTransferInput } from '../src/upload';

function emit(target: EventTarget, type: string): void {
  for (const listener of getEventListeners(target, type)) {
    listener.call(target, new Event(type));
  }
}

class FakeXhr extends EventTarget {
  upload = new EventTarget();
  responseType = '';
  status = 204;
  statusText = 'No Content';
  response = null;
  sends = 0;
  aborts = 0;
  sendError: Error | null = null;
  sent = false;
  open(): void {}
  setRequestHeader(): void {}
  getAllResponseHeaders(): string { return 'etag: fixture-etag'; }
  send(): void {
    this.sends++;
    if (this.sendError) throw this.sendError;
    this.sent = true;
  }
  abort(): void {
    this.aborts++;
    // XHR only emits abort for an active sent request, not OPENED before send.
    if (this.sent) { this.sent = false; emit(this, 'abort'); }
  }
}

function fixture(onProgress: ZdpUploadTransferInput['onProgress'] = () => {}) {
  const xhr = new FakeXhr();
  const caller = new AbortController();
  const transfer = createZdpXhrUploadTransport({ createXhr: () => xhr as unknown as XMLHttpRequest });
  const input = {
    request: new Request('https://upload.invalid/fixture', { method: 'PUT' }),
    body: new Blob(['x']), signal: caller.signal, totalBytes: 1, onProgress
  };
  return { xhr, caller, input, transfer };
}

function expectClean(xhr: FakeXhr, signal: AbortSignal): void {
  expect(getEventListeners(signal, 'abort')).toHaveLength(0);
  expect(getEventListeners(xhr.upload, 'progress')).toHaveLength(0);
  for (const event of ['load', 'error', 'abort', 'timeout']) {
    expect(getEventListeners(xhr, event)).toHaveLength(0);
  }
}

test('pre-aborted XHR settles without waiting for a browser abort event', async () => {
  const { xhr, caller, input, transfer } = fixture();
  caller.abort();
  const pending = transfer(input).then(value => value, error => error);
  const result = await Promise.race([pending, Bun.sleep(50).then(() => 'still pending')]);
  expect(result).toBeInstanceOf(DOMException);
  expect(result.name).toBe('AbortError');
  expect(xhr.sends).toBe(0);
  expectClean(xhr, caller.signal);
});

test('synchronous send failure removes every listener', async () => {
  const { xhr, caller, input, transfer } = fixture();
  const failure = new Error('send failed');
  xhr.sendError = failure;
  await expect(transfer(input)).rejects.toBe(failure);
  expectClean(xhr, caller.signal);
});

test('cancellation from initial progress never calls send', async () => {
  const context = fixture(() => context.caller.abort());
  const pending = context.transfer(context.input).then(value => value, error => error);
  const result = await Promise.race([pending, Bun.sleep(50).then(() => 'still pending')]);
  expect(result).toBeInstanceOf(DOMException);
  expect(context.xhr.sends).toBe(0);
  expectClean(context.xhr, context.caller.signal);
});

for (const event of ['progress', 'load'] as const) {
  test(`throwing ${event} callbacks reject and clean up instead of stranding the promise`, async () => {
    let callbacks = 0;
    const failure = new Error('progress failed');
    const { xhr, caller, input, transfer } = fixture(() => {
      if (++callbacks > 1) throw failure;
    });
    const pending = transfer(input);
    expect(() => emit(event === 'progress' ? xhr.upload : xhr, event)).not.toThrow();
    await expect(pending).rejects.toBe(failure);
    expectClean(xhr, caller.signal);
    if (event === 'progress') expect(xhr.aborts).toBe(1);
  });
}

test('load resolves once and detaches listeners', async () => {
  const { xhr, caller, input, transfer } = fixture();
  const pending = transfer(input);
  emit(xhr, 'load');
  const result = await pending;
  expect(result.status).toBe(204);
  expect(result.headers.get('etag')).toBe('fixture-etag');
  expectClean(xhr, caller.signal);
  caller.abort();
  expect(xhr.aborts).toBe(0);
});

for (const event of ['error', 'abort', 'timeout'] as const) {
  test(`XHR ${event} rejects and detaches listeners`, async () => {
    const { xhr, caller, input, transfer } = fixture();
    const pending = transfer(input).then(value => value, error => error);
    emit(xhr, event);
    const result = await pending;
    expect(result).toBeInstanceOf(event === 'error' ? TypeError : DOMException);
    expectClean(xhr, caller.signal);
  });
}
