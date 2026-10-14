import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { preparePolicyCorpus } from '../src/policy/documents.js';
import { choosePolicyThreshold, eligiblePolicyCorpus, selectPolicyContext } from '../src/policy/retrieval.js';
import { baseDocuments, employee, employeeQuery, harbourEmployee, manager, replacementRestrictedCorpus, restrictedOnlySentinel, security, spyEmbedder } from './policy-fixtures.js';

describe('policy eligibility', () => {
  it('filters tenant, explicit role, inactive dates, and drafts before selection', () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    expect(eligiblePolicyCorpus(corpus, employee, '2026-10-13').passages.map((passage) => passage.id)).toEqual([
      'cedar-travel-current:1', 'cedar-travel-current:2', 'cedar-travel-current:3', 'cedar-travel-current:4', 'cedar-onboarding-current:1', 'cedar-remote-a:1', 'cedar-remote-a:2', 'cedar-remote-a:3', 'cedar-remote-a:4', 'cedar-remote-b:1', 'cedar-remote-b:2', 'cedar-remote-b:3', 'cedar-remote-b:4', 'cedar-helpdesk-current:1',
    ]);
    expect(eligiblePolicyCorpus(corpus, manager, '2026-10-13').passages.map((passage) => passage.id)).toEqual([
      'cedar-travel-current:1', 'cedar-travel-current:2', 'cedar-travel-current:3', 'cedar-travel-current:4', 'cedar-onboarding-current:1', 'cedar-remote-a:1', 'cedar-remote-a:2', 'cedar-remote-a:3', 'cedar-remote-a:4', 'cedar-remote-b:1', 'cedar-remote-b:2', 'cedar-remote-b:3', 'cedar-remote-b:4', 'cedar-helpdesk-current:1', 'cedar-escalation-current:1',
    ]);
    expect(eligiblePolicyCorpus(corpus, security, '2026-10-13').passages.map((passage) => passage.id)).toEqual([
      'cedar-travel-current:1', 'cedar-travel-current:2', 'cedar-travel-current:3', 'cedar-travel-current:4', 'cedar-export-current:1', 'cedar-onboarding-current:1', 'cedar-remote-a:1', 'cedar-remote-a:2', 'cedar-remote-a:3', 'cedar-remote-a:4', 'cedar-remote-b:1', 'cedar-remote-b:2', 'cedar-remote-b:3', 'cedar-remote-b:4', 'cedar-helpdesk-current:1',
    ]);
    expect(eligiblePolicyCorpus(corpus, harbourEmployee, '2026-10-13').passages.map((passage) => passage.id)).toEqual([
      'harbour-travel-current:1', 'harbour-onboarding-current:1',
    ]);
  });

  it('never revives an obsolete rule after its restricted replacement is filtered', () => {
    const corpus = preparePolicyCorpus(replacementRestrictedCorpus());
    const eligible = eligiblePolicyCorpus(corpus, employee, '2026-10-13');
    expect(eligible.passages.map((passage) => passage.sourceId)).not.toContain('cedar-travel-obsolete');
    expect(eligible.passages.map((passage) => passage.sourceId)).not.toContain('cedar-travel-current');
    expect(eligible.excluded).toContainEqual({ id: 'cedar-travel-obsolete', reason: 'superseded' });
  });

  it.each([
    ['manager', ['harbour-travel-current:1', 'harbour-onboarding-current:1']],
    ['security', ['harbour-travel-current:1', 'harbour-export-current:1', 'harbour-onboarding-current:1']],
  ] as const)('checks Harbour %s access without role inheritance', (role, ids) => {
    expect(eligiblePolicyCorpus(preparePolicyCorpus(baseDocuments()), { tenant: 'harbour', role }, '2026-10-13').passages.map((p) => p.id)).toEqual(ids);
  });

  it('does not activate a future replacement edge', () => {
    const documents = replacementRestrictedCorpus();
    documents.find((doc) => doc.id === 'cedar-travel-current')!.effectiveOn = '2026-10-14';
    expect(eligiblePolicyCorpus(preparePolicyCorpus(documents), employee, '2026-10-13').passages.map((p) => p.sourceId)).toContain('cedar-travel-obsolete');
  });

  it('excludes future and expired current documents and abstains when no passage remains', async () => {
    const changed = baseDocuments().map((document) => document.id === 'cedar-onboarding-current'
      ? { ...document, effectiveOn: '2026-10-14' }
      : document.id === 'cedar-helpdesk-current' ? { ...document, expiresOn: '2026-10-12' } : document);
    const eligible = eligiblePolicyCorpus(preparePolicyCorpus(changed), employee, '2026-10-13');
    expect(eligible.excluded).toEqual(expect.arrayContaining([
      { id: 'cedar-onboarding-current', reason: 'future' }, { id: 'cedar-helpdesk-current', reason: 'expired' },
    ]));
    const empty = preparePolicyCorpus(baseDocuments().map((document) => ({ ...document, status: 'draft' as const })));
    await expect(selectPolicyContext(empty, employeeQuery, 'full-context', { threshold: 0 })).resolves.toMatchObject({ gate: 'abstain', gateReason: 'no_eligible_evidence', supplied: [] });
  });

  it('rejects a supersession edge across policy keys', () => {
    const documents = baseDocuments();
    documents.find((document) => document.id === 'cedar-travel-current')!.supersedes = ['cedar-export-current'];
    expect(() => eligiblePolicyCorpus(preparePolicyCorpus(documents), employee, '2026-10-13')).toThrow(/policy key/i);
  });

  it('retains both equal-authority current conflicts in stable source order', async () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    const row = await selectPolicyContext(corpus, employeeQuery, 'full-context', { threshold: 0 });
    expect(row.supplied.map((passage) => passage.id)).toEqual([
      'cedar-travel-current:1', 'cedar-travel-current:2', 'cedar-travel-current:3', 'cedar-travel-current:4', 'cedar-onboarding-current:1', 'cedar-remote-a:1', 'cedar-remote-a:2', 'cedar-remote-a:3', 'cedar-remote-a:4', 'cedar-remote-b:1', 'cedar-remote-b:2', 'cedar-remote-b:3', 'cedar-remote-b:4', 'cedar-helpdesk-current:1',
    ]);
    expect(row.ranked).toEqual([]);
    expect(row.gate).toBe('pass');
  });
});

describe('policy context methods', () => {
  it.each(['lexical', 'semantic'] as const)('breaks %s score ties by the original source order', async (method) => {
    const documents = baseDocuments();
    const corpus = preparePolicyCorpus([documents[0]!, documents[3]!].map((document) => ({ ...document, supersedes: [], text: 'Equal policy text.' })));
    const row = await selectPolicyContext(corpus, { ...employeeQuery, query: 'policy' }, method, { threshold: 0, embedder: spyEmbedder([[1], [1], [1]]).embedder });
    expect(row.ranked.map((hit) => hit.id)).toEqual(['cedar-travel-current:1', 'cedar-onboarding-current:1']);
  });
  it('passes only eligible text to semantic embedding and supplied context', async () => {
    const corpus = preparePolicyCorpus(replacementRestrictedCorpus());
    const spy = spyEmbedder(Array.from({ length: 32 }, (_value, index) => [index === 0 ? 1 : 0]));
    const row = await selectPolicyContext(corpus, employeeQuery, 'semantic', { threshold: 0, embedder: spy.embedder });
    expect(spy.seen.flat().join('\n')).not.toContain(restrictedOnlySentinel);
    expect(row.supplied.every((passage) => passage.tenant === 'cedar' && passage.allowedRoles.includes('employee'))).toBe(true);
  });

  it('reuses only same eligible-source embeddings within a supplied invocation cache', async () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    const spy = spyEmbedder(Array.from({ length: 64 }, (_value, index) => [index === 0 ? 1 : 0]));
    const cache = new Map();
    await selectPolicyContext(corpus, employeeQuery, 'semantic', { threshold: 0, embedder: spy.embedder, embeddingCache: cache });
    await selectPolicyContext(corpus, { ...employeeQuery, query: 'Cedar onboarding' }, 'semantic', { threshold: 0, embedder: spy.embedder, embeddingCache: cache });
    expect(spy.seen).toHaveLength(3);
    expect(spy.seen[2]).toEqual(['Cedar onboarding']);
  });

  it('limits lexical context to three positive ranked passages and abstains without a hit', async () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    const selected = await selectPolicyContext(corpus, { ...employeeQuery, query: 'remote schedule approval' }, 'lexical', { threshold: 99 });
    expect(selected.supplied).toHaveLength(3);
    expect(selected.ranked.every((item) => item.score > 0)).toBe(true);
    expect((await selectPolicyContext(corpus, { ...employeeQuery, query: 'zxqv' }, 'lexical', { threshold: 0 })).gate).toBe('abstain');
  });

  it('retains ungated lexical ranking when no passage is accepted as context', async () => {
    const documents = baseDocuments();
    const corpus = preparePolicyCorpus([documents[0]!].map((document) => ({ ...document, supersedes: [], text: 'Rail travel guidance.' })));
    const row = await selectPolicyContext(corpus, { ...employeeQuery, query: 'zxqv' }, 'lexical', { threshold: 0 });
    expect(row.ranked).toEqual([{ id: 'cedar-travel-current:1', score: 0 }]);
    expect(row.supplied).toEqual([]);
    expect(row.gate).toBe('abstain');
  });

  it('invalidates cached vectors when exact eligible source text changes under the same IDs', async () => {
    const documents = baseDocuments();
    const spy = spyEmbedder(Array.from({ length: 64 }, () => [1]));
    const cache = new Map();
    await selectPolicyContext(preparePolicyCorpus(documents), employeeQuery, 'semantic', { threshold: 0, embedder: spy.embedder, embeddingCache: cache });
    documents[0]!.text += ' A changed fixture sentence.';
    const changed = preparePolicyCorpus(documents);
    await selectPolicyContext(changed, employeeQuery, 'semantic', { threshold: 0, embedder: spy.embedder, embeddingCache: cache });
    expect(spy.seen.at(-2)).toContain(changed.passages[3]!.text);
    expect(spy.seen.at(-2)!.length).toBeGreaterThan(1);
  });

  it('separates corpus and query embedding time and records cold versus cached selection', async () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    const embedder = {
      async embed(texts: string[]) { return { vectors: texts.map(() => [1]), tokenCounts: texts.map(() => 3), elapsedMs: texts.length > 1 ? 7 : 3 }; },
      async dispose() {},
    };
    const options = { threshold: 0, embedder, embeddingCache: new Map() };
    const cold = await selectPolicyContext(corpus, employeeQuery, 'semantic', options);
    const warm = await selectPolicyContext(corpus, employeeQuery, 'semantic', options);
    expect(cold).toMatchObject({ embeddingCacheHit: false, timings: { corpusEmbeddingMs: 7, queryEmbeddingMs: 3, embeddingMs: 10 } });
    expect(warm).toMatchObject({ embeddingCacheHit: true, timings: { corpusEmbeddingMs: null, queryEmbeddingMs: 3, embeddingMs: 3 } });
    expect(cold.timings.selectionMs).toBeGreaterThanOrEqual(0);
    expect(warm.ranked).toEqual(cold.ranked);
    const lexical = await selectPolicyContext(corpus, employeeQuery, 'lexical', options);
    expect(lexical).toMatchObject({ embeddingCacheHit: null, timings: { corpusEmbeddingMs: null, queryEmbeddingMs: null, embeddingMs: null } });
  });

  it('rejects scorer fields and invalid query values at the selection boundary', async () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    for (const input of [{ ...employeeQuery, answerable: true }, { ...employeeQuery, caseId: 'gold-shortcut' }, { ...employeeQuery, query: '' }, { ...employeeQuery, query: 42 }]) {
      await expect(selectPolicyContext(corpus, input as never, 'full-context', { threshold: 0 })).rejects.toThrow(/query input/i);
    }
  });

  it('rejects unknown selectors and principals before any embedding', async () => {
    const corpus = preparePolicyCorpus(baseDocuments());
    await expect(selectPolicyContext(corpus, employeeQuery, 'unknown' as never, { threshold: 0 })).rejects.toThrow(/method/i);
    await expect(selectPolicyContext(corpus, { ...employeeQuery, principal: { tenant: 'cedar', role: 'intern' } as never }, 'semantic', { threshold: 0, embedder: spyEmbedder([[1]]).embedder })).rejects.toThrow(/principal/i);
  });
});

describe('semantic calibration', () => {
  it('breaks equally accurate calibration ties toward the higher threshold', () => {
    expect(choosePolicyThreshold([{ topScore: 0.2, hasEvidence: true }, { topScore: 0.2, hasEvidence: false }])).toMatchObject({ threshold: 0.20000000000000007, balancedAccuracy: 0.5 });
  });

  it('uses all-accept and all-abstain boundaries and treats conflict evidence as present', () => {
    const result = choosePolicyThreshold([{ topScore: 0.4, hasEvidence: true }, { topScore: 0.1, hasEvidence: false }, { topScore: 0.3, hasEvidence: true }]);
    expect(result.candidates.every(Number.isFinite)).toBe(true);
    expect(Math.min(...result.candidates)).toBeLessThan(0.1);
    expect(Math.max(...result.candidates)).toBeGreaterThan(0.4);
    expect(result.threshold).toBe(0.3);
    expect(() => choosePolicyThreshold([{ topScore: null, hasEvidence: false }])).toThrow(/both.*classes/i);
  });
});

describe('policy CLI contract', () => {
  const invoke = (payload: unknown) => new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/prepare-policy-contexts.mjs'], { cwd: process.cwd(), stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stderr }));
    child.stdin.end(JSON.stringify(payload));
  });

  const request = () => ({ schemaVersion: 1, fixtureHash: 'f'.repeat(64), documents: baseDocuments(), cases: [{ caseId: 'deterministic-case', input: employeeQuery }], threshold: 0 });

  it('rejects more than 2 MiB of stdin before loading any encoder', async () => {
    const result = await invoke({ unexpected: 'x'.repeat(2 * 1024 * 1024) });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/2 MiB/i);
  });

  it.each(['answerable', 'relevantIds'])('rejects scorer-only %s before attempting model loading', async (forbidden) => {
    const payload = request() as Record<string, unknown>;
    (payload.cases as Record<string, unknown>[])[0]![forbidden] = forbidden === 'answerable' ? true : ['cedar-travel-current:1'];
    const result = await invoke(payload);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(new RegExp(`unexpected.*${forbidden}`, 'i'));
    expect(result.stderr).not.toMatch(/loading.*MiniLM/i);
  });
});
