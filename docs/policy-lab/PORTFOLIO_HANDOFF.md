# Policy Lab local handoff — implementation checkpoint

**The release is not complete.** Source, deterministic tests and a truthful
pending page are prepared. Real Policy Lab evaluation and rendered root/prefix
acceptance remain deferred under the shared-compute reservation. No further
implementation approval is being requested by this handoff.

Source candidate: `80046b4649d3846e97b190b62135875c4c445a94` on
`codex/source-trail-policy-evaluation`. The following handoff commit contains
documentation only; obtain its exact ID with `git log -1 --oneline`. Original
release/worktree: `fd3e4371fc0f7fa99dc1b6118a66134a20e177ba`, preserved.

## Current deliverables

- [Approved specification](../superpowers/specs/2026-10-13-source-trail-policy-lab-design.md)
  and [implementation plan](../superpowers/plans/2026-10-13-source-trail-policy-lab.md).
- Frozen v7 fictional fixture, shared eligibility/selection, bounded local Python
  runner, strict assessment/reporting and immutable selected-export support.
- `/policy-lab/` source with recorded-only controls, source/raw-output inspection,
  explicit export and an unavailable manifest until a real run is selected.
- [Architecture](ARCHITECTURE.md), [evaluation status](EVALUATION.md),
  [assessment guide](ASSESSMENT_GUIDE.md), [walkthrough](WALKTHROUGH.md),
  [claim ledger](CLAIM_LEDGER.md) and [verification](VERIFICATION.md).

## Routes and integration ownership

| View | Root route | Portfolio-prefixed route |
| --- | --- | --- |
| Story Lab | `/` | `/tools/source-trail/` |
| Original retrieval desk | `/baseline/` | `/tools/source-trail/baseline/` |
| Policy Lab | `/policy-lab/` | `/tools/source-trail/policy-lab/` |

Keep `SOURCE_TRAIL_BASE` consistent between build and serving. Generated page and
worker headers remain scoped; Policy Lab uses same-origin-only connections. Its
methodology lives at `evidence/policy-lab/methodology.txt`; selected reports will
live beside it only after real export. Serve those paths beneath the same base.
The pending page does not expose links to nonexistent reports.

The portfolio integration owner controls deployment, header merging and any
registry/copy update. Nothing here authorises publication or changes another
repository. Root `domains.yaml`, portfolio/career files, DNS and the existing
hosted baseline were not edited.

## Reproduce the lightweight checks now

From this repository, using its installed dependencies:

```powershell
npm run policy:fixture
npm run policy:preservation
npm run policy:coherence
npm run test:policy -- --maxWorkers=1
py -3.14 -m unittest discover -s tools/policy_eval/tests -p 'test_*.py' -v
npm run check
```

These checks do not start actual models. Current observed results are in the
verification record. Synthetic test outputs must never be promoted into product
data. Keep all immutable attempts and budget files once real processing starts.

## Remaining sequence after compute becomes available

1. Complete the actual evaluation sequence in [EVALUATION.md](EVALUATION.md),
   retaining failures and respecting the stage/budget limits.
2. Produce and assess the selected real report; run `policy:report:check`,
   `policy:export:check` and `policy:coherence`.
3. Run root `npm run qa`, then a prefixed build and browser suite sequentially.
   Restore the previous base environment value afterward. Use an isolated port
   and `reuseExistingServer: false`; do not stop another project to free a port.
4. Inspect actual screenshots/keyboard/export states and both preserved journeys.
   Case-interaction browser tests currently skip honestly because no real selected
   run exists. A skip is an unmet acceptance criterion, not a pass.
5. Run fresh baseline drift verification, final whole-change review and preservation
   checks. Record the final source/evidence commit and remaining limitations.

Do not rerun held-out evaluation to improve a score or retry a started sample.
If the runtime fails, retain an explicitly partial report and its failure reason.

## Proposed portfolio/registry wording

Current truthful wording is in [CLAIM_LEDGER.md](CLAIM_LEDGER.md). A registry may
describe this as “local Policy Lab implementation; real evaluation/browser QA
pending,” but the change is only proposed here for its owner. Preserve the original
Story Lab and retrieval identities, existing release evidence and zero new
deployment/custom-domain claims. No professional-experience duration or customer
impact claim is inferred from this project.
