import { describe, expect, it } from 'vitest';
import { validateSources } from '../src/lib/sources.js';

const source = { id: 'camera', title: 'Camera', version: 'v1', text: 'First passage.\n\nSecond passage.' };

describe('validateSources', () => {
  it('creates stable passage identifiers from source id and paragraph order', () => {
    const corpus = validateSources([source]);
    expect(corpus.passages.map((passage) => passage.id)).toEqual(['camera:1', 'camera:2']);
  });

  it('rejects malformed note metadata with a useful reason', () => {
    expect(() => validateSources([{ ...source, id: 'bad id' }])).toThrow(/id/i);
  });

  it('rejects source packs over the UTF-8 byte limit', () => {
    expect(() => validateSources([{ ...source, text: 'a'.repeat(16_385) }])).toThrow(/16 KB/i);
  });
});
