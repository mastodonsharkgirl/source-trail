# Following a match back to its evidence

Source Trail explores a narrow question: can a visitor find relevant language in a few notes and immediately verify the original passage? A fluent generated answer would hide that reading step, so the product stops at retrieval.

The source desk pairs a numbered note index with ranked quotations and an original reading pane. Versions stay visible, including deliberately conflicting refund notes. The source highlight only appears after selecting a real result. The initial view has no fabricated result and triggers no model download.

## Engineering decisions

A dedicated worker keeps inference away from reading controls. A small q8 MiniLM model and single-thread WASM support an inspectable CPU path. Notes are tightly bounded, and actual tokenizer checks reject excess input rather than clipping a quotation. A text-matching baseline remains useful when the model cannot load.

Job and corpus identities make pending work disposable. Saving a note or resetting terminates the worker and invalidates its messages. That costs another model preparation after edits but avoids the confusing case where an old result appears under newly edited source text.

## Observed defects and repairs

Kernel review found a rejected model-load promise remained cached. The coordinator now clears only the current failed attempt; concurrent callers during a successful retry share one operation. A regression test exercises failure followed by concurrent retry.

Review also found an evaluator/production batching mismatch. Evaluation was changed to use the production corpus and ranking functions, with all passages in one batch and each query separately. The frozen fixture hash is asserted before measurement, and CI checks deterministic report drift. No held-out labels were used to retune the threshold.

A later browser review found that the optional Transformers progress callback
caused a full duplicate fetch of the local ONNX weights, making the original
38 MB estimate false. The worker now uses an indeterminate loading state instead
of that callback. A fresh Chromium regression counts server response bodies and
observed 37,975,282 public model/runtime bytes, with exactly one 22,972,370-byte
weights response. The check is limited to static public assets; notes, questions
and vectors remain memory-only and are not cached by the application.

## What the experiment says

Production output inspection found that ONNX's default bundled entry emitted an
unused 26.9 MB asyncify WASM file, above the intended host's per-file limit,
even though inference used the smaller pinned external runtime. The Vite
resolver now selects ONNX's `onnxruntime-web-use-extern-wasm` export condition.
A build gate checks every emitted file, and actual browser inference passed
again using the hash-verified runtime. This was a build defect caught before
publication, not a production incident.

Semantic retrieval finds more relevant passages than text overlap on this small authored test. That ranking result is not the whole visitor experience: the conservative calibration threshold abstains on 6 of 13 answerable held-out questions while abstaining on all 3 no-answer questions. The UI publishes both outcomes together. False certainty would be a worse product explanation than a visible limitation.

The source, evaluation, model hashes and browser tests are reproducible. They establish bounded implementation behavior; they do not establish user adoption or performance on every device.
