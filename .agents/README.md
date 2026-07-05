# Client SDK Agent Notes

Start with `BOUNDARY.md`, `SECURITY.md`, `CHECKLIST.md`, and `VALIDATION.md`. This repository consumes API and libs contracts; it does not own those sources of truth.

## High-Risk Mistakes

- Treating `zdp-client-sdks` as the API contract source.
- Adding refresh token, session token, credential, or authorization decision ownership to SDK helpers.
- Letting one language target use a different route, error, webhook, success status, or forbidden value contract.
- Publishing package changes without check and pack evidence.

## Local Routes

- `.agents/checklists/sdk-generation.md`
- `.agents/checklists/typed-fetch-auth.md`
- `.agents/checklists/upload-client.md`
- `.agents/checklists/package-surface.md`
- `.agents/skills/sdk-generation-plan/SKILL.md`
- `.agents/skills/typed-fetch-runtime/SKILL.md`
- `.agents/validations/client-sdk-contract.md`
