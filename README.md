# Source Trail Story Lab

Create something. Follow it back to the sources.

Story Lab combines stable selectable glass words, the authored fictional Meadow Atlas, a model-free example, optional on-device Qwen generation, and inspection of exact supplied context. The original operational-note Evidence Desk remains at `/baseline/`, including its original MiniLM retrieval model, frozen fixture and historical evaluation.

**Generated stories need review.** In real testing, the small Qwen model contradicted an explicit bridge rule even though the exact rule was supplied. Another edited-source run omitted that rule during retrieval. These failures are preserved in [raw story evaluation](docs/story-lab/evaluation.json). This product does not verify truth, recover training sources, detect plagiarism or prove causal source use. The authored sample remains the default.

## Run

Node24.11–25 and npm:

```powershell
npm ci
npm run build
npm run preview
```

For portfolio integration:

```powershell
$env:SOURCE_TRAIL_BASE='/tools/source-trail/'
npm run qa
```

Serve the resulting dist directory under that exact prefix and merge its generated page/Worker headers. No public backend is needed. The source-trail-saran.pages.dev deployment is preserved; this branch does not publish it.

## Models and privacy

The original Evidence Desk explicitly loads about38MB of same-host MiniLM/ONNX assets. It retrieves exact passages without generation. The Story Lab generator is Qwen3.5-0.8B-q4f16_1-MLC, WebLLM0.2.85, with immutable model/library revisions and verified config/tokenizer/WASM integrity. Model weights are downloaded only after disclosure and a deliberate action. The production build downloads only the baseline assets and generator tokenizer, never the443MB model cache.

A first generation setup uses approximately470MB of public decoded assets including the Worker and local tokenizer; measured model-cache bodies total443,112,645bytes. Encoded wire transfer was not fully instrumented and is not equated with cached bytes. GPU memory estimate1629MB is upstream metadata, not measured application VRAM. Browser quota does not reveal actual free drive space. No paid/cloud inference or silent fallback.

Notes, source edits, selected words, prompts, outputs and vectors stay on device. Public asset hosts are explicitly allowlisted on the generation page and Worker only. The baseline retains same-origin-only connections. Session state is in memory; explicit export writes a JSON file. Public caches occupy disk. Forget session, unload GPU and remove model are distinct actions; removal preserves unrelated caches. A cancelled load may leave partial assets. See [architecture](docs/story-lab/ARCHITECTURE.md) and [MODEL_MANIFEST](MODEL_MANIFEST.json).

## Verification and limits

```powershell
npm run qa
npm run evaluate -- --check
node scripts/evaluate-story.mjs
tools/python_rag/.venv/Scripts/python -m unittest discover -s tools/python_rag -v
```

Real Edge154.0.4258.62 WebGPU generation completed two runs: prompt counts207/212 matched runtime exactly. Raw source snapshots, output and adherence review are retained. Generation cancellation, warm reload, unload, scoped deletion and failed-download/load teardown were exercised separately. Mock Worker tests verify UI history/stale-result behavior only and are never counted as inference.

Meadow Atlas's new frozen fixture has6 development and12 held-out queries (9 answerable,3 missing evidence). Both lexical and semantic ranking had Hit@3/Recall@3=1 on answerable rows. Lexical search produced3/3 missing-evidence false positives; semantic gating produced0/3 but accepted only4/9 answerable queries. These tiny authored measurements are not general accuracy. The browser Story Lab uses lexical retrieval; semantic comparison is a separate real CPU evaluation, and semantic search remains available in the original desk.

The baseline remains unchanged in meaning:16 held-out questions, semantic ungated Recall@3=.923,7/13 answerable accepted and6 abstained, all3 no-answer questions abstained. See [baseline evaluation](docs/EVALUATION.md). Neither metric certifies generated claims.

The separate [Python/LangChain companion](tools/python_rag/README.md) runs actual framework components. Its default local vocabulary vectors are lexical. Optional Ollama embedding/chat adapters require already-installed models; live adapter inference remains unverified. Physical mobile GPU, broad device support and hosted prefix headers require separate verification. No production adoption is claimed.

[Review log](REVIEW_LOG.md), [learning guide](LEARNING_GUIDE.md), [new architecture](docs/story-lab/ARCHITECTURE.md), and [preserved baseline architecture](docs/ARCHITECTURE.md).

Authored code is MIT. Qwen, MiniLM, WebLLM and tokenizer components use their separate Apache-2.0 terms; ONNX/Three.js are MIT; bundled Geist/Fraunces fonts carry their font licenses. Implementation was generated/edited with Codex; Saran supplied product decisions. Learning exercises remain uncompleted unless separately observed.
