# Browser verification

Observed on 1 October 2026 using Chromium 153.0.8010.12, headless on Windows,
Intel Core i9-13900HX. The production output was served on loopback with its
generated CSP, a fresh browser context and HTTP `Cache-Control: no-store`.
This is a local engineering observation, not an internet download benchmark
or a promise for other devices.

One recorded sample using the original 12-passage corpus:

| Observed action | Elapsed time |
| --- | ---: |
| Load model button to ready state, including local HTTP asset fetches | 956 ms |
| First search button to visible ranked result | 612 ms |
| Repeat search with already loaded model | 957 ms |

These are end-to-end UI timings including automation and scheduling overhead,
not isolated kernel timings. Repeated searches re-embed the corpus; no visitor
vectors are persisted. A single warm observation need not be faster. The test
report includes its browser user agent and cache/host context; repeat it with
`npm run test:e2e`. CI retains the report and captures as an artifact.

The measured interaction made 18 same-origin GET requests with no request
bodies. No model asset request occurred before explicit loading. A separate
real-inference test used private-note and private-question sentinel text and
confirmed neither appeared in requests. Local and session storage stayed empty.
The worker disables Transformers browser/WASM application caches.

Browser coverage includes actual WASM inference under the built policy,
failed weight loading followed by retry, text matching during failure,
reset and saved edits while an actual weight request is pending, reset during
real inference, actual tokenizer rejection, exact source highlighting,
archived/current versions, keyboard source opening and downloaded JSON
readback. Initial and populated layouts are captured at 320, 375, 768 and
1440 pixels with reduced motion; horizontal overflow is asserted.

The Node CPU held-out ranking/abstention measurements in `EVALUATION.md` use a
different runtime and purpose. Browser timing does not replace that evaluation,
and neither proves public deployment, broad accuracy or user adoption.
