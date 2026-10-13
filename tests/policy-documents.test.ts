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
    ['duplicate document IDs', (documents: any[]) => documents.map((document, index) => index === 2 ? { ...documents[0] } : document)],
    ['unknown roles', (documents: any[]) => [{ ...documents[0], allowedRoles: ['intern'] }, ...documents.slice(1)]],
    ['invalid effective dates', (documents: any[]) => [{ ...documents[0], effectiveOn: '2026-02-30' }, ...documents.slice(1)]],
    ['cross-tenant supersession', (documents: any[]) => [{ ...documents[0], supersedes: ['harbour-travel-current'] }, ...documents.slice(1)]],
    ['more than twelve documents', (documents: any[]) => [...documents, { ...documents[0], id: 'cedar-extra-policy' }]],
    ['more than twenty-four passages', (documents: any[]) => documents.map((document, index) => index === 0 ? { ...document, text: Array.from({ length: 14 }, () => 'A bounded policy passage.').join('\n\n') } : document)],
    ['more than sixteen KiB of text', (documents: any[]) => [{ ...documents[0], text: 'é'.repeat(8_193) }, ...documents.slice(1)]],
  ])('rejects %s', (_name, mutate) => {
    const attempt = () => preparePolicyCorpus(mutate(baseDocuments()));
    if (_name === 'duplicate document IDs') expect(attempt).toThrow(/repeats the id/i);
    else expect(attempt).toThrow();
  });

  it('rejects cyclic supersession and unavailable gold references', () => {
    const documents = baseDocuments();
    documents[0]!.supersedes = ['cedar-travel-obsolete'];
    documents[1]!.supersedes = ['cedar-travel-current'];
    expect(() => preparePolicyCorpus(documents)).toThrow(/cycle/i);

    const malformed = structuredClone(fixture);
    malformed.heldOut[0]!.relevantIds = ['cedar-export-current:1'];
    expect(() => validateFixture(malformed)).toThrow(/available|relevant/i);

    const nonexistent = structuredClone(fixture);
    nonexistent.heldOut[0]!.relevantIds = ['cedar-travel-current:99'];
    expect(() => validateFixture(nonexistent)).toThrow(/available|relevant/i);
  });

  it('rejects a fixture whose frozen split no longer has the approved group counts', () => {
    const malformed = structuredClone(fixture);
    malformed.heldOut[0] = { ...malformed.heldOut[0]!, group: 'conflict', answerable: false, expectedReason: 'conflicting_evidence', relevantIds: ['cedar-remote-a:1', 'cedar-remote-b:1'], requiredFacts: ['Cedar remote work A allows two days.', 'Cedar remote work B allows three days.'] };
    expect(() => validateFixture(malformed)).toThrow(/held-out.*approved group counts/i);
  });

  it('rejects malformed rubric strings, date drift, split-family overlap, and incoherent dispositions', () => {
    const malformedRubric = structuredClone(fixture);
    malformedRubric.heldOut[0]!.requiredFacts = [42 as any];
    expect(() => validateFixture(malformedRubric)).toThrow(/rubric/i);

    const dateDrift = structuredClone(fixture);
    dateDrift.heldOut[0]!.input.asOf = '2026-10-14';
    expect(() => validateFixture(dateDrift)).toThrow(/2026-10-13/i);

    const familyOverlap = structuredClone(fixture);
    familyOverlap.heldOut[0]!.intentFamily = familyOverlap.development[0]!.intentFamily;
    expect(() => validateFixture(familyOverlap)).toThrow(/intent family/i);

    const incoherent = structuredClone(fixture);
    incoherent.heldOut[0]!.expectedReason = 'missing_evidence';
    expect(() => validateFixture(incoherent)).toThrow(/answerable.*supported/i);
  });

  it('returns deeply frozen provenance and exact UTF-8 document hashes', () => {
    const corpus = preparePolicyCorpus(withRepeatedUnicodeText());
    expect(corpus.passages[0]!.documentSha256).toBe('431729d6f6d6fe1d17281cbcf8b77170d52ef555207dd5fa010e8b231bc81ba2');
    expect(Object.isFrozen(corpus.documents[0]!)).toBe(true);
    expect(Object.isFrozen(corpus.documents[0]!.allowedRoles)).toBe(true);
    expect(Object.isFrozen(corpus.passages[0]!.supersedes)).toBe(true);
    expect(() => { (corpus.documents[0] as any).text = 'changed'; }).toThrow();
    expect(() => { (corpus.documents[0]!.allowedRoles as any).push('intern'); }).toThrow();

    const frozen = validateFixture(fixture);
    expect(Object.isFrozen(frozen.heldOut[0]!.input.principal)).toBe(true);
    expect(() => { (frozen.heldOut[0]!.requiredFacts as any).push('changed'); }).toThrow();
  });

  it('pins each held-out conflict to a distinct incompatible source pair', () => {
    const cases = new Map(validateFixture(fixture).heldOut.map((policyCase) => [policyCase.caseId, policyCase]));
    const passages = new Map(preparePolicyCorpus(fixture.documents).passages.map((passage) => [passage.id, passage.text]));
    const expectations = [
      ['held-remote-days', ['cedar-remote-a:2', 'cedar-remote-b:2'], ['Only a manager records the schedule.', 'Only a security reviewer records the schedule.']],
      ['held-remote-manager', ['cedar-remote-a:3', 'cedar-remote-b:3'], ['A manager email is required as the approval record before the first remote day.', 'a manager email is not accepted.']],
      ['held-remote-security', ['cedar-remote-a:4', 'cedar-remote-b:4'], ['Only a manager approves an ordinary remote schedule.', 'A manager or security reviewer may approve an ordinary remote schedule.']],
      ['held-remote-status', ['cedar-remote-a:4', 'cedar-remote-b:4'], ['Only a security reviewer approves an emergency schedule change.', 'Only a manager approves an emergency schedule change.']],
    ] as const;
    for (const [caseId, ids, quotes] of expectations) {
      expect(cases.get(caseId)?.relevantIds).toEqual(ids);
      expect(cases.get(caseId)?.answerable).toBe(false);
      expect(cases.get(caseId)?.expectedReason).toBe('conflicting_evidence');
      expect(passages.get(ids[0])).toContain(quotes[0]);
      expect(passages.get(ids[1])).toContain(quotes[1]);
    }
  });
});
