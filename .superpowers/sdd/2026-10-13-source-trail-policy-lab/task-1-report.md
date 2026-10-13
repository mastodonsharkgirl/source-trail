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

## Fix round 1

Archived the exact v1 fixture, rubric, and manifest under `docs/policy-lab/versions/policy-lab-fictional-v1/` before changing active data. The archived v1 fixture hash remains `f1b2a5e8a7535ac1d1ca8ba648a2cead340255a3d31c85f1a07ad7b604c48e19`. Active data is now `policy-lab-fictional-v2`, with additional travel replacement facts and four distinct passages on each side of the remote-work conflict; document IDs and the 12-document / 24-passage bounds remain unchanged.

- RED: added contract tests failed because rubric arrays accepted non-strings and returned provenance was mutable; the exact UTF-8 hash test also exposed an initially incorrect independently supplied expected value.
- GREEN: `npm test -- tests/policy-documents.test.ts` passed 13/13 after enforcing fixed `2026-10-13` dates, non-empty rubric strings, coherent group/reason/evidence combinations, cross-split intent-family exclusion, and deep immutability of documents, nested metadata, passages, cases, inputs, principals, and rubric arrays.
- The old active manifest correctly refused a differing overwrite. After checking it matched the v1 archive, it was replaced by a new write-once active v2 manifest. `node scripts/freeze-policy-fixture.mjs --write` and `--check` passed with active fixture hash `2d742f0fad108ce0ec53da2fbf601d090052094499ab376e6ac562c948f3eb7f` and rubric hash `211dce0282f30fe6b0d2fb59bd4eef7bf575625ee3c99b8cf8bbdab8cfa4175b`.
