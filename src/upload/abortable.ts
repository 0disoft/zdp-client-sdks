/** Settle SDK waits even when a caller-owned operation ignores its signal. */
export function awaitUploadStep<T>(pending: Promise<T>, signal: AbortSignal, discardLate?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      action();
    };
    const abort = () => finish(() => reject(new DOMException('Upload aborted.', 'AbortError')));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    // Always observe eventual rejection; late operations cannot advance the SDK.
    Promise.resolve(pending).then(value => {
      if (settled) {
        try { discardLate?.(value); } catch { /* Late cleanup cannot change the completed SDK outcome. */ }
      } else finish(() => resolve(value));
    }, error => finish(() => reject(error)));
  });
}
