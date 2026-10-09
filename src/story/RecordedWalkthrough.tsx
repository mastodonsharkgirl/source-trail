import { useState } from "react";
import evidence from "../../docs/story-lab/generation-evaluation.json";
import { initialAtlas, retrieve } from "./core";

const recorded = evidence.samples[0]!;
const context = recorded.context!.supplied;
const base = import.meta.env.BASE_URL;

export default function RecordedWalkthrough({
  selected,
  ordered,
  changeWords,
  restore,
}: {
  selected: string[];
  ordered: string[];
  changeWords: (word: string) => void;
  restore: () => void;
}) {
  const [inspected, setInspected] = useState(false);
  const changed =
    selected.length !== recorded.words.length ||
    recorded.words.some((w) => !selected.includes(w));
  const preview = retrieve(initialAtlas(), selected.join(" "));
  return (
    <section className="recorded-trail" aria-label="A real run in three steps">
      <div className="recorded-banner">
        <strong>Recorded real run</strong>
        <span>Saved on 9 October 2026 · no model download</span>
      </div>
      <div className="walkthrough-grid">
        <section className="walk-step">
          <p className="kicker">01 / THE IDEAS</p>
          <h2>Start with a few words.</h2>
          <p>
            This run used <strong>rabbit, bridge, sun</strong>. Try other words
            to preview which passages match.
          </p>
          <div className="word-field" aria-label="Story ideas">
            {ordered.map((word, i) => (
              <button
                key={word}
                className={`word-tablet tablet-${i % 4}`}
                aria-pressed={selected.includes(word)}
                onClick={() => changeWords(word)}
              >
                <span aria-hidden="true">
                  {selected.includes(word) ? "✦" : "＋"}
                </span>
                {word}
              </button>
            ))}
          </div>
          <p className="small-note">
            {selected.length} of 5 selected · words are prompts, not evidence
          </p>
          {changed && (
            <div className="retrieval-preview" aria-live="polite">
              <strong>Retrieval preview only</strong>
              <p>
                Your words match:{" "}
                {preview.map((p) => p.title).join(" · ") || "no passages"}. The
                recorded answer below has not changed.
              </p>
              <button className="secondary-action" onClick={restore}>
                Restore recorded ideas
              </button>
            </div>
          )}
        </section>
        <section className="walk-step supplied-step">
          <p className="kicker">02 / THE EVIDENCE</p>
          <h2>What the model received.</h2>
          <p>
            These three passages were retrieved and supplied in the saved
            request.
          </p>
          {context.map((p) => (
            <details
              className="recorded-source"
              key={p.id}
              open={p.sourceId === "bridge" || undefined}
            >
              <summary>
                {p.title} <span>v{p.version}</span>
              </summary>
              <blockquote>{p.text}</blockquote>
              <small>
                Exact supplied excerpt · {p.sourceId} · span {p.start}–{p.end}
              </small>
            </details>
          ))}
          <p className="small-note">Meadow Atlas is a fictional source pack.</p>
        </section>
        <section className="walk-step recorded-reading">
          <p className="kicker">03 / THE ANSWER</p>
          <h2>Did it follow the evidence?</h2>
          <p className="run-tag">
            Actual saved model output · not generating now
          </p>
          <p className="recorded-output">{recorded.text}</p>
          <button
            className="primary-action"
            aria-expanded={inspected}
            aria-controls="recorded-assessment"
            onClick={() => setInspected((v) => !v)}
          >
            {inspected ? "Hide inspection" : "Inspect the answer"}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="small-note">
            This run contains a contradiction. A relevant source does not
            guarantee a correct answer.
          </p>
        </section>
      </div>
      {inspected && (
        <section
          id="recorded-assessment"
          className="recorded-assessment"
          aria-label="Manual review of this recorded answer"
        >
          <p className="kicker">
            MANUALLY REVIEWED EXAMPLES · NOT AN AUTOMATIC CHECK
          </p>
          <div className="assessment-grid">
            <article>
              <h3>Supported detail</h3>
              <blockquote>“the amber light shines on the path”</blockquote>
              <p>
                The supplied lantern passage says: “Pip's lantern glows amber.
                It lights the path”. This detail agrees.
              </p>
              <small>Light for the path · v1</small>
            </article>
            <article>
              <h3>Conflicts with evidence</h3>
              <blockquote>
                “the darkness of the night remains the only time the bridge can
                truly open”
              </blockquote>
              <p>
                The supplied bridge rule says: “The bridge never opens at
                night.” The model reversed the rule.
              </p>
              <small>A crossing after sunrise · v1</small>
            </article>
            <article>
              <h3>Missing evidence</h3>
              <small>Follow-up question · not model output</small>
              <blockquote>
                At what exact clock time does the bridge open?
              </blockquote>
              <p>
                The bridge passage only says “after sunrise”. It supplies no
                exact clock time, so this follow-up cannot be answered from the
                recorded evidence.
              </p>
              <small>Not established by this request's context</small>
            </article>
          </div>
          <p className="walkaway">
            Retrieval found the rule. Generation contradicted it. Inspection
            made the difference visible.
          </p>
        </section>
      )}
      <details className="recorded-provenance">
        <summary>See the saved request and model</summary>
        <p>
          {recorded.model!.id} · {recorded.model!.runtime}. Recorded prompt:{" "}
          {recorded.context!.promptTokens} tokens; output:{" "}
          {recorded.model!.usage.completion_tokens} tokens. This is one
          development demonstration, not an accuracy benchmark.
        </p>
        <pre>{recorded.context!.prompt}</pre>
        <a href={`${base}evidence/story-evaluation.json`}>
          Raw runs and evaluation ↗
        </a>
      </details>
    </section>
  );
}
