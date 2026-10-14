"""Serial experiment runner with immutable allocations, requests and failures."""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import subprocess
import threading
import time

from .contracts import HASH, IDENTIFIER, METHODS, exact_keys, strict_json, validate_model_answer, validate_prepared_case
from .ollama import LocalOllamaClient, OllamaError, OPTIONS, runtime_fields
from .prompt import render_prompt

REPO = Path(__file__).resolve().parents[2]
EVIDENCE = REPO / "docs" / "policy-lab"
MAX_PIPE = 2 * 1024 * 1024
JS_WHITESPACE = " \t\r\n\v\f\u00a0\ufeff\u2028\u2029\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000"


def encode(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode("utf-8")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def write_once(path, value):
    data = value if isinstance(value, bytes) else encode(value)
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def validate_run_id(value):
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value) or value == "budgets":
        raise ValueError("Run ID must be 1-80 lowercase letters/digits/hyphens, beginning with a letter/digit")
    return value


def bounded_process(command, stdin, cwd, *, limit=MAX_PIPE, timeout=120):
    """Drain both pipes within fixed bounds; terminate only this owned child on failure."""
    if len(stdin) > limit:
        raise ValueError("Node stdin exceeds 2 MiB")
    process = subprocess.Popen(command, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False)
    output, errors = [], []
    failed = threading.Event()

    def read(stream, chunks, cap):
        size = 0
        try:
            while True:
                chunk = stream.read1(min(65536, cap + 1 - size))
                if not chunk:
                    return
                size += len(chunk)
                if size > cap:
                    errors.append("Subprocess output limit exceeded")
                    failed.set()
                    return
                chunks.append(chunk)
        except OSError:
            errors.append("Subprocess pipe failed")
            failed.set()

    def write():
        try:
            process.stdin.write(stdin)
            process.stdin.close()
        except OSError:
            errors.append("Subprocess input pipe failed")
            failed.set()

    stderr = []
    threads = [threading.Thread(target=read, args=(process.stdout, output, limit)), threading.Thread(target=read, args=(process.stderr, stderr, 65536)), threading.Thread(target=write)]
    deadline = time.monotonic() + timeout
    try:
        for thread in threads:
            thread.start()
        while process.poll() is None:
            if time.monotonic() >= deadline:
                raise ValueError("Subprocess exceeded time limit")
            if failed.wait(.02):
                raise ValueError(errors[0])
        for thread in threads:
            thread.join(max(0, deadline - time.monotonic()))
        if any(thread.is_alive() for thread in threads):
            raise ValueError("Subprocess pipes exceeded time limit")
        if errors or process.returncode:
            # stderr stays bounded and local; don't echo arbitrary subprocess data.
            raise ValueError(errors[0] if errors else f"Context subprocess exited {process.returncode}")
        return b"".join(output)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        for thread in threads:
            if thread.ident is not None:
                thread.join(timeout=1)
        for stream in (process.stdin, process.stdout, process.stderr):
            stream.close()


def prepare_cases(fixture, cases, fixture_hash, threshold, *, invoke=None):
    safe = [{"caseId": case["caseId"], "input": copy.deepcopy(case["input"])} for case in cases]
    if len({c["caseId"] for c in safe}) != len(safe):
        raise ValueError("Duplicate requested case IDs")
    request = {"schemaVersion": 1, "fixtureHash": fixture_hash, "documents": fixture["documents"], "cases": safe, "threshold": threshold}
    wire = encode(request)
    if len(wire) > MAX_PIPE:
        raise ValueError("Context request exceeds 2 MiB")
    if invoke is None:
        invoke = lambda data: bounded_process(["node", "--experimental-strip-types", "scripts/prepare-policy-contexts.mjs"], data, REPO)
    response = invoke(wire)
    if not isinstance(response, bytes) or len(response) > MAX_PIPE:
        raise ValueError("Context response exceeds 2 MiB or is not bytes")
    result = strict_json(response.decode("utf-8", errors="strict"))
    return validate_contexts(result, fixture, safe, fixture_hash)


def canonical_passages(fixture):
    """Check serialized source identity using the shared paragraph/UTF-16 contract.

    This does no ranking, embedding or eligibility selection. JavaScript whitespace
    is explicit: Python's broader Unicode whitespace would change passage IDs.
    """
    passages = {}
    for doc in fixture["documents"]:
        search_from = 0
        blocks = [part.strip(JS_WHITESPACE) for part in re.split(r"\r?\n[" + JS_WHITESPACE + r"]*\r?\n", doc["text"])]
        for index, block in enumerate(filter(None, blocks), 1):
            start = doc["text"].index(block, search_from)
            end = start + len(block)
            search_from = end
            identifier = f'{doc["id"]}:{index}'
            passages[identifier] = {**doc, "id": identifier, "sourceId": doc["id"], "title": doc["title"].strip(JS_WHITESPACE), "version": doc["version"].strip(JS_WHITESPACE), "text": block, "start": len(doc["text"][:start].encode("utf-16-le")) // 2, "end": len(doc["text"][:end].encode("utf-16-le")) // 2, "documentSha256": sha256(doc["text"].encode("utf-8"))}
    return passages


def validate_contexts(result, fixture, cases, fixture_hash):
    exact_keys(result, ("schemaVersion", "fixtureHash", "cases", "encoder"), "context response")
    if result["schemaVersion"] != 1 or result["fixtureHash"] != fixture_hash or not isinstance(result["cases"], list):
        raise ValueError("Context version or fixture identity mismatch")
    if [c.get("caseId") for c in result["cases"]] != [c["caseId"] for c in cases]:
        raise ValueError("Missing, extra, reordered or duplicate context cases")
    documents = {d["id"] for d in fixture["documents"]}
    canonical = canonical_passages(fixture)
    for wanted, prepared in zip(cases, result["cases"], strict=True):
        validate_prepared_case(prepared)
        if prepared["input"] != wanted["input"]:
            raise ValueError("Context query identity mismatch")
        for selection in prepared["selections"]:
            if any(p["id"] not in canonical for p in selection["ranked"]) or any(d["id"] not in documents for d in selection["excluded"]):
                raise ValueError("Ranked passage or excluded document identity is not in the fixture")
            for passage in selection["supplied"]:
                if canonical.get(passage["id"]) != passage:
                    raise ValueError("Context passage identity, bytes, span or source metadata mismatch")
    return result


def save_contexts(path, contexts):
    content = encode(contexts)
    write_once(path, content)
    write_once(path.with_suffix(".sha256.json"), {"sha256": sha256(content)})


def read_contexts(path, fixture_hash, cases, fixture):
    content = path.read_bytes()
    binding = strict_json(path.with_suffix(".sha256.json").read_bytes())
    if len(content) > MAX_PIPE or binding != {"sha256": sha256(content)}:
        raise ValueError("Saved context hash/size mismatch")
    return validate_contexts(strict_json(content), fixture, cases, fixture_hash)


def bind_run_metadata(directory, protocol_bytes, provenance, allocation):
    if sha256(protocol_bytes) != allocation["protocolHash"] or provenance["sourceCommit"] != allocation["sourceCommit"] or provenance["sourceDirty"] is not False:
        raise ValueError("Run source/protocol identity mismatch")
    protocol_path = directory / "protocol.json"
    if protocol_path.exists():
        if sha256(protocol_path.read_bytes()) != allocation["protocolHash"]:
            raise ValueError("Saved protocol bytes disagree with allocation")
    else:
        write_once(protocol_path, protocol_bytes)
    provenance_path = directory / "provenance.json"
    if provenance_path.exists():
        saved = strict_json(provenance_path.read_bytes())
        if {k: v for k, v in saved.items() if k != "createdAt"} != {k: v for k, v in provenance.items() if k != "createdAt"}:
            raise ValueError("Saved executable/runtime provenance changed; cannot resume")
    else:
        write_once(provenance_path, provenance)


def validate_development_adjustment(value, prior_count):
    if prior_count == 0:
        if value is not None:
            raise ValueError("First development sweep must have a null developmentAdjustment")
    elif not isinstance(value, str) or not value.strip():
        raise ValueError("Second development sweep needs a nonempty explanation of the development-derived adjustment")


class RunStore:
    """One writer across all protocols/versions in this evidence directory."""
    def __init__(self, root):
        self.root = Path(root)
        self._lock = None

    def __enter__(self):
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = (self.root / ".runner.lock").open("a+b")
        self._lock.seek(0, 2)
        if self._lock.tell() == 0:
            self._lock.write(b"0")
            self._lock.flush()
        self._lock.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self._lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            self._lock.close()
            self._lock = None
            raise ValueError("Another Policy Lab runner owns the experiment lock") from error
        return self

    def __exit__(self, *_):
        if self._lock is not None:
            self._lock.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self._lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._lock, fcntl.LOCK_UN)
            self._lock.close()
            self._lock = None

    def _require_lock(self):
        if self._lock is None:
            raise ValueError("Run store requires exclusive writer lock")

    def require_stage_ready(self, stage, version):
        self._require_lock()
        validate_run_id(version)
        if stage == "smoke":
            return
        prior = [strict_json(p.read_bytes()) for p in (self.root / "budgets" / version).glob("*.json")]
        smoke = [a for a in prior if a["stage"] == "smoke"]
        if len(smoke) != 1 or any(self.row_state(smoke[0]["runId"], r) != "completed" for r in smoke[0]["rows"]):
            raise ValueError("All three smoke methods must complete the model contract before later stages")
        if stage == "held-out":
            development = [a for a in prior if a["stage"] == "development"]
            if not development or not any(all(self.row_state(a["runId"], r) in ("completed", "gate_abstained", "validation_error") for r in a["rows"]) for a in development):
                raise ValueError("Held-out requires a finished development sweep")

    def allocate(self, stage, run_id, version, fixture_hash, protocol_hash, case_ids, *, source_commit, resume=False):
        self._require_lock()
        validate_run_id(run_id)
        validate_run_id(version)
        if not isinstance(source_commit, str) or not re.fullmatch(r"[a-f0-9]{40}", source_commit):
            raise ValueError("A full source commit is required")
        if stage not in ("smoke", "development", "held-out") or len(case_ids) != (24 if stage == "held-out" else 12) or len(set(case_ids)) != len(case_ids):
            raise ValueError("Invalid stage or case grid")
        for identifier in case_ids:
            validate_run_id(identifier)
        for digest in (fixture_hash, protocol_hash):
            if not isinstance(digest, str) or not HASH.fullmatch(digest):
                raise ValueError("Invalid fixture/protocol hash")
        rows = [{"caseId": case_id, "method": METHODS[(i + j) % 3]} for i, case_id in enumerate(case_ids) for j in range(3)]
        if stage == "smoke":
            rows = [{"caseId": case_ids[i], "method": method} for i, method in enumerate(METHODS)]
        allocation = {"schemaVersion": 1, "runId": run_id, "stage": stage, "fixtureVersion": version, "fixtureHash": fixture_hash, "protocolHash": protocol_hash, "sourceCommit": source_commit, "rows": rows}
        budget_dir = self.root / "budgets" / version
        budget_dir.mkdir(parents=True, exist_ok=True)
        budget_file = budget_dir / f"{run_id}.json"
        run_dir = self.root / run_id
        if resume:
            if not budget_file.exists() or strict_json(budget_file.read_bytes()) != allocation:
                raise ValueError("Resume must match an existing allocation exactly")
            run_dir.mkdir(exist_ok=True)
            if not (run_dir / "allocation.json").exists():
                write_once(run_dir / "allocation.json", allocation)
            elif strict_json((run_dir / "allocation.json").read_bytes()) != allocation:
                raise ValueError("Run and budget allocations disagree")
            return allocation
        if run_dir.exists() or budget_file.exists():
            raise FileExistsError("Run ID already exists; use explicit resume for never-started rows")
        prior = [strict_json(path.read_bytes()) for path in budget_dir.glob("*.json")]
        if any(a["fixtureHash"] != fixture_hash for a in prior):
            raise ValueError("Fixture bytes changed without a new fixture version")
        if sum(a["stage"] == stage for a in prior) >= (2 if stage == "development" else 1):
            raise ValueError("Stage allocation ceiling reached for this fixture version, across protocols")
        if sum(len(a["rows"]) for a in prior) + len(rows) > 147:
            raise ValueError("Fixture version allocation ceiling exceeds 147 attempts")
        # Reserve budget first. A crash here can only consume capacity, never reset it.
        write_once(budget_file, allocation)
        run_dir.mkdir()
        write_once(run_dir / "allocation.json", allocation)
        return allocation

    def row_path(self, run_id, row):
        validate_run_id(run_id)
        validate_run_id(row["caseId"])
        if row["method"] not in METHODS:
            raise ValueError("Unknown method")
        return self.root / run_id / "rows" / f'{row["caseId"]}--{row["method"]}'

    def row_state(self, run_id, row):
        directory = self.row_path(run_id, row)
        if (directory / "output.json").exists():
            return strict_json((directory / "output.json").read_bytes())["status"]
        return "interrupted" if directory.exists() else "missing"

    def start_row(self, run_id, row):
        self._require_lock()
        allocation = strict_json((self.root / validate_run_id(run_id) / "allocation.json").read_bytes())
        if row not in allocation["rows"]:
            raise ValueError("Row was not preallocated")
        directory = self.row_path(run_id, row)
        directory.parent.mkdir(exist_ok=True)
        directory.mkdir()  # Even a crash before request write makes this sample non-retryable.
        write_once(directory / "started.json", {"startedAt": now(), **row})

        def record(name, data):
            if name not in ("request.json", "attempt.json", "response.bin", "output.json"):
                raise ValueError("Unknown row record")
            write_once(directory / name, data)
        return record


def run_case(prepared, method, protocol, client, *, record=None):
    validate_prepared_case(prepared)
    if method not in METHODS:
        raise ValueError("Unknown method")
    selection = copy.deepcopy(next(s for s in prepared["selections"] if s["method"] == method))
    started = time.perf_counter()
    runtime = runtime_fields({})
    runtime.update(generatorCalls=0, endToEndMs=None)
    row = {"schemaVersion": 1, "runId": protocol["runId"], "caseId": prepared["caseId"], "method": method, "input": copy.deepcopy(prepared["input"]), "selection": selection, "fixtureHash": protocol["fixtureHash"], "protocolHash": protocol["protocolHash"], "modelDigest": protocol["modelDigest"], "prompt": None, "rawResponse": None, "parsedResponse": None, "validationErrors": [], "status": "missing", "runtime": runtime, "assessment": None}
    save = record or (lambda *_: None)
    try:
        if selection["gate"] == "abstain":
            row["status"] = "gate_abstained"
        else:
            try:
                row["prompt"] = render_prompt(prepared["input"], selection["supplied"])
            except ValueError as error:
                row["status"] = "context_error"
                row["validationErrors"].append(str(error))
            if row["prompt"] is not None:
                def on_start(body):
                    save("request.json", {"schemaVersion": 1, "runId": row["runId"], "caseId": row["caseId"], "method": method, "fixtureHash": row["fixtureHash"], "protocolHash": row["protocolHash"], "modelDigest": row["modelDigest"], "input": row["input"], "selection": selection, "body": body})
                    save("attempt.json", {"startedAt": now(), "generatorCalls": 1})
                    runtime["generatorCalls"] = 1

                result = client.generate(row["prompt"], row["modelDigest"], on_start=on_start, on_raw=lambda wire: save("response.bin", wire))
                row["rawResponse"] = result["rawResponse"]
                runtime.update(result["runtime"])
                row["parsedResponse"], row["validationErrors"] = validate_model_answer(row["rawResponse"], selection["supplied"])
                row["status"] = "validation_error" if row["validationErrors"] else "completed"
    except OllamaError as error:
        row["status"] = "runtime_error"
        row["validationErrors"].append(str(error))
        row["rawResponse"] = error.raw_response
        if error.runtime:
            runtime.update(error.runtime)
    except KeyboardInterrupt:
        row["status"] = "interrupted"
        row["validationErrors"].append("Interrupted; this started sample must not be retried")
    runtime["endToEndMs"] = (time.perf_counter() - started) * 1000 + selection["timings"]["selectionMs"]
    save("output.json", row)
    return row


def require_committed(files, read_head):
    for name, content in files.items():
        try:
            committed = read_head(name)
        except (ValueError, OSError) as error:
            raise ValueError(f"Required committed artifact is unavailable: {name}") from error
        if committed != content:
            raise ValueError(f"Artifact must match committed bytes: {name}")


def git(*args):
    return bounded_process(["git", *args], b"", REPO)


def prompt_identity():
    return sha256((Path(__file__).with_name("prompt.py").read_bytes()) + b"\x00" + (Path(__file__).with_name("contracts.py").read_bytes()))


def load_experiment(stage):
    names = ("fixture.json", "rubric.json", "manifest.json", "protocol.json", "calibration.json")
    files = {name: (EVIDENCE / name).read_bytes() for name in names}
    fixture, manifest, protocol, calibration = [strict_json(files[name]) for name in ("fixture.json", "manifest.json", "protocol.json", "calibration.json")]
    fixture_hash = sha256(files["fixture.json"])
    if manifest["fixtureSha256"] != fixture_hash or manifest["rubricSha256"] != sha256(files["rubric.json"]):
        raise ValueError("Frozen fixture/rubric hashes disagree")
    required = {name: files[name] for name in names if stage == "held-out" or name in ("fixture.json", "rubric.json", "manifest.json")}
    require_committed(required, lambda name: git("show", f"HEAD:docs/policy-lab/{name}"))
    if git("status", "--porcelain", "--untracked-files=no").strip():
        raise ValueError("Tracked source must be clean before model runs")
    exact_keys(protocol, ("schemaVersion", "fixtureHash", "rubricHash", "threshold", "modelDigest", "templateSha256", "promptSha256", "calibrationSha256", "locked", "options", "methodOrder", "developmentAdjustment"), "protocol")
    if protocol["schemaVersion"] != 1 or protocol["fixtureHash"] != fixture_hash or protocol["rubricHash"] != manifest["rubricSha256"] or protocol["calibrationSha256"] != sha256(files["calibration.json"]):
        raise ValueError("Protocol artifact bindings disagree")
    if protocol["promptSha256"] != prompt_identity() or protocol["options"] != OPTIONS or protocol["methodOrder"] != "cyclic":
        raise ValueError("Protocol does not match the fixed executable prompt/settings")
    if type(protocol["locked"]) is not bool or (stage == "held-out" and protocol["locked"] is not True):
        raise ValueError("Held-out requires a locked protocol")
    adjustment = protocol["developmentAdjustment"]
    if adjustment is not None and (not isinstance(adjustment, str) or not adjustment.strip()):
        raise ValueError("developmentAdjustment must be null or a nonempty explanation")
    threshold = protocol["threshold"]
    if type(threshold) not in (float, int) or not math.isfinite(threshold) or calibration.get("threshold") != threshold or calibration.get("fixtureHash") != fixture_hash:
        raise ValueError("Calibration threshold/fixture mismatch")
    return fixture, protocol, sha256(files["protocol.json"]), {"sourceCommit": git("rev-parse", "HEAD").decode().strip(), "sourceDirty": False, "evidenceKind": "local-runtime", "pythonVersion": platform.python_version(), "platform": platform.platform(), "processor": platform.processor() or None, "hardwareMeasurement": "Not measured", "createdAt": now()}


def execute(stage, run_id, *, resume=False):
    validate_run_id(run_id)
    fixture, protocol, protocol_hash, provenance = load_experiment(stage)
    cases = fixture["heldOut" if stage == "held-out" else "development"]
    client = LocalOllamaClient()
    with RunStore(EVIDENCE / "runs") as store:
        store.require_stage_ready(stage, fixture["version"])
        if stage == "development" and not resume:
            prior = list((store.root / "budgets" / fixture["version"]).glob("*.json"))
            validate_development_adjustment(protocol["developmentAdjustment"], sum(strict_json(p.read_bytes())["stage"] == "development" for p in prior))
        allocation = store.allocate(stage, run_id, fixture["version"], protocol["fixtureHash"], protocol_hash, [c["caseId"] for c in cases], source_commit=provenance["sourceCommit"], resume=resume)
        directory = store.root / run_id
        bind_run_metadata(directory, (EVIDENCE / "protocol.json").read_bytes(), provenance, allocation)
        phase = "preflight"
        try:
            metadata = client.preflight(protocol["modelDigest"])
            if metadata["templateSha256"] != protocol["templateSha256"]:
                raise ValueError("Installed template differs from protocol")
            if not (directory / "model.json").exists():
                write_once(directory / "model.json", metadata)
            elif strict_json((directory / "model.json").read_bytes()) != metadata:
                raise ValueError("Runtime metadata changed; cannot resume this run")
            context_file = directory / "contexts.json"
            selected_ids = {r["caseId"] for r in allocation["rows"]}
            selected_cases = [c for c in cases if c["caseId"] in selected_ids]
            phase = "context-preparation"
            if context_file.exists():
                contexts = read_contexts(context_file, protocol["fixtureHash"], selected_cases, fixture)
            else:
                contexts = prepare_cases(fixture, selected_cases, protocol["fixtureHash"], protocol["threshold"])
                save_contexts(context_file, contexts)
            by_id = {c["caseId"]: c for c in contexts["cases"]}
            settings = {**protocol, "protocolHash": protocol_hash, "runId": run_id}
            phase = "generation"
            for row in allocation["rows"]:
                if store.row_state(run_id, row) != "missing":
                    continue
                record = store.start_row(run_id, row)
                result = run_case(by_id[row["caseId"]], row["method"], settings, client, record=record)
                if result["status"] in ("runtime_error", "context_error", "interrupted"):
                    return 1  # Stop resource/contract failures; preserve every started row.
        except (OSError, ValueError, OllamaError, KeyboardInterrupt) as error:
            write_once(directory / f"pipeline-error-{time.time_ns()}.json", {"recordedAt": now(), "phase": phase, "errorType": type(error).__name__, "message": str(error), "generationAttemptsRecorded": len(list(directory.glob("rows/*/attempt.json")))})
            return 1
        return 0 if all(store.row_state(run_id, row) not in ("missing", "interrupted") for row in allocation["rows"]) else 1


def main():
    parser = argparse.ArgumentParser(description="Bounded local Policy Lab evaluation; never retries started samples")
    parser.add_argument("--stage", choices=("smoke", "development", "held-out"), required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--resume", action="store_true", help="Complete only never-started preallocated rows of this run")
    args = parser.parse_args()
    try:
        return execute(args.stage, args.run_id, resume=args.resume)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Policy evaluation unavailable: {error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
