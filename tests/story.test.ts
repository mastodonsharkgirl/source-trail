import { describe, it, expect } from "vitest";
import {
  initialAtlas,
  retrieve,
  snapshot,
  budgetContext,
  sampleRun,
  editSource,
  accepts,
  exactExcerpt,
} from "../src/story/core";
describe("story evidence boundaries", () => {
  it("keeps snapshots immutable across source edits", () => {
    const pack = initialAtlas();
    const run = sampleRun(pack);
    const before = JSON.stringify(run);
    const next = editSource(pack, "bridge", "The bridge opens at noon.");
    expect(next.revision).not.toBe(pack.revision);
    expect(JSON.stringify(run)).toBe(before);
    expect(run.sources.find((x) => x.id === "bridge")?.text).toContain(
      "sunrise",
    );
  });
  it("only returns actual lexical overlap and exact spans", () => {
    const pack = initialAtlas();
    expect(retrieve(pack, "quuxxyzzy")).toEqual([]);
    for (const p of retrieve(pack, "rabbit bridge"))
      expect(exactExcerpt(p)).toBe(true);
  });
  it("budgets the complete rendered prompt and visibly drops context", () => {
    const p = initialAtlas();
    const passages = retrieve(p, "rabbit bridge sun");
    const count = (s: string) => s.length;
    const full = budgetContext(
      ["rabbit", "bridge", "sun"],
      passages,
      count,
      10000,
      256,
    );
    const small = budgetContext(
      ["rabbit", "bridge", "sun"],
      passages,
      count,
      full.promptTokens,
      256,
    );
    expect(small.promptTokens + small.outputReserve).toBeLessThanOrEqual(
      full.promptTokens,
    );
    expect(small.dropped.length).toBeGreaterThan(0);
    expect(() =>
      budgetContext(["rabbit", "bridge", "sun"], passages, count, 10, 256),
    ).toThrow();
  });
  it("rejects stale jobs and changed corpus revisions", () => {
    expect(
      accepts({ jobId: 2, revision: "a" }, { jobId: 1, revision: "a" }),
    ).toBe(false);
    expect(
      accepts({ jobId: 2, revision: "b" }, { jobId: 2, revision: "a" }),
    ).toBe(false);
  });
  it("exports source identity and distinguishes authored sample from generation", () => {
    const run = sampleRun(initialAtlas());
    expect(run.kind).toBe("authored-sample");
    expect(run.context).toBeNull();
    expect(snapshot(initialAtlas()).sources.every((s) => s.contentId)).toBe(
      true,
    );
  });
});
