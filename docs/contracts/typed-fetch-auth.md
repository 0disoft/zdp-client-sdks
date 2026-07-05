# Typed Fetch And Auth Contract

Typed fetch keeps operation metadata visible to SDK consumers. Request id, trace id, timeout, abort signal, idempotency key, success status metadata, pagination, and standard error envelope handling are part of the SDK boundary.

The auth helper attaches caller-provided access token material. It does not own refresh token storage, session lifecycle, raw credential storage, membership authority, entitlement authority, or final authorization decisions.

Auth and session metadata from API routes must not be flattened into ordinary CRUD helpers.
