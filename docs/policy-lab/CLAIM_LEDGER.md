# Policy Lab claim ledger

Checkpoint: 15 October 2026. Source candidate
`80046b4649d3846e97b190b62135875c4c445a94`. This is a local implementation
checkpoint, not a release accepted through model and browser verification.

| Claim | Evidence | Current status and limit |
| --- | --- | --- |
| A separate Policy Lab scenario is specified | Approved specification and implementation plan under `docs/superpowers/` | Specified; user approved continuation. |
| It preserves the original retrieval and Story Lab evidence/core | `scripts/check-policy-preservation.mjs`; 13 protected Git blobs match `fd3e437` | Verified locally. Small navigation additions still need rendered regression QA. |
| Eligibility precedes ranking/context assembly | `src/policy/eligibility.ts`, `retrieval.ts`; focused tests | Verified with deterministic inputs. Public fictional filtering is not production authorisation. |
| Real semantic retrieval and local Qwen comparison are measured | Actual calibration/protocol/run files | Not done. No Policy Lab model-quality or performance score may be claimed. |
| The runner retains failures and prevents automatic retries | `tools/policy_eval/runner.py` and synthetic tests | Tested contract/persistence behavior; actual runtime compatibility is pending. |
| Reports retain expected denominators and prepared context | `report.py`; missing/interrupted/failed-row tests | Tested with synthetic records, not a completed real report. |
| Assessments cannot transfer between differing contexts | `assessment.py`; run/case/method/context/output/rubric regressions | Tested. Agent assessment is not independent human validation. |
| The viewer reads stored cases and renders text literally | `viewer.ts`, React components; 8 viewer unit tests | Source and server-render tests pass. Actual browser interaction/appearance remain unverified. |
| Case downloads identify their selected snapshot | Build coherence check, required SelectedRun and export regressions | Local consistency tests pass. Real browser download readback is pending. |
| Current page has no measured results | Unavailable manifest; absent run/calibration/protocol/selection files | Verified locally; no synthetic test response appears in product data. |
| Output disclosure resistance is measured | No restricted-only sentinel exists in v7 | Not applicable. The public marker cannot prove disclosure or its absence. |
| Production readiness, customer adoption or business impact | No evidence in this experiment | Not claimed. |

Implementation and documentation were generated/edited with Codex. Saran supplied
the product direction, local-only scope and approval to continue. Do not turn
assisted implementation into an unsupported claim of independently writing every
component, completing learning exercises, customer discovery or production use.

## Suitable wording at this checkpoint

“Building a local policy-evidence experiment that compares lexical retrieval,
semantic retrieval and full eligible context. The fixture, bounded runner,
reporting checks and recorded viewer are implemented and locally unit-tested;
real model evaluation and browser acceptance are still pending.”

After real evaluation, replace the pending clause with the actual retained
results and limitations. Do not promise a target score, security guarantee,
latency improvement or enterprise adoption before evidence exists.
