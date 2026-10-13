import type { Passage, SourceNote } from '../lib/sources.js';

export type Tenant = 'cedar' | 'harbour';
export type Role = 'employee' | 'manager' | 'security';
export type ReasonCode = 'supported' | 'missing_evidence' | 'conflicting_evidence' | 'unsafe_request';

export interface Principal { tenant: Tenant; role: Role; }
export interface QueryInput { query: string; principal: Principal; asOf: string; }

export interface PolicyDocument extends SourceNote {
  tenant: Tenant;
  allowedRoles: Role[];
  policyKey: string;
  authority: string;
  status: 'current' | 'obsolete' | 'draft';
  effectiveOn: string;
  expiresOn: string | null;
  supersedes: string[];
}

export interface PolicyPassage extends Passage {
  start: number;
  end: number;
  documentSha256: string;
  tenant: Tenant;
  allowedRoles: Role[];
  policyKey: string;
  authority: string;
  status: PolicyDocument['status'];
  effectiveOn: string;
  expiresOn: string | null;
  supersedes: string[];
}

export interface PolicyCorpus { documents: readonly PolicyDocument[]; passages: readonly PolicyPassage[]; revision: string; }

export interface GoldCase {
  caseId: string;
  input: QueryInput;
  group: 'current' | 'superseded' | 'conflict' | 'unavailable' | 'injection';
  answerable: boolean;
  relevantIds: string[];
  expectedReason: ReasonCode;
  requiredFacts: string[];
  prohibitedAssertions: string[];
  rationale: string;
  intentFamily: string;
}

export interface PolicyFixture { schemaVersion: 1; version: string; documents: PolicyDocument[]; development: GoldCase[]; heldOut: GoldCase[]; }
