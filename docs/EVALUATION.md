# Reproducible evaluation

Run `npm run prepare-model && npm run evaluate`. The generated
`src/data/evaluation.json` contains raw per-query rankings, actual tokenizer
counts, and semantic and lexical measurements. The semantic threshold is chosen
only from frozen calibration rows; held-out labels are excluded from selection.
Recall@3 averages each answerable query's fraction of labelled relevant passages
within its top three; MRR uses the first relevant passage in the full ranking.
No-answer held-out queries sit outside those denominators and are reported as
above-threshold false positives or abstentions.

This Task 1 measurement runs actual Transformers.js inference in Node CPU. It
does not stand in for the required browser ONNX WASM release measurement, which
Task 2 must run and report separately.
