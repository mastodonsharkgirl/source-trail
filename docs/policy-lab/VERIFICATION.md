# Local verification record

Recorded 15 October 2026 on codex/source-trail-policy-evaluation. Actual evidence
was committed at `02e6e17`; final source and recovery fix are committed at
`ca63ca4016b0d9973a9aa7e87b8fa55e62f6d53b`. The following commit updates
verification/handoff documentation only. These are local results.

| Check | Observed result |
| --- | --- |
| Actual encoder/model preflight | Six MiniLM files hashed from bytes, 37,974,266 bytes; installed Qwen digest/template and Ollama metadata checked before/after generation. |
| Actual generation/assessment | 108 calls across stages; 72 held rows: 64 valid, 5 gates, 3 rejected. All 108 emitted responses separately agent-assessed. |
| npm run test:policy -- --maxWorkers=1 | Exit 0; 51 tests. Synthetic transport/temp-file tests are not model measurements. |
| Python unittest discovery | Exit 0; 64 tests after recovery fix, including calibration-byte binding and three crash-boundary regressions; synthetic test records. |
| Root npm run qa after recovery fix | Exit 0; Astro 49 files/zero diagnostics, 73 unit tests in 11 files, build/header audit, 36 browser tests. |
| Prefixed build and npm run test:e2e after recovery fix | Both exit 0; 36 browser tests under /tools/source-trail/. |
| policy:fixture | Exit 0; v7 fixture/rubric hashes match frozen manifest. |
| policy:report:check, policy:export:check, policy:coherence | Exit 0 against actual selected report, raw records, calibration and immutable selected identity. |
| policy:preservation | Exit 0; all 13 protected Git blobs match fd3e4371fc0f7fa99dc1b6118a66134a20e177ba. |
| Original npm run evaluate -- --check | Exit 0; threshold 0.577271 and held semantic ungated Recall@3=0.923 unchanged; actual encoder check, no rewrite. |
| Separate Story Lab worktree | Clean at fd3e437 on codex/source-trail-story-lab; no edits there. |
| Evidence line endings | Run/export Git attributes unset text; exact snapshot bytes retained. |

Full browser runs were sequential, one worker, owned port 4733, reuseExistingServer:false. Prior base environment values were restored. No unrelated process was stopped. No renewed large Story Lab GPU download was needed. Browser results include the original actual MiniLM flow and recorded Story Lab source/history/export journeys.

## Browser behavior and rendered inspection

Policy checks cover all three rows changing together, all tenant/role filter combinations, empty results, keyboard disclosures/skip focus, exact case-download readback, rejection/partial data and corrupt-data fail-closed state. Error tests alter test responses only, never product files. Requests were watched for model/Worker/tokenizer/loopback targets; storage hooks fail on visitor writes. New-route same-origin CSP and plain-text report headers passed at both bases. Local checks do not verify a host.

Policy screenshots at 320/390/768/1440 were inspected. Root/prefix image bytes were identical at each width. Mobile/tablet panels stack; desktop uses three columns. Visible labels separate accepted, rejected and assessed output. The narrow metric table intentionally scrolls inside a focusable region; no document-level overflow. Captures show a keyboard-focused skip link; its blue overlay is a focus state. Native controls and reduced-motion state stayed usable. No new ambient animation was added.

Prefixed Story Lab inspected at 390/768/1440 with saved answer/source inspection: dark teal identity, responsive idea/evidence/answer layout and explicit contradiction review remain legible. Prefixed retrieval desk inspected at 320/768/1440 after text matching: current/archive labels, highlighted source and export remain visible; the mobile pack collapses and results stack. No substantive visual defect observed. This is author visual judgment, not a usability study.

Ignored local artifacts: output/policy-qa-root.log, output/policy-build-prefixed.log, output/policy-browser-prefixed.log, output/policy-baseline-drift.log, both browser-results JSONs and output/policy-visual-{root,prefixed}/. Test results retain prefixed Story/desk screenshots. These are local logs/captures, not invented screenshots.

## Retained failures and fixes

Initial development length-stopped at 256 tokens; raw output and 31 never-started rows remain. The sole allowed prompt change requested short answers/quotes; the second run completed and was locked before held-out. No held-out rerun/tuning occurred.

Scoped reviews found prepared-context loss, transferable assessments, saved-model binding gaps and missing selected-export identity. Failing regressions preceded fixes. A later source review confirmed the first three addressed; export fixes were verified by regressions. Self-review additionally bound actual calibration bytes and the retrieval sidecar: RED observed, then the 61-test Python suite passed.

Initial acceptance exposed missing Astro fixture slot metadata, Node24 JSON import attributes and a label locator including nested select text. Test-only repairs use existing serialization/JSON-read patterns and semantic combobox locators; assertions retained. Full root/prefix suites subsequently passed. Initial failure logs/traces remain under output/policy-root-initial-failures/ and the initial QA log.

## Final review and external limits

Fresh read-only reviewer_sol review of `fd3e437..1f9b82d` found no Critical issue,
one Important interruption-recovery defect and two factual documentation issues.
The recovery regressions failed first (two failures and one missing-marker error),
then passed after the repair; the full Python suite passed 64/64. Both documents
were corrected during final status/teaching reconciliation. No deferred minor
remains. The single author fix pass was verified by tests, without a second review.
See [FINAL_REVIEW.md](FINAL_REVIEW.md) for scope and findings and
[DECISIONS.md](DECISIONS.md) for every ruling and its cost.

Post-fix root QA and prefixed build/browser suites passed with the counts above.
New screenshot bytes match the previously inspected images at all four Policy
widths, and root/prefix images match each other. Logs are
`output/policy-review-qa-root.log`, `output/policy-review-build-prefixed.log`,
`output/policy-review-browser-prefixed.log`, `output/policy-review-python.log`,
and recovery RED/GREEN logs; new captures are under
`output/policy-review-visual-{root,prefixed}/`. Original acceptance logs remain.
Actual report/export/coherence checks still confirm the same selected hash; no
model call, fixture/assessment change or historic raw-record rewrite occurred.
Historical partial-status ledger entries are not current claims.

Independent human answer assessment, broad source-injection testing, physical mobile GPU validation, broad device timing/memory benchmarks and hosted headers are unperformed. Push, CI, deployment, DNS, portfolio/registry writes and custom-domain changes were not performed by this workstream.
