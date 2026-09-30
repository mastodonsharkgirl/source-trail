import { describe, expect, it } from 'vitest';
import { lexicalSearch, rankVectors } from '../src/lib/ranking.js';
import type { Corpus, Passage } from '../src/lib/sources.js';

const passages: Passage[] = [
  { id: 'camera:1', sourceId: 'camera', title: 'Camera', version: 'v1', text: 'Report damaged camera to the equipment coordinator.' },
  { id: 'room:1', sourceId: 'room', title: 'Room', version: 'v1', text: 'Cancel a room booking before noon.' },
];
const corpus: Corpus = { revision: 'fixture-v1', passages };

describe('ranking', () => {
  it('ranks lexical overlap before unmatched passages', () => {
    expect(lexicalSearch(corpus, 'damaged camera')[0]?.id).toBe('camera:1');
  });

  it('ranks normalized cosine vectors descending', () => {
    expect(rankVectors(passages, [[1, 0], [0, 1]], [0.9, 0.1])[0]?.id).toBe('camera:1');
  });

  it('rejects vectors with inconsistent dimensions', () => {
    expect(() => rankVectors(passages, [[1, 0], [1]], [1, 0])).toThrow(/dimension/i);
  });
});
