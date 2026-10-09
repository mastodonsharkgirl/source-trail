# Story Lab review log

Reviewed on2026-10-09. One implementation owner; a separate read-only reviewer inspected code, actual screenshots and saved inference evidence. The reviewer did not generate or download models. The original source/evaluation fixture remains byte-identical to baseline76eff16.

## Pass1 — product comprehension
Issue: sample prose could be mistaken for live AI or supplied context. Fix: prominent Authored example / no AI run label; supplied view says no request occurred; related passages are a separate action. Recheck: real browser sample/evidence flows at360,390,768,1440. Source labels distinguish exact excerpt, related passage, supplied context and the deliberately authored unmapped twist. No verified-truth badge.

## Pass2 — state, evidence and interaction
Independent finding: Worker completion captured an old run and could lose history. Fix: current run reference; completed and previous runs retained with unique IDs. Recheck: dedicated transport-only browser regression completes two runs across a source edit, reopens/exports each, asserts source versions1/2, then rejects a stale completion after word changes. This is explicitly not inference evidence.

Owner finding: Source text label lookup included nested textarea content. Fix: explicit accessible name. Recheck: actual edit/export/reset, exact old source text, superseded label and private-canary absence from requests.

Real Edge154.0.4258.62 WebGPU: two genuine outputs, exact budget counts207/212 match runtime. Run1 contradicts the supplied daytime bridge rule. Run2 omits the edited bridge from top3 retrieval. Independent reviewer corroborated the first contradiction. Both raw outputs and source snapshots are preserved in generation-evaluation.json; manual assessment:1 explicit contradiction,1 needs review,0 fully-supported passes out of2 development demonstrations. Mitigation is disclosure: generated prose visibly needs review and the main controls state the observed failure. No automatic support detector, silent retry, factual guarantee or passing adherence claim.

## Pass3 — art direction and readable composition
Actual screenshots inspected at390/1440;360/768 also captured. Stable glass tablets, serif reading surface and restrained horizon separate the focal interaction from explanatory content.

Issue: appearance menu sat below main content and clicks hit the heading. Fix: raise header stacking context. Recheck: opaque/appearance control browser tests pass. Issue: native dialog dismissal could leave focus at the skip link. Fix: close native dialog before restoring the stored trigger on the next frame; preserve visible focus styles. Neutral initial screenshots are captured separately for delivery.

## Pass4 — accessibility, privacy and performance
No-WebGPU fallback, keyboard word selection, source-drawer controls, forced colors, opaque mode,200% text scaling and narrow reflow tested. Decorative WebGL pause stops draw calls; forced context loss exposes the static fallback while DOM interaction stays usable. Small-screen/reduced-motion loads skip decoration. Physical mobileGPU and native browser-toolbar zoom are not claimed.

Real generation controls: cancellation retained the sample; warm reload succeeded; unload preserved cached weights; no private canary appeared in44 captured real-run requests. All were public-asset GETs. Measured real cached model bodies443,112,645bytes. Full encoded wire transfer was not captured; first-use decoded assets are estimated about470MB including Worker and duplicate local tokenizer. Upstream1629MB VRAM is an estimate, not measured memory. Raw model timings22.656s and15.794s are device observations, not performance promises.

Issue: WebLLM supported removal left tensor-cache.json. Fix: supported per-model APIs plus exact known-model-key cleanup, with no broad cache deletion. Empty-cache removal stays offline; partial/no-manifest cases use supported config/WASM deletion and exact URL keys. Real pre-fix cache evidence remains unchanged. A separate representative nonempty CacheStorage fixture exercises the real UI/library removal and verifies both same-cache unrelated entry and separate-cache sentinel survive. Final result is retained in browser attachments; it is not claimed as another real model load.

Python: actual LangChain Document/splitter/VocabularyEmbeddings/InMemoryVectorStore/retriever tests pass3/3. A zero-vocabulary query initially caused NaN cosine similarity; explicit no-evidence guard fixes it. Default vectors are lexical; optional Ollama adapters are implemented but live model inference remains unverified.

## Pass5 — fresh regression and release evidence
Independent review resolved baseline preservation, real separate Meadow evaluation, visible failure disclosure, direct history regression and local prefixed routing.Final release QA passed under /tools/source-trail/: strict TypeScript/Astro check (zero diagnostics), 22 unit tests and all 29 browser tests. The separate Python suite passed 3/3, and the original evaluation drift check passed. The full log is retained in output/qa-release-final.log and the immutable handoff evidence. The nonempty-cache fixture passed through the real removal control with zero external requests and both unrelated sentinels preserved.

Two test defects were corrected without weakening product checks: CPU-throttling slowed UI rather than guaranteeing pending Worker results; tests now hold delivery of actual inference results briefly. Repeated exclamation marks compressed into fewer Qwen tokens than expected; overflow input now uses many repeated word tokens. Focused real-tokenizer/pending-inference recheck passed3/3. A prior run also spanned a host clock/suspend discontinuity and reported13hours; it is not used as a performance measurement.

Meadow retrieval: frozen6 development +12 held-out questions (9 answerable,3 no-answer). Both methods Hit@3/Recall@3=1 on answerable rows. Lexical false positives3/3; semantic gate0/3 but accepted only4/9 answerable. No held-out tuning. Baseline drift check passes at original threshold0.577270614119211 and original Recall@3=.923.

Remaining external validation: actual saran.info hosted response headers/deployment belong to the integration owner. No physical-phone GPU, GPU-OOM fault injection, broad real-world accuracy, employment reconstruction or production adoption claim.
