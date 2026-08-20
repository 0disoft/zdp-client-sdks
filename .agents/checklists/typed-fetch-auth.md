# Typed Fetch And Auth Checklist

- Operation definitions are derived from API catalog data.
- Request id and trace id are preserved through errors.
- Timeout option and abort signal remain caller controlled.
- Idempotency key is propagated for mutation safety.
- Automatic retry is disabled by default and remains bounded when enabled.
- GET requests or mutations with a contract-backed idempotency key are the only retry-safe calls.
- One logical call reuses the same request id, trace id, and idempotency key across every attempt.
- Retry-After values beyond the configured wait cap fail without another request.
- Auth helper attaches access token only; it does not store refresh, session, credential, or provider state.
- Authorization decisions stay outside the SDK.
