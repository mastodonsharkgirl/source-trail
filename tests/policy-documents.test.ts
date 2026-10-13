import { describe, expect, it } from 'vitest';
import fixture from '../docs/policy-lab/fixture.json';
import { preparePolicyCorpus, validateFixture } from '../src/policy/documents.js';
import { baseDocuments, withRepeatedUnicodeText } from './policy-fixtures.js';

describe('policy fixture contracts', () => {
  it('freezes the approved split and dispositions', () => {
    const frozen = validateFixture(fixture);
    expect(frozen.documents).toHaveLength(12);
    expect(frozen.development).toHaveLength(12);
    expect(frozen.heldOut).toHaveLength(24);
    expect(frozen.heldOut.filter((policyCase) => policyCase.answerable)).toHaveLength(14);
    expect(new Set(frozen.development.map((policyCase) => policyCase.intentFamily))
      .intersection(new Set(frozen.heldOut.map((policyCase) => policyCase.intentFamily))).size).toBe(0);
  });

  it('retains occurrence-aware Unicode source spans', () => {
    const corpus = preparePolicyCorpus(withRepeatedUnicodeText());
    const document = corpus.documents[0]!;
    const spans = corpus.passages.filter((passage) => passage.sourceId === document.id);
    expect(spans[1]!.start).toBeGreaterThan(spans[0]!.start);
    for (const passage of spans) expect(document.text.slice(passage.start, passage.end)).toBe(passage.text);
  });

  it.each([
    ['duplicate document IDs', (documents: any[]) => [{ ...documents[0] }, { ...documents[0] }, ...documents.slice(1)]],
    ['unknown roles', (documents: any[]) => [{ ...documents[0], allowedRoles: ['intern'] }, ...documents.slice(1)]],
    ['invalid effective dates', (documents: any[]) => [{ ...documents[0], effectiveOn: '2026-02-30' }, ...documents.slice(1)]],
    ['cross-tenant supersession', (documents: any[]) => [{ ...documents[0], supersedes: ['harbour-travel-current'] }, ...documents.slice(1)]],
    ['more than twelve documents', (documents: any[]) => [...documents, { ...documents[0], id: 'cedar-extra-policy' }]],
    ['more than twenty-four passages', (documents: any[]) => documents.map((document, index) => index === 0 ? { ...document, text: Array.from({ length: 14 }, () => 'A bounded policy passage.').join('\n\n') } : document)],
    ['more than sixteen KiB of text', (documents: any[]) => [{ ...documents[0], text: 'é'.repeat(8_193) }, ...documents.slice(1)]],
  ])('rejects %s', (_name, mutate) => {
    expect(() => preparePolicyCorpus(mutate(baseDocuments()))).toThrow();
  });

  it('rejects cyclic supersession and unavailable gold references', () => {
    const documents = baseDocuments();
    documents[0]!.supersedes = ['cedar-travel-obsolete'];
    documents[1]!.supersedes = ['cedar-travel-current'];
    expect(() => preparePolicyCorpus(documents)).toThrow(/cycle/i);

    const malformed = structuredClone(fixture);
    malformed.heldOut[0]!.relevantIds = ['cedar-export-current:1'];
    expect(() => validateFixture(malformed)).toThrow(/available|relevant/i);
  });

  it('rejects a fixture whose frozen split no longer has the approved group counts', () => {
    const malformed = structuredClone(fixture);
    malformed.heldOut[0]!.group = 'conflict';
    expect(() => validateFixture(malformed)).toThrow(/held-out.*approved group counts/i);
  });
});
