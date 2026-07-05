# Client SDK Contract Validation

Before reporting completion, verify:

- SDK contracts still consume `zdp-api-contracts` instead of replacing it.
- Generation plan remains dry-run only.
- Typed fetch preserves operation metadata, request id, trace id, timeout, abort, idempotency, and error envelope.
- Auth helper does not store refresh/session/credential material.
- Upload client does not publish raw provider URL or bucket ownership as SDK truth.
- Package surface and version impact are named when packaged files change.
