# Task 1 report — frozen Policy Lab fixture and contracts

## Scope and result

Created the fictional 12-document Policy Lab corpus, frozen development and held-out contracts, a Node-only validator/corpus preparer, SHA-256 freeze manifest tool, and focused contract tests. No Story Lab, original source desk, original evaluator, inference code, route, or UI files changed. The corpus contains 12 one-passage documents and is below the documented 24-passage/16 KiB bounds. The held-out split is 8 current, 4 superseded, 4 conflict, 4 unavailable, and 4 injection cases, with 14 answerable cases.

`documents.ts` intentionally uses synchronous `node:crypto`: it is a Node CLI/corpus boundary. The future recorded Policy Lab viewer must import frozen JSON and types only, never this module or inference/selection modules.

## TDD evidence

- RED: `npm test -- tests/policy-documents.test.ts` first failed because `docs/policy-lab/fixture.json` did not exist.
- RED: after initial implementation, the new group-count test failed because a malformed held-out group distribution was accepted.
- GREEN: `npm test -- tests/policy-documents.test.ts` passed with 11 tests. The suite exercises split counts and disjoint intent families, exact repeated-Unicode/CRLF spans, duplicate IDs, bad roles/dates, supersession cycles/cross-tenant references, corpus size limits, inaccessible gold evidence, and frozen group counts.

## Freeze and validation

- `node scripts/freeze-policy-fixture.mjs --write` created the initial immutable manifest.
- `node scripts/freeze-policy-fixture.mjs --check` passed with fixture SHA-256 `f1b2a5e8a7535ac1d1ca8ba648a2cead340255a3d31c85f1a07ad7b604c48e19`.
- `git diff --check` passed.
- `npm run qa` passed: Astro check 0 errors/warnings, Vitest 33/33, production build, and Playwright 30/30. The saved Playwright result reports no failures.

## Self-review

The fixture is explicitly fictional and contains no real credentials, tenant data, endpoints, or policy claims. Gold labels remain in the fixture/rubric contract and are not used by corpus preparation. The manifest rejects overwriting differing frozen bytes, requiring a new version/path. `.gitattributes` preserves prior fixture rules and adds LF enforcement only for Policy Lab JSON.

## Commit

`56d7a5b` — `feat: freeze policy lab fixture and contracts`.
