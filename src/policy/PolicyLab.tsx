import { useMemo, useState } from "react";
import CaseComparison from "./CaseComparison";
import {
  buildCaseExport,
  filterRecordedCases,
  formatFraction,
  METHOD_LABELS,
  METHODS,
  validatePolicyData,
} from "./viewer";
import type { CaseFilters, RunReport, SelectedRun } from "./viewer";

function RecordedViewer({
  report,
  base,
  selectedRun,
}: {
  report: RunReport;
  base: string;
  selectedRun: SelectedRun;
}) {
  const [filters, setFilters] = useState<CaseFilters>({
    tenant: null,
    role: null,
    group: null,
  });
  const [caseId, setCaseId] = useState(report.expectedCaseIds[0]);
  const [exportStatus, setExportStatus] = useState("");
  const cases = useMemo(
    () => filterRecordedCases(report, filters),
    [report, filters],
  );
  // Derive the entire selection in one render: no effect can leave stale panels behind.
  const selected = cases.find((record) => record.caseId === caseId) ?? cases[0];
  const updateFilter = (key: keyof CaseFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || null }));
    setExportStatus("");
  };
  function downloadCase() {
    if (!selected) return;
    try {
      const url = URL.createObjectURL(
        new Blob([buildCaseExport(report, selected.caseId, selectedRun)], {
          type: "application/json;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.runId}--${selected.caseId}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus(`Download requested for ${selected.caseId}.`);
    } catch {
      setExportStatus(
        "The case could not be exported. The saved record is unchanged.",
      );
    }
  }
  return (
    <>
      <section className="policy-run" aria-labelledby="policy-run-title">
        <h2 id="policy-run-title">The recorded run</h2>
        <dl>
          <div>
            <dt>Run</dt>
            <dd>{report.runId}</dd>
          </div>
          <div>
            <dt>Recorded at</dt>
            <dd>{report.provenance.createdAt}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>
              {report.provenance.model?.model ?? "No runtime model record"}
            </dd>
          </div>
          <div>
            <dt>Split and status</dt>
            <dd>
              {report.split} · {report.completion}
            </dd>
          </div>
        </dl>
        <p>
          Complete means every expected row was recorded. Errors and abstentions
          remain visible; it does not mean every answer succeeded.
        </p>
        <div
          className="policy-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Recorded evaluation counts"
        >
          <table>
            <caption>Counts across all expected cases</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Answerable acceptance</th>
                <th scope="col">Assessed supported yield</th>
                <th scope="col">Correct abstention</th>
              </tr>
            </thead>
            <tbody>
              {METHODS.map((method) => (
                <tr key={method}>
                  <th scope="row">{METHOD_LABELS[method]}</th>
                  <td>
                    {formatFraction(
                      report.metrics[method].answerableAcceptance,
                    )}
                  </td>
                  <td>
                    {formatFraction(
                      report.metrics[method].supportedAnswerYield,
                    )}
                  </td>
                  <td>
                    {formatFraction(report.metrics[method].correctAbstention)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="policy-meta">
          Abstention counts track valid decline decisions on cases expected to
          decline. Their explanations can still contain unsupported claims;
          inspect the separate source-support and reason assessments below.
        </p>
        <details>
          <summary>Full metrics and run identity</summary>
          <p>
            Prepared-context coverage includes saved retrieval even when
            generation never starts. Attempted-context coverage is separate.
            Timing summaries include sample counts.
          </p>
          <pre>
            {JSON.stringify(
              { provenance: report.provenance, metrics: report.metrics },
              null,
              2,
            )}
          </pre>
        </details>
        <p className="policy-links">
          <a href={`${base}evidence/policy-lab/report.json`}>
            Full recorded report (JSON)
          </a>
          <a href={`${base}evidence/policy-lab/report.md`}>Report notes</a>
          <a href={`${base}evidence/policy-lab/selected-run.json`}>
            Selected report identity
          </a>
        </p>
      </section>
      <section
        className="policy-case-desk"
        aria-labelledby="policy-cases-title"
      >
        <div className="policy-section-heading">
          <span className="eyebrow">FOLLOW ONE EVIDENCE TRAIL</span>
          <h2 id="policy-cases-title">One question. Three saved contexts.</h2>
          <p>
            Filters choose recorded cases. They do not change the question,
            permissions or evaluation date.
          </p>
        </div>
        <div className="policy-filters">
          <label>
            Fictional tenant
            <select
              value={filters.tenant ?? ""}
              onChange={(e) => updateFilter("tenant", e.target.value)}
            >
              <option value="">All tenants</option>
              <option value="cedar">Cedar</option>
              <option value="harbour">Harbour</option>
            </select>
          </label>
          <label>
            Recorded role
            <select
              value={filters.role ?? ""}
              onChange={(e) => updateFilter("role", e.target.value)}
            >
              <option value="">All roles</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="security">Security</option>
            </select>
          </label>
          <label>
            Issue
            <select
              value={filters.group ?? ""}
              onChange={(e) => updateFilter("group", e.target.value)}
            >
              <option value="">All issues</option>
              {[
                "current",
                "superseded",
                "conflict",
                "unavailable",
                "injection",
              ].map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="policy-meta" role="status">
          {cases.length} saved {cases.length === 1 ? "case" : "cases"} match.
        </p>
        {selected ? (
          <>
            <label className="policy-case-picker">
              Saved case
              <select
                value={selected.caseId}
                onChange={(e) => {
                  setCaseId(e.target.value);
                  setExportStatus("");
                }}
              >
                {cases.map((record) => (
                  <option key={record.caseId} value={record.caseId}>
                    {record.caseId} · {record.input.query}
                  </option>
                ))}
              </select>
            </label>
            <div className="policy-case-context">
              <h3>{selected.input.query}</h3>
              <p>
                {selected.input.principal.tenant} ·{" "}
                {selected.input.principal.role} · As of {selected.input.asOf}
              </p>
              <p className="policy-meta">
                Case {selected.caseId} · {selected.rows[0].case.group}
              </p>
              <button
                type="button"
                className="policy-button"
                onClick={downloadCase}
              >
                Export this recorded case
              </button>
              <p className="policy-meta" role="status">
                {exportStatus}
              </p>
            </div>
            <CaseComparison key={selected.caseId} record={selected} />
            <details
              key={`rubric/${selected.caseId}`}
              className="policy-rubric"
            >
              <summary>Expected evidence and assessment rubric</summary>
              <p>These scoring labels were not included in the model prompt.</p>
              <p>{selected.rows[0].case.rationale}</p>
              <pre>
                {JSON.stringify(
                  {
                    expected: selected.rows[0].case,
                    relevantPassages: selected.rows[0].evidence.relevantIds,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </>
        ) : (
          <div className="policy-empty">
            <h3>No saved cases match these filters</h3>
            <p>Choose another combination to inspect a recorded question.</p>
            <button
              type="button"
              className="policy-button"
              onClick={() => {
                setFilters({ tenant: null, role: null, group: null });
                setExportStatus("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
      <section className="policy-limits" aria-labelledby="policy-limits-title">
        <h2 id="policy-limits-title">What these results can tell us</h2>
        <ul>
          {report.limitations.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function PolicyLab({
  data,
  base,
  selectedRun = null,
}: {
  data: unknown;
  base: string;
  selectedRun?: SelectedRun | null;
}) {
  const validated = useMemo(() => {
    try {
      return { value: validatePolicyData(data, selectedRun), error: false };
    } catch {
      return { value: null, error: true };
    }
  }, [data, selectedRun]);
  if (validated.error || !validated.value)
    return (
      <section className="policy-empty" role="alert">
        <h2>Recorded evidence could not be verified</h2>
        <p>
          This page cannot display a comparison from the supplied record. No
          model request has been made.
        </p>
      </section>
    );
  if (validated.value.evidenceKind === "unavailable")
    return (
      <section className="policy-empty" aria-labelledby="policy-empty-title">
        <span className="policy-status">Evaluation has not run yet</span>
        <h2 id="policy-empty-title">No recorded run selected</h2>
        <p>{validated.value.reason}</p>
        <p>
          The planned comparison will inspect lexical retrieval, semantic
          retrieval and all eligible context for the same saved question. Model
          output and measured scores will appear only after a real local run is
          recorded.
        </p>
        <p>There are no saved cases to select or results to export yet.</p>
        <a href={`${base}evidence/policy-lab/methodology.txt`}>
          Read the evaluation method
        </a>
      </section>
    );
  return (
    <RecordedViewer
      report={validated.value.report}
      base={base}
      selectedRun={validated.value.selectedRun}
    />
  );
}
