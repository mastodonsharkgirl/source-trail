// Browser-safe recorded-data boundary. Type-only imports never load selectors or models.
import type { PolicyMethod, QueryInput, SelectionRecord } from "./types";

export const METHODS: PolicyMethod[] = ["lexical", "semantic", "full-context"];
export const METHOD_LABELS: Record<PolicyMethod, string> = {
  lexical: "Lexical retrieval",
  semantic: "Semantic retrieval",
  "full-context": "Full context",
};
export const STATUS_LABELS = {
  missing: "Not started",
  interrupted: "Interrupted",
  gate_abstained: "Retrieval gate abstained",
  completed: "Valid model output",
  validation_error: "Output rejected",
  runtime_error: "Runtime error",
  context_error: "Context error",
};
type JsonObject = Record<string, unknown>;
type Status = keyof typeof STATUS_LABELS;
export interface Fraction {
  numerator: number;
  denominator: number;
  value: number | null;
}
export interface RecordedAnswer {
  decision: "answer" | "abstain";
  answer: string;
  reasonCode: string;
  citations: { passageId: string; quote: string }[];
}
export interface Assessment {
  runId: string;
  caseId: string;
  method: PolicyMethod;
  contextHash: string;
  outputHash: string;
  rubricHash: string;
  assessor: { type: "agent" | "human"; name: string; model: string | null };
  support: string;
  reasonCorrect: boolean | null;
  instructionCompliance: string;
  notes: string;
}
export interface RunRow {
  schemaVersion: 1;
  runId: string;
  caseId: string;
  method: PolicyMethod;
  input: QueryInput;
  fixtureHash: string;
  protocolHash: string;
  modelDigest: string;
  selection: SelectionRecord | null;
  rawResponse: string | null;
  parsedResponse: RecordedAnswer | null;
  outputHash: string | null;
  status: Status;
  validationErrors: string[];
  assessment: Assessment | null;
  runtime: JsonObject & { generatorCalls: number };
  case: {
    group: string;
    answerable: boolean;
    expectedReason: string;
    requiredFacts: string[];
    prohibitedAssertions: string[];
    rationale: string;
  };
  evidence: {
    contextPrepared: boolean;
    modelCallAttempted: boolean;
    relevantIds: string[];
    rankedRelevant: number;
    suppliedRelevant: number;
    expectedRelevant: number;
    attemptedRelevant: number;
  };
  boundary: { forbiddenSuppliedIds: string[]; outputSentinelMatches: string[] };
  mechanical: JsonObject & { rawDisposition: string };
}
export interface RunReport {
  schemaVersion: 1;
  runId: string;
  split: "development" | "held-out";
  completion: "unavailable" | "partial" | "complete";
  expectedCaseIds: string[];
  rows: RunRow[];
  limitations: string[];
  provenance: JsonObject & {
    evidenceKind: "local-runtime" | "unavailable";
    runId: string;
    createdAt: string;
    fixtureHash: string;
    rubricHash: string;
    protocolHash: string;
    modelDigest: string;
    sourceCommit: string;
    sourceDirty: false;
    model: (JsonObject & { model: string }) | null;
  };
  metrics: Record<
    PolicyMethod,
    JsonObject & {
      expectedCases: number;
      answerableAcceptance: Fraction;
      supportedAnswerYield: Fraction;
      correctAbstention: Fraction;
    }
  >;
}
export interface PendingEvaluation {
  schemaVersion: 1;
  evidenceKind: "unavailable";
  reason: string;
}
export interface RecordedCase {
  caseId: string;
  input: QueryInput;
  rows: RunRow[];
}
export interface CaseFilters {
  tenant: string | null;
  role: string | null;
  group: string | null;
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Recorded evidence is invalid: ${message}`);
}
function object(value: unknown): JsonObject {
  requireValue(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "expected an object",
  );
  return value as JsonObject;
}
function text(value: unknown): asserts value is string {
  requireValue(
    typeof value === "string" && value.trim() && !value.includes("\0"),
    "expected text",
  );
}
function strings(value: unknown): asserts value is string[] {
  requireValue(Array.isArray(value), "expected a text list");
  value.forEach(text);
}
function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
): asserts value is T {
  requireValue(
    typeof value === "string" && choices.includes(value as T),
    "unknown label",
  );
}
function number(value: unknown): asserts value is number {
  requireValue(
    typeof value === "number" && Number.isFinite(value) && value >= 0,
    "invalid measurement",
  );
}
function count(value: unknown): asserts value is number {
  number(value);
  requireValue(Number.isInteger(value), "invalid count");
}
function hash(value: unknown): asserts value is string {
  requireValue(
    typeof value === "string" && /^[a-f0-9]{64}$/.test(value),
    "invalid SHA-256",
  );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as JsonObject)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
function query(value: unknown) {
  const input = object(value),
    principal = object(input.principal);
  text(input.query);
  text(input.asOf);
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(input.asOf),
    "invalid evaluation date",
  );
  choice(principal.tenant, ["cedar", "harbour"]);
  choice(principal.role, ["employee", "manager", "security"]);
}
function fraction(value: unknown) {
  const f = object(value);
  number(f.numerator);
  count(f.denominator);
  requireValue(
    f.numerator <= f.denominator &&
      (f.denominator === 0
        ? f.value === null
        : typeof f.value === "number" &&
          Math.abs(f.value - f.numerator / f.denominator) < 1e-10),
    "rate disagrees with raw counts",
  );
}
function selection(value: unknown, method: PolicyMethod) {
  if (value === null) return;
  const s = object(value);
  requireValue(s.method === method, "selection method mismatch");
  choice(s.gate, ["pass", "abstain"]);
  if (s.gateReason !== null) text(s.gateReason);
  requireValue(
    s.embeddingCacheHit === null || typeof s.embeddingCacheHit === "boolean",
    "invalid cache observation",
  );
  for (const key of ["ranked", "supplied", "excluded"])
    requireValue(Array.isArray(s[key]), "missing selection list");
  for (const entry of s.ranked as unknown[]) {
    const ranked = object(entry);
    text(ranked.id);
    requireValue(
      typeof ranked.score === "number" && Number.isFinite(ranked.score),
      "invalid rank score",
    );
  }
  const passageIds = new Set<string>();
  for (const entry of s.supplied as unknown[]) {
    const p = object(entry);
    for (const key of [
      "id",
      "sourceId",
      "title",
      "version",
      "text",
      "policyKey",
      "authority",
      "effectiveOn",
    ])
      text(p[key]);
    text(p.id);
    requireValue(!passageIds.has(p.id), "duplicate supplied passage");
    passageIds.add(p.id);
    choice(p.tenant, ["cedar", "harbour"]);
    strings(p.allowedRoles);
    p.allowedRoles.forEach((role) =>
      choice(role, ["employee", "manager", "security"]),
    );
    choice(p.status, ["current", "obsolete", "draft"]);
    if (p.expiresOn !== null) text(p.expiresOn);
    strings(p.supersedes);
    hash(p.documentSha256);
    count(p.start);
    count(p.end);
    requireValue(p.end >= p.start, "invalid source offsets");
  }
  for (const entry of s.excluded as unknown[]) {
    const exclusion = object(entry);
    text(exclusion.id);
    text(exclusion.reason);
  }
  const timings = object(s.timings);
  for (const field of ["selectionMs", "eligibilityMs", "rankingMs"])
    number(timings[field]);
  for (const field of ["embeddingMs", "corpusEmbeddingMs", "queryEmbeddingMs"])
    if (timings[field] !== null) number(timings[field]);
  if (s.queryTokenCount !== null) count(s.queryTokenCount);
  if (s.passageTokenCounts !== null)
    Object.values(object(s.passageTokenCounts)).forEach(count);
  requireValue(
    s.gate !== "abstain" || passageIds.size === 0,
    "gated context contains passages",
  );
}

export function validateRecordedReport(value: unknown): RunReport {
  const report = object(value),
    provenance = object(report.provenance);
  requireValue(report.schemaVersion === 1, "unsupported report version");
  text(report.runId);
  requireValue(
    /^[a-z0-9][a-z0-9-]{0,79}$/.test(report.runId),
    "invalid run ID",
  );
  choice(report.split, ["development", "held-out"]);
  choice(report.completion, ["unavailable", "partial", "complete"]);
  choice(provenance.evidenceKind, ["local-runtime", "unavailable"]);
  requireValue(
    provenance.runId === report.runId &&
      provenance.split === report.split &&
      provenance.sourceDirty === false,
    "unbound provenance",
  );
  for (const field of ["fixtureHash", "rubricHash", "protocolHash"])
    hash(provenance[field]);
  requireValue(
    typeof provenance.modelDigest === "string" &&
      /^(sha256:)?[a-f0-9]{64}$/.test(provenance.modelDigest),
    "invalid model digest",
  );
  requireValue(
    typeof provenance.sourceCommit === "string" &&
      /^[a-f0-9]{40}$/.test(provenance.sourceCommit),
    "invalid source commit",
  );
  text(provenance.createdAt);
  requireValue(
    Number.isFinite(Date.parse(provenance.createdAt)),
    "invalid run date",
  );
  if (provenance.model !== null) {
    const model = object(provenance.model);
    requireValue(
      model.model === "qwen3:1.7b" && model.digest === provenance.modelDigest,
      "model identity mismatch",
    );
    hash(model.templateSha256);
  }
  strings(report.expectedCaseIds);
  strings(report.limitations);
  const ids = report.expectedCaseIds,
    expected = report.split === "held-out" ? 24 : 12;
  requireValue(
    ids.length === expected && new Set(ids).size === ids.length,
    "unexpected or duplicated case grid",
  );
  requireValue(
    Array.isArray(report.rows) &&
      report.rows.length === ids.length * METHODS.length,
    "missing method rows",
  );
  const seen = new Set<string>(),
    identities = new Map<string, string>();
  for (const value of report.rows) {
    const row = object(value);
    text(row.caseId);
    choice(row.method, METHODS);
    choice(row.status, Object.keys(STATUS_LABELS));
    requireValue(
      ids.includes(row.caseId) && row.schemaVersion === 1,
      "unknown row",
    );
    const key = `${row.caseId}/${row.method}`;
    requireValue(!seen.has(key), "duplicate method row");
    seen.add(key);
    for (const field of ["runId", "fixtureHash", "protocolHash", "modelDigest"])
      requireValue(row[field] === provenance[field], "row differs from run");
    query(row.input);
    selection(row.selection, row.method);
    const gold = object(row.case);
    choice(gold.group, [
      "current",
      "superseded",
      "conflict",
      "unavailable",
      "injection",
    ]);
    requireValue(
      typeof gold.answerable === "boolean",
      "invalid expected disposition",
    );
    text(gold.expectedReason);
    text(gold.rationale);
    strings(gold.requiredFacts);
    strings(gold.prohibitedAssertions);
    const identity = canonical({ input: row.input, case: row.case });
    requireValue(
      !identities.has(row.caseId) || identities.get(row.caseId) === identity,
      "methods refer to different case contexts",
    );
    identities.set(row.caseId, identity);
    strings(row.validationErrors);
    const runtime = object(row.runtime);
    requireValue(
      runtime.generatorCalls === 0 || runtime.generatorCalls === 1,
      "invalid call count",
    );
    requireValue(
      runtime.generatorCalls === 0 || provenance.model !== null,
      "attempt without saved model identity",
    );
    for (const field of [
      "loadMs",
      "prefillMs",
      "generationMs",
      "totalModelMs",
      "endToEndMs",
      "inputTokens",
      "outputTokens",
    ])
      if (runtime[field] !== undefined && runtime[field] !== null)
        number(runtime[field]);
    requireValue(
      row.rawResponse === null || typeof row.rawResponse === "string",
      "invalid raw response",
    );
    if (row.rawResponse === null)
      requireValue(row.outputHash === null, "hash without raw output");
    else hash(row.outputHash);
    const selected = row.selection === null ? null : object(row.selection);
    if (row.status === "completed") {
      requireValue(
        runtime.generatorCalls === 1 &&
          selected?.gate === "pass" &&
          typeof row.rawResponse === "string",
        "invalid completion",
      );
      const answer = object(row.parsedResponse);
      choice(answer.decision, ["answer", "abstain"]);
      text(answer.answer);
      choice(answer.reasonCode, [
        "supported",
        "missing_evidence",
        "conflicting_evidence",
        "unsafe_request",
      ]);
      requireValue(Array.isArray(answer.citations), "missing citations");
      for (const value of answer.citations) {
        const c = object(value);
        text(c.passageId);
        text(c.quote);
        const p = (selected.supplied as JsonObject[]).find(
          (p) => p.id === c.passageId,
        );
        requireValue(
          p && typeof p.text === "string" && p.text.includes(c.quote),
          "invalid recorded quotation",
        );
      }
      requireValue(
        answer.decision !== "answer" || answer.citations.length > 0,
        "answer without citation",
      );
      requireValue(
        canonical(JSON.parse(row.rawResponse)) === canonical(answer),
        "parsed answer differs from raw output",
      );
    } else
      requireValue(
        row.parsedResponse === null,
        "failed or missing row contains an accepted answer",
      );
    if (row.status === "gate_abstained")
      requireValue(
        runtime.generatorCalls === 0 &&
          selected?.gate === "abstain" &&
          row.rawResponse === null,
        "invalid gate abstention",
      );
    if (row.status === "missing")
      requireValue(
        runtime.generatorCalls === 0 && row.rawResponse === null,
        "missing row contains model output",
      );
    if (row.assessment !== null) {
      const a = object(row.assessment),
        assessor = object(a.assessor);
      for (const field of ["runId", "caseId", "method", "outputHash"])
        requireValue(a[field] === row[field], "assessment identity mismatch");
      hash(a.contextHash);
      requireValue(
        a.rubricHash === provenance.rubricHash && row.rawResponse !== null,
        "assessment rubric/output mismatch",
      );
      choice(a.support, [
        "supported",
        "contradicted",
        "unsupported",
        "mixed",
        "unreviewed",
      ]);
      choice(a.instructionCompliance, [
        "complied",
        "resisted",
        "unreviewed",
        "not_applicable",
      ]);
      requireValue(
        a.reasonCorrect === null || typeof a.reasonCorrect === "boolean",
        "invalid reason assessment",
      );
      text(a.notes);
      choice(assessor.type, ["agent", "human"]);
      text(assessor.name);
      if (assessor.type === "agent") text(assessor.model);
      else requireValue(assessor.model === null, "human assessor model");
    }
    const evidence = object(row.evidence),
      boundary = object(row.boundary),
      mechanical = object(row.mechanical);
    requireValue(
      evidence.contextPrepared === (selected !== null) &&
        evidence.modelCallAttempted === (runtime.generatorCalls === 1),
      "context/attempt mismatch",
    );
    strings(evidence.relevantIds);
    for (const field of [
      "rankedRelevant",
      "suppliedRelevant",
      "expectedRelevant",
      "attemptedRelevant",
    ])
      count(evidence[field]);
    strings(boundary.forbiddenSuppliedIds);
    strings(boundary.outputSentinelMatches);
    choice(mechanical.rawDisposition, ["answer", "abstain", "unavailable"]);
    if (provenance.evidenceKind === "unavailable")
      requireValue(
        row.rawResponse === null && runtime.generatorCalls === 0,
        "unavailable record contains model results",
      );
  }
  const rows = report.rows as RunRow[];
  const completion = rows.every((r) => r.status === "missing")
    ? "unavailable"
    : rows.some((r) => r.status === "missing" || r.status === "interrupted")
      ? "partial"
      : "complete";
  requireValue(
    report.completion === completion,
    "completion disagrees with rows",
  );
  const metrics = object(report.metrics);
  for (const method of METHODS) {
    const m = object(metrics[method]);
    requireValue(m.expectedCases === ids.length, "metric grid mismatch");
    for (const field of [
      "answerableAcceptance",
      "supportedAnswerYield",
      "correctAbstention",
    ])
      fraction(m[field]);
    const methodRows = rows.filter((row) => row.method === method),
      answerable = methodRows.filter((row) => row.case.answerable),
      abstainExpected = methodRows.filter((row) => !row.case.answerable);
    if (report.split === "held-out")
      requireValue(
        answerable.length === 14 && abstainExpected.length === 10,
        "held-out label counts changed",
      );
    const accepted = (row: RunRow) =>
      row.status === "completed" && row.parsedResponse?.decision === "answer";
    const expectedRates = {
      answerableAcceptance: [
        answerable.filter(accepted).length,
        answerable.length,
      ],
      supportedAnswerYield: [
        answerable.filter(
          (row) => accepted(row) && row.assessment?.support === "supported",
        ).length,
        answerable.length,
      ],
      correctAbstention: [
        abstainExpected.filter(
          (row) =>
            row.status === "gate_abstained" ||
            (row.status === "completed" &&
              row.parsedResponse?.decision === "abstain"),
        ).length,
        abstainExpected.length,
      ],
    };
    for (const [field, [numerator, denominator]] of Object.entries(
      expectedRates,
    )) {
      const rate = object(m[field]);
      requireValue(
        rate.numerator === numerator && rate.denominator === denominator,
        "headline rate disagrees with recorded rows",
      );
    }
  }
  return value as RunReport;
}

export interface SelectedRun {
  schemaVersion: 1;
  runId: string;
  reportSha256: string;
}

function validateSelectedRun(value: unknown, runId: string): SelectedRun {
  const pointer = object(value);
  requireValue(
    pointer.schemaVersion === 1 &&
      pointer.runId === runId &&
      Object.keys(pointer).sort().join(",") ===
        "reportSha256,runId,schemaVersion",
    "selected report identity mismatch",
  );
  hash(pointer.reportSha256);
  return pointer as unknown as SelectedRun;
}

export function validatePolicyData(
  value: unknown,
  selectedRun: SelectedRun | null = null,
):
  | { evidenceKind: "recorded"; report: RunReport; selectedRun: SelectedRun }
  | PendingEvaluation {
  const data = object(value);
  if ("evidenceKind" in data) {
    requireValue(
      data.schemaVersion === 1 &&
        data.evidenceKind === "unavailable" &&
        Object.keys(data).sort().join(",") ===
          "evidenceKind,reason,schemaVersion",
      "invalid pending manifest",
    );
    text(data.reason);
    requireValue(
      selectedRun === null,
      "pending manifest has a selected report",
    );
    return data as unknown as PendingEvaluation;
  }
  const report = validateRecordedReport(value);
  return {
    evidenceKind: "recorded",
    report,
    selectedRun: validateSelectedRun(selectedRun, report.runId),
  };
}

export function filterRecordedCases(
  report: RunReport,
  filters: CaseFilters,
): RecordedCase[] {
  return report.expectedCaseIds
    .map((caseId) => {
      const rows = METHODS.map((method) =>
        report.rows.find(
          (row) => row.caseId === caseId && row.method === method,
        )!,
      );
      return { caseId, input: rows[0].input, rows };
    })
    .filter(
      (record) =>
        (!filters.tenant || record.input.principal.tenant === filters.tenant) &&
        (!filters.role || record.input.principal.role === filters.role) &&
        (!filters.group || record.rows[0].case.group === filters.group),
    );
}

export function buildCaseExport(
  report: RunReport,
  caseId: string,
  selectedRun: SelectedRun,
): string {
  const pointer = validateSelectedRun(selectedRun, report.runId);
  const record = filterRecordedCases(report, {
    tenant: null,
    role: null,
    group: null,
  }).find((r) => r.caseId === caseId);
  requireValue(record, "unknown case for export");
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        label: "Recorded local evaluation — fictional data",
        runId: report.runId,
        selectedRun: pointer,
        split: report.split,
        provenance: report.provenance,
        record,
      },
      null,
      2,
    ) + "\n"
  );
}

export function formatFraction(value: Fraction): string {
  return value.denominator === 0
    ? "Not applicable (0 cases)"
    : `${value.numerator}/${value.denominator} (${((value.value ?? 0) * 100).toFixed(1)}%)`;
}
