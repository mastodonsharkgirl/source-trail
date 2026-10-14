# Local verification checkpoint

Source candidate: `80046b4649d3846e97b190b62135875c4c445a94` on
`codex/source-trail-policy-evaluation`. Recorded 15 October 2026. This document
separates source/test evidence from remaining release requirements.

| Check | Observed result |
| --- | --- |
| `npm run test:policy -- --maxWorkers=1` | Exit 0; 48 tests in four files passed. No real encoder or model call. |
| `py -3.14 -m unittest discover -s tools/policy_eval/tests -p 'test_*.py' -v` | Exit 0; 58 synthetic Python tests passed in one process. |
| `npm run check` | Exit 0; 48 files, zero errors, warnings or hints. |
| `py -3.14 -m compileall -q tools/policy_eval` | Passed after report fixes. |
| `npm run policy:fixture` | Exit 0; frozen v7 fixture/rubric manifest confirmed. |
| `npm run policy:preservation` | Exit 0; all 13 protected Git blobs match release `fd3e4371fc0f7fa99dc1b6118a66134a20e177ba`. |
| `npm run policy:coherence` | Exit 0; pending manifest and absence of stale selected artifacts confirmed. |
| Git attributes for run/export paths | `text: unset`; exact evidence bytes survive checkout line-ending settings. |
| Source scan of new viewer entry/components | No inference, network, persistent-storage or HTML-execution APIs found. Source check only. |
| Separate Story Lab worktree | Clean; remains at `fd3e437` on its Story Lab branch. |

The last source changes after the full focused suites were Git attributes and
documentation. Coherence was rerun after attributes changed. Original nav diffs
contain only Policy Lab links; visual fit has not yet been inspected.

## Review record

The serial read-only reviewer initially found three Important reporting issues:
lost prepared retrieval for missing generation, transferable assessments, and
incomplete saved-model/template binding. Regression tests demonstrated the issues;
fixes passed the tests. The subsequent source review confirmed all three addressed.

The viewer review found one Important gap: selected snapshot identity was not
bound to the bundled page and case download. A local build/page coherence check,
explicit selected hash in downloads and mismatch regressions address it. Those
fixes passed tests and type checking; they have not had independent re-review.
No Critical finding was reported in these scoped reviews.

## Unperformed acceptance checks

- Actual installed-asset hashing, MiniLM development calibration, Qwen smoke and
  development/held-out generation, real source-support assessment and report export.
- `policy:report:check` and `policy:export:check` against an actual selected run.
  There is no pointer to check yet; a pending-manifest check is not a substitute.
- `npm run qa`, fresh root/prefix builds and Playwright suites, including the
  original recorded Story Lab journey and retrieval desk.
- Actual response CSP, browser network/storage behavior, export download readback,
  keyboard use, 320/390/768/1440 layouts and reduced-motion visual inspection.
- Fresh original `npm run evaluate -- --check`, which performs real embeddings.
- Final whole-change review including raw evidence and screenshots.

These remain deferred under the existing shared-compute reservation. No such
work was silently run, and no screenshot, deployment or performance result is
claimed. Local commits exist; push, CI, hosted preview and custom-domain actions
were not performed by this workstream.
