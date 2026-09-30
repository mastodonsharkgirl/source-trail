# Reproducible evaluation

Run `npm run prepare-model && npm run evaluate`. The generated
`src/data/evaluation.json` contains raw per-query rankings, actual tokenizer
counts, and semantic and lexical measurements. The semantic threshold is chosen
only from frozen calibration rows; held-out labels are excluded from selection.
`ungatedRecallAt3` and `ungatedMrrFirstRelevantFullRanking` describe ranking
quality before that threshold is applied. `answerableAccepted` and
`answerableAbstained` describe what a thresholded visitor search would receive;
they must be displayed beside the ungated metrics. Recall@3 averages each
answerable query's fraction of labelled relevant passages within its top three;
MRR uses the first relevant passage in the full ranking. No-answer held-out
queries sit outside those denominators and are reported as above-threshold false
positives or abstentions.

The evaluator imports the production source-validation and ranking functions,
asserts the frozen fixture SHA-256 before inference, and provides
`npm run evaluate -- --check` for CI drift detection. That comparison excludes
machine-specific model load timing.

This Task 1 measurement runs actual Transformers.js inference in Node CPU. It
does not stand in for the required browser ONNX WASM release measurement, which
Task 2 must run and report separately.
