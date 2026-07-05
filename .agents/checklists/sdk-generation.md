# SDK Generation Checklist

- Generation source points at `zdp-api-contracts/contracts/sdk-generation-input.yaml`.
- Dry-run plan does not write SDK files or publish schemas.
- TypeScript, Dart, and Rust targets share the same source inputs.
- Route metadata includes success statuses, request id, trace id, idempotency, session effect, credential policy, and forbidden value checks.
- API export plan handoff confirms OpenAPI, SDK input, docs contract, and webhook schema planning from the same source.
