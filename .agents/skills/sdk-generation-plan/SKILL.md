# SDK Generation Plan Skill

## Use When

SDK generation source, API generation input drift, API export plan handoff, target language planning, or generation dry-run behavior changes.

## Procedure

1. Read `contracts/sdk-generation-source.yaml`, `src/sdk-generation-plan/**`, and `scripts/plan-sdk-generation.ts`.
2. Read sibling `../zdp-api-contracts/contracts/sdk-generation-input.yaml` and the API export plan owner when drift is suspected.
3. Keep generation dry-run write-free.
4. Preserve route, error, webhook, request, trace, idempotency, session, credential, and forbidden value metadata across TypeScript, Dart, and Rust targets.
5. Verify with `zdp_client_sdks_check`.
