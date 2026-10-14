import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { checkPolicyExport } from "../scripts/check-policy-export.mjs";

const roots: string[] = [];
function setup(recorded = true) {
  const root = mkdtempSync(join(tmpdir(), "source-trail-policy-export-"));
  roots.push(root);
  function write(path: string, value: string) {
    const destination = join(root, path);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, value);
  }
  if (!recorded) {
    write(
      "src/data/policy-evaluation.json",
      JSON.stringify({
        schemaVersion: 1,
        evidenceKind: "unavailable",
        reason: "Synthetic test only; no run",
      }),
    );
    return { root, write, pointer: null };
  }
  const report = JSON.stringify({
    schemaVersion: 1,
    runId: "synthetic-export-shape",
    provenance: { evidenceKind: "local-runtime" },
  });
  const reportSha256 = createHash("sha256").update(report).digest("hex");
  const pointer = {
    schemaVersion: 1,
    runId: "synthetic-export-shape",
    reportSha256,
  };
  write("src/data/policy-evaluation.json", report);
  write("public/evidence/policy-lab/report.json", report);
  write("public/evidence/policy-lab/report.md", "Synthetic test only");
  write(
    "public/evidence/policy-lab/selected-run.json",
    JSON.stringify(pointer),
  );
  write("docs/policy-lab/selected-run.json", JSON.stringify(pointer));
  write(
    `docs/policy-lab/runs/${pointer.runId}/reports/${reportSha256}/report.json`,
    report,
  );
  write(
    `docs/policy-lab/runs/${pointer.runId}/reports/${reportSha256}/report.md`,
    "Synthetic test only",
  );
  return { root, write, pointer };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    const target = resolve(root),
      parent = resolve(tmpdir());
    if (
      !target.startsWith(parent + sep) ||
      !basename(target).startsWith("source-trail-policy-export-")
    )
      throw new Error("Unsafe test cleanup target");
    rmSync(target, { recursive: true, force: true });
  }
});
describe("local Policy Lab build evidence coherence", () => {
  it("accepts a clean pending state and a coherent selected snapshot", () => {
    expect(checkPolicyExport(setup(false).root)).toBeNull();
    const fixture = setup();
    expect(checkPolicyExport(fixture.root)).toEqual(fixture.pointer);
  });
  it("rejects changed bundled bytes, selected hash/run ID and stale public reports", () => {
    for (const mutate of [
      (f: ReturnType<typeof setup>) =>
        f.write("src/data/policy-evaluation.json", '{"runId":"changed"}'),
      (f: ReturnType<typeof setup>) =>
        f.write(
          "public/evidence/policy-lab/selected-run.json",
          JSON.stringify({ ...f.pointer, reportSha256: "f".repeat(64) }),
        ),
      (f: ReturnType<typeof setup>) =>
        f.write(
          "public/evidence/policy-lab/selected-run.json",
          JSON.stringify({ ...f.pointer, runId: "another-run" }),
        ),
      (f: ReturnType<typeof setup>) =>
        f.write("public/evidence/policy-lab/report.json", '{"runId":"stale"}'),
      (f: ReturnType<typeof setup>) =>
        f.write("public/evidence/policy-lab/report.md", "Stale report notes"),
    ]) {
      const f = setup();
      mutate(f);
      expect(() => checkPolicyExport(f.root)).toThrow();
    }
  });
  it("rejects selected artifacts beside an unavailable manifest", () => {
    for (const path of [
      "public/evidence/policy-lab/report.json",
      "public/evidence/policy-lab/selected-run.json",
      "docs/policy-lab/selected-run.json",
      "public/evidence/policy-lab/evidence/old.json",
    ]) {
      const f = setup(false);
      f.write(path, "{}");
      expect(() => checkPolicyExport(f.root)).toThrow();
    }
  });
});
