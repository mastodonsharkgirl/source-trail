import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  buildCaseExport,
  filterRecordedCases,
  validateRecordedReport,
  validatePolicyData,
} from "../src/policy/viewer";
import CaseComparison from "../src/policy/CaseComparison";
import type { RunReport } from "../src/policy/viewer";

// Synthetic unit-test records only. These are never browser data or exported evidence.
function syntheticReport() {
  const input = {
    query: "<script>synthetic question</script>",
    principal: { tenant: "cedar", role: "employee" },
    asOf: "2026-10-13",
  };
  const caseIds = Array.from({ length: 12 }, (_, i) => `synthetic-${i}`);
  const fraction = { numerator: 0, denominator: 12, value: 0 };
  const methods = ["lexical", "semantic", "full-context"];
  return {
    schemaVersion: 1,
    runId: "synthetic-viewer",
    split: "development",
    completion: "unavailable",
    expectedCaseIds: caseIds,
    provenance: {
      evidenceKind: "unavailable",
      runId: "synthetic-viewer",
      split: "development",
      fixtureHash: "a".repeat(64),
      rubricHash: "b".repeat(64),
      protocolHash: "c".repeat(64),
      modelDigest: "d".repeat(64),
      sourceCommit: "e".repeat(40),
      sourceDirty: false,
      createdAt: "2026-10-15T00:00:00Z",
      model: null,
    },
    rows: caseIds.flatMap((caseId, i) =>
      methods.map((method) => ({
        schemaVersion: 1,
        runId: "synthetic-viewer",
        caseId,
        method,
        fixtureHash: "a".repeat(64),
        protocolHash: "c".repeat(64),
        modelDigest: "d".repeat(64),
        input: {
          ...input,
          principal: { tenant: i ? "harbour" : "cedar", role: "employee" },
        },
        selection: null,
        rawResponse: null,
        parsedResponse: null,
        status: "missing",
        validationErrors: ["No model run"],
        runtime: { generatorCalls: 0 },
        assessment: null,
        outputHash: null,
        case: {
          group: i ? "unavailable" : "current",
          answerable: true,
          expectedReason: "supported",
          requiredFacts: [],
          prohibitedAssertions: [],
          rationale: "Synthetic only",
        },
        evidence: {
          relevantIds: [],
          rankedRelevant: 0,
          suppliedRelevant: 0,
          expectedRelevant: 0,
          contextPrepared: false,
          modelCallAttempted: false,
          attemptedRelevant: 0,
        },
        boundary: { forbiddenSuppliedIds: [], outputSentinelMatches: [] },
        mechanical: { rawDisposition: "unavailable" },
      })),
    ),
    metrics: Object.fromEntries(
      methods.map((method) => [
        method,
        {
          expectedCases: 12,
          answerableAcceptance: fraction,
          supportedAnswerYield: fraction,
          correctAbstention: { numerator: 0, denominator: 0, value: null },
        },
      ]),
    ),
    limitations: ["Synthetic unit-test record, not measured results."],
  };
}

function syntheticCompletion(): RunReport {
  const report = validateRecordedReport(syntheticReport());
  report.provenance.evidenceKind = "local-runtime"; // Shape test only; never saved as evidence.
  report.provenance.model = {
    model: "qwen3:1.7b",
    digest: report.provenance.modelDigest,
    templateSha256: "f".repeat(64),
  };
  report.completion = "partial";
  const row = report.rows[0];
  const passage = {
    id: "synthetic-doc:1",
    sourceId: "synthetic-doc",
    title: "Synthetic source",
    version: "test",
    text: "<b>synthetic quoted text</b>",
    start: 0,
    end: 28,
    documentSha256: "a".repeat(64),
    tenant: "cedar" as const,
    allowedRoles: ["employee" as const],
    policyKey: "synthetic",
    authority: "Synthetic author",
    status: "current" as const,
    effectiveOn: "2026-10-13",
    expiresOn: null,
    supersedes: [],
  };
  row.selection = {
    method: "lexical",
    ranked: [{ id: passage.id, score: 1 }],
    supplied: [passage],
    excluded: [],
    gate: "pass",
    gateReason: null,
    embeddingCacheHit: null,
    timings: {
      selectionMs: 1,
      eligibilityMs: 1,
      rankingMs: 0,
      embeddingMs: null,
      corpusEmbeddingMs: null,
      queryEmbeddingMs: null,
    },
    queryTokenCount: null,
    passageTokenCounts: null,
  };
  row.status = "completed";
  row.runtime.generatorCalls = 1;
  row.validationErrors = [];
  row.parsedResponse = {
    decision: "answer",
    answer: "<img src=x> Synthetic answer.",
    reasonCode: "supported",
    citations: [{ passageId: passage.id, quote: passage.text }],
  };
  row.rawResponse = JSON.stringify(row.parsedResponse);
  row.outputHash = "b".repeat(64);
  row.evidence = {
    contextPrepared: true,
    modelCallAttempted: true,
    relevantIds: [passage.id],
    rankedRelevant: 1,
    suppliedRelevant: 1,
    expectedRelevant: 1,
    attemptedRelevant: 1,
  };
  row.mechanical.rawDisposition = "answer";
  report.metrics.lexical.answerableAcceptance = {
    numerator: 1,
    denominator: 12,
    value: 1 / 12,
  };
  return report;
}

describe("recorded Policy Lab viewer", () => {
  it("keeps pending data distinct from a run and rejects synthetic evidence kinds", () => {
    expect(
      validatePolicyData({
        schemaVersion: 1,
        evidenceKind: "unavailable",
        reason: "No recorded run selected",
      }).evidenceKind,
    ).toBe("unavailable");
    const value = syntheticReport();
    value.provenance.evidenceKind = "synthetic-test";
    expect(() => validateRecordedReport(value)).toThrow();
    expect(() => validatePolicyData({ schemaVersion: 99 })).toThrow();
  });
  it("joins three methods using the same immutable input and filters only whole cases", () => {
    const report = validateRecordedReport(syntheticReport());
    const records = filterRecordedCases(report, {
      tenant: "cedar",
      role: null,
      group: null,
    });
    expect(records.map((r) => r.caseId)).toEqual(["synthetic-0"]);
    expect(records[0].rows.map((r) => r.method)).toEqual([
      "lexical",
      "semantic",
      "full-context",
    ]);
    expect(
      filterRecordedCases(report, {
        tenant: "cedar",
        role: "security",
        group: null,
      }),
    ).toEqual([]);
  });
  it("rejects cross-context, duplicate, missing and unbound rows", () => {
    for (const mutate of [
      (v: ReturnType<typeof syntheticReport>) => {
        v.rows[1].input.query = "Different question";
      },
      (v: ReturnType<typeof syntheticReport>) => {
        v.rows.push(v.rows[0]);
      },
      (v: ReturnType<typeof syntheticReport>) => {
        v.rows.pop();
      },
      (v: ReturnType<typeof syntheticReport>) => {
        v.rows[0].fixtureHash = "f".repeat(64);
      },
      (v: ReturnType<typeof syntheticReport>) => {
        v.provenance.sourceDirty = true;
      },
      (v: ReturnType<typeof syntheticReport>) => {
        v.metrics.lexical.answerableAcceptance.value = 0.8;
      },
    ]) {
      const value = structuredClone(syntheticReport());
      mutate(value);
      expect(() => validateRecordedReport(value)).toThrow();
    }
  });
  it("exports the exact case and complete provenance without modifying the report", () => {
    const report = validateRecordedReport(syntheticReport());
    const before = JSON.stringify(report);
    const exported = JSON.parse(buildCaseExport(report, "synthetic-0"));
    expect(exported.record.rows).toEqual(report.rows.slice(0, 3));
    expect(exported.provenance).toEqual(report.provenance);
    expect(exported.record.input).toEqual(report.rows[0].input);
    expect(JSON.stringify(report)).toBe(before);
    expect(() => buildCaseExport(report, "unknown")).toThrow();
  });
  it("renders markup-like text literally and labels missing methods", () => {
    const report = validateRecordedReport(syntheticReport());
    const record = filterRecordedCases(report, {
      tenant: null,
      role: null,
      group: null,
    })[0];
    const html = renderToStaticMarkup(
      createElement(CaseComparison, { record }),
    );
    expect(html).toContain("&lt;script&gt;synthetic question&lt;/script&gt;");
    expect(html).not.toContain("<script>synthetic");
    expect(html.match(/Not started/g)).toHaveLength(3);
  });
  it("renders completed raw answers and source text literally, without upgrading unreviewed support", () => {
    const report = validateRecordedReport(syntheticCompletion());
    const record = filterRecordedCases(report, {
      tenant: "cedar",
      role: null,
      group: null,
    })[0];
    const html = renderToStaticMarkup(
      createElement(CaseComparison, { record }),
    );
    expect(html).toContain("&lt;img src=x&gt; Synthetic answer.");
    expect(html).toContain("&lt;b&gt;synthetic quoted text&lt;/b&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("Source-support assessment: unreviewed");
  });
  it("rejects coherent-looking headline rates that disagree with the recorded rows", () => {
    const report = syntheticCompletion();
    report.metrics.lexical.supportedAnswerYield = {
      numerator: 1,
      denominator: 12,
      value: 1 / 12,
    };
    expect(() => validateRecordedReport(report)).toThrow();
  });
  it("rejects completed output with a changed quote or no model identity", () => {
    const report = syntheticCompletion();
    report.rows[0].parsedResponse!.citations[0].quote = "Not in the source";
    report.rows[0].rawResponse = JSON.stringify(report.rows[0].parsedResponse);
    expect(() => validateRecordedReport(report)).toThrow();
    const missingModel = syntheticCompletion();
    missingModel.provenance.model = null;
    expect(() => validateRecordedReport(missingModel)).toThrow();
  });
});
