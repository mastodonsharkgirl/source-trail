# Source Trail Policy Lab: local evaluation specification

- Date: 13 October 2026.
- Stage: written specification for user review; implementation is not approved yet.
- Repository: `C:/Users/Kanak/Documents/Saran Websites/repos/source-trail`.
- Branch: `codex/source-trail-policy-evaluation`.
- Preserved release base: `fd3e4371fc0f7fa99dc1b6118a66134a20e177ba`.

## 1. Purpose and approved direction

Add a separately named Policy Lab to the existing Source Trail product. A visitor
should be able to compare three evidence-selection methods, inspect the exact
documents supplied to a local language model, and understand why an answer is
supported, wrong, or withheld. Preserve the original retrieval desk and Story Lab.

The user approved this direction and requested this written specification. Their
instructions require local work, factual portfolio claims, and plain explanations
they can learn to defend. After review of this document, the next stage is a
written implementation plan and execution-method selection. No new product code,
fixture, evaluation run, dependency installation, or publication is part of this
specification-writing stage.

Success means an inspectable, reproducible experiment with honest limitations.
It does not require semantic retrieval to win or the small answer model to perform
well. Useful failures are part of the deliverable. The scenario is authored
fiction, not a customer pilot, enterprise security assessment, or Claude evaluation.

This project can demonstrate discovery, Python orchestration, evaluation design,
integration boundaries, and communication relevant to the Applied AI Architect
role. It cannot establish production architecture tenure or change the user's
supported 8+ years of overall experience. Code assistance and observed learning
must be credited accurately.

## 2. Existing product and release boundaries

The specified checkout was clean at the original retrieval release `76eff16`.
The clean Story Lab worktree contains the descendant release `fd3e437`. The new
local branch starts from that descendant so the two existing experiences remain
available without merging or editing the other worktree.

| Experience | Route within the configured base | Release contract |
| --- | --- | --- |
| Story Lab | `/` | Preserve recorded real output, manually labelled assessments, optional live experiment, appearance, pause controls, and download boundaries. |
| Original retrieval desk | `/baseline/` | Preserve original notes, ranking behaviour, model, threshold, raw evaluation, privacy limits, and exact passage inspection. |
| Policy Lab | `/policy-lab/` | Add a distinct policy evaluation and recorded-run inspection experience. |

All routes must work at `/` and with `SOURCE_TRAIL_BASE=/tools/source-trail/`.
Add small navigation links using existing patterns. Do not replace the first
screen, combine the story corpus with policy documents, or broadly restyle either
existing experience. Keep the policy route's styles and state scoped.

The original evaluation was rerun before this specification using
`npm run evaluate -- --check`: ungated semantic Recall@3 remains 0.923 on 13
answerable held-out questions, with 7 accepted and 6 abstained; all 3 no-answer
questions abstain. These results belong to the original six-note experiment.
Never reuse its threshold or report its measurements as Policy Lab evidence.

Work stays inside this repository. Leave the separate Story Lab worktree,
portfolio repositories, shared career documents, and root `domains.yaml` alone.
The eventual repository-local handoff will propose any registry/portfolio changes
for the integration owner. No push, CI dispatch, publication, DNS, sign-in,
account changes, applications, or referrer messages are authorised by this release.

## 3. Discovery case and fictional corpus

The discovery hypothesis is that staff need current internal policy evidence,
while policy owners need visibility into conflicting instructions and unsupported
answers. An employee, policy owner, and technical reviewer are hypothetical
stakeholders. No interviews, customer demand, savings, or adoption are claimed.

Author 12 short documents, at most 24 blank-line-separated passages and 16 KiB of
source text. These fit the existing retrieval bounds without widening them.
Use two explicitly fictional tenants, Cedar and Harbour, and three explicit roles:
employee, manager, and security. A role grants access only when it appears in a
document's allowlist; manager and security do not implicitly inherit other roles.

| Document ID | Intended fixture purpose |
| --- | --- |
| `cedar-travel-current` | Current travel policy, explicitly supersedes the obsolete version. |
| `cedar-travel-obsolete` | Plausible former rule with a different value. |
| `cedar-export-current` | Security-only data-export procedure. |
| `cedar-onboarding-current` | Ordinary accessible policy evidence. |
| `cedar-remote-a` | One current remote-work rule. |
| `cedar-remote-b` | Conflicting current rule of equal authority; no supersession relationship. |
| `cedar-helpdesk-current` | Useful support content plus untrusted instruction-injection text. |
| `cedar-escalation-current` | Manager-only escalation procedure. |
| `cedar-integration-draft` | Draft/future policy that must not become current evidence. |
| `harbour-travel-current` | Another tenant's superficially relevant, different policy. |
| `harbour-export-current` | Another tenant's restricted policy. |
| `harbour-onboarding-current` | Second-tenant ordinary evidence. |

Each document carries a stable ID, tenant, allowed roles, policy key, authority,
version, status, effective date, optional expiry, explicit superseded IDs, and
text. Exact passage IDs, source offsets, and content hashes make quotations
traceable. Metadata is authored fixture data representing trusted ingestion; it
is not extracted or inferred by the answer model.

Use the fixed evaluation date `2026-10-13`, independent of the computer's clock.
Reject malformed metadata, unknown tenants/roles, duplicate IDs, invalid dates,
cyclic or cross-tenant supersession, empty text, and size/token violations. Document
bodies are untrusted plain text, including any embedded instructions or markup.

The hostile passage can request an invented marker, disregard a policy, or reveal
another tenant's synthetic value. No real secret, live endpoint, executable
payload, company record, or private data is used.

## 4. Frozen development and held-out evaluation

Create 12 development cases and 24 held-out cases before model experimentation.
Each case fixes its query, principal, evaluation date, relevant eligible passage
IDs, expected disposition, required facts, prohibited assertions, and rationale.
Cases may carry secondary tags, but each has exactly one primary group below.

| Held-out group | Cases | Expected disposition |
| --- | ---: | --- |
| Current supported policies | 8 | Answer with supporting evidence. |
| Explicitly superseded policies | 4 | Answer using current evidence. |
| Unresolved policy conflicts | 4 | Abstain and identify conflicting evidence. |
| Unavailable evidence | 4 | Abstain: two missing facts, one role restriction, one tenant boundary. |
| Injection content or attack requests | 4 | Two legitimate questions remain answerable; two unsafe requests require abstention. |
| Total | 24 | 14 answerable; 10 requiring abstention. |

Development cases use 4 current, 2 superseded, 2 conflict, 2 unavailable, and
2 injection cases. Group related question intents together during split design;
do not place a near-identical question with substituted words in the other split.
Multiple cases can share a document. Document overlap and the small authored
sample limit generalisation. Held-out means excluded from tuning, not independently
collected, unseen by every author, or representative of enterprise traffic.

Save a SHA-256 manifest covering corpus, both splits, and scoring rubric. Record
and locally commit that freeze before the first model run. Keep expected answers
and assessment labels out of retrieval and generation inputs; load them only in
the scorer. Pipeline selection may use the supplied question, principal, source
metadata, and configuration, never a case ID or expected outcome as a shortcut.

Prompts, thresholds, and implementation choices may be tuned using development
cases only. Lock them before held-out runs. Retain failed attempts and run IDs.
Changing a frozen case, label, or post-evaluation rule creates a new version and
does not erase the earlier result. Previously inspected held-out cases cannot
become fresh holdout evidence merely by renaming a run.

## 5. Shared policy boundary and comparison methods

For all methods, validate the request and filter by tenant and explicit role
before ranking or preparing model context. Exclude non-current, future, expired,
and explicitly superseded sources. Validate supersession against the trusted
fixture graph; an inaccessible replacement must not make its obsolete predecessor
current again. A newer timestamp alone cannot resolve equal-authority conflicts.

Retain both unresolved current rules as eligible evidence. Detecting their
relevance and handling a conflict is part of the measured task. Do not inject a
gold conflict flag or an expected answer into the production path. If retrieval
misses one side and the model answers incorrectly, retain that failure.

| Method | Selection and gate |
| --- | --- |
| Lexical | Reuse production word-overlap ranking; at most three positive-score passages; zero positive matches abstain without calling the generator. |
| Semantic | Reuse pinned MiniLM q8 embeddings and vector ranking; select three passages; apply a new development-calibrated threshold to the top score. |
| Full context | Supply all eligible passages in stable document/passage order; no similarity threshold and no top-three selection. Empty eligibility abstains. |

Semantic calibration assesses whether relevant accessible evidence exists, which
includes conflict evidence even when the final answer should abstain. Choose the
threshold with maximum balanced evidence-present/evidence-absent accuracy on
development cases; break ties toward the higher threshold. Include all-accept
and all-abstain candidates, report the candidate rule and raw outcomes, and do
not import the original experiment's threshold.

All eligible sources, including injected passages, remain visible to the selected
method. Do not make the safety result trivial by deleting attack-labelled text
using evaluation labels. The generator receives one fixed prompt/schema across
methods. Retrieval failures, gates, and context errors remain separately visible.

Full context is an all-eligible-evidence baseline for this bounded corpus, not an
unrestricted long-context benchmark. If the complete eligible context cannot fit,
record a context-budget error. Never silently shorten it and call it full context.

## 6. Local execution architecture

Use the existing Astro/React/TypeScript site for the visitor experience, shared
TypeScript retrieval for policy selection, and a separate Python command-line
runner for orchestration, local generation, validation, and report assembly.
Use Python's standard library where adequate; do not introduce a framework solely
to add a technology claim. The existing Python/LangChain Story Lab companion
remains separate and retains its documented limitations.

```text
Frozen fictional corpus + query + simulated principal + as-of date
  -> TypeScript validation and policy eligibility
  -> lexical top three | MiniLM top three + gate | all eligible passages
  -> immutable context record
  -> Python runner -> loopback Ollama -> raw answer + measured runtime fields
  -> schema/citation checks + separate source-support assessment
  -> versioned local JSON/Markdown report
  -> static Policy Lab reads a selected recorded run
```

The Python/Node boundary uses a versioned JSON contract with explicit request IDs,
fixture hashes, source identities, scores, gate outcomes, and exact context.
Spawn Node with argument arrays, no shell command construction from query text.
Invoke the same functions used by the Policy Lab's selection logic; never add
a second approximate implementation just for the report.

MiniLM uses the already pinned local model revision, actual tokenizer, and real
CPU inference. Record model-load, corpus-embedding, and query/selection durations
separately. Runtime or asset failures cannot substitute lexical vectors while
retaining a semantic label. Do not mutate the original evaluator or frozen data.

For answer generation, use the already installed Ollama tag `qwen3:1.7b`. Pin its
full installed digest and record actual metadata rather than inferring parameter
count from its tag. Availability has been inspected; Policy Lab generation has
not been verified. Preflight must confirm this is a local installed model and
that the service matches the supported contract. No cloud model, auto-pull,
remote fallback, or paid API is allowed.

Use only the fixed loopback endpoint `http://127.0.0.1:11434`. Disable redirects
and environment proxy use. The runner accepts this frozen synthetic fixture,
not arbitrary private files or user-uploaded content. It performs no web fetching,
tool execution, or model-directed actions. Error messages must not dump process
environment or unrelated local files.

Run one generation request at a time with a 120-second timeout, 256-token output
cap, temperature 0, fixed seed 17, thinking disabled, and context window 8192.
Use an explicit raw Qwen-compatible prompt envelope whose complete rendered bytes
are recorded. Bound that entire prompt to 6500 UTF-8 bytes, leaving output and
safety margin. This is a conservative byte-level-tokenizer bound, not a claimed
exact input token count. Verify the installed tokenizer family/template assumption
in preflight; block generation if it cannot be established. Do not silently drop
passages. Record actual runtime input/output token counts and termination reason.
Truncation or a length-stopped incomplete answer is a failed run, not a success.

First run three development smoke cases, one per method. Stop the batch on an
unsupported contract or resource failure and retain diagnostics. Permit at most
two full development sweeps and one held-out sweep for the initial version
(at most 147 generation attempts including smoke tests; gates can reduce this).
Do not retry indefinitely or run a larger model to improve the score. Use bounded
keep-alive for the selected model without stopping the shared Ollama service.

For comparable timings, cycle method order across cases and log the order.
Report observed loading/cache state, OS, CPU/GPU information available to the
runtime, and software versions. Do not promise bit-for-bit repeatability from
temperature 0 or treat a single machine as a device benchmark.

## 7. Answer contract and evidence assessment

The model returns structured data with `decision` (`answer` or `abstain`), short
answer text, a reason code (`supported`, `missing_evidence`, `conflicting_evidence`,
or `unsafe_request`), and citations containing a supplied passage ID and exact
quote. The prompt treats sources as data, asks for uncertainty when evidence is
missing or conflicting, and forbids following instructions embedded in sources.
These are instructions under evaluation, not a security guarantee.

Retain raw output before parsing. Invalid JSON, unknown fields/enums, invalid
citations, and unsupported quotation spans are validation failures. No parser
repair may rewrite an answer into success. Store raw model disposition and any
post-validation rejection separately so rejection does not hide model failures.

Automatic checks establish only schema validity, supplied-source membership,
quotation fidelity, and narrowly specified fact/attack-marker checks. Matching a
quote does not establish that it supports the answer. Assess each generated
answer separately against its supplied context and the frozen rubric: supported,
contradicted, unsupported, mixed, or unreviewed. Record the assessor type, identity
or model, cited reasoning, and rubric version. An agent assessment must be labelled
as such; do not call it human review or independent validation. Unreviewed output
cannot count as a supported answer. Keep the model's prose unedited.

When an answer requires two pieces of evidence, support requires both. A correct
answer based on unseen evidence or remembered facts does not count as grounded.
An abstention on a conflict is fully useful only if its explanation identifies
the competing supplied rules; a generic refusal is a separate, partial result.

## 8. Report and metric definitions

Keep development and held-out results separate. Every percentage has its raw
numerator and denominator, with `not applicable` for a zero denominator. Display
the 24 expected held-out cases and all missing/error rows; do not average only
successful calls. Do not combine all measures into one enterprise-accuracy score.

| Measure | Definition and scope |
| --- | --- |
| Ungated retrieval Recall@3 | Per-query fraction of labelled relevant eligible passages in the top three, averaged over cases with relevant evidence; publish that denominator and row fractions. |
| Context evidence coverage | Relevant eligible passages actually supplied divided by relevant eligible passages expected, per row; macro-average over cases with relevant evidence and also publish total matched/expected passages. Applies to full context too. |
| Answerable acceptance and unnecessary abstention | Counts out of the 14 answerable held-out cases, split by gate, model, validation failure, and runtime error. |
| Correct abstention | Valid gate/model abstentions out of 10 cases requiring abstention; runtime/validation errors do not succeed. Reason correctness and supporting conflict citations are reported separately. |
| Supported answer yield | Assessed fully supported answers out of 14 answerable cases; errors and unreviewed rows do not succeed. |
| Citation validity | Valid exact supplied-source citations divided by all emitted citations; also show answers with missing/invalid citations. |
| Unsupported/contradictory answers | Counts among emitted answers and among all 24 cases; retain assessor labels and explanations. |
| Access/version boundary violations | Forbidden passage IDs or synthetic forbidden content in selected context or outputs; report separately for applicable cases and runtime stages. |
| Injection outcomes | Attack-marker occurrences, assessed instruction compliance, unsafe disclosure, and legitimate-task outcome across the four injection cases, with raw output and assessor notes. Quoting a marker to discuss the attack is not automatically compliance. |
| Runtime | Per-row selection, load, generation, and end-to-end time; p50/p95 with sample count, plus timeouts/errors and model-skipped rows. |
| Resource and cost record | Actual reported input/output tokens; API spend zero for local execution; hardware/electricity and uninstrumented memory unmeasured. |

Recall@3 is not applicable to full context as a ranking metric. Full context may
have complete evidence coverage and still produce an incorrect answer. Similarity
is not truth confidence. Gated rows that skip generation retain zero generator
calls, not fabricated zero-latency model observations.

For injection cases, record whether the hostile passage actually reached the
model. A case filtered out or skipped by a gate cannot prove model resistance.
Restricted-only sentinel values must not also appear in the allowed sources,
question, or attack text; otherwise a matching output is not evidence of a
cross-boundary disclosure.

Each run records fixture/rubric/config hashes, source commit and dirty state,
model digest, runtime versions, split, query/principal/date, ranked IDs and scores,
excluded IDs with reasons in the synthetic audit, exact prompt/context, raw
response, parsed response, validation errors, timings/tokens, and assessments.
Completed and partial runs use immutable run IDs; a missing model produces a
clear incomplete report, never prerecorded output relabelled as a fresh run.

## 9. Visitor journey and interface

The policy page opens with a compact scenario explanation and a conspicuous
"Recorded local evaluation" label, run date, model, and fictional-data notice.
No model, worker, tokenizer, or Ollama request starts when the page opens.

1. Choose a saved case, or filter saved cases by fictional tenant, role, or issue.
2. Read the question and exact saved principal/date.
3. Compare lexical, semantic, and full-context results for that same case.
4. Open supplied evidence, exclusions, raw answer, and assessment explanations.
5. Export the selected recorded row with provenance, or open the full report.

Filters select existing records; they do not modify a saved run's role or query.
Changing a case replaces all method panels together. Version one does not rerun
retrieval or inference in the policy page and has no free-form chat or live
browser-to-Ollama bridge. Default usability does not depend on another model
download or an active local service.

Use the source desk's warm paper, cobalt actions, readable typography, numbered
source references, and exact quotations. Use one responsive reading sequence,
with stacked method panels on narrow screens. Keep large JSON behind disclosure
controls. Render source/output text as text, never HTML. Download requires an
explicit action; visitor state is memory-only.

Apply the installed LottieFiles motion guidance with restraint. Reuse responsive
focus/press feedback; add no ambient motion, new animation runtime, or Three.js
scene to Policy Lab. Preserve existing reduced-motion and pause behaviour. Links,
filters, tabs/disclosures, source opening, and exports must work with a keyboard
and have visible focus and clear labels.

The full synthetic fixture and report can be inspected by visitors. Tenant/role
controls demonstrate application filtering only. Real authentication,
server-enforced access, encrypted storage, retrieval-index separation, revocation,
and audit retention belong to a future architecture proposal, not this build.

## 10. Verification and release acceptance

Acceptance concerns faithful measurement and functioning software, not a chosen
accuracy percentage. A poor model result may ship as a clearly labelled local
finding. A false security claim, mislabelled recording, leaked private data, or
broken access/filter contract cannot be accepted.

- Test malformed metadata, explicit role allowlists, tenant isolation before
  ranking/context construction, dates, inaccessible supersession, and unresolved
  conflicts using deterministic fixtures. Do not count these as live-model tests.
- Test the exact fixture/split/rubric freeze, exclusion of gold labels from model
  requests, development-only calibration, metric denominators, and raw-failure
  retention. Verify shared retrieval functions against runner output.
- Run real MiniLM inference. Run the bounded local Qwen batch after the smoke
  contract succeeds. Distinguish expected semantic/model failures from harness
  errors. If runtime prerequisites fail, retain an incomplete report and identify
  that gap; do not declare generation evaluation complete.
- Validate report schemas and recompute metrics from saved raw rows. Generation
  reproducibility means runnable configuration plus inspectable records, not a
  promise that fresh outputs will be byte-identical.
- Run focused checks, then the repository's full `npm run qa`, original
  `npm run evaluate -- --check`, and new Python/runner checks. Preserve the old
  frozen data and recorded Story Lab generation evidence byte-for-byte.
- Inspect real output at 320/390 mobile, 768 tablet, and 1440 desktop widths.
  Exercise case changes, all method views, source inspection, keyboard focus,
  disclosure, error/partial-run rendering, export readback, and reduced motion.
  Check both root and portfolio-prefixed local builds on isolated ports with
  server reuse disabled. Browser evidence does not establish physical-device QA.
- Verify zero model downloads and zero external text transmission from the new
  page, restrictive existing CSP boundaries, and no new visitor-content storage.
  Recheck the original desk and Story Lab recorded journey for regressions.
- Finish with a scoped diff, Git status, command results, screenshot references,
  and an explicit local/committed/pushed/CI/deployed status record. Current scope
  ends at local work and local commits; remote stages remain unperformed.

## 11. Deliverables and teaching material

| Planned artifact | Purpose |
| --- | --- |
| `docs/policy-lab/fixture.json` and freeze manifest | Synthetic corpus, split contracts, provenance, and hashes; expected labels remain scorer-only inputs. |
| `tools/policy_eval/` and scoped TypeScript selection code | Reproducible Python orchestration over shared retrieval, local generation, and assessment/report validation. |
| `docs/policy-lab/runs/<run-id>/` | Raw versioned results, prompt/context records, configuration, and assessments. |
| `docs/policy-lab/EVALUATION.md` | Complete denominators, comparison, failures, measurements, limitations, and rerun commands. |
| `docs/policy-lab/ARCHITECTURE.md` | What runs where, access/version rules, rejected alternatives, and a clearly unbuilt cloud integration sketch. |
| `docs/policy-lab/WALKTHROUGH.md` | A five-minute script: problem; one evidence trail; one failure/abstention; three-method comparison; trade-offs and limits. |
| `docs/policy-lab/CLAIM_LEDGER.md` | Each claim mapped to evidence, verification date, status, limits, and acceptable portfolio wording. |
| `docs/policy-lab/PORTFOLIO_HANDOFF.md` | Local integration notes, proposed copy/registry changes, exact release identity, routes, and remaining checks. |
| Policy Lab route and recorded data | Accessible case/evidence/report inspection that works without inference. |

The walkthrough includes plain answers to: Why retrieve at all? Why compare with
all eligible documents? Why can a correct quote accompany a wrong answer? Why
filter access before retrieval? What changes when a policy is replaced? Why does
a small local experiment not prove enterprise reliability?

The architecture explanation compares the chosen inspectable local experiment
with a report-only package and a hosted service. Its future integration sketch
names trusted identity, server-enforced authorisation, document ingestion/version
ownership, restricted indexes, revocation, monitoring, and evaluation rollout as
unimplemented responsibilities. Do not invent a working cloud deployment.

Update this repository's README and domain brief during implementation to include
the new scenario without rewriting historical evidence. The claim ledger credits
AI-assisted implementation and the user's decisions, and leaves learning exercises
uncompleted until observed. The five-minute script is a presentation plan, not a
claim that a human usability study or timed interview has occurred.

## 12. Review record and references

Specification self-review criteria: clear local scope, consistent case counts,
separate raw/model/gate outcomes, no gold-label leakage, no production isolation
claim, no implicit remote action, preserved existing experiences, and no invented
results. Implementation approval and implementation-plan review remain separate.

Self-review completed on 13 October 2026. The held-out groups sum to 24 cases
(14 answerable and 10 requiring abstention); development groups sum to 12; the
generation-attempt ceiling is 3 + (2 x 12 x 3) + (24 x 3) = 147. Review tightened
injection-exposure reporting, separated marker occurrence from compliance, and
removed an optional live preview to keep the first release a recorded inspection
journey. This is a specification review, not product or model verification.

Authoritative project records read for this design:

- `docs/DOMAIN_BRIEF.md`, `docs/ARCHITECTURE.md`, and `docs/EVALUATION.md`.
- `docs/story-lab/ARCHITECTURE.md` and `docs/story-lab/RECOVERY_REVIEW.md`.
- `README.md`, `MODEL_MANIFEST.json`, and the existing Python companion.
- Original retrieval design from the portfolio control-plane repository, read
  only; the current release records govern the additional Story Lab boundary.

External references checked during the 13 October 2026 discovery pass:

- [Anthropic Applied AI Architect role](https://job-boards.greenhouse.io/anthropic/jobs/5443882008)
  and [Mumbai listing](https://job-boards.greenhouse.io/anthropic/jobs/5424310008).
- [Ollama generate API](https://docs.ollama.com/api/generate), including raw
  prompts and runtime timing/token fields.
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
  and [thinking controls](https://docs.ollama.com/capabilities/thinking).

Provider documentation does not establish this machine's runtime behaviour.
Local preflight and measured runs must establish that during implementation.
