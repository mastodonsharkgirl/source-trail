import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { defaultNotes, searchRecord, SEMANTIC_THRESHOLD } from "../lib/session";
import {
  validateSources,
  MAX_QUERY_CHARACTERS,
  type SourceNote,
} from "../lib/sources";
import { lexicalSearch, type RankedPassage } from "../lib/ranking";
import {
  acceptsWorkerResponse,
  type WorkerRequest,
  type WorkerResponse,
} from "../lib/protocol";
import Worker from "../workers/search.worker?worker";
import evaluation from "../data/evaluation.json";

type ModelState = "idle" | "loading" | "ready" | "error";
const example = "What should I do with a broken borrowed camera?";
const originalRevision = validateSources(defaultNotes()).revision;

export default function SourceDesk() {
  const [notes, setNotes] = useState(defaultNotes);
  const corpus = validateSources(notes);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<"semantic" | "lexical">("semantic");
  const [model, setModel] = useState<ModelState>("idle");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RankedPassage[] | null>(null);
  const [resultQuery, setResultQuery] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Your source pack is ready to explore.");
  const [selected, setSelected] = useState("camera");
  const [selectedPassage, setSelectedPassage] = useState("");
  const [editing, setEditing] = useState<SourceNote | null>(null);
  const worker = useRef<InstanceType<typeof Worker> | null>(null);
  const job = useRef<Pick<WorkerRequest, "jobId" | "revision"> | null>(null);
  const serial = useRef(0);
  const reader = useRef<HTMLElement>(null);
  const editorTitle = useRef<HTMLInputElement>(null);
  const sourceIndex = useRef<HTMLDetailsElement>(null);
  const matches = useRef<HTMLElement>(null);
  const current = notes.find((note) => note.id === selected) ?? notes[0]!;
  const newNote = !!editing && !notes.some((note) => note.id === editing.id);
  const accepted =
    !!results?.length &&
    (method === "semantic"
      ? results[0]!.score >= SEMANTIC_THRESHOLD
      : results[0]!.score > 0);

  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (sourceIndex.current && matchMedia("(max-width: 759px)").matches)
      sourceIndex.current.open = false;
  }, []);
  function invalidate(terminate = false) {
    job.current = null;
    setBusy(false);
    setResults(null);
    setError("");
    setSelectedPassage("");
    setStatus(
      terminate
        ? "Search cancelled. Load the model again or use text matching."
        : "Search cleared. Search again when you are ready.",
    );
    if (terminate) {
      worker.current?.terminate();
      worker.current = null;
      setModel("idle");
    }
  }
  function load() {
    invalidate(true);
    setModel("loading");
    setMethod("semantic");
    setStatus("Downloading public model files, then preparing local search.");
    const next = new Worker();
    worker.current = next;
    const identity = {
      jobId: String(++serial.current),
      revision: corpus.revision,
    };
    job.current = identity;
    next.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (!job.current || !acceptsWorkerResponse(job.current, data)) return;
      if (data.type === "ready") {
        setModel("ready");
        setStatus("Local model ready");
        job.current = null;
      }
      if (data.type === "results") {
        setResults(data.results.slice(0, 3));
        setBusy(false);
        setStatus("Search complete. Open a passage to inspect its source.");
        job.current = null;
      }
      if (data.type === "error") {
        const loadingFailed = job.current?.jobId === identity.jobId;
        setError(
          loadingFailed
            ? "The model files could not be downloaded or prepared. Check your connection and retry, or use text matching."
            : data.message,
        );
        setBusy(false);
        if (loadingFailed) setModel("error");
        setStatus("Local search could not finish.");
        job.current = null;
      }
    };
    next.onerror = () => {
      if (worker.current !== next) return;
      setModel("error");
      setBusy(false);
      setError(
        "The local model could not start. Retry the download or use text matching.",
      );
      job.current = null;
    };
    next.postMessage({ type: "load", ...identity } satisfies WorkerRequest);
  }
  function search() {
    setError("");
    setResults(null);
    setSelectedPassage("");
    if (!query.trim()) {
      setError("Write a question to search these notes.");
      return;
    }
    if (query.length > MAX_QUERY_CHARACTERS) {
      setError(
        `Keep your question within ${MAX_QUERY_CHARACTERS} characters. Nothing has been shortened.`,
      );
      return;
    }
    setResultQuery(query);
    if (method === "lexical") {
      setResults(lexicalSearch(corpus, query).slice(0, 3));
      setStatus(
        "Text matching complete. Open a passage to inspect its source.",
      );
      return;
    }
    if (model !== "ready" || !worker.current) {
      setError("Load the local model first, or choose text matching.");
      return;
    }
    const identity = {
      jobId: String(++serial.current),
      revision: corpus.revision,
    };
    job.current = identity;
    setBusy(true);
    setStatus("Reading your passages locally…");
    worker.current.postMessage({
      type: "search",
      ...identity,
      corpus,
      query,
    } satisfies WorkerRequest);
  }
  function reset() {
    invalidate(true);
    setNotes(defaultNotes());
    setQuery("");
    setSelected("camera");
    setEditing(null);
    setStatus("Workspace reset. Only the fictional source pack remains.");
  }
  function save() {
    if (!editing) return;
    try {
      const updated = notes.some((note) => note.id === editing.id)
        ? notes.map((note) => (note.id === editing.id ? editing : note))
        : [...notes, editing];
      validateSources(updated);
      invalidate(true);
      setNotes(updated);
      setSelected(editing.id);
      setEditing(null);
      setStatus("Notes changed. Search again.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Check your note.");
    }
  }
  function focusSource(edit = false) {
    requestAnimationFrame(() => {
      const destination = edit ? editorTitle.current : reader.current;
      destination?.focus({ preventScroll: true });
      if (innerWidth < 760)
        destination?.scrollIntoView({
          behavior: "instant",
          block: edit ? "center" : "start",
        });
    });
  }
  function openSource(result: RankedPassage) {
    setSelected(result.sourceId);
    setSelectedPassage(result.id);
    setEditing(null);
    focusSource();
  }
  function exportRecord() {
    if (!results) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            searchRecord(resultQuery, corpus.revision, results, method),
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "source-trail-search.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <section className="question-desk" aria-label="Search workspace">
        <div className="question-label">
          <label htmlFor="question">Your question</label>
          <span>01 / ASK THE NOTES</span>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
        >
          <textarea
            id="question"
            rows={2}
            value={query}
            placeholder="What are you trying to find?"
            onChange={(event) => {
              if (busy) {
                invalidate(true);
              } else if (results) {
                setResults(null);
                setStatus("Question changed. Search again.");
              }
              setQuery(event.target.value);
            }}
            aria-describedby="question-limit"
          />
          <div className="question-bottom">
            <button
              className="example-link"
              type="button"
              onClick={() => {
                if (busy) invalidate(true);
                setQuery(example);
                setResults(null);
              }}
            >
              Try a question <span aria-hidden="true">↗</span>
              <span className="example-text"> Broken borrowed camera</span>
            </button>
            <Button
              type="submit"
              disabled={busy || (method === "semantic" && model !== "ready")}
            >
              {busy ? "Finding passages…" : "Find passages"}{" "}
              <span aria-hidden="true">→</span>
            </Button>
          </div>
        </form>
        <div className="method-row">
          <div className="model-choice">
            {model === "ready" ? (
              <button
                className={`method-button ${method === "semantic" ? "chosen" : ""}`}
                onClick={() => {
                  invalidate();
                  setMethod("semantic");
                }}
              >
                ● Search by meaning
              </button>
            ) : model === "loading" ? (
              <span className="loading-label">
                Downloading & preparing local search…
              </span>
            ) : (
              <button
                className={`method-button ${method === "semantic" ? "chosen" : ""}`}
                onClick={load}
              >
                {model === "error"
                  ? "Retry model download"
                  : "Load local search model"}
              </button>
            )}
            <button
              className={`method-button ${method === "lexical" ? "chosen" : ""}`}
              onClick={() => {
                if (busy) invalidate(true);
                else {
                  setResults(null);
                  setStatus(
                    model === "loading"
                      ? "Model loading. Text matching is ready."
                      : "Text matching is ready. Ask your question.",
                  );
                }
                setMethod("lexical");
                setError("");
              }}
            >
              Text matching — no model
            </button>
          </div>
          <p>
            About 38 MB downloads. Your notes and question stay in this browser.
          </p>
        </div>
        <div className="workspace-state">
          <p role="status">{status}</p>
          <span id="question-limit">{query.length} / 800 characters</span>
        </div>
        {error && !editing && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="desk-grid">
        <aside className="source-index" aria-label="Source notes">
          <details ref={sourceIndex} open>
            <summary>
              Browse {notes.length}{" "}
              {corpus.revision === originalRevision ? "fictional " : ""}
              notes <span aria-hidden="true">↓</span>
            </summary>
            <div className="source-index-inner">
              <p className="eyebrow">02 / SOURCE PACK</p>
              <nav aria-label="Choose a source">
                {notes.map((note, index) => (
                  <button
                    key={note.id}
                    className={`source-row ${current.id === note.id ? "active" : ""}`}
                    onClick={() => {
                      setSelected(note.id);
                      setSelectedPassage("");
                      setEditing(null);
                      focusSource();
                    }}
                  >
                    <span className="source-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{note.title}</strong>
                      <small
                        className={
                          note.version.includes("archived") ? "archived" : ""
                        }
                      >
                        {note.version}
                      </small>
                    </span>
                  </button>
                ))}
              </nav>
              <p className="pack-note">
                An authored equipment & workshop pack. All six original notes
                are fictional.
              </p>
              <Button
                variant="line"
                onClick={() => {
                  setEditing({
                    id: `note-${Date.now()}`,
                    title: "",
                    version: "",
                    text: "",
                  });
                  setError("");
                  focusSource(true);
                }}
                disabled={notes.length >= 12}
              >
                + Add a note
              </Button>
              <button className="reset-button" onClick={reset}>
                Reset workspace <span aria-hidden="true">↺</span>
              </button>
            </div>
          </details>
        </aside>

        <section
          className="results-column"
          ref={matches}
          tabIndex={-1}
          aria-label="Search matches"
          data-testid="results"
        >
          <div className="column-heading">
            <h2>Passages</h2>
            <span>
              {results
                ? `${results.length} ${accepted ? "ranked passages" : "reading alternatives"}`
                : "AWAITING A QUESTION"}
            </span>
          </div>
          {results ? (
            <>
              <div className="result-method">
                <span className="eyebrow">
                  {method === "semantic"
                    ? "Search by meaning"
                    : "Text matching"}
                </span>
                <p>
                  {method === "semantic"
                    ? "Runs in your browser. Similarity is not factual confidence."
                    : "Shared words, not model inference."}
                </p>
              </div>
              {!accepted && (
                <div className="no-match">
                  <h3>No close passage found in these notes.</h3>
                  <p>
                    {method === "semantic"
                      ? "None of these passages was close enough to the question."
                      : "No question words matched a passage."}{" "}
                    These are lower-ranked alternatives for reading.
                  </p>
                </div>
              )}
              <ol className="result-list">
                {results.map((result, index) => (
                  <li
                    data-testid="result"
                    key={result.id}
                    className={
                      selectedPassage === result.id ? "selected-result" : ""
                    }
                  >
                    <div className="result-top">
                      <span className="result-number">0{index + 1}</span>
                      <span className="score">
                        {method === "semantic" ? "Similarity" : "Word overlap"}{" "}
                        {result.score.toFixed(3)}
                      </span>
                    </div>
                    <blockquote>“{result.text}”</blockquote>
                    <div className="result-origin">
                      <strong>{result.title}</strong>
                      <span
                        className={
                          result.version.includes("archived") ? "archived" : ""
                        }
                      >
                        {result.version}
                      </span>
                      <code>{result.id}</code>
                    </div>
                    <button
                      className="open-source"
                      onClick={() => openSource(result)}
                    >
                      Open source <span aria-hidden="true">↗</span>
                      <span className="sr-only">
                        {" "}
                        {result.title}, passage {result.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <Button variant="line" onClick={exportRecord} disabled={busy}>
                Download search record <span aria-hidden="true">↓</span>
              </Button>
              <p className="export-note">
                JSON includes your question, quoted notes, versions and method.
              </p>
            </>
          ) : (
            <div className="empty-results">
              <div className="empty-glyph" aria-hidden="true">
                [ ↗ ]
              </div>
              <h3>
                A match is only useful
                <br />
                if you can follow it.
              </h3>
              <p>
                Ask a question above. Three exact passages will appear here,
                each with a path back to its source.
              </p>
              <span>NO GENERATED ANSWER. JUST THE NOTES.</span>
            </div>
          )}
        </section>

        <section
          ref={reader}
          tabIndex={-1}
          className="reader"
          aria-label="Original source"
          data-testid="reader"
        >
          <div className="column-heading">
            <h2>Original note</h2>
            <span>03 / READ IN CONTEXT</span>
          </div>
          <article className="source-sheet">
            <div className="sheet-top">
              <span className="eyebrow">
                {newNote ? "NEW SOURCE" : "SOURCE "}
                {!newNote &&
                  String(
                    notes.findIndex((note) => note.id === current.id) + 1,
                  ).padStart(2, "0")}
              </span>
              <span
                className={
                  current.version.includes("archived")
                    ? "version archived"
                    : "version"
                }
              >
                {newNote ? "Draft" : current.version}
              </span>
            </div>
            <h3>{newNote ? "New note" : current.title}</h3>
            <code className="source-id">
              {newNote ? "Not saved yet" : current.id}
            </code>
            {editing ? (
              <div className="note-editor">
                <label htmlFor="note-title">Note title</label>
                <input
                  id="note-title"
                  ref={editorTitle}
                  value={editing.title}
                  onChange={(event) =>
                    setEditing({ ...editing, title: event.target.value })
                  }
                />
                <label htmlFor="note-version">Version or date</label>
                <input
                  id="note-version"
                  value={editing.version}
                  onChange={(event) =>
                    setEditing({ ...editing, version: event.target.value })
                  }
                />
                <label htmlFor="note-text">Note text</label>
                <textarea
                  id="note-text"
                  rows={9}
                  value={editing.text}
                  onChange={(event) =>
                    setEditing({ ...editing, text: event.target.value })
                  }
                />
                <p>
                  Separate passages with a blank line. Up to 12 notes, 24
                  passages and 16 KB of text. Each passage must fit 512 model
                  tokens.
                </p>
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save}>Save note</Button>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEditing(null);
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="source-text">
                  {corpus.passages
                    .filter((passage) => passage.sourceId === current.id)
                    .map((passage) => (
                      <p
                        key={passage.id}
                        className={
                          selectedPassage === passage.id
                            ? "highlighted-passage"
                            : ""
                        }
                      >
                        <span className="passage-id">{passage.id}</span>
                        {selectedPassage === passage.id ? (
                          <mark>{passage.text}</mark>
                        ) : (
                          passage.text
                        )}
                      </p>
                    ))}
                </div>
                <div className="sheet-bottom">
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEditing({ ...current });
                      setError("");
                    }}
                  >
                    Edit this note
                  </Button>
                  <span>Memory only · clears on reload</span>
                </div>
              </>
            )}
          </article>
          <button
            className="back-matches"
            onClick={() => {
              matches.current?.focus();
              matches.current?.scrollIntoView({ behavior: "instant" });
            }}
          >
            ↑ Back to matches
          </button>
        </section>
      </div>

      <section className="methodology" id="methodology">
        <div className="method-intro">
          <span className="eyebrow">04 / SHOW YOUR WORK</span>
          <h2>
            Useful retrieval.
            <br />
            Visible limits.
          </h2>
          <p>
            A small, reproducible experiment. The model finds related language;
            the original notes remain the evidence.
          </p>
        </div>
        <div className="method-content">
          <details>
            <summary>
              The measured tradeoff <span>+</span>
            </summary>
            <p>
              On 13 answerable held-out questions, semantic search accepted 7
              and abstained on 6. On 3 no-answer questions it returned 0 false
              positives and 3 abstentions. Text matching accepted all 13
              answerable questions and all 3 no-answer questions.
            </p>
            <div className="metric-table">
              <table>
                <caption>Ungated rankings · before the threshold</caption>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Recall@3</th>
                    <th>MRR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Semantic</th>
                    <td>
                      {evaluation.heldOut.semantic.ungatedRecallAt3.toFixed(3)}
                    </td>
                    <td>
                      {evaluation.heldOut.semantic.ungatedMrrFirstRelevantFullRanking.toFixed(
                        3,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Text matching</th>
                    <td>
                      {evaluation.heldOut.lexical.ungatedRecallAt3.toFixed(3)}
                    </td>
                    <td>
                      {evaluation.heldOut.lexical.ungatedMrrFirstRelevantFullRanking.toFixed(
                        3,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Recall@3 is the mean fraction of labelled relevant passages found
              in the first three; MRR uses the first relevant passage in the
              full ranking. Both exclude no-answer questions and do not imply a
              question was accepted. These are Node CPU evaluation results, not
              browser performance measurements.
            </p>
            <p>
              The {SEMANTIC_THRESHOLD.toFixed(4)} threshold was selected on 8
              separate calibration questions, never the held-out set. Six
              fictional sources and 12 passages are a tiny test, not evidence of
              general accuracy.
            </p>
            <a href="/evidence/evaluation.json" download>
              Download raw evaluation ↗
            </a>{" "}
            ·{" "}
            <a href="/evidence/source-trail-fixture.json" download>
              Frozen test set ↗
            </a>
          </details>
          <details>
            <summary>
              What stays in your browser <span>+</span>
            </summary>
            <p>
              Notes, questions and vectors live in memory. They are not sent to
              a service, logged or saved in application storage. Reset clears
              the workspace; reloading clears your edits. Public model files
              download from this same site only when requested. Your browser may
              cache those public files.
            </p>
            <p>
              Export deliberately creates a file containing your question and
              retrieved quotations. Keep it wherever you normally keep those
              notes.
            </p>
          </details>
          <details>
            <summary>
              The actual model & source trail <span>+</span>
            </summary>
            <p>
              MiniLM-L6-v2, q8 weights, 384 dimensions, mean pooling and
              normalized vectors. Transformers.js 4.3.0 runs ONNX WASM in a
              dedicated worker with one thread. Every question and passage is
              checked against the model’s 512-token limit; nothing is silently
              shortened.
            </p>
            <p>
              Archived and current versions stay separate. Retrieval does not
              resolve contradictions or establish which statement is true.
              Editing sources invalidates results and unloads the model to clear
              pending work.
            </p>
            <a href="/models/manifest.json">Pinned asset hashes ↗</a> ·{" "}
            <a href="/evidence/architecture.txt">Architecture ↗</a>
          </details>
        </div>
      </section>
    </>
  );
}
