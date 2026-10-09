import { test, expect } from "@playwright/test";
import { readdir } from "node:fs/promises";
const prefix = process.env.SOURCE_TRAIL_BASE || "/";
test("actual page and worker response policies preserve baseline boundary", async ({
  request,
}) => {
  const story = await request.get(prefix),
    baseline = await request.get(`${prefix}baseline/`);
  expect(story.status()).toBe(200);
  expect(baseline.status()).toBe(200);
  const storyCSP = story.headers()["content-security-policy"]!,
    baselineCSP = baseline.headers()["content-security-policy"]!;
  expect(storyCSP).toContain("https://huggingface.co");
  expect(baselineCSP).toContain("connect-src 'self';");
  expect(baselineCSP).not.toContain("huggingface");
  for (const name of (await readdir("dist/_source-trail")).filter(
    (n) => n.startsWith("generation.worker") || n.startsWith("search.worker"),
  )) {
    const r = await request.get(`${prefix}_source-trail/${name}`);
    expect(r.status()).toBe(200);
    expect(
      r.headers()["content-security-policy"]?.includes("huggingface.co"),
    ).toBe(name.startsWith("generation.worker"));
  }
  expect(
    (await request.get(`${prefix}generation/tokenizer.json`)).status(),
  ).toBe(200);
  expect(
    (await request.get(`${prefix}evidence/story-evaluation.json`)).status(),
  ).toBe(200);
});
