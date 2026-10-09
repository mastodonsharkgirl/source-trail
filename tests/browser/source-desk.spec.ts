const prefix = process.env.SOURCE_TRAIL_BASE || "/";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("explicit real WASM search, privacy boundary, keyboard source and provenance", async ({
  page,
}, testInfo) => {
  const requests: { url: string; method: string; body: string | null }[] = [];
  const errors: string[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${prefix}baseline/`);
  await expect(
    page.getByRole("heading", { name: "Find the passage. Keep the source." }),
  ).toBeVisible();
  expect(requests.filter((r) => /models\//.test(r.url))).toHaveLength(0);
  const start = Date.now();
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  const loadMs = Date.now() - start;
  await page
    .getByLabel("Your question")
    .fill("What should I do with a broken borrowed camera?");
  const queryStart = Date.now();
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  const first = page.getByTestId("result").first();
  await expect(first).toContainText("camera:1", { timeout: 90_000 });
  const firstSearchMs = Date.now() - queryStart;
  await first.getByRole("button", { name: /Open source/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("reader")).toContainText(
    "If a borrowed camera is damaged",
  );
  await expect(page.getByTestId("reader").locator("mark")).toContainText(
    "take photographs",
  );
  const warm = Date.now();
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download search record" }),
  ).toBeEnabled();
  const warmSearchMs = Date.now() - warm;
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download search record" }).click();
  const download = await downloadPromise;
  const record = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(record.results[0].id).toBe("camera:1");
  expect(record.method).toBe("semantic");
  expect(record.model.assets).toHaveLength(6);
  expect(record.model.runtime).toContain("WASM");
  expect(record.model.runtime).toContain("1.31.0-dev.20260914-8d85527a0");
  expect(
    requests.every((r) => r.url.startsWith("http://127.0.0.1:4733/")),
  ).toBe(true);
  expect(requests.every((r) => r.method === "GET" && r.body === null)).toBe(
    true,
  );
  expect(requests.some((r) => r.url.endsWith(".wasm"))).toBe(true);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await page.screenshot({
    path: testInfo.outputPath("semantic-results.png"),
    fullPage: true,
  });
  await testInfo.attach("browser-measurement", {
    body: JSON.stringify({
      loadMs,
      firstSearchMs,
      warmSearchMs,
      requests: requests.length,
      userAgent: await page.evaluate(() => navigator.userAgent),
      context:
        "new Chromium context, localhost built CSP, HTTP no-store, 12 passages",
    }),
    contentType: "application/json",
  });
  await page
    .getByLabel("Your question")
    .fill("What do the two ticket refund notes say?");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("results")).toContainText("refund-old:1");
  await expect(page.getByTestId("results")).toContainText("refund-current:1");
  await page
    .getByTestId("result")
    .filter({ hasText: "refund-old:1" })
    .getByRole("button", { name: /Open source/ })
    .click();
  await expect(page.getByTestId("reader")).toContainText("2025-11 archived");
  await expect(page.getByTestId("reader").locator("mark")).toContainText(
    "twenty-four hours",
  );
  await page.screenshot({
    path: testInfo.outputPath("contradictory-versions.png"),
    fullPage: true,
  });
});

test("failed asset load is retryable and text matching remains available", async ({
  page,
}, testInfo) => {
  await page.route("**/models/**/model_quantized.onnx", (route) =>
    route.abort(),
  );
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry model download" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("alert")).toContainText(
    "The model files could not be downloaded or prepared.",
  );
  await page.screenshot({
    path: testInfo.outputPath("model-failure.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Text matching — no model", exact: true })
    .click();
  await page.getByLabel("Your question").fill("damaged camera");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("result").first()).toContainText("camera:1");
  await expect(page.getByTestId("results")).toContainText("Text matching");
  await page.unroute("**/models/**/model_quantized.onnx");
  await page.getByRole("button", { name: "Retry model download" }).click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
});

test("reset and edit during pending download recover without stale results", async ({
  page,
}, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/models/**/model_quantized.onnx", async (route) => {
    await gate;
    await route.continue().catch((error) => {
      expect(String(error)).toMatch(/Route is already handled|Target.*closed/);
    });
  });
  await page.goto(`${prefix}baseline/`);
  const pendingDownload = page.waitForRequest(
    "**/models/**/model_quantized.onnx",
  );
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await pendingDownload;
  await page.screenshot({
    path: testInfo.outputPath("model-loading.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Load local search model", exact: true }),
  ).toBeVisible();
  release();
  await page.unroute("**/models/**/model_quantized.onnx");
  let releaseEdit!: () => void;
  const editGate = new Promise<void>((resolve) => {
    releaseEdit = resolve;
  });
  await page.route("**/models/**/model_quantized.onnx", async (route) => {
    await editGate;
    await route.continue().catch((error) => {
      expect(String(error)).toMatch(/Route is already handled|Target.*closed/);
    });
  });
  const editingDownload = page.waitForRequest(
    "**/models/**/model_quantized.onnx",
  );
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await editingDownload;
  await page.getByRole("button", { name: "Edit this note" }).click();
  await page.getByLabel("Note title").fill("My camera note");
  await page.screenshot({
    path: testInfo.outputPath("note-editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("button", { name: "Load local search model", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("result")).toHaveCount(0);
  releaseEdit();
  await page.unroute("**/models/**/model_quantized.onnx");
});

test("limits, escaped note editing and revision invalidation", async ({
  page,
}) => {
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Text matching — no model", exact: true })
    .click();
  await page.getByLabel("Your question").fill("x".repeat(801));
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("800");
  await page.getByRole("button", { name: "Edit this note" }).click();
  await page
    .getByLabel("Note text")
    .fill("<img src=x onerror=alert(1)> private canary Ω🪴");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByTestId("reader")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("img").count()).toBe(0);
  await page.getByLabel("Your question").fill("canary");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("result").first()).toContainText("canary");
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(page.getByTestId("result")).toHaveCount(0);
  await expect(page.getByLabel("Your question")).toHaveValue("");
  await expect(page.getByTestId("reader")).not.toContainText("canary");
});

for (const width of [320, 375, 768, 1440])
  test(`readable layouts ${width}px and reduced motion`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${prefix}baseline/`);
    if (width < 760)
      await expect(page.locator(".source-index details")).not.toHaveAttribute(
        "open",
      );
    await page.screenshot({
      path: testInfo.outputPath(`initial-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Text matching — no model", exact: true })
      .click();
    await page.getByLabel("Your question").fill("current ticket refund");
    await page
      .getByRole("button", { name: "Find passages", exact: true })
      .click();
    await page
      .getByTestId("result")
      .first()
      .getByRole("button", { name: /Open source/ })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".source-row")
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toBe("0s");
    await page.screenshot({
      path: testInfo.outputPath(`desk-${width}.png`),
      fullPage: true,
    });
  });

test("owned note stays local during real inference, exact quote export and no-answer state", async ({
  page,
}, testInfo) => {
  const requests: { url: string; body: string | null }[] = [];
  page.on("request", (request) =>
    requests.push({ url: request.url(), body: request.postData() }),
  );
  await page.goto(`${prefix}baseline/`);
  await page.getByRole("button", { name: "Edit this note" }).click();
  const privateText =
    "PRIVATE-NOTE-CANARY-83: Return a damaged borrowed camera to the equipment coordinator for inspection. Photograph the damage first.";
  await page.getByLabel("Note text").fill(privateText);
  await page.getByRole("button", { name: "Save note" }).click();
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await page
    .getByLabel("Your question")
    .fill(
      "PRIVATE-QUESTION-CANARY-39: What happens to a damaged borrowed camera?",
    );
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("result").first()).toContainText(privateText);
  expect(JSON.stringify(requests)).not.toContain("PRIVATE-");
  expect(
    requests.every(
      (request) =>
        request.url.startsWith("http://127.0.0.1:4733/") &&
        request.body === null,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await page
    .getByLabel("Your question")
    .fill("Which train should I take to reach the venue?");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(
    page.getByText("No close passage found in these notes.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("no-close-match.png"),
    fullPage: true,
  });
});

test("actual tokenizer rejects an under-800-character over-token query without truncation", async ({
  page,
}) => {
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await page.getByLabel("Your question").fill("!".repeat(600));
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("model tokens");
  await expect(page.getByRole("alert")).toContainText("512");
  await expect(page.getByTestId("result")).toHaveCount(0);
});

test("reset during real pending inference discards the old job", async ({
  page,
}) => {
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  // Keep actual inference; hold only result delivery so the pending state is stable.
  await page.workers()[0]!.evaluate(() => {
    const scope = globalThis as unknown as {
      postMessage: (data: unknown) => void;
    };
    const send = scope.postMessage.bind(scope);
    scope.postMessage = (data) => {
      if ((data as { type?: string }).type === "results")
        setTimeout(() => send(data), 2000);
      else send(data);
    };
  });
  await page
    .getByLabel("Your question")
    .fill("What should I do with a broken borrowed camera?");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finding passages…" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Load local search model", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("result")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Text matching — no model", exact: true })
    .click();
  await page.getByLabel("Your question").fill("seeds blue tray");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("result").first()).toContainText("garden:1");
});

test("maximum-length unbroken source metadata remains readable at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${prefix}baseline/`);
  await page.getByRole("button", { name: "Edit this note" }).click();
  await page.getByLabel("Note title").fill("A".repeat(256));
  await page.getByLabel("Version or date").fill("B".repeat(128));
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByText("Browse 6 notes", { exact: false }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("cold model transfer sends the full weights once and stays within the advertised download", async ({
  page,
  request,
}, testInfo) => {
  const before = (await (await request.get("/__test_transfers")).json()).length;
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await page
    .getByLabel("Your question")
    .fill("What should I do with a broken borrowed camera?");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("result").first()).toContainText("camera:1");
  const records: { path: string; status: number; bodyBytes: number }[] = (
    await (await request.get("/__test_transfers")).json()
  ).slice(before);
  const assets = records.filter((row) =>
    row.path.startsWith(`${prefix}models/`),
  );
  const weights = assets.filter(
    (row) =>
      row.path.endsWith("model_quantized.onnx") && row.bodyBytes === 22_972_370,
  );
  await testInfo.attach("actual-server-transfers", {
    body: JSON.stringify({
      assets,
      totalModelBodyBytes: assets.reduce((sum, row) => sum + row.bodyBytes, 0),
    }),
    contentType: "application/json",
  });
  expect(weights).toHaveLength(1);
  expect(
    assets.reduce((sum, row) => sum + row.bodyBytes, 0),
  ).toBeLessThanOrEqual(38_000_000);
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

test("query edit cancels actual inference and announces an accurate idle state", async ({
  page,
}) => {
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Load local search model", exact: true })
    .click();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  // Keep actual inference; hold only result delivery so the pending state is stable.
  await page.workers()[0]!.evaluate(() => {
    const scope = globalThis as unknown as {
      postMessage: (data: unknown) => void;
    };
    const send = scope.postMessage.bind(scope);
    scope.postMessage = (data) => {
      if ((data as { type?: string }).type === "results")
        setTimeout(() => send(data), 2000);
      else send(data);
    };
  });
  await page
    .getByLabel("Your question")
    .fill("What should I do with a broken borrowed camera?");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finding passages…" }),
  ).toBeVisible();
  await page.getByLabel("Your question").fill("seeds blue tray");
  await expect(page.getByRole("status")).toContainText("Search cancelled");
  await expect(page.getByRole("status")).not.toContainText(
    "Reading your passages",
  );
  await expect(
    page.getByRole("button", { name: "Load local search model", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("result")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Text matching — no model", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("result").first()).toContainText("garden:1");
});

for (const width of [320, 375])
  test(`mobile source browsing and new-note focus at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${prefix}baseline/`);
    await page
      .getByRole("button", { name: "Text matching — no model", exact: true })
      .click();
    await page.getByLabel("Your question").fill("current ticket refund");
    await page
      .getByRole("button", { name: "Find passages", exact: true })
      .click();
    await page.locator(".source-index summary").click();
    const source = page
      .getByRole("navigation", { name: "Choose a source" })
      .getByRole("button", { name: /Projector setup/ });
    if (width === 320) await source.click();
    else {
      await source.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByTestId("reader")).toBeFocused();
    await expect(
      page
        .getByTestId("reader")
        .getByRole("heading", { name: "Projector setup" }),
    ).toBeInViewport();
    const add = page.getByRole("button", { name: "Add a note" });
    if (width === 320) await add.click();
    else {
      await add.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByLabel("Note title")).toBeFocused();
    await expect(page.getByLabel("Note title")).toBeInViewport();
    await expect(
      page
        .getByTestId("reader")
        .getByRole("heading", { name: "New note", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`new-note-${width}.png`),
    });
  });

test("abstention labels actual rows as reading alternatives, not matches", async ({
  page,
}) => {
  await page.goto(`${prefix}baseline/`);
  await page
    .getByRole("button", { name: "Text matching — no model", exact: true })
    .click();
  await page.getByLabel("Your question").fill("quuxxxyzzy");
  await page
    .getByRole("button", { name: "Find passages", exact: true })
    .click();
  await expect(page.getByTestId("results")).toContainText(
    "No close passage found",
  );
  await expect(
    page.getByTestId("results").locator(".column-heading"),
  ).toContainText("3 reading alternatives");
  await expect(
    page.getByTestId("results").locator(".column-heading"),
  ).not.toContainText("MATCHES");
});
