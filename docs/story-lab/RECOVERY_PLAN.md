# C recovery owner plan

Base: f63bf4adaaef12ccebd08e7f9af71b40a0b4bf71. Work only in existing Source Trail worktree; preserve earlier release snapshot and immutable raw evaluation.

1. Add a regression for first-use recorded-run label, exact saved output/context, human support/conflict/missing assessments, changed-word distinction and zero model requests.
2. Add src/story/RecordedWalkthrough.tsx using the first actual saved run; reuse glass word state and style. Three visible steps, one inspection action, exact quotations with source version. Changing words previews retrieval only and never relabels the saved output as newly generated.
3. Move existing live generation and editable source/session tools to an explicit secondary experiment details section. Keep original baseline and Python companion intact. Adjust existing browser tests to deliberately open the experiment.
4. Check comprehension, evidence truth, responsive composition, keyboard/no-download/accessibility and a timed one-minute demo. Run full QA and baseline drift. Arrange one read-only final review through coordinator or available reviewer; no GPU/model download.
5. Update README/domain brief/recovery review log, commit/push, verify CI, freeze exact static snapshot/hash handoff. D owns deployment; coordinator owns domains.yaml.

Pre-flight: recorded immutable data and editable live state must remain separate. Ruling: the default presents the real first run with manually reviewed claim excerpts, never an automatic support score; changing chips offers a clearly labelled retrieval preview, while recorded words/output stay fixed.
