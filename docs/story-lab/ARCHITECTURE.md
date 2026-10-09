# Source Trail Story Lab architecture

## Preserved baseline
`/baseline/` retains the original SourceDesk, pinned MiniLM assets, source pack, calibration threshold and raw evaluation. Its page and search Worker response CSP permit same-origin connections only. The pre-upgrade live deployment is not modified by this branch.

## Default recorded walkthrough
`RecordedWalkthrough.tsx` renders the first actual saved run from unchanged generation-evaluation.json. Output, selected words, exact supplied passages and prompt remain tied to that immutable record. Manually authored claim assessments are labelled as manual examples, not automatic verification. Glass word changes perform lexical retrieval against the original atlas only, visibly labelled as a preview; they cannot modify the recording. The existing editable pack, authored sample and generator are a separate optional experiment. No generator Worker or model asset is requested by this default flow.

## Optional live story flow
`src/story/atlas.json` holds8 authored fictional notes,7 current and1 archived. `core.ts` filters current sources before lexical retrieval, retains exact source offsets and copies the full pack into each run. Prompts are words, not evidence. Generated text never enters the pack.

`StoryLab.tsx` owns in-memory selected words, versioned edits and a bounded run history. The dedicated generator Worker uses pinned WebLLM and the exact pinned tokenizer. It renders a complete Qwen template into a text-completion request; the runtime applies no additional template or system prefix to text completions (verified against installed0.2.85 source). The same full string is tokenized, budgeted, exported and sent. Whole lowest-ranked passages are dropped until prompt+256 output fits4096; dropped IDs are visible. Token count is compared with runtime usage during real validation.

Worker responses are accepted only for current worker, job ID and corpus revision. Source/word edits cancel pending operations. Loading cancellation tears down its dedicated Worker; partial public caches can remain. Generation uses the supported interrupt operation and session teardown. GPU/runtime failures return an error and the authored sample remains usable. Device capability checks include shader-f16 and buffer limits; quota estimates are advisory.

## Cache and network
WebLLM0.2.85's cache APIs use fixed literal names. `astro.config.mjs` applies a narrow build transformation to those three literal scopes, consistently for engine and supported per-model deletion APIs. Actual generator cache scopes are `source-trail-story-v1/model`, `/config`, `/wasm`. Deletion never calls broad caches.delete or storage.clear. A sentinel regression checks unrelated cache survival.

Generation page/Worker allow only listed public asset origins. Immutable model and model-library revisions are recorded; config/tokenizer/library SRI is checked. Tensor files are pinned by immutable revision; their provenance hashes are not advertised as an extra runtime tensor verification layer. There is no inference endpoint, analytics, user-content logging or localStorage. Explicit JSON export is the only content persistence.

`SOURCE_TRAIL_BASE=/tools/source-trail/` scopes emitted asset URLs; `_source-trail` isolates code/Worker names. Required page and Worker headers are generated, each below2000characters. Deployment owner merges them and verifies actual hosted headers. No global CSP relaxation is required.

## Atmosphere
One lazy Three.js plane shader, static CSS horizon fallback, capped DPR1.25 and25fps target. Reduced-motion and small-screen initial loads skip WebGL. Pause, hidden document and inference stop renders; resources are disposed on teardown and context loss exposes fallback. Performance targets require measurement; desktop emulation is not a physical phone GPU test.

## Python boundary
The local companion runs real LangChain documents/splitter/custom lexical embeddings/vector store/retriever. Optional OllamaEmbeddings and ChatOllama are loopback only, explicit model tags, no download. The public browser remains TypeScript. Default lexical vectors are not mislabelled learned semantic embeddings.
