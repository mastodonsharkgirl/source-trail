"""Explicit, hash-selected local export. Never turns test output into evidence."""
import argparse
from .contracts import exact_keys
from .report import load_recorded_run, markdown, selected_pointer
from .runner import EVIDENCE, REPO, encode, sha256


def validate_export(report, pointer):
    exact_keys(pointer, ("schemaVersion", "runId", "reportSha256"), "selected pointer")
    if pointer["schemaVersion"] != 1 or pointer["runId"] != report["runId"] or pointer["reportSha256"] != sha256(encode(report)):
        raise ValueError("Selected run/hash does not match recomputed report")
    kind = report["provenance"].get("evidenceKind")
    if kind not in ("local-runtime", "unavailable"):
        raise ValueError("Only actual local-run or explicitly unavailable records may be exported; synthetic tests are forbidden")
    if kind == "unavailable" and (report["completion"] != "unavailable" or any(r["rawResponse"] is not None or r["runtime"].get("generatorCalls") for r in report["rows"])):
        raise ValueError("Unavailable evidence cannot contain invented model results")
    if report["split"] == "smoke":
        raise ValueError("Smoke attempts are retained as diagnostics, not a selected comparison")


def export_selected_run(run_id=None, check=False):
    pointer = selected_pointer(run_id)
    report = load_recorded_run(pointer["runId"])
    validate_export(report, pointer)
    directory = EVIDENCE / "runs" / report["runId"] / "reports" / pointer["reportSha256"]
    if (directory / "report.json").read_bytes() != encode(report) or (directory / "report.md").read_bytes() != markdown(report).encode():
        raise ValueError("Selected report snapshot is missing or changed")
    public = REPO / "public/evidence/policy-lab"
    outputs = {REPO / "src/data/policy-evaluation.json": encode(report), public / "report.json": encode(report), public / "report.md": markdown(report).encode(), public / "selected-run.json": encode(pointer)}
    for relative, digest in report["provenance"]["artifactHashes"].items():
        source = (EVIDENCE / relative).resolve()
        if not source.is_relative_to(EVIDENCE.resolve()):
            raise ValueError("Evidence export escapes fixed directory")
        content = source.read_bytes()
        if sha256(content) != digest:
            raise ValueError("Evidence changed during export")
        outputs[public / "evidence" / relative] = content
    for path, content in outputs.items():
        if not path.resolve().is_relative_to(REPO.resolve()):
            raise ValueError("Export target escapes repository")
        if check:
            if path.read_bytes() != content:
                raise ValueError(f"Recorded export differs: {path.name}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)


def main():
    parser = argparse.ArgumentParser(description="Export only an explicit recorded Policy Lab snapshot, locally")
    parser.add_argument("--run-id")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        export_selected_run(args.run_id, args.check)
        print("Selected local recorded export confirmed" if args.check else "Selected local recorded export written")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Policy export unavailable: {error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
