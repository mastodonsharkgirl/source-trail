const prefix = process.env.SOURCE_TRAIL_BASE || "/";
import { test, expect } from "@playwright/test";
// Transport-only fixtures. These prove UI state handling, never model inference.
test("two runs retain their own source revisions after reopening and export", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => ({
          features: new Set(["shader-f16"]),
          limits: {
            maxStorageBufferBindingSize: 2 ** 30,
            maxBufferSize: 2 ** 30,
          },
        }),
      },
    });
    const Original = window.Worker;
    let count = 0;
    class Transport extends EventTarget {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror = null;
      terminate() {}
      postMessage(d: any) {
        const send = (data: any) => {
          const e = new MessageEvent("message", { data });
          this.onmessage?.(e);
          this.dispatchEvent(e);
        };
        if (d.type === "load")
          setTimeout(() => send({ ...d, type: "ready" }), 5);
        if (d.type === "generate") {
          const n = ++count;
          setTimeout(
            () =>
              send({
                ...d,
                type: "story",
                text: `State fixture ${n}.`,
                context: {
                  prompt: "Transport fixture only; not model inference",
                  promptTokens: 1,
                  outputReserve: 256,
                  window: 4096,
                  supplied: d.passages,
                  dropped: [],
                  templateVersion: "test-only",
                },
              }),
            100,
          );
        }
        if (d.type === "cancel") send({ ...d, type: "cancelled" });
      }
    }
    window.Worker = class extends Original {
      constructor(url: URL | string, options?: WorkerOptions) {
        if (String(url).includes("generation.worker"))
          return new Transport() as unknown as Worker;
        super(url, options);
      }
    } as typeof Worker;
  });
  await page.goto(prefix);
  const setup = async () => {
    await page
      .getByRole("button", { name: "Set up local story generation" })
      .click();
    await page
      .getByRole("button", { name: "Download and prepare model" })
      .click();
    await expect(page.getByRole("status")).toContainText("Model ready");
  };
  await setup();
  await page
    .getByRole("button", { name: "Build a story on this device" })
    .click();
  await expect(page.locator(".story-paragraph")).toContainText(
    "State fixture 1.",
  );
  await page.getByRole("button", { name: "Open Meadow Atlas" }).click();
  await page
    .getByLabel("Source text", { exact: true })
    .fill("The bridge opens at noon.");
  await page.getByRole("button", { name: "Save as a new version" }).click();
  await page.getByRole("button", { name: "Close evidence" }).click();
  await setup();
  await page
    .getByRole("button", { name: "Build a story on this device" })
    .click();
  await expect(page.locator(".story-paragraph")).toContainText(
    "State fixture 2.",
  );
  await page.getByText("Earlier runs in this session", { exact: true }).click();
  const items = page
    .locator(".method details")
    .filter({
      has: page.getByText("Earlier runs in this session", { exact: true }),
    })
    .getByRole("button");
  const revisions = [];
  for (const index of [1, 0]) {
    await items.nth(index).click();
    const wait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export this run" }).click();
    const file = info.outputPath(`transport-run-${index}.json`);
    await (await wait).saveAs(file);
    const fs = await import("node:fs/promises");
    const run = JSON.parse(await fs.readFile(file, "utf8"));
    revisions.push(
      run.sources.find((s: { id: string }) => s.id === "bridge").version,
    );
    expect(run.context.prompt).toContain("Transport fixture");
  }
  expect(revisions).toEqual(["1", "2"]);
  await page
    .getByRole("button", { name: "Build a story on this device" })
    .click();
  await page.getByRole("button", { name: "rainbow", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("cancelled");
  await page.waitForTimeout(200);
  await expect(page.locator(".story-paragraph")).toContainText(
    "State fixture 2.",
  );
});
