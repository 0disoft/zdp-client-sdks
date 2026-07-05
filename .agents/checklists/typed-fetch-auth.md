# Typed Fetch And Auth Checklist

- Operation definitions are derived from API catalog data.
- Request id and trace id are preserved through errors.
- Timeout option and abort signal remain caller controlled.
- Idempotency key is propagated for mutation safety.
- Auth helper attaches access token only; it does not store refresh, session, credential, or provider state.
- Authorization decisions stay outside the SDK.
