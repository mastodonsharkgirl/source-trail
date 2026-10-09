import { useEffect, useRef, useState } from "react";
import {
  initialAtlas,
  words,
  retrieve,
  snapshot,
  sampleRun,
  editSource,
  accepts,
  TWIST,
  type Run,
  type Evidence,
  type Context,
} from "./core";
import { preflight } from "./gpu";
import manifest from "../../MODEL_MANIFEST.json";
import GenerationWorker from "./generation.worker?worker";
import Horizon from "./Horizon";
type State = "idle" | "loading" | "ready" | "writing" | "error";
const base = import.meta.env.BASE_URL;
export default function StoryLab() {
  const [pack, setPack] = useState(initialAtlas),
    [selected, setSelected] = useState(["rabbit", "bridge", "sun"]);
  const [run, setRun] = useState<Run>(() => sampleRun(initialAtlas())),
    [history, setHistory] = useState<Run[]>([]);
  const [state, setState] = useState<State>("idle"),
    [status, setStatus] = useState(
      "Start with the authored example. No download needed.",
    ),
    [error, setError] = useState("");
  const [consent, setConsent] = useState(false),
    [drawer, setDrawer] = useState<"supplied" | "related" | "sources" | null>(
      null,
    ),
    [related, setRelated] = useState<Evidence[]>([]);
  const [editId, setEditId] = useState("bridge"),
    [draft, setDraft] = useState(initialAtlas().sources[1]!.text);
  const [mood, setMood] = useState("cyan-dawn"),
    [paused, setPaused] = useState(false),
    [opaque, setOpaque] = useState(false),
    [tone, setTone] = useState("paper"),
    [shuffle, setShuffle] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;
  const worker = useRef<Worker | null>(null),
    serial = useRef(0),
    job = useRef<{ jobId: number; revision: string } | null>(null),
    pending = useRef<Run | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    loadDialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const busy = state === "loading" || state === "writing";
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (drawer) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [drawer]);
  useEffect(() => {
    if (consent) loadDialog.current?.showModal();
    else if (loadDialog.current?.open) loadDialog.current.close();
  }, [consent]);
  function cancel(
    message = "Stopped. Partial public model files may remain cached. You can remove them below.",
  ) {
    job.current = null;
    pending.current = null;
    const old = worker.current;
    worker.current = null;
    if (old) {
      if (state === "writing") {
        const timer = setTimeout(() => old.terminate(), 2000);
        old.addEventListener("message", ({ data }) => {
          if (data.type === "cancelled") {
            clearTimeout(timer);
            old.terminate();
          }
        });
        old.postMessage({
          type: "cancel",
          jobId: ++serial.current,
          revision: pack.revision,
        });
      } else old.terminate();
    }
    setState("idle");
    setStatus(message);
  }
  function changeWords(word: string) {
    if (!selected.includes(word) && selected.length === 5) {
      setStatus("Choose at most five ideas. Remove one to add another.");
      return;
    }
    if (busy) cancel("Ideas changed. Previous work was cancelled.");
    setSelected((s) =>
      s.includes(word) ? s.filter((x) => x !== word) : [...s, word],
    );
  }
  function newWorker() {
    worker.current?.terminate();
    const next = new GenerationWorker();
    worker.current = next;
    next.onerror = () => {
      if (worker.current !== next) return;
      job.current = null;
      setState("error");
      setError(
        "The local worker stopped. Retry the model or use the authored sample.",
      );
    };
    next.onmessage = ({ data }) => {
      if (
        worker.current !== next ||
        !job.current ||
        !accepts(job.current, data)
      )
        return;
      if (data.type === "progress") setStatus(data.text);
      if (data.type === "ready") {
        setState("ready");
        setStatus("Model ready on this device. Choose ideas, then build.");
        job.current = null;
      }
      if (data.type === "context") {
        if (pending.current) pending.current.context = data.context as Context;
        setStatus("Writing one short paragraph on your GPU…");
      }
      if (data.type === "story" && pending.current) {
        const completed = {
          ...pending.current,
          text: data.text,
          context: data.context,
          model: {
            id: manifest.modelId,
            revision: manifest.revision,
            runtime: manifest.runtime,
            usage: data.usage,
          },
        };
        setHistory((h) =>
          [completed, runRef.current, ...h]
            .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
            .slice(0, 5),
        );
        setRun(completed);
        pending.current = null;
        job.current = null;
        setState("ready");
        setStatus("Story ready. Inspect what the model was given.");
      }
      if (data.type === "removed" || data.type === "unloaded") {
        setState("idle");
        setStatus(
          data.type === "removed"
            ? "Source Trail’s downloaded generator removed. Unrelated site data was not cleared."
            : "GPU model unloaded. Downloaded weights remain cached.",
        );
        job.current = null;
        next.terminate();
        worker.current = null;
      }
      if (data.type === "error") {
        setError(data.text);
        setState("error");
        pending.current = null;
        job.current = null;
      }
    };
    return next;
  }
  async function load() {
    setConsent(false);
    setError("");
    setStatus("Checking browser GPU features and storage estimate…");
    const id = ++serial.current;
    job.current = { jobId: id, revision: pack.revision };
    setState("loading");
    try {
      const reason = await preflight();
      if (job.current?.jobId !== id) return;
      if (reason) {
        setError(reason);
        setState("idle");
        job.current = null;
        return;
      }
      const w = newWorker();
      w.postMessage({ type: "load", ...job.current });
    } catch {
      if (job.current?.jobId !== id) return;
      setError(
        "Browser preflight failed. The authored sample remains available.",
      );
      setState("error");
    }
  }
  function generate() {
    if (selected.length < 3 || selected.length > 5) {
      setError("Choose three to five ideas.");
      return;
    }
    if (state !== "ready" || !worker.current) {
      setConsent(true);
      return;
    }
    const frozen = snapshot(pack),
      retrieved = retrieve(frozen, selected.join(" "));
    if (!retrieved.length) {
      setError(
        "No close passage retrieved with text matching. Choose another idea.",
      );
      return;
    }
    setError("");
    setState("writing");
    setStatus("Retrieving passages from Meadow Atlas…");
    const identity = { jobId: ++serial.current, revision: frozen.revision };
    job.current = identity;
    pending.current = {
      id: `story-${identity.jobId}`,
      kind: "local-generation",
      words: [...selected],
      packId: frozen.id,
      revision: frozen.revision,
      sources: frozen.sources,
      retrieved,
      context: null,
      text: "",
      model: null,
      createdAt: new Date().toISOString(),
    };
    worker.current.postMessage({
      type: "generate",
      ...identity,
      words: [...selected],
      passages: retrieved,
    });
  }
  function open(kind: typeof drawer, query = run.text) {
    trigger.current = document.activeElement as HTMLElement;
    setRelated(
      retrieve(
        {
          id: run.packId,
          version: "1",
          revision: run.revision,
          sources: run.sources,
        },
        query,
      ),
    );
    setDrawer(kind);
  }
  function close() {
    dialog.current?.close();
    setDrawer(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function exportRun() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...run,
            notice:
              "Supplied or related passages do not prove that every story detail is supported.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "source-trail-story.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function save() {
    try {
      const next = editSource(pack, editId, draft);
      cancel(
        "Source saved as a new version. Earlier stories keep their original evidence.",
      );
      setPack(next);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  function forget() {
    cancel(
      "Session forgotten. Authored example restored; downloaded public weights remain cached.",
    );
    setPack(initialAtlas());
    setRun(sampleRun(initialAtlas()));
    setHistory([]);
    setSelected(["rabbit", "bridge", "sun"]);
    setDraft(initialAtlas().sources[1]!.text);
    setEditId("bridge");
    setError("");
    setDrawer(null);
    setConsent(false);
  }
  function cacheAction(type: "remove" | "unload") {
    setError("");
    setStatus("Updating local model storage…");
    setState("loading");
    pending.current = null;
    const w = worker.current ?? newWorker();
    job.current = { jobId: ++serial.current, revision: pack.revision };
    w.postMessage({ type, ...job.current });
  }
  const ordered = [
    ...words.slice(shuffle % words.length),
    ...words.slice(0, shuffle % words.length),
  ];
  return (
    <div
      className={`story-app ${opaque ? "opaque" : ""}`}
      data-mood={mood}
      data-tone={tone}
    >
      <Horizon paused={paused || busy} mood={mood} />
      <header className="story-header">
        <a className="story-brand" href={base}>
          <span aria-hidden="true">s↗</span> source trail
          <span className="brand-dot">.</span>
        </a>
        <nav aria-label="Product views">
          <a href="#lab" aria-current="page">
            Story Lab
          </a>
          <a href={`${base}baseline/`}>Evidence Desk ↗</a>
          <a href="#how">How it works</a>
        </nav>
        <details className="appearance">
          <summary>Appearance</summary>
          <div>
            <label>
              Sky{" "}
              <select value={mood} onChange={(e) => setMood(e.target.value)}>
                {[
                  "cloudy-blue",
                  "sunny-gold",
                  "yellow-dusk",
                  "cyan-dawn",
                  "night",
                ].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Reading tone{" "}
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="paper">Warm paper</option>
                <option value="ink">Deep ink</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={opaque}
                onChange={(e) => setOpaque(e.target.checked)}
              />{" "}
              Opaque tablets
            </label>
            <label>
              <input
                type="checkbox"
                checked={paused}
                onChange={(e) => setPaused(e.target.checked)}
              />{" "}
              Pause atmosphere
            </label>
          </div>
        </details>
      </header>
      <main id="lab">
        <section className="story-intro">
          <p className="kicker">A LITTLE FICTION. AN INSPECTABLE TRAIL.</p>
          <h1>
            Create something.
            <br />
            <em>Follow it back.</em>
          </h1>
          <p className="intro-copy">
            Choose a few ideas, build a short story, then inspect the passages
            the model was given.
          </p>
          <div className="local-note">
            <span aria-hidden="true">✦</span> Your words stay on this device{" "}
            <span>Meadow Atlas is authored fiction</span>
          </div>
        </section>
        <section className="creation" aria-labelledby="choose-title">
          <div className="word-stage">
            <div className="step-heading">
              <span>01 / GATHER</span>
              <button
                className="text-button"
                onClick={() => setShuffle((s) => s + 5)}
              >
                Shuffle arrangement ↻
              </button>
            </div>
            <h2 id="choose-title">What belongs in your story?</h2>
            <p>Pick three to five ideas. These are prompts, not evidence.</p>
            <div className="word-field" aria-label="Story ideas">
              {ordered.map((word, i) => (
                <button
                  className={`word-tablet tablet-${i % 4}`}
                  key={word}
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
            <div className="selection-line">
              <span>{selected.length} of 5 selected</span>
              <button
                className="text-button"
                onClick={() => {
                  if (busy) cancel();
                  setSelected(["rabbit", "bridge", "sun"]);
                }}
              >
                Use example
              </button>
            </div>
            <button
              className="primary-action"
              disabled={busy || selected.length < 3}
              onClick={generate}
            >
              {state === "ready"
                ? "Build a story on this device"
                : "Set up local story generation"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
            {busy && (
              <button className="secondary-action" onClick={() => cancel()}>
                Cancel{" "}
                {state === "loading" ? "download / preparation" : "generation"}
              </button>
            )}
            <p className="small-note">
              Known limitation: this small model has contradicted supplied rules
              in testing. Treat generated stories as drafts.
            </p>
            <p className="small-note">
              Optional model download · about 470 MB of public assets · WebGPU
              required
            </p>
            <p className="status" role="status" aria-live="polite">
              {status}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </div>
          <article className="reading-page" aria-labelledby="story-title">
            <div className="step-heading">
              <span>02 / READ</span>
              <span className="run-tag">
                {run.kind === "authored-sample"
                  ? "Authored example · no AI run"
                  : "Generated locally · needs review"}
              </span>
            </div>
            <div className="story-ornament" aria-hidden="true">
              ☼
            </div>
            <h2 id="story-title">
              {run.kind === "authored-sample"
                ? "A crossing into morning"
                : "A story from your ideas"}
            </h2>
            <p className="reading-instruction">
              Select a sentence to find related passages.
            </p>
            <div className="story-paragraph">
              {run.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s, i) => (
                <button
                  key={i}
                  className="sentence"
                  onClick={() => open("related", s.trim())}
                >
                  {s.trim()}{" "}
                </button>
              ))}
            </div>
            {run.creativeTwist && (
              <div className="twist">
                <span>Creative detail · authored, deliberately unmapped</span>
                <p>{run.creativeTwist}</p>
              </div>
            )}
            <div className="story-signoff">
              <span aria-hidden="true">⌁</span>
              <p>
                {run.kind === "authored-sample"
                  ? "Written as a teaching example. No passages were sent to a model."
                  : "Generated fiction can contradict its sources. Review the supplied passages."}
              </p>
            </div>
            {run.revision !== pack.revision && (
              <p className="superseded">
                Older source snapshot. The source pack has changed; this story
                retains its original evidence.
              </p>
            )}
            <div className="reading-actions">
              <button onClick={() => open("supplied")}>
                View supplied passages ↗
              </button>
              <button onClick={() => open("related")}>
                Find related passages
              </button>
              <button
                disabled={!!run.creativeTwist}
                onClick={() => setRun((r) => ({ ...r, creativeTwist: TWIST }))}
              >
                Add a creative twist
              </button>
              <button onClick={exportRun}>Export this run ↓</button>
            </div>
          </article>
        </section>
        <section className="trail-bar">
          <div>
            <span className="kicker">03 / FOLLOW THE TRAIL</span>
            <h2>
              A source is a starting point.
              <br />
              <em>It isn’t a seal of truth.</em>
            </h2>
          </div>
          <p>
            See exact excerpts and versions. Supplied context shows what the
            model received; related text does not prove it used a passage or
            supported every detail.
          </p>
          <button className="secondary-action" onClick={() => open("sources")}>
            Open Meadow Atlas ↗
          </button>
        </section>
        <section className="work-bridge">
          <div>
            <p className="kicker">FROM A MEADOW TO A WORKDAY</p>
            <h2>
              The same trail.
              <br />
              More practical questions.
            </h2>
            <p>
              Where should a damaged camera go? Which refund policy replaced the
              old one? Explore six fictional work notes with text matching or
              local semantic search.
            </p>
            <a className="primary-action" href={`${base}baseline/`}>
              Try this with work notes ↗
            </a>
          </div>
          <div className="note-stack" aria-hidden="true">
            <div>
              NOTE 04 · ARCHIVED
              <br />
              <strong>Refund policy / v1</strong>
              <span>Replaced. Keep the history.</span>
            </div>
            <div>
              NOTE 05 · CURRENT
              <br />
              <strong>Refund policy / v2</strong>
              <span>Open the exact passage.</span>
            </div>
          </div>
        </section>
        <section className="method" id="how">
          <p className="kicker">HOW IT WORKS</p>
          <h2>Ideas → passages → context → story</h2>
          <ol>
            <li>
              <strong>Retrieve</strong>
              <p>
                Text matching searches current Meadow Atlas sources. The
                original desk also offers MiniLM semantic retrieval.
              </p>
            </li>
            <li>
              <strong>Write locally</strong>
              <p>
                The optional Qwen model runs in a dedicated browser Worker. One
                request, a 4,096-token window, and at most 256 output tokens.
              </p>
            </li>
            <li>
              <strong>Inspect</strong>
              <p>
                Every live run retains the exact token-budgeted prompt and
                source snapshots. Similarity and citation IDs never certify
                truth.
              </p>
            </li>
          </ol>
          <p>
            The browser is TypeScript. The separate{" "}
            <a href="https://github.com/mastodonsharkgirl/source-trail/tree/codex/source-trail-story-lab/tools/python_rag">
              Python / LangChain companion
            </a>{" "}
            runs locally and demonstrates the same pipeline. LangChain assembles
            components; it is not a model.
          </p>
          <div className="method-links">
            <a href={`${base}evidence/evaluation.json`}>
              Original raw evaluation ↗
            </a>
            <a href={`${base}evidence/story-evaluation.json`}>
              Story retrieval evaluation ↗
            </a>
            <a href={`${base}evidence/MODEL_MANIFEST.json`}>
              Model provenance ↗
            </a>
          </div>
          <details>
            <summary>Privacy, downloads and session controls</summary>
            <p>
              No accounts, analytics or cloud inference. Your inputs, context
              and output stay in browser memory until you export them. Public
              model files download from pinned Hugging Face and GitHub URLs.
              Browser caches use disk and may be evicted. Quota estimates cannot
              measure your free drive space or VRAM. Allocation can fail even
              after preflight.
            </p>
            <p>
              Forgetting a session clears its content. Unloading releases model
              memory. Removing downloads deletes only this tool’s generator
              cache. A cancelled load may leave partial public assets. Normal
              HTTP cache behavior is controlled by your browser.
            </p>
            <div className="session-actions">
              <button onClick={forget}>Forget this session</button>
              <button disabled={busy} onClick={() => cacheAction("unload")}>
                Unload GPU model
              </button>
              <button disabled={busy} onClick={() => cacheAction("remove")}>
                Remove downloaded model
              </button>
            </div>
          </details>
          {history.length > 0 && (
            <details>
              <summary>Earlier runs in this session</summary>
              {history.map((r, i) => (
                <button key={`${r.id}-${i}`} onClick={() => setRun(r)}>
                  {r.kind} · {r.words.join(", ")} · source {r.revision}
                </button>
              ))}
            </details>
          )}
        </section>
      </main>
      <footer className="story-footer">
        <span>source trail.</span>
        <p>Built with AI assistance. Authored fiction, inspectable behavior.</p>
        <a href={`${base}evidence/README.txt`}>Project notes ↗</a>
      </footer>
      <dialog
        ref={loadDialog}
        className="trail-dialog"
        onCancel={() => setConsent(false)}
        onClose={() => setConsent(false)}
      >
        <h2>
          A small model.
          <br />A deliberate download.
        </h2>
        <p>
          <strong>{manifest.modelId}</strong> · Apache-2.0 · WebLLM 0.2.85.
        </p>
        <p>
          About 470 MB of public assets, cached on this device. The runtime
          estimates 1,629 MB GPU memory; actual use varies. Requires WebGPU,
          shader-f16 and sufficient GPU buffer limits.
        </p>
        <p>
          Your words are never sent to a hosted model. Downloading does contact
          the public asset hosts. The authored example works without this
          download.
        </p>
        <div className="session-actions">
          <button className="primary-action" onClick={load}>
            Download and prepare model
          </button>
          <button onClick={() => setConsent(false)}>
            Keep exploring the example
          </button>
        </div>
      </dialog>
      <dialog
        ref={dialog}
        className="trail-dialog evidence-dialog"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setDrawer(null)}
      >
        <div className="dialog-heading">
          <p className="kicker">THE EVIDENCE DESK</p>
          <button aria-label="Close evidence" onClick={close}>
            Close ×
          </button>
        </div>
        <h2>
          {drawer === "sources"
            ? "Inside Meadow Atlas"
            : drawer === "supplied"
              ? "What the model received"
              : "Related passages"}
        </h2>
        {drawer === "sources" ? (
          <>
            <p>
              Eight authored fictional notes. Current versions guide new
              stories; archived rules remain visible for comparison.
            </p>
            <label>
              Source to edit
              <select
                value={editId}
                onChange={(e) => {
                  setEditId(e.target.value);
                  setDraft(
                    pack.sources.find((s) => s.id === e.target.value)!.text,
                  );
                }}
              >
                {pack.sources
                  .filter((s) => s.status === "current")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · v{s.version}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Source text
              <textarea
                aria-label="Source text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                rows={5}
              />
            </label>
            <button className="primary-action" onClick={save}>
              Save as a new version
            </button>
            {error && <p role="alert">{error}</p>}
            {pack.sources.map((s) => (
              <section className="excerpt" key={s.id}>
                <small>
                  {s.id} · version {s.version} · {s.status} · {s.contentId}
                </small>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </section>
            ))}
          </>
        ) : (
          <>
            <p>
              {drawer === "supplied"
                ? "These passages were supplied to the model. Related text is not proof that every story detail is supported."
                : "Text matching against this run’s source snapshot. A related passage is not a support assessment."}
            </p>
            {run.revision !== pack.revision && (
              <p className="superseded">
                Superseded source snapshot, retained exactly as it was.
              </p>
            )}
            {drawer === "supplied" && !run.context ? (
              <p className="empty-evidence">
                This is an authored example. No generation request was made, so
                there is no supplied model context. Use “Find related passages”
                to explore the source pack.
              </p>
            ) : (
              <>
                {(drawer === "supplied" ? run.context?.supplied : related)?.map(
                  (p) => (
                    <section className="excerpt" key={p.id}>
                      <small>
                        {drawer === "supplied"
                          ? "Context supplied"
                          : "Related passage"}{" "}
                        · Exact excerpt
                      </small>
                      <h3>{p.title}</h3>
                      <blockquote>{p.text}</blockquote>
                      <p className="source-id">
                        {p.sourceId} · version {p.version} · span {p.start}–
                        {p.end} · {p.contentId}
                      </p>
                    </section>
                  ),
                )}
                {drawer === "related" && !related.length && (
                  <p>
                    No close passage retrieved with text matching. That does not
                    prove no support exists.
                  </p>
                )}
              </>
            )}
            {drawer === "supplied" && run.context && (
              <details>
                <summary>Exact final prompt and token budget</summary>
                <p>
                  {run.context.promptTokens} prompt tokens +{" "}
                  {run.context.outputReserve} reserved output /{" "}
                  {run.context.window}. Dropped passages:{" "}
                  {run.context.dropped.join(", ") || "none"}. No source was
                  silently shortened.
                </p>
                <pre>{run.context.prompt}</pre>
              </details>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
