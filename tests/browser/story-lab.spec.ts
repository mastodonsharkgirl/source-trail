const prefix = process.env.SOURCE_TRAIL_BASE || "/";
import { test, expect } from "@playwright/test";
for (const width of [360, 390, 768, 1440])
  test(`Story Lab sample and evidence at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(prefix);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:info.outputPath(`initial-${width}.png`),fullPage:true});
    await expect(
      page.getByRole("heading", { name: "What belongs in your story?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "View supplied passages" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "No generation request was made",
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Find related passages", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Exact excerpt");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add a creative twist" }).click();
    await expect(page.locator(".twist")).toContainText("deliberately unmapped");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`story-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(requests.every((u) => u.startsWith("http://127.0.0.1:4733/"))).toBe(
      true,
    );
    expect(requests.some((u) => u.includes("tokenizer.json"))).toBe(false);
  });
test("source versions, export, reset, keyboard and privacy", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url() + (r.postData() || "")));
  await page.goto(prefix);
  await page.getByRole("button", { name: "Open Meadow Atlas" }).click();
  await page
    .getByLabel("Source text", { exact: true })
    .fill("PRIVATE-STORY-CANARY: The bridge opens at noon.");
  await page.getByRole("button", { name: "Save as a new version" }).click();
  await expect(page.getByRole("dialog")).toContainText("version 2");
  await page.keyboard.press("Escape");
  await expect(page.locator(".reading-page")).toContainText(
    "Older source snapshot",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this run" }).click();
  const dl = await download;
  const path = info.outputPath("sample-export.json");
  await dl.saveAs(path);
  const fs = await import("node:fs/promises");
  const run = JSON.parse(await fs.readFile(path, "utf8"));
  expect(run.kind).toBe("authored-sample");
  expect(
    run.sources.find((s: { id: string }) => s.id === "bridge").text,
  ).toContain("sunrise");
  expect(run.context).toBeNull();
  expect(JSON.stringify(requests)).not.toContain("PRIVATE-STORY-CANARY");
  await page
    .getByText("Privacy, downloads and session controls", { exact: true })
    .click();
  await page.getByRole("button", { name: "Forget this session" }).click();
  await expect(page.locator(".superseded")).toHaveCount(0);
  await page.getByRole("button", { name: "rainbow", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "rainbow", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("download disclosure and no-WebGPU fallback", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { value: undefined }),
  );
  await page.goto(prefix);
  await page
    .getByRole("button", { name: "Set up local story generation" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("470 MB");
  await page
    .getByRole("button", { name: "Download and prepare model" })
    .click();
  await expect(page.getByRole("alert")).toContainText("no WebGPU");
  await expect(page.locator(".story-paragraph")).toContainText("Pip");
});
test("opaque, forced colors, zoom and scoped cache deletion", async ({
  page,
}) => {
  await page.goto(prefix);
  await page.getByText("Appearance", { exact: true }).click();
  await page.getByLabel("Opaque tablets").check();
  expect(
    await page
      .locator(".word-tablet")
      .first()
      .evaluate((e) => getComputedStyle(e).backdropFilter),
  ).toBe("none");
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 720, height: 500 });
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    const cache = await caches.open("unrelated-sentinel");
    await cache.put("/sentinel", new Response("keep me"));
  });
  await page
    .getByText("Privacy, downloads and session controls", { exact: true })
    .click();
  await page.getByRole("button", { name: "Remove downloaded model" }).click();
  await expect(page.getByRole("status")).toContainText(
    "downloaded generator removed",
  );
  expect(
    await page.evaluate(
      async () =>
        !!(await (await caches.open("unrelated-sentinel")).match("/sentinel")),
    ),
  ).toBe(true);
  expect(
    (await page.evaluate(() => caches.keys())).every(
      (n) =>
        n === "unrelated-sentinel" || n.startsWith("source-trail-story-v1"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(async () => {
      const names = (await caches.keys()).filter((n) =>
        n.startsWith("source-trail-story-v1"),
      );
      return (
        await Promise.all(
          names.map(async (n) => (await (await caches.open(n)).keys()).length),
        )
      ).every((n) => n === 0);
    }),
  ).toBe(true);
});
