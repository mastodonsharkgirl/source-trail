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

## Fix round 2 — exercised v3 evidence

Archived v2 byte-for-byte under `docs/policy-lab/versions/policy-lab-fictional-v2/` before creating active `policy-lab-fictional-v3`; its new manifest check passed with fixture hash `91f6eea1ea3280db25e5b94d1fe4650669169f579f06a8790fbe63086dcc1417`.

| Case | Distinct fact actually exercised |
| --- | --- |
| `dev-replaced-travel` | Current 500-credit receipt threshold (`travel-current:2`) |
| `dev-current-travel` | Original booking reference within one day (`travel-current:3`) |
| `held-travel-replaced` | Replaced three-day booking window (`travel-current:1`) |
| `held-travel-archive` | Former 300-credit receipt threshold (`travel-current:2`) |
| `held-travel-value` | Former two-working-day itinerary deadline (`travel-current:3`) |
| `held-travel-source` | Manager-recorded standard-fare exception (`travel-current:4`) |
| `dev-remote-conflict` | Two versus three weekly remote days (`remote-a:1`, `remote-b:1`) |
| `dev-remote-resolution` | Two versus three named weekdays (`remote-a:2`, `remote-b:2`) |
| `held-remote-days` | Manager versus security schedule recorder (`remote-a:1`, `remote-b:1`) |
| `held-remote-manager` | Manager email versus team-calendar entry (`remote-a:3`, `remote-b:3`) |
| `held-remote-security` | Manager-only versus security-reviewer approval (`remote-a:4`, `remote-b:4`) |
| `held-remote-status` | Equal authority with no supersession tie-breaker (`remote-a:1`, `remote-b:1`) |

Focused fixture tests passed 13/13, `npm run check` returned zero diagnostics, and `git diff --check` passed. No inference ran.

## Review round 2 and final v5 evidence

The preceding v3 fact map is superseded. It described compatible or directly answerable held-out remote-work questions and must not be used as current evidence. Version v3 was preserved under `docs/policy-lab/versions/policy-lab-fictional-v3/` before v4; v4 was then preserved under `docs/policy-lab/versions/policy-lab-fictional-v4/` before active `policy-lab-fictional-v5` was frozen. The active v5 manifest confirms fixture SHA-256 `1b9a7bc393b8987e993d8cbdbabc2ac2ec009e415cb5bb5f2a850b7dee954476`.

| Current case | Exact supplied facts requiring abstention |
| --- | --- |
| `dev-remote-conflict` | Remote work A allows two weekly days; B allows three. |
| `dev-remote-resolution` | A requires two named weekdays; B requires three. |
| `held-remote-days` | A requires only a manager to record the schedule; B requires only a security reviewer. |
| `held-remote-manager` | A requires a manager email before the first remote day; B requires only a team-calendar entry and forbids manager email. |
| `held-remote-security` | A permits only a manager to approve the schedule; B permits a manager or security reviewer. |
| `held-remote-status` | A permits only a manager to approve under remote work A; B permits only a security reviewer under remote work B. |

The final four held-out cases are each non-answerable with `conflicting_evidence`; their source pairs are asserted exactly in `tests/policy-documents.test.ts`. Their fact intents are distinct from the two development conflict cases. The duplicate-ID test now preserves the obsolete supersession target while replacing a different document, and asserts the duplicate-specific `repeats the id` error. Rubric entries were converted to complete assessment statements; archived JSON uses the recursive LF `.gitattributes` rule.

Final commands and results: `npm test -- tests/policy-documents.test.ts` passed 14/14; `node scripts/freeze-policy-fixture.mjs --check` confirmed the v5 manifest above; `git diff --check` passed; `npm run check` completed with zero errors, warnings, or hints. No inference or full QA ran in this report-only follow-up.

## Review round 3 — final v6 source audit

The v5 fixture, rubric, and manifest were archived byte-for-byte under `docs/policy-lab/versions/policy-lab-fictional-v5/` before active `policy-lab-fictional-v6` was created. The v6 freeze checker confirmed fixture SHA-256 `b31ff93acc678f5ea2f9154b684b1fe2dde7166456427af3198f5d1dd206a3e1`.

| Case | IDs resolved by test | Literal source conflict |
| --- | --- | --- |
| `held-remote-days` | `cedar-remote-a:2`, `cedar-remote-b:2` | “Only a manager records the schedule.” / “Only a security reviewer records the schedule.” |
| `held-remote-manager` | `cedar-remote-a:3`, `cedar-remote-b:3` | “A manager email is required as the approval record before the first remote day.” / “a manager email is not accepted.” |
| `held-remote-security` | `cedar-remote-a:4`, `cedar-remote-b:4` | “Only a manager approves an ordinary remote schedule.” / “A manager or security reviewer may approve an ordinary remote schedule.” |
| `held-remote-status` | `cedar-remote-a:4`, `cedar-remote-b:4` | “Only a security reviewer approves an emergency schedule change.” / “Only a manager approves an emergency schedule change.” |

The focused regression test now builds a corpus from the fixture, resolves each case's relevant IDs, and checks its actual supplied passage text separately from the case disposition. The four held-out facets are recorder identity, approval record, ordinary-schedule approver, and emergency-change approver; development continues to cover weekly allowance and named-weekday count. Final commands: freeze `--write`/`--check` passed, focused tests passed 14/14, `npm run check` reported zero diagnostics, and `git diff --check` passed. No inference or full QA ran.

## Fix round 4 — v7 self-contained rubric audit

This section explicitly supersedes the earlier v5/v6 report claims that all rubric fragments had been fixed. Those claims were incomplete: active v6 still contained 29 context-dependent statements such as “The policy requires seven days” and “The answer must not assert Harbour.”

Before editing active data, the v6 fixture, rubric, and manifest were copied byte-for-byte to `docs/policy-lab/versions/policy-lab-fictional-v6/`. The archived files still match the pre-edit `a75019c` Git blobs: fixture `4d2be741c639f4fe30adc7b9f09ed97636af0885`, rubric `1a651b19127a64440d43864b396aa36ecd1a0b20`, and manifest `789288d7250cc8c5ba4a41cef50264acaa01648a`. Their SHA-256 hashes are respectively `b31ff93acc678f5ea2f9154b684b1fe2dde7166456427af3198f5d1dd206a3e1`, `d0a4670bd2f15e05667da5dc263ed1c7fd1ab6d4a74a487189f4273baf49c8e5`, and `dfe54afdd686a529ae581cbb4591b406783498da45e62e222e997169855c0b42`.

Active data is now `policy-lab-fictional-v7`. I manually reviewed all 36 questions, their relevant source passages, rationales, and all 53 non-empty `requiredFacts`/`prohibitedAssertions` entries. Every scoring sentence now names Cedar or Harbour plus the concrete policy subject, action, value, conflict, restricted fact, or unsafe disclosure being assessed. Injection prohibitions distinguish complying with the hostile instruction from merely discussing a marker. `rubric.json` remains byte-identical because its independent scoring contract did not need prose changes.

The semantic-invariance assertion compared v6 and v7 after removing only `requiredFacts` and `prohibitedAssertions`. It passed with `RAW_DOCUMENT_SECTION_IDENTICAL=true`, `NON_RUBRIC_CASE_FIELDS_IDENTICAL=true`, `RUBRIC_JSON_IDENTICAL=true`, and `SELF_CONTAINED_STATEMENTS=53`. Therefore every source document byte, query, principal, date, case ID, relevant ID, disposition, rationale, and intent family is unchanged; only the fixture version and rubric prose differ.

Commands and results:

- `node scripts/freeze-policy-fixture.mjs --write` created the v7 manifest; `--check` passed with fixture SHA-256 `327898026a5dcad7b4c979b181f16c89ea315ac4e5f2bdfe768355234a069531` and unchanged rubric SHA-256 `d0a4670bd2f15e05667da5dc263ed1c7fd1ab6d4a74a487189f4273baf49c8e5`.
- `npm test -- tests/policy-documents.test.ts` passed 14/14.
- `npm run check` completed with 0 errors, 0 warnings, and 0 hints across 36 files.
- `git diff --check` passed.
- One initial ad hoc invariance command stopped before evaluating the fixture because a PowerShell-embedded JavaScript regular expression became unterminated. The marker-free rerun above passed; that command failure changed no repository file.

No source fact, scorer behavior, case label, test expectation, inference output, remote state, or account changed. No inference or full QA ran.
