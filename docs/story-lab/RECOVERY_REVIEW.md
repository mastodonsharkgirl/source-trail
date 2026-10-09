# Recovery review: Source Trail

Scope: simplify the first-use journey from release f63bf4a while preserving its recorded outputs, model stack, baseline, and evidence. No new inference or model download.

## Pass 1: comprehension
The first screen names a recorded real run and gives three numbered steps: ideas, supplied evidence, answer. The primary action inspects the answer. Live generation is inside a closed optional experiment. The introductory claim is now evidence inspection, not creative generation. Changing glass words clearly labels a retrieval preview and does not imply a new generated answer. This is an author walkthrough, not a study with independent first-time users.

## Pass 2: evidence truth
Recorded output and all three supplied passages come directly from the unchanged first raw generation record. Manual review distinguishes a supported amber-light detail, a direct reversal of the nighttime bridge rule, and an explicitly labelled authored follow-up question about the exact clock time, which the supplied bridge passage does not specify. The manual examples are not an automatic detector or an assessment of every claim. The full request/model/tokens and raw evaluation remain inspectable. The second failed run and both frozen evaluations are unchanged. A browser regression compares exact output and supplied passage text to the saved record.

## Pass 3: layout
Actual initial and inspected screenshots captured at360,390,768,1440. Author inspected mobile/tablet/desktop compositions. A hover rule made the inspection button unreadable; a focused regression reproduced the wrong pale background, then scoped hover styling fixed it and the final suite passed. Paper-step label contrast was corrected too. Full-page captures now start at scrollTop0 to avoid an offscreen fixed skip-link capture artifact; keyboard focus styles remain intact. Existing glass tablets, serif paper/ink surface and restrained horizon retained; no new visual identity.

## Pass 4: accessibility and no-download
The targeted changed-flow test passed: keyboard Enter expands the manual assessment, all network requests stay local, and no generator Worker, tokenizer, WASM, ONNX or model shard is requested. navigator.gpu was absent. Optional setup remains hidden until opened. Final responsive, forced-color, opaque and200% text/reflow checks pass. The no-WebGPU optional experiment fallback and scoped cache-removal controls still pass.

## Pass 5: one-minute demonstration and regression
Regression initially failed because the old release had no recorded-run region; after implementation it passes. Scripted path: read steps, inspect answer, compare rule, change word, observe retrieval-only label, restore recorded ideas. Automation duration is retained but is not a human reading-time measurement. Original evaluation drift check passes at the unchanged threshold. Final prefixed npm run qa passes: zero Astro diagnostics,22 unit tests,30 browser tests. The separate Python implementation is unchanged; its previous3/3 evidence remains, no new Ollama run is claimed.

Independent Terra read-only review found that the star-detail assessment was ambiguous against the supplied cloud/star sentence. Fixed by removing that assessment, retaining the exact unedited model output, and making missing evidence an explicitly labelled follow-up question rather than a model quote. New regression failed on the old card, then requires the follow-up label and exact-clock-time question. The revised regression and full suite pass after the correction:30 browser tests,22 unit tests,zero diagnostics. Final updated390/768 screenshots were inspected after this text change. No deployment by C. Teaching remains inactive.
