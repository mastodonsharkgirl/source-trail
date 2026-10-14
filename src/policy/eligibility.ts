import type { Corpus } from '../lib/sources.js';
import type { PolicyCorpus, PolicyDocument, PolicyPassage, Principal, QueryInput } from './types.js';

export interface PolicyExclusion { id: string; reason: string; }
export interface EligiblePolicyCorpus { corpus: Corpus; passages: PolicyPassage[]; excluded: PolicyExclusion[]; }

const roles = new Set(['employee', 'manager', 'security']);
const tenants = new Set(['cedar', 'harbour']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertPrincipal(principal: Principal): void {
  if (!principal || Object.keys(principal).length !== 2 || !tenants.has(principal.tenant) || !roles.has(principal.role)) throw new Error('Unknown policy principal.');
}

export function assertPolicyQueryInput(value: unknown): asserts value is QueryInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid policy query input.');
  const input = value as QueryInput;
  if (Object.keys(input).length !== 3 || Object.keys(input).some((key) => !['query', 'principal', 'asOf'].includes(key)) || typeof input.query !== 'string' || !input.query.trim() || !validDate(input.asOf)) {
    throw new Error('Invalid policy query input; only query, principal and a valid asOf date are allowed.');
  }
  assertPrincipal(input.principal);
}

function isCurrentAt(document: PolicyDocument, asOf: string): boolean {
  return document.status === 'current' && document.effectiveOn <= asOf && (document.expiresOn === null || document.expiresOn >= asOf);
}

function supersededDocumentIds(corpus: PolicyCorpus, asOf: string): Set<string> {
  const byId = new Map(corpus.documents.map((document) => [document.id, document]));
  const superseded = new Set<string>();
  for (const replacement of corpus.documents) {
    for (const targetId of replacement.supersedes) {
      const target = byId.get(targetId);
      if (!target) throw new Error(`Document ${replacement.id} supersedes an unknown document.`);
      if (target.tenant !== replacement.tenant || target.policyKey !== replacement.policyKey) {
        throw new Error(`Document ${replacement.id} may supersede only the same tenant and policy key.`);
      }
      if (isCurrentAt(replacement, asOf)) superseded.add(targetId);
    }
  }
  return superseded;
}

export function eligiblePolicyCorpus(corpus: PolicyCorpus, principal: Principal, asOf: string): EligiblePolicyCorpus {
  assertPrincipal(principal);
  if (!validDate(asOf)) throw new Error('Policy as-of date must be a valid YYYY-MM-DD value.');
  const superseded = supersededDocumentIds(corpus, asOf);
  const allowed = new Set<string>();
  const excluded: PolicyExclusion[] = [];
  for (const document of corpus.documents) {
    let reason: string | null = null;
    if (document.tenant !== principal.tenant) reason = 'tenant';
    else if (!document.allowedRoles.includes(principal.role)) reason = 'role';
    else if (document.status !== 'current') reason = document.status;
    else if (document.effectiveOn > asOf) reason = 'future';
    else if (document.expiresOn !== null && document.expiresOn < asOf) reason = 'expired';
    else if (superseded.has(document.id)) reason = 'superseded';
    if (reason) excluded.push({ id: document.id, reason });
    else allowed.add(document.id);
  }
  const passages = corpus.passages.filter((passage) => allowed.has(passage.sourceId));
  return { corpus: { revision: corpus.revision, passages }, passages, excluded };
}
