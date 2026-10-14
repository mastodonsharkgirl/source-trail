import SourceInspection from "./SourceInspection";
import { METHOD_LABELS, STATUS_LABELS } from "./viewer";
import type { RecordedCase } from "./viewer";

export default function CaseComparison({ record }: { record: RecordedCase }) {
  return (
    <div className="policy-comparison">
      {record.rows.map((row) => (
        <section
          key={`${record.caseId}/${row.method}`}
          className="policy-method"
          aria-labelledby={`policy-${row.method}`}
        >
          <div className="policy-method-heading">
            <span className="policy-meta">
              {row.method === "full-context"
                ? "All eligible passages"
                : "Top three eligible passages"}
            </span>
            <h3 id={`policy-${row.method}`}>{METHOD_LABELS[row.method]}</h3>
          </div>
          <p className="policy-status">{STATUS_LABELS[row.status]}</p>
          <p className="policy-question">{record.input.query}</p>
          {row.parsedResponse ? (
            <div className="policy-answer">
              <p className="policy-meta">
                Model {row.parsedResponse.decision} ·{" "}
                {row.parsedResponse.reasonCode.replaceAll("_", " ")}
              </p>
              <p>{row.parsedResponse.answer}</p>
              {row.parsedResponse.citations.map((citation, index) => (
                <blockquote key={`${citation.passageId}/${index}`}>
                  <p>{citation.quote}</p>
                  <cite>{citation.passageId}</cite>
                </blockquote>
              ))}
            </div>
          ) : (
            <p>
              {row.status === "gate_abstained"
                ? "The retrieval gate stopped this row before generation."
                : row.rawResponse !== null
                  ? "The returned text did not become an accepted answer. Inspect the unedited output below."
                  : "No accepted model answer is recorded for this method."}
            </p>
          )}
          {row.validationErrors.length > 0 && (
            <div className="policy-errors">
              <p>Recorded diagnostic</p>
              <ul>
                {row.validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Unedited model output</summary>
            {row.rawResponse === null ? (
              <p>No decoded model response is available.</p>
            ) : (
              <pre>{row.rawResponse}</pre>
            )}
          </details>
          <details>
            <summary>
              Source-support assessment:{" "}
              {row.assessment?.support ?? "unreviewed"}
            </summary>
            {row.assessment ? (
              <>
                <p>
                  {row.assessment.assessor.type === "agent"
                    ? "Agent assessment"
                    : "Human assessment"}{" "}
                  by {row.assessment.assessor.name}
                  {row.assessment.assessor.model
                    ? ` (${row.assessment.assessor.model})`
                    : ""}
                  .
                </p>
                <p>{row.assessment.notes}</p>
                <p>
                  Reason correct:{" "}
                  {row.assessment.reasonCorrect === null
                    ? "Unreviewed"
                    : row.assessment.reasonCorrect
                      ? "Yes"
                      : "No"}
                  . Instruction compliance:{" "}
                  {row.assessment.instructionCompliance.replaceAll("_", " ")}.
                </p>
                <p className="policy-meta">
                  An agent assessment is not independent human validation.
                </p>
              </>
            ) : (
              <p>
                No separate assessment has been recorded. Valid formatting or a
                matching quote alone does not establish support.
              </p>
            )}
          </details>
          <SourceInspection row={row} />
        </section>
      ))}
    </div>
  );
}
