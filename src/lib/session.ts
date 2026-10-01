import fixture from "../../docs/superpowers/specs/source-trail-fixture.json";
import evaluation from "../data/evaluation.json";
import manifest from "../../public/models/manifest.json";
import type { RankedPassage } from "./ranking";
import {
  MODEL_DTYPE,
  MODEL_ID,
  MODEL_REVISION,
  POOLING,
  VECTOR_DIMENSIONS,
  type SourceNote,
} from "./sources";

export const defaultNotes = (): SourceNote[] =>
  fixture.sources.map((note) => ({ ...note }));
export const SEMANTIC_THRESHOLD = evaluation.measurement.threshold;
export function searchRecord(
  query: string,
  revision: string,
  results: RankedPassage[],
  method: "semantic" | "lexical",
) {
  return {
    format: "source-trail-search-v1",
    query,
    corpusRevision: revision,
    method,
    threshold: method === "semantic" ? SEMANTIC_THRESHOLD : 0,
    accepted:
      results.length > 0 &&
      (method === "semantic"
        ? results[0]!.score >= SEMANTIC_THRESHOLD
        : results[0]!.score > 0),
    notice:
      "Exact retrieved passages. Similarity is not factual confidence. This record includes your question and quoted notes.",
    model:
      method === "semantic"
        ? {
            id: MODEL_ID,
            revision: MODEL_REVISION,
            dtype: MODEL_DTYPE,
            pooling: POOLING,
            normalized: true,
            dimensions: VECTOR_DIMENSIONS,
            runtime:
              "@huggingface/transformers 4.3.0; ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0; single-thread WASM",
            tokenizerLimit: 512,
            embeddingBatchStrategy: evaluation.method.embeddingBatchStrategy,
            assets: manifest.assets,
          }
        : null,
    results: results.slice(0, 3),
  };
}
