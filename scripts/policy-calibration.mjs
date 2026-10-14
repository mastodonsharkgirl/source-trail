import { choosePolicyThreshold } from "../src/policy/calibration.ts";

try {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 65536) throw new Error("Calibration input exceeds 64 KiB");
    chunks.push(chunk);
  }
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
  );
  if (
    value.schemaVersion !== 1 ||
    Object.keys(value).sort().join() !== "rows,schemaVersion" ||
    !Array.isArray(value.rows) ||
    value.rows.length !== 12
  )
    throw new Error("Calibration requires exactly 12 development score rows");
  const seen = new Set();
  for (const row of value.rows) {
    if (
      Object.keys(row).sort().join() !== "caseId,hasEvidence,topScore" ||
      typeof row.caseId !== "string" ||
      seen.has(row.caseId) ||
      typeof row.hasEvidence !== "boolean" ||
      (row.topScore !== null && !Number.isFinite(row.topScore))
    )
      throw new Error("Invalid calibration row");
    seen.add(row.caseId);
  }
  const choice = choosePolicyThreshold(value.rows);
  const candidates = choice.candidates.map((threshold) => {
    const outcomes = value.rows.map((row) => ({
      ...row,
      passed: row.topScore !== null && row.topScore >= threshold,
    }));
    const byClass = (expected) => {
      const rows = outcomes.filter((row) => row.hasEvidence === expected);
      const numerator = rows.filter((row) => row.passed === expected).length;
      return {
        numerator,
        denominator: rows.length,
        value: numerator / rows.length,
      };
    };
    const evidencePresent = byClass(true),
      evidenceAbsent = byClass(false);
    return {
      threshold,
      balancedAccuracy: (evidencePresent.value + evidenceAbsent.value) / 2,
      evidencePresent,
      evidenceAbsent,
      outcomes,
    };
  });
  process.stdout.write(
    JSON.stringify({
      schemaVersion: 1,
      threshold: choice.threshold,
      balancedAccuracy: choice.balancedAccuracy,
      rows: value.rows,
      candidates,
    }) + "\n",
  );
} catch (error) {
  process.stderr.write(
    `Policy calibration rejected: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
}
