# Typed Fetch And Auth Contract

Typed fetch keeps operation metadata visible to SDK consumers. Request id, trace id, timeout, abort signal, idempotency key, success status metadata, pagination metadata handoff, and standard error envelope handling are part of the SDK boundary. The current runtime does not implement automatic page traversal.

HTTP 204 success responses decode to `undefined`; generated response-schema field checks apply only to success responses that can carry a body.

Generated schema metadata keeps required and optional fields separate. Product-link exchange therefore exposes `workspace_ref` when present without making it mandatory for account-only links.

The auth helper attaches caller-provided access token material. It does not own refresh token storage, session lifecycle, raw credential storage, membership authority, entitlement authority, or final authorization decisions.

Auth and session metadata from API routes must not be flattened into ordinary CRUD helpers.
