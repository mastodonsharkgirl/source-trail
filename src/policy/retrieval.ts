import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { lexicalSearch, rankVectors } from '../lib/ranking.ts';
import type { PolicyCorpus, PolicyPassage, QueryInput } from './types.ts';
import type { CachedPolicyEmbeddings, PolicyEmbedder, PolicyMethod, SelectionRecord } from './types.ts';
export type { CachedPolicyEmbeddings, PolicyEmbedder, PolicyMethod, SelectionRecord } from './types.ts';
import { assertPolicyQueryInput, eligiblePolicyCorpus, type PolicyExclusion } from './eligibility.ts';
export { eligiblePolicyCorpus } from './eligibility.ts';
export { choosePolicyThreshold } from './calibration.ts';

type SelectionWork = Omit<SelectionRecord, 'timings'> & { timings: Omit<SelectionRecord['timings'], 'selectionMs'> };
type SelectionOptions = { threshold: number; embedder?: PolicyEmbedder; embeddingCache?: Map<string, CachedPolicyEmbeddings> };
const noEmbedding = { embeddingMs: null, corpusEmbeddingMs: null, queryEmbeddingMs: null };

const methods = new Set<PolicyMethod>(['lexical', 'semantic', 'full-context']);
const abstained = (method: PolicyMethod, excluded: PolicyExclusion[], eligibilityMs: number, reason: string): SelectionWork => ({
  method, ranked: [], supplied: [], excluded, gate: 'abstain', gateReason: reason,
  embeddingCacheHit: null,
  timings: { eligibilityMs, rankingMs: 0, ...noEmbedding }, queryTokenCount: null, passageTokenCounts: null,
});

export async function selectPolicyContext(corpus: PolicyCorpus, input: QueryInput, method: PolicyMethod, options: SelectionOptions): Promise<SelectionRecord> {
  const started = performance.now();
  const result = await selectContext(corpus, input, method, options);
  return { ...result, timings: { ...result.timings, selectionMs: performance.now() - started } };
}

async function selectContext(corpus: PolicyCorpus, input: QueryInput, method: PolicyMethod, options: SelectionOptions): Promise<SelectionWork> {
  if (!methods.has(method)) throw new Error('Unknown policy selection method.');
  assertPolicyQueryInput(input);
  if (!Number.isFinite(options.threshold)) throw new Error('Policy threshold must be finite.');
  const eligibilityStarted = performance.now();
  const eligible = eligiblePolicyCorpus(corpus, input.principal, input.asOf);
  const sourceOrder = new Map(eligible.passages.map((passage, index) => [passage.id, index]));
  const stableScoreOrder = (a: { id: string; score: number }, b: { id: string; score: number }) => b.score - a.score || sourceOrder.get(a.id)! - sourceOrder.get(b.id)!;
  const eligibilityMs = performance.now() - eligibilityStarted;
  if (eligible.passages.length === 0) return abstained(method, eligible.excluded, eligibilityMs, 'no_eligible_evidence');
  if (method === 'full-context') return {
    method, ranked: [], supplied: eligible.passages, excluded: eligible.excluded, gate: 'pass', gateReason: null, embeddingCacheHit: null,
    timings: { eligibilityMs, rankingMs: 0, ...noEmbedding }, queryTokenCount: null, passageTokenCounts: null,
  };
  if (method === 'lexical') {
    const rankingStarted = performance.now();
    const ranked = lexicalSearch(eligible.corpus, input.query).sort(stableScoreOrder).slice(0, 3);
    const accepted = ranked.filter((passage) => passage.score > 0);
    const rankingMs = performance.now() - rankingStarted;
    if (accepted.length === 0) return { ...abstained(method, eligible.excluded, eligibilityMs, 'no_positive_lexical_hit'), ranked: ranked.map(({ id, score }) => ({ id, score })), timings: { eligibilityMs, rankingMs, ...noEmbedding } };
    return {
      method, ranked: ranked.map(({ id, score }) => ({ id, score })), supplied: accepted.map(({ score: _score, method: _method, ...passage }) => passage as PolicyPassage), excluded: eligible.excluded, gate: 'pass', gateReason: null,
      embeddingCacheHit: null, timings: { eligibilityMs, rankingMs, ...noEmbedding }, queryTokenCount: null, passageTokenCounts: null,
    };
  }
  if (!options.embedder) throw new Error('Semantic policy selection requires an embedder.');
  const sourceHash = createHash('sha256').update(JSON.stringify(eligible.passages), 'utf8').digest('hex');
  const cached = options.embeddingCache?.get(sourceHash);
  const corpusEmbedding = cached ? null : await options.embedder.embed(eligible.passages.map((passage) => passage.text));
  const corpusVectors = cached ?? corpusEmbedding!;
  if (corpusVectors.vectors.length !== eligible.passages.length || corpusVectors.tokenCounts.length !== eligible.passages.length) throw new Error('Policy embedder returned an incomplete corpus batch.');
  const queryEmbedding = await options.embedder.embed([input.query]);
  if (queryEmbedding.vectors.length !== 1 || queryEmbedding.tokenCounts.length !== 1) throw new Error('Policy embedder returned an incomplete query batch.');
  if (!cached) options.embeddingCache?.set(sourceHash, { vectors: corpusVectors.vectors, tokenCounts: corpusVectors.tokenCounts });
  const queryVector = queryEmbedding.vectors[0]!;
  const rankingStarted = performance.now();
  const ranked = rankVectors(eligible.passages, corpusVectors.vectors, queryVector).sort(stableScoreOrder).slice(0, 3);
  const rankingMs = performance.now() - rankingStarted;
  const passageTokenCounts = Object.fromEntries(eligible.passages.map((passage, index) => [passage.id, corpusVectors.tokenCounts[index]!]));
  const timings = { eligibilityMs, rankingMs, corpusEmbeddingMs: corpusEmbedding?.elapsedMs ?? null, queryEmbeddingMs: queryEmbedding.elapsedMs, embeddingMs: (corpusEmbedding?.elapsedMs ?? 0) + queryEmbedding.elapsedMs };
  if (!ranked[0] || ranked[0].score < options.threshold) return {
    method, ranked: ranked.map(({ id, score }) => ({ id, score })), supplied: [], excluded: eligible.excluded, gate: 'abstain', gateReason: 'semantic_threshold',
    embeddingCacheHit: Boolean(cached), timings, queryTokenCount: queryEmbedding.tokenCounts[0]!, passageTokenCounts,
  };
  return {
    method, ranked: ranked.map(({ id, score }) => ({ id, score })), supplied: ranked.map(({ score: _score, method: _method, ...passage }) => passage as PolicyPassage), excluded: eligible.excluded, gate: 'pass', gateReason: null,
    embeddingCacheHit: Boolean(cached), timings, queryTokenCount: queryEmbedding.tokenCounts[0]!, passageTokenCounts,
  };
}
