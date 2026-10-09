# Learn Source Trail from the working code

Prepared for later practice. No exercise is marked complete. Saran supplied the product direction, privacy constraints, visual brief and delivery goals. Codex generated and edited implementation, tests and these explanations; passing tests do not establish the learner's independent proficiency.

## One-minute recorded demonstration (no download)
0:00 Identify the recorded real-run label and the three ideas. 0:10 Read the supplied bridge rule. 0:20 Read the actual saved answer. 0:30 Choose Inspect the answer and compare support, conflict and missing evidence. 0:45 Change a glass word: this previews retrieval only; the recorded answer stays fixed. Explain: retrieval can find the right rule while generation contradicts it. The manual review is not an automatic verifier.

This script is prepared for later practice; it does not assert that a user has completed it. The raw saved run and frozen evaluations remain unchanged.

## 1. Choosing words and sources
User gain: a concrete starting point without a download. Component: `src/story/StoryLab.tsx` and `atlas.json`. Input `rabbit, bridge, sun` becomes a retrieval query. Change an authored source in the source drawer and save a new version. Practice: explain why a word chip is a prompt rather than evidence.

## 2. Retrieval
User gain: relevant passages with exact origins. Component: `src/story/core.ts` (`retrieve`) and original `src/lib/ranking.ts`. Input `bridge sunrise` returns the current bridge passage with its original span. Change top-k in a local experiment, preserving frozen evaluation. Practice: why can ordinary words cause a false positive for an unanswerable question?

## 3. Context and generation
User gain: one short story created on the device. Component: `generation.worker.ts` and `budgetContext`. Input: ideas plus ranked source snapshots. Output: a complete prompt counted by the exact tokenizer, supplied/dropped passages and a bounded paragraph. Change the output cap only alongside its tests. Practice: if a4096-token window reserves256 output tokens, why must template tokens count too?

## 4. Evidence and versions
User gain: an earlier story keeps its original meaning even after source edits. Component: Run record and evidence dialog. Input: source bridge version1; after editing, pack contains version2 while old run still exports version1. Practice: explain the difference between exact excerpt, supplied context and related passage. None establishes causal use by the model.

## 5. Workers and cancellation
User gain: responsive controls and no stale story replacing a newer request. Component: job ID/revision guard, dedicated Worker and library interrupt/unload/cache functions. Input: select new ideas during generation. Output: older job invalidated, work stopped, authored example retained. Practice: distinguish cancelling a promise, interrupting generation, unloading GPU state and deleting downloaded model assets.

## 6. Plain Python then LangChain
User gain: inspect the same pipeline in a separately launched CLI. Component: `tools/python_rag/companion.py`. First `plain_retrieve` loops over words. Then actual LangChain Document/splitter/embedding/vector store/retriever components return source-aware chunks. Default embeddings are lexical vocabulary vectors, not a neural model. Optional local Ollama adapters are explicit. Practice: name the responsibilities still belonging to application code after adding LangChain.

## A real failure to investigate
A no-known-vocabulary query became an all-zero vector. LangChain cosine similarity rejected it as NaN. Read the test and guard, predict what would happen without it, then reproduce with the authored query `quuxxyzzy`. Do not substitute a made-up source to hide a miss.

## Glossary
- Embedding: numeric representation of text; learned semantic embeddings differ from simple word-count vectors.
- Vector: ordered list of numbers.
- Retrieval: ranking existing source passages for a query.
- Context: text actually supplied to a generator.
- Token: the model tokenizer's unit, not necessarily a word.
- Generation: predicting output tokens from a prompt.
- RAG: retrieve material, then use it as generation context.
- Citation: a reference to a source; existence alone does not prove support.
- Similarity: closeness in a chosen representation, not factual confidence.
- Abstention: declining to return an accepted match under a stated rule.
- Web Worker: a separate browser execution context for expensive work; it is not a server.
- LangChain: a framework for assembling pipeline components, not a model.

## Optional live-experiment demonstration (after download)
0:00 Show the authored sample and promise. 0:45 Choose three words and explain the deliberate local-model download. 1:30 Build a real story if this browser supports the model; otherwise explicitly demonstrate the sample. 2:00 Inspect exact supplied context and related passages separately. 2:45 Add the deliberately unmapped twist. 3:15 Edit a source and show the older snapshot. 3:45 Open work notes and compare current/archived refund policy. 4:30 Explain raw evaluation misses and the local Python boundary.

Three defensible decisions: preserve the old baseline instead of reusing its threshold; retain exact budgeted snapshots rather than reconstructing evidence later; keep no-model use useful and external connections asset-only. Future extension: separately evaluate claim-support assessment; similarity is insufficient.
