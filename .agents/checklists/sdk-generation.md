# SDK Generation Checklist

- Generation source points at `zdp-api-contracts/contracts/sdk-generation-input.yaml`.
- Cross-language dry-run plan does not write SDK files or publish schemas.
- TypeScript, Dart, and Rust targets share the same API inputs.
- TypeScript model generation writes only checked-in `src/typed-fetch/api-models.ts` from the locked API handoff and `contracts/typescript-sdk-models.yaml`.
- TypeScript field representation covers exactly the required and optional fields used by API operations.
- Route metadata includes success statuses, request id, trace id, idempotency, session effect, credential policy, and forbidden value checks.
- API export plan handoff confirms OpenAPI, SDK input, docs contract, and webhook schema planning from the same source.
