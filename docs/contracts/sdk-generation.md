# SDK Generation Contract

SDK generation consumes `zdp-api-contracts/contracts/sdk-generation-input.yaml`. It does not create the API source of truth.

The generation plan is a dry-run contract. It may inspect API input, libs export source, route metadata, success statuses, error metadata, webhook replay fields, request id, trace id, idempotency, schema required and optional fields, and forbidden values. It must not write generated SDK files, publish schemas, or create OpenAPI artifacts.

TypeScript, Dart, and Rust targets must preserve the same input source and safety metadata before any language-specific generator is allowed to write files.
