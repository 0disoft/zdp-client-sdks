# Upload Client Contract

The upload client owns the signed upload request handoff shape, error mapping, and request, trace, and idempotency propagation.

It does not own bucket naming, file ownership decisions, raw provider URLs, signed URL values, provider tokens, or storage provider secrets.

Provider-specific data must stay behind the server-owned upload authorization boundary.
