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

  it('counts multibyte metadata and rejects an oversized title', () => {
    expect(() => validateSources([{ ...source, title: '😀'.repeat(65) }])).toThrow(/title.*UTF-8/i);
    expect(validateSources([{ ...source, title: 'é'.repeat(128) }]).passages[0]?.title).toHaveLength(128);
  });

  it('rejects an oversized version', () => {
    expect(() => validateSources([{ ...source, version: 'v'.repeat(129) }])).toThrow(/version.*UTF-8/i);
  });

  it('accepts exact note, passage, and UTF-8 boundaries', () => {
    const notes = Array.from({ length: 12 }, (_, index) => ({ id: `note-${index}`, title: 'T', version: 'v', text: 'a\n\nb' }));
    expect(validateSources(notes).passages).toHaveLength(24);
    expect(validateSources([{ ...source, text: 'a'.repeat(16_384) }]).passages).toHaveLength(1);
  });

  it('rejects one note or passage beyond the stated bounds', () => {
    const notes = Array.from({ length: 13 }, (_, index) => ({ id: `note-${index}`, title: 'T', version: 'v', text: 'a' }));
    expect(() => validateSources(notes)).toThrow(/12 source notes/i);
    expect(() => validateSources(Array.from({ length: 12 }, (_, index) => ({ id: `note-${index}`, title: 'T', version: 'v', text: 'a\n\nb\n\nc' })))).toThrow(/at most 24/i);
  });
});
