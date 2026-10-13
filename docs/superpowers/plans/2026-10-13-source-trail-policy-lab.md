# Source Trail Policy Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, reproducible policy evaluation and a recorded evidence-inspection page while preserving Source Trail's retrieval desk and Story Lab.

**Architecture:** A shared TypeScript kernel filters and selects fictional policy passages. A Python CLI coordinates the existing MiniLM runtime, installed local Qwen generation, evidence checks, and immutable run records. A separate Astro/React route presents recorded results without invoking inference.

**Tech Stack:** Existing Astro 7, React 19, strict TypeScript, npm lockfile, Transformers.js 4.3.0/MiniLM q8, Python 3.14 standard library, loopback Ollama, Vitest, and Playwright. No new runtime dependency is planned.

**Spec:** [Approved specification](../specs/2026-10-13-source-trail-policy-lab-design.md), commit `7438ecd`. User approval was received after that commit. This plan remains pending user review and execution-method selection.

## Global Constraints

- Repository: `C:/Users/Kanak/Documents/Saran Websites/repos/source-trail`; branch: `codex/source-trail-policy-evaluation`; preserved release base: `fd3e4371fc0f7fa99dc1b6118a66134a20e177ba`.
- Node `>=24.11.0 <26`; npm and committed `package-lock.json`; strict TypeScript and static Astro output.
- Preserve Story Lab at `/`, original desk at `/baseline/`, and add `/policy-lab/`. Support `SOURCE_TRAIL_BASE=/tools/source-trail/` as well as `/`.
- Author 12 short documents, at most 24 blank-line-separated passages and 16 KiB of source text; fixed evaluation date `2026-10-13`.
- Freeze 12 development and 24 held-out cases: held-out counts are 8 current, 4 superseded, 4 conflict, 4 unavailable, 4 injection; 14 answerable and 10 requiring abstention.
- Tenant values: `cedar`, `harbour`; explicit role values: `employee`, `manager`, `security`. No implicit role inheritance.
- Original notes, threshold, fixture, raw evaluation, model identity, and recorded Story Lab output remain unchanged. No broad refactor or redesign.
- Generation: installed `qwen3:1.7b`, full digest pinned, loopback `http://127.0.0.1:11434`, raw prompt, temperature 0, seed 17, thinking disabled, context 8192, output cap 256, prompt cap 6500 UTF-8 bytes, timeout 120 seconds, one request at a time.
- Three smoke attempts, at most two development sweeps and one held-out sweep: maximum 147 generation attempts, including failures. Gate skips do not consume a model call.
- No cloud model, auto-pull, paid API, private files, remote inference fallback, new accounts, persistent visitor data, analytics, publication, push, or CI dispatch.
- All model/source text is rendered as text. Injection metadata and gold labels never influence selection or enter model prompts.
- Application filtering of public fictional data is a simulation, not production authentication or tenant isolation.
- No edits outside this repository. Proposed `domains.yaml` and portfolio changes belong in the local handoff only.
- Load applicable interface/motion/visual-QA skills at their implementation tasks; preserve the installed LottieFiles restraint and reduced-motion requirements.
- Respect AGENTS model routing and use no more than three concurrent subagents, never Ultra. Only one implementer may edit this repository at a time; review agents are read-only.

## Review Focus

1. A replacement policy inaccessible to a role must not reactivate the obsolete rule: Task 2 tests supersession against the trusted full graph before eligible evidence is selected.
2. Repeated identical paragraphs, CRLF, and Unicode must still link to exact source spans: Task 1 tests occurrence-aware offsets and UTF-8 bounds.
3. A timed-out request or interrupted run must remain visible in the expected denominator: Tasks 3 and 4 test interruption records, missing rows, and no automatic retry.
4. An attack marker quoted in an explanation must not automatically become a successful attack: Task 4 separates mechanical marker presence from assessed compliance and records exposure.
5. Switching case/tenant filters must not display an answer from another saved context: Task 6 tests atomic record changes, empty filter results, and exact export identity.

## File map and ownership

| Area | Create | Modify |
| --- | --- | --- |
| Frozen fixture and contracts | `docs/policy-lab/{fixture,rubric,manifest}.json`; `src/policy/{types,documents}.ts`; `scripts/freeze-policy-fixture.mjs`; `tests/{policy-fixtures,policy-documents.test}.ts` | `.gitattributes` for exact fixture LF bytes |
| Selection | `src/policy/{eligibility,retrieval,calibration}.ts`; `scripts/{policy-encoder,prepare-policy-contexts}.mjs`; `tests/policy-retrieval.test.ts` | `package.json` for scoped commands |
| Python runner | `tools/policy_eval/{__init__,contracts,ollama,prompt,runner}.py`; `tools/policy_eval/tests/test_{contract,ollama,runner}.py`; `tools/policy_eval/README.md` | None in existing Python companion |
| Assessment/reporting | `tools/policy_eval/{assessment,report,export}.py`; `tools/policy_eval/tests/test_{assessment,report}.py`; `docs/policy-lab/ASSESSMENT_GUIDE.md` | Scoped commands in `package.json` |
| Local evidence | `docs/policy-lab/{calibration,protocol,selected-run}.json`; `docs/policy-lab/runs/<run-id>/`; `docs/policy-lab/EVALUATION.md` | None in historical evaluations |
| Policy interface | `src/pages/policy-lab.astro`; `src/policy/{PolicyLab,CaseComparison,SourceInspection}.tsx`; `src/policy/viewer.ts`; `src/policy/policy.css`; `src/data/policy-evaluation.json`; `tests/policy-viewer.test.ts`; `tests/browser/policy-lab.spec.ts` | `scripts/build-csp.mjs`, `src/pages/baseline.astro`, `src/story/StoryLab.tsx`, `tests/browser/headers.spec.ts` |
| Release evidence and handoff | `scripts/check-policy-preservation.mjs`; `docs/policy-lab/{ARCHITECTURE,WALKTHROUGH,CLAIM_LEDGER,PORTFOLIO_HANDOFF,VERIFICATION}.md` | `README.md`, `docs/DOMAIN_BRIEF.md` |

Do not restructure `StoryLab.tsx`; its only product change is a navigation link.
Use `src/policy/types.ts` for shared contracts, and keep Node inference imports out
of the browser dependency graph. Test helper files are not collected by the
existing `tests/*.test.ts` Vitest pattern unless their names end in `.test.ts`.

## Shared contracts

Use camelCase keys consistently in TypeScript and JSON; Python accesses those
same JSON keys. Model output uses the spec's `decision`, `answer`, `reasonCode`,
and `citations` fields. Reject extra model fields.

- `Principal = { tenant: 'cedar' | 'harbour'; role: 'employee' | 'manager' | 'security' }`.
- `QueryInput = { query: string; principal: Principal; asOf: string }`; no case ID or gold label appears in this selection input.
- `PolicyDocument extends SourceNote` with `tenant`, `allowedRoles`, `policyKey`, `authority`, `status: 'current' | 'obsolete' | 'draft'`, `effectiveOn`, `expiresOn: string | null`, and `supersedes: string[]`.
- `PolicyPassage extends Passage` with `start`, `end` (JavaScript UTF-16 string offsets), `documentSha256`, and policy metadata. Verify spans with `original.slice(start, end) === text`; distinguish offsets from UTF-8 byte counts.
- `PolicyCorpus = { documents: PolicyDocument[]; passages: PolicyPassage[]; revision: string }`.
- `GoldCase = { caseId: string; input: QueryInput; group: 'current' | 'superseded' | 'conflict' | 'unavailable' | 'injection'; answerable: boolean; relevantIds: string[]; expectedReason: ModelAnswer['reasonCode']; requiredFacts: string[]; prohibitedAssertions: string[]; rationale: string; intentFamily: string }`. Fact/assertion strings are rubric statements; any mechanical matching expressions are separately named rubric fields, never silently treated as complete semantic grading.
- `SelectionRecord = { method, ranked: { id: string; score: number }[], supplied: PolicyPassage[], excluded: { id: string; reason: string }[], gate: 'pass' | 'abstain', gateReason: string | null, timings: { eligibilityMs: number; rankingMs: number; embeddingMs: number | null }, queryTokenCount: number | null, passageTokenCounts: Record<string, number> | null }`. Token/embedding fields are null for methods that do not tokenize/embed; model-load timing belongs to encoder provenance.
- `PreparedCase = { caseId, input: QueryInput, selections: SelectionRecord[] }`. The CLI attaches IDs after calling the ID-free selection functions.
- `ModelAnswer = { decision: 'answer' | 'abstain'; answer: string; reasonCode: 'supported' | 'missing_evidence' | 'conflicting_evidence' | 'unsafe_request'; citations: { passageId: string; quote: string }[] }`.
- `RunRow = { schemaVersion: 1, runId, caseId, method, input, selection, fixtureHash, protocolHash, modelDigest, prompt, rawResponse, parsedResponse, validationErrors, status, runtime, assessment }`.
- `status` is one of `gate_abstained`, `completed`, `validation_error`, `runtime_error`, `context_error`, `interrupted`, `missing`; `assessment` starts null, never implicitly successful.
- Optional timing/token values use null plus an availability reason, not invented zeroes. Gate skips have an explicit zero call count and null generator timings.
- `RunReport = { schemaVersion: 1, runId, provenance, split, expectedCaseIds, rows, metrics, completion }`; `completion` is `complete`, `partial`, or `unavailable`.
- `Assessment = { outputHash, assessor: { type: 'agent' | 'human', name, model: string | null }, rubricHash, support, reasonCorrect, instructionCompliance, notes }`; `support` is `supported`, `contradicted`, `unsupported`, `mixed`, or `unreviewed`.

Before execution, read both approved spec and this plan. Do not treat example
test outputs below as actual model evidence. Use synthetic test outputs only in
explicitly labelled tests; never copy them into the recorded public evaluation.

---

### Task 1: Freeze a valid policy corpus and evaluation contract

**Owner:** builder_terra, with read-only reviewer_sol review of the fixture and disclosure boundaries.

**Files:** Fixture/contracts row in the file map.

**Interfaces:**
- Consumes: existing `SourceNote`, `Passage`, and `validateSources()` from `src/lib/sources.ts`, and the spec's exact document ID table.
- Produces: `preparePolicyCorpus(documents: unknown): PolicyCorpus`; `validateFixture(value: unknown): PolicyFixture`; `PolicyFixture = { schemaVersion: 1, version: string, documents: PolicyDocument[], development: GoldCase[], heldOut: GoldCase[] }` in `types.ts`.
- Test helpers in `tests/policy-fixtures.ts`: `baseDocuments(): PolicyDocument[]`, `withRepeatedUnicodeText(): PolicyDocument[]`, and named request/gold fixtures used by later tasks.

- [ ] **1. Inspect the execution checkout and dependencies.** Require the approved branch, review uncommitted changes, read current instructions, and preserve user changes. Use the existing checkout for serial work; if isolation becomes necessary follow `using-git-worktrees` before creating one. Record Node/Python versions and run `npm ls --depth=0`. If the checkout's dependencies do not match the lockfile, restore them with `npm ci`; this may fetch the already declared public packages but sends no user documents. Do not add dependencies or start Policy Lab inference yet.
- [ ] **2. Write failing fixture/validator tests.** Author the 12 documents and 36 labelled cases, grouped by distinct intent families. Include the exact approved split and test these assertions:

```ts
it('freezes the approved split and dispositions', () => {
  const f = validateFixture(fixture);
  expect(f.documents).toHaveLength(12);
  expect(f.development).toHaveLength(12);
  expect(f.heldOut).toHaveLength(24);
  expect(f.heldOut.filter(c => c.answerable)).toHaveLength(14);
  expect(new Set(f.development.map(c => c.intentFamily))
    .intersection(new Set(f.heldOut.map(c => c.intentFamily))).size).toBe(0);
});
it('retains occurrence-aware Unicode source spans', () => {
  const corpus = preparePolicyCorpus(withRepeatedUnicodeText());
  const doc = corpus.documents[0]!;
  const spans = corpus.passages.filter(p => p.sourceId === doc.id);
  expect(spans[1]!.start).toBeGreaterThan(spans[0]!.start);
  for (const p of spans) expect(doc.text.slice(p.start, p.end)).toBe(p.text);
});
```

Also use table tests rejecting duplicate IDs, unknown principals/roles, invalid
dates, cyclic/cross-tenant supersession, more than 12 documents, more than 24
passages, more than 16 KiB text, and gold references to unavailable/nonexistent
passages. Define meaningfully different fact questions within the small corpus;
do not satisfy split counts with trivial paraphrase pairs.

- [ ] **3. Run `npm test -- tests/policy-documents.test.ts` and confirm the new validator behaviours fail.** A missing implementation import is an initial red state; then require assertion-level failures for boundary cases before calling the cycle complete.
- [ ] **4. Implement `preparePolicyCorpus` and `validateFixture`.** Reuse the original bounds/identifier rules without editing them. Derive SHA-256 from exact UTF-8 source bytes and occurrence-aware passage offsets. Accept real calendar dates only. Metadata authority is descriptive, not an automatic truth ranking.
- [ ] **5. Freeze fixture and rubric bytes.** `scripts/freeze-policy-fixture.mjs` supports explicit `--write` once and normal `--check`; an existing differing manifest causes `--write` to fail. Add LF rules for these JSON files to `.gitattributes`. A new version/path is required for changed data. Manifest includes fixture/rubric hashes and declared split counts; write no future accuracy result.
- [ ] **6. Verify and commit.** Run the focused test, `node scripts/freeze-policy-fixture.mjs --write`, then `--check`, and `git diff --check`. Inspect all labels manually before a scoped local commit `feat: freeze policy lab fixture and contracts`. This commit must precede any Policy Lab inference.

### Task 2: Enforce eligibility and implement the three context methods

**Owner:** builder_terra; reviewer_sol checks access, supersession, calibration, and gold-label exclusion read-only.

**Files:** Selection row in the file map; no changes to original ranking/evaluation code.

**Interfaces:**
- Consumes: Task 1 contracts and existing `lexicalSearch()`/`rankVectors()` from `src/lib/ranking.ts`.
- Produces `eligiblePolicyCorpus(corpus: PolicyCorpus, principal: Principal, asOf: string): { corpus: Corpus; passages: PolicyPassage[]; excluded: { id: string; reason: string }[] }`.
- Produces `selectPolicyContext(corpus: PolicyCorpus, input: QueryInput, method: 'lexical' | 'semantic' | 'full-context', options: { threshold: number; embedder?: PolicyEmbedder }): Promise<SelectionRecord>`; unknown methods/principals reject.
- `PolicyEmbedder.embed(texts: string[]): Promise<{ vectors: number[][]; tokenCounts: number[]; elapsedMs: number }>` and `dispose(): Promise<void>`; real Node factory `createPolicyEncoder(): Promise<PolicyEmbedder>` in `scripts/policy-encoder.mjs`.
- `choosePolicyThreshold(rows: { topScore: number | null; hasEvidence: boolean }[]): { threshold: number; balancedAccuracy: number; candidates: number[] }` is calibration-only code, never the query path.
- `prepare-policy-contexts.mjs` reads `{ schemaVersion: 1, fixtureHash: string, documents: PolicyDocument[], cases: { caseId: string; input: QueryInput }[], threshold: number }` from stdin; emits `{ schemaVersion: 1, fixtureHash: string, cases: PreparedCase[], encoder: object }` to stdout. Diagnostics go to stderr. Reject unknown input keys, including gold-label fields. `encoder` records model/revision, runtime, dtype, pooling, dimensions, load time, and asset identity.

- [ ] **1. Write failing selection tests with a spy embedder.** Check both tenants and all roles, current/obsolete/draft/future/expiry cases, same-authority conflict retention, empty eligibility, and no case-ID/gold input. Key expectations:

```ts
it('never revives an obsolete rule after its restricted replacement is filtered', () => {
  const eligible = eligiblePolicyCorpus(replacementRestrictedCorpus, employee, '2026-10-13');
  expect(eligible.passages.map(p => p.sourceId)).not.toContain('cedar-travel-obsolete');
});
it('passes only eligible text to semantic embedding and context', async () => {
  const result = await selectPolicyContext(corpus, employeeQuery, 'semantic', { threshold: 0, embedder: spy });
  expect(spySeenText.join('\n')).not.toContain(restrictedOnlySentinel);
  expect(result.supplied.every(p => p.tenant === 'cedar' && p.allowedRoles.includes('employee'))).toBe(true);
});
it('keeps both conflicting documents in full context', async () => {
  const row = await selectPolicyContext(corpus, employeeQuery, 'full-context', { threshold: 0 });
  expect(row.supplied.map(p => p.sourceId)).toEqual(expect.arrayContaining(['cedar-remote-a', 'cedar-remote-b']));
});
```

Define `replacementRestrictedCorpus`, `employee`, `employeeQuery`, `corpus`, and
spy helpers in `policy-fixtures.ts` as explicit deterministic test data. Assert
the complete expected eligible IDs, not only the two conflict IDs.

- [ ] **2. Run `npm test -- tests/policy-retrieval.test.ts` and observe the new behaviours fail.** Pin calibration ties to the higher threshold, empty scores to abstention, and conflict evidence to `hasEvidence: true`.
- [ ] **3. Implement eligibility before ranking/embedding.** Supersession is active only for a current replacement effective on the as-of date, against the full validated graph before role filtering; validate same tenant and policy key. Reject unknown superseded IDs. Preserve equal-authority unresolved versions. Stable source order breaks ties.
- [ ] **4. Implement the selector and Node encoder/CLI.** Lexical selects at most three positive hits; semantic ranks eligible vectors and gates on its top score; full context supplies all eligible passages with no ranking metric. Tokenize without truncation, reject over 512 tokens for MiniLM, and reuse pinned local q8/mean/normalised/384-dimensional configuration. Cache embeddings only within this CLI invocation keyed by the exact eligible-source hash; dispose the model on exit. No browser import may reach this file.
- [ ] **5. Implement calibration and contract checks.** Candidate scores plus finite all-accept/all-abstain boundary candidates; maximise mean of positive/negative evidence decision accuracy, requiring both development classes. Add CLI tests proving unexpected `answerable`/`relevantIds` fields reject, not silently forward. Add `policy:fixture` and `test:policy` npm scripts for existing checker/focused unit commands.
- [ ] **6. Verify and commit.** All focused TypeScript tests and `npm run check` pass; fixture `--check` passes. Tests using a spy embedder remain labelled deterministic. Real Policy Lab inference waits for Task 5. Commit `feat: add policy eligibility and context comparison`.

### Task 3: Build the bounded Python local-model runner

**Owner:** builder_terra; reviewer_sol reviews local-only transport, byte/token assumptions, raw prompt, and failure handling read-only.

**Files:** Python runner row in the file map.

**Interfaces:**
- `contracts.py`: `validate_prepared_case(value: dict) -> dict`, `validate_model_answer(raw: str, supplied: list[dict]) -> tuple[dict | None, list[str]]`.
- `prompt.py`: `render_prompt(input: dict, supplied: list[dict]) -> str`, `validate_prompt_budget(prompt: str) -> None`; final rendered prompt includes the full explicit Qwen role envelope, empty completed thinking segment, evidence delimiters, and schema instructions.
- `ollama.py`: class `LocalOllamaClient` with methods `preflight(expected_digest: str | None) -> dict` and `generate(prompt: str, digest: str) -> dict`; only fixed loopback `tags`, `show`, `version`, and `generate` endpoints.
- `runner.py`: CLI `py -3.14 -m tools.policy_eval.runner --stage smoke|development|held-out --run-id ID`; `run_case(prepared: dict, method: str, protocol: dict, client: LocalOllamaClient) -> dict` produces a `RunRow`.
- `LocalOllamaClient` is the production transport class; constructor takes no arbitrary base URL. Unit tests inject a transport callable without enabling a CLI endpoint override.

- [ ] **1. Write failing tests for the model contract and transport.** Assert exact settings, full supplied evidence, 6500-byte acceptance/6501-byte rejection, Unicode byte counting, schema/quote validation, unknown citation rejection, and immutable raw text. The transport fake records requests and returns clearly labelled synthetic data:

```python
def test_request_is_local_raw_bounded_and_does_not_enable_tools(self):
    result = self.client.generate(self.prompt, self.digest)
    request = self.transport.requests[-1]
    self.assertEqual(request.url, 'http://127.0.0.1:11434/api/generate')
    self.assertEqual(request.body['options'], {'temperature': 0, 'seed': 17, 'num_predict': 256, 'num_ctx': 8192})
    self.assertTrue(request.body['raw'])
    self.assertFalse(request.body['think'])
    self.assertNotIn('tools', request.body)

def test_timeout_remains_failure_without_retry(self):
    self.transport.fail_with_timeout()
    row = run_case(self.prepared, 'semantic', self.protocol, self.client)
    self.assertEqual(row['status'], 'runtime_error')
    self.assertEqual(self.transport.generation_calls, 1)
    self.assertIsNone(row['parsedResponse'])
```

Test blocked redirects, environment proxy settings ignored, missing/changed model
digest, unsupported tokenizer/family/template, length termination, invalid UTF-8,
response size above 1 MiB, and service-unavailable states. Tests do not need Ollama.

- [ ] **2. Run `py -3.14 -m unittest discover -s tools/policy_eval/tests -p 'test_*.py' -v` and confirm failures for the unimplemented runner behaviours.** Keep mocks distinct from model measurements.
- [ ] **3. Implement preflight, prompt and generation transport.** Standard-library HTTP client disables redirects and proxies and enforces response/time bounds. Pin local tag digest and the inspected Qwen3/GPT2-byte-tokenizer metadata. Save the installed template hash and validate compatibility with the raw envelope; fail visibly on unsupported metadata. Use `keep_alive: '30s'`, no auto-pull, no service shutdown. Record actual prompt/output tokens, load/prefill/generation durations, returned model, stop reason, and unavailable runtime fields.
- [ ] **4. Implement versioned subprocess and run contracts.** Python sends only projected safe query inputs/documents to `node --experimental-strip-types scripts/prepare-policy-contexts.mjs` through stdin with an argument list and `shell=False`. Bound stdin/stdout to 2 MiB and subprocess time to 120 seconds. Check IDs and fixture identity on return. Reject duplicate case/method rows. Use exclusive run-directory creation and exclusive per-attempt JSON creation; save the request before generation and raw response before parsing. On timeout/interruption preserve an attempt record. Validate run IDs as lowercase letters/digits/hyphens up to 80 characters; never use a supplied path.
- [ ] **5. Enforce run sequencing and ceilings.** Smoke has three development attempts total, one per method. Persist attempt counts across partial runs and all protocol/config variants of this fixture version, not merely per invocation or config hash. Permit two development sweeps and one held-out sweep only; a rerun is not a loophole. Require committed fixture and locked calibration/protocol for held-out. A held-out interruption leaves missing rows; completing a preallocated never-started row is permitted, retrying a started row is not. Pipeline errors never substitute a saved answer. This task defines records; Task 4 supplies reporting and Task 5 performs inference.
- [ ] **6. Verify and commit.** Python tests pass, `py -3.14 -m compileall -q tools/policy_eval` succeeds, and no test opens the real model endpoint. Document CLI and local-only boundaries in the runner README. Commit `feat: add bounded local policy evaluation runner`.

### Task 4: Make assessment, denominators, and static export inspectable

**Owner:** builder_terra; reviewer_sol reviews scoring/claim boundaries read-only.

**Files:** Assessment/reporting row in the file map; `src/data/policy-evaluation.json` is not generated from mocked results.

**Interfaces:**
- `assessment.py`: `assess_mechanical(row: dict, gold: dict) -> dict` for schema/source/quote checks and labelled marker/fact indicators; `validate_assessment(value: dict, row: dict, rubric_hash: str) -> dict` binds a separate assessor record to raw output hash.
- `report.py`: `build_report(rows: list[dict], gold_cases: list[dict], provenance: dict) -> dict`, `write_report(report: dict, directory: Path) -> None`; generates JSON and Markdown from the same record.
- `export.py`: `export_selected_run(run_id: str, check: bool = False) -> None`; validates `selected-run.json`, recomputes results, then produces the recorded browser data and public evidence copies. No output rewriting of historic run files.
- CLI: `py -3.14 -m tools.policy_eval.report --run-id ID --check`; `py -3.14 -m tools.policy_eval.export --run-id ID --check` compares regenerated nonvolatile content without inference.

- [ ] **1. Write failing denominator and provenance tests.** Use explicit synthetic `RunRow` factories only in tests. Assertions include:

```python
def test_partial_run_keeps_expected_case_denominator(self):
    report = build_report(self.one_completed_row, self.gold_24, self.provenance)
    self.assertEqual(report['metrics']['semantic']['answerableTotal'], 14)
    self.assertEqual(report['metrics']['semantic']['abstainExpectedTotal'], 10)
    self.assertEqual(report['metrics']['semantic']['expectedCases'], 24)
    self.assertEqual(report['completion'], 'partial')

def test_valid_quote_is_not_automatically_supported_answer(self):
    result = assess_mechanical(self.quote_valid_answer_wrong, self.gold)
    self.assertTrue(result['citationsValid'])
    self.assertNotIn('support', result)

def test_quoted_attack_marker_is_only_a_mechanical_indicator(self):
    result = assess_mechanical(self.attack_explained_not_followed, self.gold)
    self.assertTrue(result['attackMarkerPresent'])
    self.assertNotIn('instructionCompliance', result)
```

Also pin macro Recall@3 versus total passage coverage, full-context ranking metric
as null/not-applicable, zero-denominator behaviour, gated latency handling,
unreviewed yield exclusion, model abstention versus parser failure, output-hash
tampering, duplicate rows, absent attack exposure, and forbidden sentinels already
present in allowed input. Reject such sentinel contamination when freezing data.

- [ ] **2. Run the focused Python tests and confirm the reporting behaviours fail.** Do not use a percentage assertion without its raw counts.
- [ ] **3. Implement report aggregation.** Build the expected case-by-method grid first, then attach results or explicit missing rows. Compute every metric in spec section 8, retaining raw/gate/final dispositions separately. Use nearest-rank p95 and median p50 with N, only over available durations; separate timed-out samples. Context coverage macro denominator is cases with relevant eligible evidence; also emit total matched/expected passages. Retain every attempt in provenance, including failed smoke/development runs.
- [ ] **4. Implement the assessor guide and record validation.** Every generated answer has an output-bound assessment or remains visibly unreviewed. Label agent assessment accurately; no automatic truth detector. Useful conflict abstention requires both competing evidence passages. Check exact required facts and prohibited assertions as limited mechanical indicators alongside a reasoned support assessment, not a replacement for one.
- [ ] **5. Implement deterministic static export and commands.** Fail on changed fixture/config/model/output identities or incoherent case/method joins. Record selected run via a hash-bound pointer, never an implicit newest-file search. Add `policy:report:check` and `policy:export:check` commands using the selected pointer by default. Missing generation evidence yields clearly partial/unavailable data, never test records substituted into the page.
- [ ] **6. Verify and commit.** All Python and relevant TypeScript tests pass. Commit `feat: report policy evidence and failure denominators`. No generation quality is claimed yet.

### Task 5: Run the frozen local experiment and retain all outcomes

**Owner:** serial execution by the selected implementer; separate read-only reviewer_sol can assess outputs. Do not run competing model batches in parallel.

**Files:** Local-evidence row in the file map, plus `ASSESSMENT_GUIDE.md` only for clarity corrections that do not change the frozen rubric.

**Interfaces:** Consumes Tasks 1–4 contracts. Produces measured run directories, locked `calibration.json`/`protocol.json`, `selected-run.json`, completed or explicitly partial report, and a static data export.

- [ ] **1. Verify preconditions and freeze identities.** Require unchanged fixture hashes and a clean tracked code tree. Run `npm run policy:fixture` and both focused test suites. Record installed model digest, runtime metadata, source commit, template compatibility, and installed public assets. Current inspection found Qwen3/GPT2 tokenizer, 40960 model context capacity, and true/false thinking controls; recheck rather than treating this observation as inference success.
- [ ] **2. Measure development retrieval and choose the threshold.** Run actual pinned MiniLM only on development inputs with finite threshold `-1.01` for collection of ungated rankings; no generator call uses this provisional gate. Calibrate using evidence-present labels in the scorer. Save every candidate and outcome in `calibration.json`, with source/fixture hashes. Do not evaluate held-out retrieval yet.
- [ ] **3. Perform the three bounded generation smoke attempts.** Use one legitimate development case per method, log prompt sizes, exact context, settings, identity, actual response and timing fields. A malformed/poor answer is retained; an unsupported contract, unexpected network target, context overflow, or resource failure stops the batch. Never download another model or call a paid endpoint.
- [ ] **4. Execute development sweeps within the ceiling.** One sweep is the default; a second is allowed only for a documented development-derived adjustment. Preserve both prompts/config hashes and outputs. Lock the chosen final prompt/schema, threshold, model digest, method order, software versions, and fixed generation settings in `protocol.json`; commit that lock before any held-out run.
- [ ] **5. Execute the held-out sweep once.** Prepare the 24 safe inputs, withhold gold from the runtime, and cycle method order by case index. Record all 72 expected method rows, with generator skips/errors explicit. Do not tune on these outputs. Let the chosen model keep-alive expire; do not interfere with other installed models or the Ollama service.
- [ ] **6. Assess and write the report.** Review all emitted answers against supplied evidence and the frozen rubric; record assessor type/model and output hashes. Inspect each supported claim, conflict, missing-evidence explanation, and attack exposure. Preserve bad outputs. Produce measured timings/tokens, raw denominators and failure analysis in `EVALUATION.md`; state local API spend zero and unmeasured resource costs. Mark unavailable model runs as incomplete.
- [ ] **7. Verify and commit evidence.** Recompute report/export from raw files with `--check`, confirm the report includes every expected case, inspect raw examples manually, and check no historic fixture/evaluation changed. Commit `eval: record local policy comparison and failures`. Generate `src/data/policy-evaluation.json` from the selected run, never from the test fixtures. If model execution is blocked, retain a partial report and explicitly leave this task's real-generation criterion incomplete.

### Task 6: Add the recorded Policy Lab page and scoped navigation

**Owner:** builder_terra; qa_terra reviews rendered behaviour read-only. Apply `saran-interface-craft`, installed `motion-design`, and `saran-visual-qa`. Reuse the current identity; do not introduce a new visual direction.

**Files:** Policy-interface row in file map. Extend CSP/evidence copy rules only for this route and its generated report.

**Interfaces:**
- `viewer.ts`: `validateRecordedReport(value: unknown): RunReport`, `filterRecordedCases(report: RunReport, filters: { tenant: string | null; role: string | null; group: string | null }): RecordedCase[]`, and `buildCaseExport(report: RunReport, caseId: string): string`.
- `RecordedCase = { caseId: string; input: QueryInput; rows: RunRow[] }`, grouped by one immutable input identity; missing method rows remain explicit.
- `PolicyLab({ report }: { report: RunReport })`; `CaseComparison({ record }: { record: RecordedCase })`; `SourceInspection({ row }: { row: RunRow })`. No inference import or endpoint setting is exposed to these components.

- [ ] **1. Write failing viewer and browser tests.** Validate recorded joins and export identity, then add semantic role-based Playwright checks. Use actual selected evidence for normal results and explicitly labelled test fixtures only for error-state tests. Pin exact copy `Recorded local evaluation`, fictional-data disclosure, model/run identity, all three methods, and no automatic inference.

```ts
test('case changes replace all saved methods without inference', async ({ page }) => {
  const forbiddenRequests: string[] = [];
  page.on('request', r => { if (/11434|onnx|tokenizer|\.wasm|\.worker|params_shard/.test(r.url())) forbiddenRequests.push(r.url()); });
  await page.goto(`${prefix}policy-lab/`);
  await expect(page.getByText('Recorded local evaluation', { exact: true })).toBeVisible();
  await page.getByLabel('Saved case').selectOption(secondCaseId);
  for (const panel of ['Lexical retrieval', 'Semantic retrieval', 'Full context']) {
    await expect(page.getByRole('region', { name: panel })).toContainText(secondCaseQuestion);
  }
  expect(forbiddenRequests).toEqual([]);
});
```

Read `secondCaseId` and `secondCaseQuestion` from the selected report. Also test
filters with no results, keyboard source/disclosure controls, literal HTML-like
source/output rendering, partial/error data, unknown/corrupt report fail-closed
state, explicit export readback, and preservation of Story Lab/baseline links.

- [ ] **2. Run the new unit test and a built browser test to observe the missing page/behaviour failure.** Use port 4733 only when free, matching the existing suite; `reuseExistingServer: false` remains. Do not kill another process to claim this port. If occupied, record the conflict and use a separate targeted config/port rather than changing unrelated running work.
- [ ] **3. Implement the scoped page and components.** Import recorded JSON only; retain exact raw text and quotes. Use the source desk's paper/cobalt reading design, explicit labels for gate/model/errors, and stacked narrow-screen method panels. Filters only select stored cases; they cannot rewrite principal/query metadata. Keep output immutable and large JSON in accessible disclosures. Show an understandable error if provenance is invalid instead of an empty success screen.
- [ ] **4. Add route protection and links.** Extend `build-csp.mjs` with `["policy-lab/index.html", "policy-lab/", false]` so it gets same-origin-only connections. Copy report, raw selected-run JSON and methodology text to scoped `dist/evidence/policy-lab/` paths with explicit MIME/download-friendly extensions. Add one Policy Lab link to `StoryLab.tsx` product navigation and one to baseline header; preserve their content/behaviour. All paths use `import.meta.env.BASE_URL`.
- [ ] **5. Verify interface and headers.** Run focused unit/browser tests, original recorded-walkthrough test and expanded `headers.spec.ts`. Assert no external text requests, storage writes, model imports/downloads, or private sentinel data in network traffic. Inspect screenshots at 320, 390, 768, and 1440 widths, keyboard focus and reduced motion; repair observed defects, not unrelated styling. Exports must match the selected case's immutable input/rows/hash exactly.
- [ ] **6. Commit `feat: add recorded policy lab evidence desk`.** Include source, tests, scoped header/navigation changes and generated data. Record what was visually inspected, not just screenshot filenames.

### Task 7: Complete preservation checks, teaching material, and local handoff

**Owner:** selected implementer for code/docs; qa_terra for read-only browser review and reviewer_sol for read-only final architecture/claim review, using AGENTS routing. Reviews do not author overlapping edits.

**Files:** Release-evidence row in file map; review corrections stay within owned policy files unless a specifically changed navigation/header defect requires a focused repair.

**Interfaces:** `scripts/check-policy-preservation.mjs` compares protected files against release base `fd3e437...` using Git blobs and fails on differences; no history rewriting. Protect original fixture/evaluation, ranking/worker core, Story Lab atlas/fixtures/raw generation, and model manifests. Page/nav files intentionally changed by Task 6 are reviewed by diff rather than incorrectly frozen.

- [ ] **1. Add the preservation checker and fresh verification record.** Check exact original fixture, `src/data/evaluation.json`, `src/lib/{sources,ranking,protocol,worker-controller}.ts`, `src/workers/search.worker.ts`, `docs/story-lab/{fixture,evaluation,generation-evaluation}.json`, `src/story/atlas.json`, `MODEL_MANIFEST.json`, and `public/models/manifest.json`. Save only scoped command summaries and artifact references in `VERIFICATION.md`; do not copy environment dumps.
- [ ] **2. Write the learning and claim artifacts.** Architecture explains local components, filtered evidence, rejected alternatives and explicitly unbuilt cloud responsibilities. Walkthrough covers problem/evidence/failure/comparison/limits in five planned minutes. Claim ledger maps each statement to an artifact and measured status, credits assistance, and leaves unobserved learning incomplete. Handoff gives exact route/base/header rules, selected run, reproduction commands, proposed portfolio copy/registry change, and integration ownership. Update README/domain brief without revising historical results.
- [ ] **3. Run focused final checks and original drift verification.** Commands: `npm run policy:fixture`; `npm run test:policy`; Python unittest discovery; `npm run policy:report:check`; `npm run policy:export:check`; `node scripts/check-policy-preservation.mjs`; `npm run evaluate -- --check`. Expected: explicit successful exit codes, no missing test rows, no preservation drift. A mocked runner test does not fulfil Task 5's measurement requirement.
- [ ] **4. Run full root QA and prefixed checks sequentially.** In PowerShell set `$env:SOURCE_TRAIL_BASE='/'`, run `npm run qa`, then set it to `/tools/source-trail/`, run `npm run build` and `npm run test:e2e` against that build. Capture exit codes immediately; stop on failure. Restore the previous environment value afterwards. Do not allow either server to reuse an existing process. Inspect Policy Lab and the two preserved journeys at mobile/tablet/desktop sizes under the prefixed build too; no renewed large Story Lab GPU download is required.
- [ ] **5. Obtain whole-change read-only review.** Review the actual diff, selected raw evidence, metrics and screenshots. Prioritise wrong denominators, hidden model failures, cross-context data, outdated-policy handling, incorrect support claims, browser network/storage behaviour, and regression to existing experiences. Fix substantive findings, run affected checks, then repeat full QA only when code changes justify it. Use project role routing rather than an unrequested expensive model override.
- [ ] **6. Commit the local handoff and reconcile status.** Run `git diff --check`, scoped preservation checks and `git status`; commit reviewed changes and report the exact final local commit. Update handoff release identity without inventing a self-referential commit hash: use the final source/evidence commit and identify the following documentation-only commit separately when needed. Confirm original branches/worktree remain intact. Pushed, CI, hosted-preview and custom-domain states remain unperformed by this workstream.

## Review and acceptance map

| Spec sections | Plan coverage |
| --- | --- |
| 1–2: purpose, preservation, local scope | Constraints, Tasks 1, 6, 7 |
| 3–4: corpus, split, freeze, leakage limits | Task 1; Tasks 2 and 5 contract/tuning checks |
| 5: eligibility, calibration, fair comparison | Task 2; Task 5 measured comparison |
| 6: local architecture, runtime limits | Tasks 2–3; Task 5 real preflight/run |
| 7–8: assessment and raw denominators | Task 4; Task 5 assessed outputs |
| 9: recorded visitor experience | Task 6 |
| 10: focused/full/browser QA | Each task's checks; Task 7 release verification |
| 11: explanation, learning, ledger, handoff | Tasks 4, 5, 7 |

Self-review completed on 13 October 2026: all specification sections map to tasks;
each of the five Review Focus conditions has an owning test; shared types, class
methods, and CLI boundaries use consistent names. Removed an optional unused
module and an ineffective example assertion, and made the provisional calibration
gate explicit. No task widens deployment scope. No task checkbox is complete
merely because this plan exists; product tests and model measurements remain future work.

## Execution-method handoff

User review of this plan and execution-method selection are required before any
implementation. Two supported methods:

- **Sequential subagents (recommended):** one builder owns each task at a time,
  followed by fresh read-only review before proceeding. Use builder_terra for
  implementation, qa_terra for browser QA, reviewer_sol for high-risk architecture,
  privacy and claims, and inventory_luna only for genuinely mechanical inventory.
  This has more review overhead but catches contract/scoring mistakes between
  tasks. No parallel writers in this repository.
- **Native execution:** the main agent implements the sequence in this chat,
  then a fresh read-only final reviewer checks the whole change under the project
  routing rules. Lower coordination overhead; independent review arrives later.

Sequential subagents are recommended because the TypeScript/Python contract,
measurement logic, and recorded UI can each appear correct while disagreeing with
one another. The shared interfaces and separate review gates are useful here.
Neither option authorises publication, remote API use, or another project's edits.
