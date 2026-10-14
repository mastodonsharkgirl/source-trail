import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { lexicalSearch, rankVectors } from '../lib/ranking.ts';
import type { PolicyCorpus, PolicyPassage, QueryInput } from './types.ts';
import { assertPolicyQueryInput, eligiblePolicyCorpus, type PolicyExclusion } from './eligibility.ts';
export { eligiblePolicyCorpus } from './eligibility.ts';
export { choosePolicyThreshold } from './calibration.ts';

export type PolicyMethod = 'lexical' | 'semantic' | 'full-context';
export interface PolicyEmbedder {
  embed(texts: string[]): Promise<{ vectors: number[][]; tokenCounts: number[]; elapsedMs: number }>;
  dispose(): Promise<void>;
}
export interface CachedPolicyEmbeddings { vectors: number[][]; tokenCounts: number[]; }
export interface SelectionRecord {
  method: PolicyMethod;
  ranked: { id: string; score: number }[];
  supplied: PolicyPassage[];
  excluded: PolicyExclusion[];
  gate: 'pass' | 'abstain';
  gateReason: string | null;
  timings: { eligibilityMs: number; rankingMs: number; embeddingMs: number | null };
  queryTokenCount: number | null;
  passageTokenCounts: Record<string, number> | null;
}

const methods = new Set<PolicyMethod>(['lexical', 'semantic', 'full-context']);
const abstained = (method: PolicyMethod, excluded: PolicyExclusion[], eligibilityMs: number, reason: string): SelectionRecord => ({
  method, ranked: [], supplied: [], excluded, gate: 'abstain', gateReason: reason,
  timings: { eligibilityMs, rankingMs: 0, embeddingMs: null }, queryTokenCount: null, passageTokenCounts: null,
});

export async function selectPolicyContext(corpus: PolicyCorpus, input: QueryInput, method: PolicyMethod, options: { threshold: number; embedder?: PolicyEmbedder; embeddingCache?: Map<string, CachedPolicyEmbeddings> }): Promise<SelectionRecord> {
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
    method, ranked: [], supplied: eligible.passages, excluded: eligible.excluded, gate: 'pass', gateReason: null,
    timings: { eligibilityMs, rankingMs: 0, embeddingMs: null }, queryTokenCount: null, passageTokenCounts: null,
  };
  if (method === 'lexical') {
    const rankingStarted = performance.now();
    const ranked = lexicalSearch(eligible.corpus, input.query).sort(stableScoreOrder).slice(0, 3);
    const accepted = ranked.filter((passage) => passage.score > 0);
    const rankingMs = performance.now() - rankingStarted;
    if (accepted.length === 0) return { ...abstained(method, eligible.excluded, eligibilityMs, 'no_positive_lexical_hit'), ranked: ranked.map(({ id, score }) => ({ id, score })), timings: { eligibilityMs, rankingMs, embeddingMs: null } };
    return {
      method, ranked: ranked.map(({ id, score }) => ({ id, score })), supplied: accepted.map(({ score: _score, method: _method, ...passage }) => passage as PolicyPassage), excluded: eligible.excluded, gate: 'pass', gateReason: null,
      timings: { eligibilityMs, rankingMs, embeddingMs: null }, queryTokenCount: null, passageTokenCounts: null,
    };
  }
  if (!options.embedder) throw new Error('Semantic policy selection requires an embedder.');
  const sourceHash = createHash('sha256').update(JSON.stringify(eligible.passages), 'utf8').digest('hex');
  const cached = options.embeddingCache?.get(sourceHash);
  const embedded = cached
    ? await options.embedder.embed([input.query])
    : await options.embedder.embed([...eligible.passages.map((passage) => passage.text), input.query]);
  const embedding = cached
    ? { vectors: [...cached.vectors, ...embedded.vectors], tokenCounts: [...cached.tokenCounts, ...embedded.tokenCounts], elapsedMs: embedded.elapsedMs }
    : embedded;
  if (embedding.vectors.length !== eligible.passages.length + 1 || embedding.tokenCounts.length !== embedding.vectors.length) throw new Error('Policy embedder returned an incomplete batch.');
  if (!cached) options.embeddingCache?.set(sourceHash, { vectors: embedding.vectors.slice(0, -1), tokenCounts: embedding.tokenCounts.slice(0, -1) });
  const queryVector = embedding.vectors.at(-1)!;
  const rankingStarted = performance.now();
  const ranked = rankVectors(eligible.passages, embedding.vectors.slice(0, -1), queryVector).sort(stableScoreOrder).slice(0, 3);
  const rankingMs = performance.now() - rankingStarted;
  const passageTokenCounts = Object.fromEntries(eligible.passages.map((passage, index) => [passage.id, embedding.tokenCounts[index]!]));
  if (!ranked[0] || ranked[0].score < options.threshold) return {
    method, ranked: ranked.map(({ id, score }) => ({ id, score })), supplied: [], excluded: eligible.excluded, gate: 'abstain', gateReason: 'semantic_threshold',
    timings: { eligibilityMs, rankingMs, embeddingMs: embedding.elapsedMs }, queryTokenCount: embedding.tokenCounts.at(-1)!, passageTokenCounts,
  };
  return {
    method, ranked: ranked.map(({ id, score }) => ({ id, score })), supplied: ranked.map(({ score: _score, method: _method, ...passage }) => passage as PolicyPassage), excluded: eligible.excluded, gate: 'pass', gateReason: null,
    timings: { eligibilityMs, rankingMs, embeddingMs: embedding.elapsedMs }, queryTokenCount: embedding.tokenCounts.at(-1)!, passageTokenCounts,
  };
}
