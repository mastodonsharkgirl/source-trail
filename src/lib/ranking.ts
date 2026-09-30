import type { Corpus, Passage } from './sources.js';

export interface RankedPassage extends Passage {
  score: number;
  method: 'lexical' | 'semantic';
}

const terms = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function lexicalSearch(corpus: Corpus, query: string): RankedPassage[] {
  const queryTerms = new Set(terms(query));
  return corpus.passages.map((passage) => {
    const passageTerms = terms(passage.text);
    const overlap = passageTerms.filter((term) => queryTerms.has(term)).length;
    return { ...passage, score: queryTerms.size === 0 ? 0 : overlap / Math.sqrt(queryTerms.size * Math.max(1, passageTerms.length)), method: 'lexical' as const };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function rankVectors(passages: readonly Passage[], vectors: readonly (readonly number[])[], queryVector: readonly number[]): RankedPassage[] {
  if (passages.length !== vectors.length) throw new Error('Each passage needs exactly one vector.');
  if (queryVector.length === 0 || !queryVector.every(Number.isFinite)) throw new Error('Query vector must contain finite values.');
  return passages.map((passage, index) => {
    const vector = vectors[index]!;
    if (vector.length !== queryVector.length) throw new Error(`Vector dimension mismatch for passage ${passage.id}.`);
    if (!vector.every(Number.isFinite)) throw new Error(`Vector for passage ${passage.id} must contain finite values.`);
    const score = vector.reduce((sum, value, dimension) => sum + value * queryVector[dimension]!, 0);
    return { ...passage, score, method: 'semantic' as const };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
