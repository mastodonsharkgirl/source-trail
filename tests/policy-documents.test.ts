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
    expect(cases.get('held-remote-days')?.requiredFacts).toEqual(['Remote work A requires only a manager to record the schedule.', 'Remote work B requires only a security reviewer to record the schedule.']);
    expect(cases.get('held-remote-manager')?.requiredFacts).toEqual(['Remote work A requires a manager email before the first remote day.', 'Remote work B requires only a team-calendar entry and forbids a manager email.']);
    expect(cases.get('held-remote-security')?.requiredFacts).toEqual(['Remote work A permits only a manager to approve the schedule.', 'Remote work B permits a manager or security reviewer to approve the schedule.']);
    expect(cases.get('held-remote-status')?.requiredFacts).toEqual(['Only a manager may approve under remote work A.', 'Only a security reviewer may approve under remote work B.']);
    for (const id of ['held-remote-days', 'held-remote-manager', 'held-remote-security', 'held-remote-status']) {
      expect(cases.get(id)?.answerable).toBe(false);
      expect(cases.get(id)?.expectedReason).toBe('conflicting_evidence');
    }
  });
});
