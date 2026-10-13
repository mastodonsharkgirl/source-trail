import fixture from '../docs/policy-lab/fixture.json';
import type { PolicyDocument } from '../src/policy/types.js';

export const baseDocuments = (): PolicyDocument[] => structuredClone(fixture.documents) as PolicyDocument[];

export const withRepeatedUnicodeText = (): PolicyDocument[] => [{
  ...baseDocuments()[0]!,
  id: 'cedar-unicode-current',
  supersedes: [],
  text: 'Ångström guidance repeats.\r\n\r\nÅngström guidance repeats.',
}];

export const developmentRequests = fixture.development;
export const heldOutGoldCases = fixture.heldOut;
