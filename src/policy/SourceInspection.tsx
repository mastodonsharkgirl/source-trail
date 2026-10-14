import type { RunRow } from "./viewer";

export default function SourceInspection({ row }: { row: RunRow }) {
  return (
    <div className="policy-sources">
      <details>
        <summary>
          Prepared evidence ({row.selection?.supplied.length ?? 0} passages)
        </summary>
        <p>
          {row.evidence.modelCallAttempted
            ? "A model call was attempted with this saved context."
            : "No model call was attempted. Any passages below are prepared context only."}
        </p>
        {row.selection === null ? (
          <p>No selection was recorded.</p>
        ) : row.selection.supplied.length === 0 ? (
          <p>No passages were selected for generation.</p>
        ) : (
          row.selection.supplied.map((passage, i) => (
            <article key={passage.id} className="policy-source">
              <h4>
                {i + 1}. {passage.title}
              </h4>
              <p className="policy-meta">
                {passage.id} · Version {passage.version} · {passage.authority}
              </p>
              <p className="policy-meta">
                {passage.tenant} · Roles: {passage.allowedRoles.join(", ")} ·{" "}
                {passage.status} · Effective {passage.effectiveOn}
                {passage.expiresOn ? ` · Expires ${passage.expiresOn}` : ""}
              </p>
              <blockquote>{passage.text}</blockquote>
              <details>
                <summary>Source location and identity</summary>
                <p>
                  Document {passage.sourceId}; characters {passage.start}–
                  {passage.end} (UTF-16 offsets).
                </p>
                <code>{passage.documentSha256}</code>
                <p>Supersedes: {passage.supersedes.join(", ") || "None"}</p>
              </details>
            </article>
          ))
        )}
      </details>
      <details>
        <summary>Retrieval ranking and exclusions</summary>
        <p>
          Ranking is saved before the gate. Exclusions name documents; these
          decisions demonstrate filtering of public fictional data.
        </p>
        {row.selection ? (
          <>
            <p>
              Gate: {row.selection.gate}
              {row.selection.gateReason ? ` — ${row.selection.gateReason}` : ""}
            </p>
            <pre>
              {JSON.stringify(
                {
                  ranked: row.selection.ranked,
                  excluded: row.selection.excluded,
                },
                null,
                2,
              )}
            </pre>
          </>
        ) : (
          <p>No retrieval record.</p>
        )}
      </details>
      <details>
        <summary>Measurements and mechanical checks</summary>
        <p>
          Missing measurements are unavailable. Exact quotation checks do not
          establish that an answer is supported.
        </p>
        <pre>
          {JSON.stringify(
            {
              timings: row.selection?.timings ?? null,
              embeddingCacheHit: row.selection?.embeddingCacheHit ?? null,
              runtime: row.runtime,
              evidence: row.evidence,
              boundary: row.boundary,
              mechanical: row.mechanical,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
