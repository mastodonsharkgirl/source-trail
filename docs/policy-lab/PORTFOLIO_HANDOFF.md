# Policy Lab local handoff

Actual evaluation, local root/prefix browser acceptance and fresh whole-change
review are complete. The review's substantive recovery finding was fixed with
failing-then-passing regressions and repeated acceptance checks. The branch
remains local and preserves Story Lab and the original retrieval desk.

Final source/acceptance commit:
`ca63ca4016b0d9973a9aa7e87b8fa55e62f6d53b` on
`codex/source-trail-policy-evaluation`. Actual evidence was committed at `02e6e17`;
the fresh reviewer examined `1f9b82d`, and the substantive repair is in `ca63ca4`.
The following commit contains verification/handoff documentation only; get its
exact ID with `git log -1 --oneline`. This avoids a self-referential hash.
Protected release/separate Story Lab worktree:
`fd3e4371fc0f7fa99dc1b6118a66134a20e177ba`.

## Deliverables and exact evidence

- [Approved specification](../superpowers/specs/2026-10-13-source-trail-policy-lab-design.md) and [implementation plan](../superpowers/plans/2026-10-13-source-trail-policy-lab.md).
- Frozen v7 corpus, shared eligibility/selection, real calibration, bounded runner, locked protocol, raw attempts, separate assessments and immutable reports; earlier failures retained.
- Selected run policy-v7-held: 24 cases ×3 methods, 72 rows, 64 valid outputs, 5 gate skips, 3 rejected outputs. Report SHA-256:2b2f3eb6d19ea407cd5366ac0cd79b648b57af980f75f40d81cfd597988f00fc.
- Recorded-only viewer with filters, exact source/raw inspection and case export; no automatic inference/download.
- [Architecture](ARCHITECTURE.md), [evaluation](EVALUATION.md), [assessment guide](ASSESSMENT_GUIDE.md), [walkthrough](WALKTHROUGH.md), [claim ledger](CLAIM_LEDGER.md), [verification](VERIFICATION.md), [decisions](DECISIONS.md) and [final review](FINAL_REVIEW.md).

## Routes and ownership

| View | Root route | Portfolio-prefixed route |
| --- | --- | --- |
| Story Lab | / | /tools/source-trail/ |
| Original desk | /baseline/ | /tools/source-trail/baseline/ |
| Policy Lab | /policy-lab/ | /tools/source-trail/policy-lab/ |

Keep SOURCE_TRAIL_BASE identical for build/serving. Generated page/Worker headers are scoped; Policy Lab connections are same-origin only. Methodology, selected pointer, reports and whitelisted raw evidence are under evidence/policy-lab/ beneath that base. methodology.txt and report.md have explicit plain-text headers. Do not silently broaden the route's CSP during integration.

The portfolio owner controls integration, header merging, deployment and registry updates. Root domains.yaml, portfolio/career files, DNS and the hosted baseline were not edited. Local checks do not revalidate or advance existing deployment state.

## Check saved evidence without model calls

From this repository with installed dependencies:

```powershell
npm run policy:fixture
npm run policy:preservation
npm run policy:report:check
npm run policy:export:check
npm run policy:coherence
npm run test:policy -- --maxWorkers=1
py -3.14 -m unittest discover -s tools/policy_eval/tests -p 'test_*.py' -v
```

These checks read saved evidence or synthetic tests. Do not rerun held-out to improve a score, retry started samples, overwrite attempts or change the frozen rubric.

## Local preview

For root paths (retain the prior environment setting if needed):

```powershell
$env:SOURCE_TRAIL_BASE='/'
npm run build
$env:PORT='4734'
node scripts/serve.mjs
```

Open http://127.0.0.1:4734/policy-lab/ for a root build. Story Lab and the desk use
the same port. For integration review build/serve with
SOURCE_TRAIL_BASE='/tools/source-trail/' and open its prefixed route. Check the
port is free; do not stop another workflow to claim it. Acceptance suites used
port 4733 with server reuse disabled and leave no acceptance server running.

A separate local preview of the final prefixed build was left running on port
4734 and returned HTTP200 with the selected recording. Open
[Policy Lab](http://127.0.0.1:4734/tools/source-trail/policy-lab/),
[Story Lab](http://127.0.0.1:4734/tools/source-trail/) or
[the retrieval desk](http://127.0.0.1:4734/tools/source-trail/baseline/).
This helper is local, not a hosted deployment, and lasts only while its process
is running. For a preview you launch in your own terminal, Ctrl+C stops it.
This helper is separate from unrelated development servers.

Post-fix root QA passed 73 unit tests, zero Astro diagnostics and 36 browser
tests; the prefixed build passed another 36. Python passed 64 tests. Baseline
drift remains threshold 0.577271/Recall@3=0.923. Mobile/tablet/desktop inspection
and all 13 protected blobs passed. See verification for scope and retained failures.

## Proposed portfolio/registry wording

Use qualified copy in [CLAIM_LEDGER.md](CLAIM_LEDGER.md). Proposed registry status: “local Policy Lab evaluated and browser-verified; integration/publication not performed.” This proposal does not write another repository. Preserve original identities/historical release evidence. No employment duration, customers, adoption, production security or business impact is inferred.
