# Source Trail

A small source desk for finding exact passages in notes. Ask a question, inspect three retrieved quotations, and open each original note with its version and passage highlighted. It does not generate an answer or decide which statement is true.

The included six notes are authored fictional equipment and workshop examples. Edit or add notes with the form; the workspace lives only in browser memory and clears on reload. No account is needed. Loading Search by meaning explicitly downloads about 38 MB of public assets. A cold local-browser check served 37,975,282 bytes across its model and runtime responses, including one 22,972,370-byte weights response. A separate text-matching mode works without the model.

## Run locally

Use Node 24.11 or later (below 26) and npm:

```sh
npm ci
npm run build
npm run preview
```

The build prepares pinned assets, verifies SHA-256 hashes, and writes a restrictive CSP. The first build downloads immutable model files from Hugging Face; later builds verify existing copies. Weights and runtime binaries are ignored by Git. Runtime files come from the lockfile-installed ONNX package. The browser fetches assets only from the same host. Cloudflare Pages uses `npm run build` and the `dist` output directory.

## Verification

```sh
npx playwright install chromium
npm run qa
npm run evaluate -- --check
```

QA runs strict Astro/TypeScript checks, kernel unit tests, a prepared production build and Chromium tests against the built CSP on isolated port 4705. Browser checks run real single-thread ONNX WASM inference, not a substituted scorer. On Linux CI, install browser dependencies with `npx playwright install --with-deps chromium`.

## Honest measurement

The frozen test set has 8 calibration questions and 16 held-out questions (13 answerable, 3 no-answer). The semantic threshold is `0.577270614119211`, selected using calibration only. Held-out semantic rankings have **ungated** Recall@3 0.923 and first-relevant full-ranking MRR 0.827. The threshold accepts 7/13 answerable questions and abstains on 6; all 3 no-answer questions abstain. Text matching has Recall@3 0.538, MRR 0.515, and 3 no-answer false positives. These tiny authored data measure this experiment, not general reliability. Similarity is not confidence in truth.

[Evaluation and definitions](docs/EVALUATION.md), [raw results](src/data/evaluation.json), [frozen fixture](docs/superpowers/specs/source-trail-fixture.json), [architecture](docs/ARCHITECTURE.md), [case study](docs/CASE_STUDY.md), and [model provenance](docs/MODEL.md) make the implementation inspectable. Node CPU evaluation results are distinct from browser timing observations.

## Limits and privacy

At most 12 notes, 24 blank-line-separated passages and 16 KiB UTF-8 source text. Titles are bounded to 256 UTF-8 bytes and versions to 128. Questions have an 800-character limit, and the real tokenizer rejects questions or passages over 512 tokens rather than silently truncating. Notes, questions and vectors are never submitted, logged or saved by the application. Public assets may enter the normal HTTP cache. Export deliberately downloads the question and retrieved quotations in a JSON record with versions, corpus revision and model hashes.

The authored application code is MIT licensed. The pinned MiniLM model and Transformers.js use Apache-2.0; ONNX Runtime uses MIT. Their separate licences and notices are in `public/models`. No deployment or adoption is implied by this repository.
