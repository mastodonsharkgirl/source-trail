import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const evidence = JSON.parse(
  readFileSync("docs/story-lab/generation-evaluation.json", "utf8"),
);
const prefix = process.env.SOURCE_TRAIL_BASE || "/";
test("one-minute recorded evidence walkthrough stays truthful without a model download", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { value: undefined }),
  );
  const start = Date.now();
  await page.goto(prefix);
  const trail = page.getByRole("region", { name: "A real run in three steps" });
  await expect(trail).toContainText("Recorded real run");
  await expect(trail.locator(".recorded-output")).toHaveText(
    evidence.samples[0].text,
  );
  await expect(
    page.getByRole("button", { name: "Set up local story generation" }),
  ).not.toBeVisible();
  await trail.getByRole("button", { name: "Inspect the answer" }).focus();
  await page.keyboard.press("Enter");
  const inspect = trail.getByRole("button", { name: "Hide inspection" });
  await inspect.hover();
  expect(
    await inspect.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 59, 73)");
  for (const passage of evidence.samples[0].context.supplied) {
    await expect(
      trail
        .locator(".recorded-source blockquote")
        .filter({ hasText: passage.text }),
    ).toHaveText(passage.text);
  }
  await expect(
    trail.getByRole("heading", {
      name: "Conflicts with evidence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(trail).toContainText("The bridge never opens at night.");
  await expect(
    trail.getByRole("heading", { name: "Supported detail", exact: true }),
  ).toBeVisible();
  await expect(
    trail.getByRole("heading", { name: "Missing evidence", exact: true }),
  ).toBeVisible();
  const missing = trail
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Missing evidence", exact: true }),
    });
  await expect(missing).toContainText("Follow-up question · not model output");
  await expect(missing).toContainText(
    "At what exact clock time does the bridge open?",
  );
  await trail.getByRole("button", { name: "rainbow", exact: true }).click();
  await expect(trail).toContainText("Retrieval preview only");
  await expect(trail.locator(".recorded-output")).toHaveText(
    evidence.samples[0].text,
  );
  await trail.getByRole("button", { name: "Restore recorded ideas" }).click();
  await expect(trail).not.toContainText("Retrieval preview only");
  expect(requests.every((u) => u.startsWith("http://127.0.0.1:4733/"))).toBe(
    true,
  );
  expect(
    requests.some((u) =>
      /tokenizer|\.wasm|generation\.worker|params_shard|onnx/.test(u),
    ),
  ).toBe(false);
  expect(Date.now() - start).toBeLessThan(60000);
  await info.attach("walkthrough", {
    body: JSON.stringify({
      elapsedMs: Date.now() - start,
      requests,
      kind: "Scripted journey, not a human comprehension study",
    }),
    contentType: "application/json",
  });
});
