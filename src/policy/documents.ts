import { createHash } from 'node:crypto';
import { validateSources } from '../lib/sources.js';
import type { GoldCase, PolicyCorpus, PolicyDocument, PolicyFixture, PolicyPassage, Principal, Role, Tenant } from './types.js';

// This synchronous validator is intentionally Node-only. The recorded Policy Lab
// viewer reads frozen JSON and types, while CLI selection imports this module.

const tenants = new Set<Tenant>(['cedar', 'harbour']);
const roles = new Set<Role>(['employee', 'manager', 'security']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const identifier = /^[a-z0-9][a-z0-9-]{0,63}$/;
const exactDate = (value: unknown): value is string => typeof value === 'string' && datePattern.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
}

function document(value: unknown, index: number): PolicyDocument {
  object(value, `Document ${index + 1}`);
  const candidate = value as unknown as PolicyDocument;
  if (!identifier.test(candidate.id ?? '')) throw new Error(`Document ${index + 1} has an invalid id.`);
  if (!tenants.has(candidate.tenant)) throw new Error(`Document ${candidate.id} has an unknown tenant.`);
  if (!Array.isArray(candidate.allowedRoles) || candidate.allowedRoles.length === 0 || !candidate.allowedRoles.every((role) => roles.has(role))) throw new Error(`Document ${candidate.id} has an unknown or empty role allowlist.`);
  if (typeof candidate.policyKey !== 'string' || !candidate.policyKey.trim() || typeof candidate.authority !== 'string' || !candidate.authority.trim()) throw new Error(`Document ${candidate.id} needs policy metadata.`);
  if (!['current', 'obsolete', 'draft'].includes(candidate.status)) throw new Error(`Document ${candidate.id} has an invalid status.`);
  if (!exactDate(candidate.effectiveOn) || (candidate.expiresOn !== null && !exactDate(candidate.expiresOn))) throw new Error(`Document ${candidate.id} has an invalid calendar date.`);
  if (candidate.expiresOn !== null && candidate.expiresOn < candidate.effectiveOn) throw new Error(`Document ${candidate.id} expires before it becomes effective.`);
  if (!Array.isArray(candidate.supersedes) || !candidate.supersedes.every((id) => typeof id === 'string' && identifier.test(id))) throw new Error(`Document ${candidate.id} has invalid supersession metadata.`);
  return { ...candidate, allowedRoles: [...candidate.allowedRoles], supersedes: [...candidate.supersedes] };
}

function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }

export function preparePolicyCorpus(documents: unknown): PolicyCorpus {
  if (!Array.isArray(documents)) throw new Error('Policy documents must be an array.');
  const parsed = documents.map(document);
  const source = validateSources(parsed);
  const byId = new Map(parsed.map((item) => [item.id, item]));
  for (const item of parsed) for (const replaced of item.supersedes) {
    const target = byId.get(replaced);
    if (!target) throw new Error(`Document ${item.id} supersedes an unknown document.`);
    if (target.tenant !== item.tenant) throw new Error(`Document ${item.id} cannot supersede a cross-tenant document.`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('Policy supersession contains a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    byId.get(id)!.supersedes.forEach(visit);
    visiting.delete(id); visited.add(id);
  };
  parsed.forEach((item) => visit(item.id));
  const passageById = new Map(source.passages.map((passage) => [passage.id, passage]));
  const passages: PolicyPassage[] = [];
  for (const item of parsed) {
    let searchFrom = 0;
    const documentHash = sha256(item.text);
    for (let index = 1; passageById.has(`${item.id}:${index}`); index += 1) {
      const passage = passageById.get(`${item.id}:${index}`)!;
      const start = item.text.indexOf(passage.text, searchFrom);
      if (start < 0) throw new Error(`Could not locate passage ${passage.id} in its original document.`);
      const end = start + passage.text.length;
      searchFrom = end;
      passages.push(Object.freeze({ ...passage, start, end, documentSha256: documentHash, tenant: item.tenant, allowedRoles: [...item.allowedRoles], policyKey: item.policyKey, authority: item.authority, status: item.status, effectiveOn: item.effectiveOn, expiresOn: item.expiresOn, supersedes: [...item.supersedes] }));
    }
  }
  return Object.freeze({ documents: Object.freeze(parsed), passages: Object.freeze(passages), revision: `policy-${sha256(JSON.stringify(parsed)).slice(0, 12)}` });
}

function visibleTo(principal: Principal, document: PolicyDocument): boolean { return document.tenant === principal.tenant && document.allowedRoles.includes(principal.role); }
function policyCase(value: unknown, corpus: PolicyCorpus, split: string): GoldCase {
  object(value, `${split} case`);
  const candidate = value as unknown as GoldCase;
  if (!identifier.test(candidate.caseId ?? '') || typeof candidate.intentFamily !== 'string' || !candidate.intentFamily.trim()) throw new Error(`${split} case has an invalid identity.`);
  if (!['current', 'superseded', 'conflict', 'unavailable', 'injection'].includes(candidate.group) || typeof candidate.answerable !== 'boolean' || !['supported', 'missing_evidence', 'conflicting_evidence', 'unsafe_request'].includes(candidate.expectedReason)) throw new Error(`${candidate.caseId} has an invalid disposition.`);
  object(candidate.input, `${candidate.caseId} input`);
  if (typeof candidate.input.query !== 'string' || !candidate.input.query.trim() || !tenants.has(candidate.input.principal?.tenant) || !roles.has(candidate.input.principal?.role) || !exactDate(candidate.input.asOf)) throw new Error(`${candidate.caseId} has an invalid request.`);
  if (!Array.isArray(candidate.relevantIds) || !Array.isArray(candidate.requiredFacts) || !Array.isArray(candidate.prohibitedAssertions) || typeof candidate.rationale !== 'string') throw new Error(`${candidate.caseId} has an invalid rubric.`);
  const passageById = new Map(corpus.passages.map((passage) => [passage.id, passage]));
  for (const id of candidate.relevantIds) {
    const passage = passageById.get(id);
    if (!passage || !visibleTo(candidate.input.principal, passage) || passage.status !== 'current' || passage.effectiveOn > candidate.input.asOf || (passage.expiresOn !== null && passage.expiresOn < candidate.input.asOf)) throw new Error(`${candidate.caseId} references unavailable relevant evidence.`);
  }
  return structuredClone(candidate);
}

export function validateFixture(value: unknown): PolicyFixture {
  object(value, 'Policy fixture');
  const candidate = value as unknown as PolicyFixture;
  if (candidate.schemaVersion !== 1 || typeof candidate.version !== 'string' || !candidate.version.trim()) throw new Error('Policy fixture has an invalid schema version.');
  const corpus = preparePolicyCorpus(candidate.documents);
  if (!Array.isArray(candidate.development) || !Array.isArray(candidate.heldOut)) throw new Error('Policy fixture needs both frozen splits.');
  const development = candidate.development.map((item) => policyCase(item, corpus, 'Development'));
  const heldOut = candidate.heldOut.map((item) => policyCase(item, corpus, 'Held-out'));
  const countGroups = (cases: readonly GoldCase[], group: GoldCase['group']) => cases.filter((item) => item.group === group).length;
  if (development.length !== 12 || countGroups(development, 'current') !== 4 || countGroups(development, 'superseded') !== 2 || countGroups(development, 'conflict') !== 2 || countGroups(development, 'unavailable') !== 2 || countGroups(development, 'injection') !== 2) throw new Error('Development split does not have the approved group counts.');
  if (heldOut.length !== 24 || countGroups(heldOut, 'current') !== 8 || countGroups(heldOut, 'superseded') !== 4 || countGroups(heldOut, 'conflict') !== 4 || countGroups(heldOut, 'unavailable') !== 4 || countGroups(heldOut, 'injection') !== 4) throw new Error('Held-out split does not have the approved group counts.');
  if (heldOut.filter((item) => item.answerable).length !== 14) throw new Error('Held-out split must contain fourteen answerable cases.');
  const ids = [...development, ...heldOut].map((item) => item.caseId);
  if (new Set(ids).size !== ids.length) throw new Error('Policy fixture repeats a case id.');
  return Object.freeze({ schemaVersion: 1, version: candidate.version, documents: [...corpus.documents], development, heldOut });
}
