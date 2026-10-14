import fixture from '../docs/policy-lab/fixture.json';
import type { PolicyDocument, Principal, QueryInput } from '../src/policy/types.js';

export const baseDocuments = (): PolicyDocument[] => structuredClone(fixture.documents) as PolicyDocument[];

export const withRepeatedUnicodeText = (): PolicyDocument[] => [{
  ...baseDocuments()[0]!,
  id: 'cedar-unicode-current',
  supersedes: [],
  text: 'Ångström guidance repeats.\r\n\r\nÅngström guidance repeats.',
}];

export const developmentRequests = fixture.development;
export const heldOutGoldCases = fixture.heldOut;

export const employee: Principal = { tenant: 'cedar', role: 'employee' };
export const manager: Principal = { tenant: 'cedar', role: 'manager' };
export const security: Principal = { tenant: 'cedar', role: 'security' };
export const harbourEmployee: Principal = { tenant: 'harbour', role: 'employee' };
export const employeeQuery: QueryInput = { query: 'What is Cedar travel guidance?', principal: employee, asOf: '2026-10-13' };
export const restrictedOnlySentinel = 'SENTINEL-RESTRICTED-NEVER-EMBED';

export const replacementRestrictedCorpus = (): PolicyDocument[] => {
  const documents = baseDocuments();
  const current = documents.find((document) => document.id === 'cedar-travel-current')!;
  return documents.map((document) => document.id === current.id
    ? { ...document, allowedRoles: ['security'], text: document.text.replace('Cedar', restrictedOnlySentinel) }
    : document.id === 'cedar-travel-obsolete' ? { ...document, status: 'current' } : document);
};

export const spyEmbedder = (vectors: number[][]) => {
  const seen: string[][] = [];
  return {
    seen,
    embedder: {
      async embed(texts: string[]) {
        seen.push([...texts]);
        return { vectors: vectors.slice(0, texts.length), tokenCounts: texts.map(() => 3), elapsedMs: 1 };
      },
      async dispose() {},
    },
  };
};
