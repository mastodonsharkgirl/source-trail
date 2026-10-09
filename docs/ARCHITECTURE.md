# Architecture — preserved retrieval baseline

Astro emits a static page. A React island owns the source desk; local UI button source and Tailwind accompany the editorial CSS. Geist is served locally. There are no remote fonts, analytics, account services or query APIs.

## Search data path

1. `validateSources` splits each note on blank lines, checks UTF-8 bounds and metadata, assigns stable `source-id:paragraph` identifiers, and derives a corpus revision.
2. The visitor explicitly loads the model. A dedicated module worker uses Transformers.js 4.3.0 with pinned local q8 assets and single-thread ONNX WASM.
3. Each query and passage is checked with the actual tokenizer without truncation. All passages are embedded in one batch, followed by the query separately. Mean-pooled normalized vectors have 384 dimensions.
4. Shared ranking code orders dot-product similarities. The UI shows three exact quotations and their original title, version and ID. The calibrated threshold determines whether the best passage is accepted; below-threshold alternatives are explicitly labelled.
5. Selecting a result opens its exact source and highlights its passage. Contradictory archived/current notes are never merged. No answer is generated.

The baseline counts word overlap and is always labelled text matching. It has no model dependency. Its zero-overlap case abstains.

## Memory and asynchronous work

React stores sources, query and result state in memory. Each worker request and response includes a job ID and corpus revision. Only the current identity can affect the UI. The worker coordinator serializes operations and shares a pending model load; it releases rejected load promises for retry.

Saving or resetting notes invalidates pending jobs, terminates the worker, clears results and returns the model control to its initial state. This also covers editing during download. Reload clears visitor state. Query edits while inference is pending terminate pending work, so earlier questions cannot populate new inputs. Choosing text matching during a pending search also terminates it.

No visitor notes, queries or derived vectors enter network requests, console logs, cookies, local/session storage, IndexedDB or application caches. Only explicit JSON export writes a local file. Browser HTTP caching of public model assets is separate from application storage. Downloads include model-file byte progress; preparation and runtime download do not pretend to have a known total progress percentage.

## Assets and CSP

`prebuild` runs `prepare-model`, which verifies each asset against the committed SHA-256 and byte manifest. Fresh clones fetch the pinned immutable model revision; runtime assets come from npm. Every individual asset is below the Cloudflare Pages 25 MiB limit. Model/runtime binaries are never committed.

`build-csp` hashes Astro's emitted inline scripts. The policy allows same-host scripts plus WASM compilation, same-host connections and module workers, and blocks frames, objects and forms. It does not allow JavaScript `unsafe-eval`. Inline style permission accommodates Astro island styling, with no third-party style or font origins. The browser test server applies the actual generated production policy to all responses.

## Verification and limits

Kernel tests check metadata, vectors, identities, load retry and token bounds. Chromium tests use the built page and real WASM; inspect request origin/method/body, failure/retry, reset/edit during pending download, plain-text note rendering, export, keyboard source actions, four viewports and reduced motion. CI runs both deterministic Node evaluation drift checks and actual browser inference.

The frozen fixture's hash and labels are immutable. Calibration chooses the threshold; held-out questions assess it. The public page distinguishes ungated ranking metrics from thresholded acceptance. This is a bounded experiment with a small fictional pack, not a claim of real-world adoption, authentication integration or factual reliability.
