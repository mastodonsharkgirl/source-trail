# Policy Lab evaluation status

**No real Policy Lab evaluation has run.** There is no selected run or measured
comparison. The browser manifest explicitly says unavailable. This file records
the current state; it is not an evaluation-results report.

| Stage | Planned grid | Recorded Policy Lab outcomes |
| --- | ---: | --- |
| Smoke | 3 case/method pairs | None |
| Development | 12 cases × 3 methods per sweep | None |
| Held-out | 24 cases × 3 methods, once | None |
| Source-support assessment | Every actual emitted answer | None |

The held-out design contains 14 answerable and 10 abstention cases per method.
The fixture is `policy-lab-fictional-v7`. Its SHA-256 is
`327898026a5dcad7b4c979b181f16c89ea315ac4e5f2bdfe768355234a069531`;
the rubric SHA-256 is
`d0a4670bd2f15e05667da5dc263ed1c7fd1ab6d4a74a487189f4273baf49c8e5`.
The freeze check passes. Model evaluation and held-out context preparation are
deferred under the shared-compute reservation.

No `runs/`, `calibration.json`, `protocol.json` or `selected-run.json` exists at
this checkpoint. Policy Lab accuracy, supported yield, attack resistance, model
latency, runtime token counts and resource costs are therefore **unmeasured**.
There is no automatic restricted-output disclosure score in this fixture.
Existing retrieval-desk and Story Lab measurements belong to their original
experiments and are not Policy Lab results.

## Verification that has occurred

48 focused TypeScript tests cover fixture/selection logic, recorded-case joins,
literal text rendering and export coherence. 58 Python tests use synthetic
transport responses and temporary directories to cover contracts, attempts,
failures, assessment binding and report denominators. They do not measure model
quality or real runtime compatibility. See [VERIFICATION.md](VERIFICATION.md).

## Completing the real experiment

Follow [Task 5 of the approved plan](../superpowers/plans/2026-10-13-source-trail-policy-lab.md)
only after the shared compute restriction is released. The order matters:

1. Verify actual local model/encoder assets, hashes and runtime metadata against
   the clean source commit. Do not merely copy declared manifest hashes.
2. Measure development retrieval only, record candidates, calibrate the gate and
   create the protocol. No generation uses the provisional collection threshold.
3. Complete the bounded three-method smoke contract, preserving all diagnostics.
4. Run the default development sweep; a second requires a documented adjustment.
   Commit the final locked protocol before opening held-out evaluation.
5. Run the single held-out sweep with cyclic method order and no tuning on results.
6. Assess raw outputs against exact supplied evidence, following the
   [assessment guide](ASSESSMENT_GUIDE.md). Preserve bad and missing outcomes.
7. Recompute the report, explicitly select its hash, export it and run all checks.

The runner's [commands](../../tools/policy_eval/README.md) intentionally fail before
processing until real calibration/protocol files exist. Do not fabricate those
files or replace missing runtime output with test responses to complete the page.
