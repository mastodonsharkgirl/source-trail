import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
/**
 * Read-only coherence gate; no inference, subprocesses, downloads or writes.
 * @param {string} root
 * @returns {{schemaVersion: 1, runId: string, reportSha256: string} | null}
 */
export function checkPolicyExport(root = repository) {
  const bundled = readFileSync(join(root, "src/data/policy-evaluation.json"));
  const report = JSON.parse(bundled.toString("utf8"));
  const publicRoot = join(root, "public/evidence/policy-lab");
  const selectedPath = join(root, "docs/policy-lab/selected-run.json");
  if (report.evidenceKind === "unavailable") {
    if (
      report.schemaVersion !== 1 ||
      typeof report.reason !== "string" ||
      !report.reason.trim() ||
      Object.keys(report).sort().join(",") !==
        "evidenceKind,reason,schemaVersion"
    )
      throw new Error("Invalid pending Policy Lab manifest");
    if (
      existsSync(selectedPath) ||
      ["report.json", "report.md", "selected-run.json", "evidence"].some(
        (name) => existsSync(join(publicRoot, name)),
      )
    )
      throw new Error(
        "Pending Policy Lab manifest coexists with stale selected evidence",
      );
    return null;
  }
  if (
    report.schemaVersion !== 1 ||
    !["local-runtime", "unavailable"].includes(report.provenance?.evidenceKind)
  )
    throw new Error("Unsupported recorded evidence kind");
  const pointerBytes = readFileSync(join(publicRoot, "selected-run.json"));
  const pointer = JSON.parse(pointerBytes.toString("utf8"));
  if (
    Object.keys(pointer).sort().join(",") !==
      "reportSha256,runId,schemaVersion" ||
    pointer.schemaVersion !== 1 ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(pointer.runId) ||
    !/^[a-f0-9]{64}$/.test(pointer.reportSha256)
  )
    throw new Error("Invalid selected Policy Lab pointer");
  const actualHash = createHash("sha256").update(bundled).digest("hex");
  if (pointer.runId !== report.runId || pointer.reportSha256 !== actualHash)
    throw new Error(
      "Bundled Policy Lab report does not match selected identity/hash",
    );
  if (!readFileSync(join(publicRoot, "report.json")).equals(bundled))
    throw new Error("Bundled and public Policy Lab report bytes differ");
  if (!readFileSync(selectedPath).equals(pointerBytes))
    throw new Error("Public Policy Lab pointer differs from local selection");
  const snapshot = join(
    root,
    "docs/policy-lab/runs",
    pointer.runId,
    "reports",
    pointer.reportSha256,
  );
  if (
    !readFileSync(join(snapshot, "report.json")).equals(bundled) ||
    !readFileSync(join(snapshot, "report.md")).equals(
      readFileSync(join(publicRoot, "report.md")),
    )
  )
    throw new Error("Policy Lab public report differs from immutable snapshot");
  return {
    schemaVersion: 1,
    runId: pointer.runId,
    reportSha256: pointer.reportSha256,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const selected = checkPolicyExport();
    console.log(
      selected
        ? `Policy Lab selected report confirmed: ${selected.runId} / ${selected.reportSha256}`
        : "Policy Lab pending manifest confirmed; no stale selected report artifacts.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Policy Lab evidence coherence failed",
    );
    process.exitCode = 1;
  }
}
