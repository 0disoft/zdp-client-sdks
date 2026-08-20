# SDK Generation Plan Skill

## Use When

SDK generation source, API generation input drift, API export plan handoff, target language planning, TypeScript model generation, or generation dry-run behavior changes.

## Procedure

1. Read `contracts/sdk-generation-source.yaml`, `contracts/typescript-sdk-models.yaml`, `src/sdk-generation-plan/**`, and generation scripts.
2. Read sibling `../zdp-api-contracts/contracts/sdk-generation-input.yaml` and the locked API schema/route handoff when drift is suspected.
3. Keep the cross-language generation plan write-free.
4. Allow the dedicated TypeScript model sync command to update only its checked-in generated source.
5. Preserve route, error, webhook, request, trace, idempotency, session, credential, and forbidden value metadata across TypeScript, Dart, and Rust targets.
6. Verify exact TypeScript field coverage and run `zdp_client_sdks_check`.
