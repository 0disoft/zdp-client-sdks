# Upload Client Checklist

- Signed provider requests stay inside ephemeral `createRequest()` closures.
- Results, errors, progress events, fixtures, and docs do not expose signed URLs or provider response bodies.
- Local limits and authorization-scoped file size and MIME limits are both enforced before transfer.
- SHA-256 checksum, request ID, trace ID, and idempotency key reach authorization and completion callbacks.
- Provider requests do not receive ZDP authorization, cookies, request IDs, trace IDs, or idempotency keys.
- Retry is bounded and enabled only when the prepared upload declares `replaySafe: true`.
- Timeout and caller cancellation stop authorization, transfer, retry delay, and completion work.
- Default fetch progress is start/finish only; granular browser progress uses the XHR transport.
