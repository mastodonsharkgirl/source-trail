# Policy Lab runner

This Python 3.14 standard-library package runs the separately frozen fictional
Policy Lab experiment. It does not modify the retrieval desk, Story Lab, or the
existing `tools/python_rag` companion. Importing this package does no inference.

## Current verification boundary

The contract, transport, persistence and failure tests use **explicitly synthetic
responses** in temporary directories. They verify runner behavior, not model
accuracy, actual Ollama compatibility, actual MiniLM inference, or real timing.
No test contacts the model endpoint. Real runs remain deferred while the shared
compute slot is reserved. No held-out context preparation has been performed.

Run the focused tests in one Python process:

```powershell
py -3.14 -m unittest discover -s tools/policy_eval/tests -p 'test_*.py' -v
py -3.14 -m compileall -q tools/policy_eval
```

## Explicit execution

After the real experiment prerequisites are prepared and compute is available:

```powershell
py -3.14 -m tools.policy_eval.preparation --development
# Commit calibration, retrieval records and the initial protocol before generation.
py -3.14 -m tools.policy_eval.runner --stage smoke --run-id policy-v7-smoke
py -3.14 -m tools.policy_eval.runner --stage development --run-id policy-v7-dev-1
py -3.14 -m tools.policy_eval.preparation --lock
# Commit the exact locked protocol before opening the held-out sweep.
py -3.14 -m tools.policy_eval.runner --stage held-out --run-id policy-v7-held
```

These commands start real local processing. They currently fail before processing
because the actual calibration/protocol artifacts have not yet been created.
The CLI has no endpoint, file-input, model, settings, or output-directory override.
Run IDs accept lowercase letters/digits/hyphens only (1–80 characters).

The runner loads the repository's fixed fixture, rubric and manifest, verifies
their hashes and committed bytes, and requires clean tracked source. It projects
only documents, query, principal and date into the TypeScript selector; gold
answers and scoring fields never enter selection or the model prompt.

`protocol.json` fixes `schemaVersion: 1`, `fixtureHash`, `rubricHash`, `threshold`,
`modelDigest`, `templateSha256`, `promptSha256`, `calibrationSha256`, `locked`,
`options`, `methodOrder: "cyclic"`, and `developmentAdjustment` (null for the first
development sweep; an explicit explanation for a second). `prompt_identity()`
hashes the prompt and strict schema/contract source bytes. `calibration.json` must
bind the same fixture and threshold; its full bytes are bound by the protocol.
Held-out additionally requires the calibration and locked protocol to match Git.
The calibration procedure and measured evidence are supplied by later tasks.
The preparation CLI uses only the 12 development inputs and the shared TypeScript
threshold function. It records each candidate and outcome, actual encoder asset
hashes/sizes, separate timings, runtime metadata and the source commit. It refuses
automatic reruns of started calibration. Encoder CPU inference uses one thread.

## Fixed model boundary

- Only `http://127.0.0.1:11434`, with tags/show/version/generate endpoints.
- No environment proxies, redirects, auto-pull, cloud fallback, tools, or service
  shutdown. Only a timed-out runner-owned Node child can be terminated.
- Installed `qwen3:1.7b`, complete digest, Qwen3/GPT2 tokenizer metadata,
  sufficient context capacity, thinking capability and compatible role template
  checked before generation. Digest/template are checked again afterward.
- Raw Qwen role envelope; a completed empty thinking segment; `think: false`;
  strict JSON schema; temperature 0, seed 17, output cap 256, context 8192,
  `keep_alive: "30s"`, one request at a time.
- Entire rendered prompt at most 6500 UTF-8 bytes. JSON escaping prevents source
  text from becoming raw role delimiters while preserving its decoded text.
  No passage truncation. This byte bound is not a measured token count.
- HTTP timeout 120 seconds, response at most 1 MiB; Node input/output at most
  2 MiB and execution at most 120 seconds. Invalid UTF-8, malformed JSON,
  unsupported metadata, changed digest and length stops are visible failures.

Pre/post metadata checks detect an observed tag change; they cannot prove atomic
identity under a concurrent administrator changing the installed model between
checks. The experiment therefore requires an unchanged local model installation.
Actual installed-template/runtime compatibility must be verified in the real
smoke stage; synthetic metadata is never proof of that compatibility.

## Durable attempts and recovery

`docs/policy-lab/runs/` holds a persistent writer lock, budget allocations keyed by
**fixture version**, and immutable run folders. Configuration changes do not reset
the budget: one three-row smoke allocation, at most two 36-row development
allocations, and one 72-row held-out allocation reserve at most 147 possible
generation attempts. Failures consume their started sample; gate skips make zero
generation calls. Reserving a sweep is deliberately conservative: interruption
does not create a new sweep allowance.

All three smoke methods must return valid completed outputs before development.
Held-out requires a finished development sweep and a committed protocol lock.
Method order cycles by case; the exact order is stored in `allocation.json`.

Each row directory is created exclusively before work starts. It retains
`started.json`, `request.json` before generation, `attempt.json` immediately
before the HTTP call, raw `response.bin` before JSON/answer validation, and
`output.json`. A directory without an output is an interrupted sample. A row
that never got a directory is missing. Raw wire bytes also survive malformed
UTF-8/JSON responses; there is no parser repair or substitute saved answer.

```powershell
py -3.14 -m tools.policy_eval.runner --stage held-out --run-id policy-v7-held --resume
```

Explicit resume completes only preallocated **never-started** rows. It cannot
retry a started row, change its configuration, or overwrite any record. Saved
allocations bind the exact source commit; resume also verifies saved protocol
bytes and executable/runtime provenance. Saved contexts have a separate content
hash and are revalidated against canonical frozen passage/document identities,
exact spans, bytes and metadata on resume. A resource/contract failure stops the current batch. Pipeline failure
records retain phase, error and observed attempt count; no automatic retry occurs.
Do not remove budget or partial-run files to obtain another attempt.

Selection telemetry retains ungated rankings, actual supplied context, exclusion
reasons and the separate corpus/query embedding timings/cache observation. Model
timings/tokens come only from returned runtime fields. Missing measurements are
null with a reason; gate skips have zero calls and null generator measurements.
`endToEndMs` adds saved selection time to runner wall time (including local
preflight and persistence); shared encoder initialization is recorded separately.
Schema/quote validity does not establish support. Every result starts with a
null assessment for separate source-support review.
