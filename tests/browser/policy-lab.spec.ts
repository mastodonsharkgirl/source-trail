import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import data from "../../src/data/policy-evaluation.json";
import { checkPolicyExport } from "../../scripts/check-policy-export.mjs";
import {
  buildCaseExport,
  filterRecordedCases,
  METHOD_LABELS,
  validatePolicyData,
} from "../../src/policy/viewer";

const prefix = process.env.SOURCE_TRAIL_BASE || "/";
const selectedRun = checkPolicyExport();
const verified = validatePolicyData(data, selectedRun);
const report = verified.evidenceKind === "recorded" ? verified.report : null;

test("Policy Lab displays its true evidence state without inference or persistent writes", async ({
  page,
}) => {
  const forbidden: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (
      !url.startsWith("http://127.0.0.1:4733/") ||
      /11434|\.onnx|tokenizer|\.wasm|\.worker|params_shard/.test(url)
    )
      forbidden.push(url);
  });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Policy Lab must not write persistent state");
    };
    indexedDB.open = () => {
      throw new Error("Policy Lab must not open a persistent database");
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${prefix}policy-lab/`);
  await expect(
    page.getByText("Recorded local evaluation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /All documents, organisations, roles and cases are fictional/,
    ),
  ).toBeVisible();
  if (!report) {
    await expect(
      page.getByRole("heading", { name: "No recorded run selected" }),
    ).toBeVisible();
    await expect(page.getByLabel("Saved case")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Export this recorded case" }),
    ).toHaveCount(0);
  } else
    await expect(page.getByText(report.runId, { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Product views" })
      .getByRole("link", { name: "Story Lab", exact: true }),
  ).toHaveAttribute("href", prefix);
  await expect(
    page
      .getByRole("navigation", { name: "Product views" })
      .getByRole("link", { name: "Evidence Desk", exact: true }),
  ).toHaveAttribute("href", `${prefix}baseline/`);
  expect(forbidden).toEqual([]);
  expect(errors).toEqual([]);
});

test("saved case changes, disclosures and export keep all methods together", async ({
  page,
}) => {
  test.skip(
    !report,
    "Actual selected evaluation is pending; synthetic results cannot satisfy recorded-run browser acceptance.",
  );
  if (!report) return;
  const records = filterRecordedCases(report, {
    tenant: null,
    role: null,
    group: null,
  });
  const selected = records[1];
  await page.goto(`${prefix}policy-lab/`);
  await page
    .getByLabel("Saved case", { exact: true })
    .selectOption(selected.caseId);
  for (const method of ["lexical", "semantic", "full-context"] as const) {
    const panel = page.getByRole("region", {
      name: METHOD_LABELS[method],
      exact: true,
    });
    await expect(panel).toContainText(selected.input.query);
    const disclosure = panel
      .locator("summary")
      .filter({ hasText: "Unedited model output" });
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure.locator("..")).toHaveAttribute("open", "");
    await expect(panel).toContainText(
      selected.rows.find((row) => row.method === method)!.rawResponse ??
        "No raw model response was recorded.",
    );
  }
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this recorded case" }).click();
  const download = await downloading;
  expect(await readFile((await download.path())!, "utf8")).toBe(
    buildCaseExport(report, selected.caseId, selectedRun!),
  );
});

test("filters never keep an answer from an excluded case", async ({ page }) => {
  test.skip(!report, "Actual selected evaluation is pending.");
  if (!report) return;
  const roles = ["employee", "manager", "security"];
  const tenants = ["cedar", "harbour"];
  await page.goto(`${prefix}policy-lab/`);
  for (const tenant of tenants) {
    for (const role of roles) {
      await page
        .getByLabel("Fictional tenant", { exact: true })
        .selectOption(tenant);
      await page
        .getByLabel("Recorded role", { exact: true })
        .selectOption(role);
      const matching = filterRecordedCases(report, {
        tenant,
        role,
        group: null,
      });
      if (!matching.length) {
        await expect(
          page.getByRole("heading", {
            name: "No saved cases match these filters",
          }),
        ).toBeVisible();
        await expect(page.locator(".policy-method")).toHaveCount(0);
      } else {
        const id = await page
          .getByLabel("Saved case", { exact: true })
          .inputValue();
        const record = matching.find((c) => c.caseId === id)!;
        expect(record).toBeDefined();
        for (const method of ["lexical", "semantic", "full-context"] as const)
          await expect(
            page.getByRole("region", {
              name: METHOD_LABELS[method],
              exact: true,
            }),
          ).toContainText(record.input.query);
      }
    }
  }
});

test("policy route is readable across the required widths and reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}policy-lab/`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to Policy Lab" }),
    ).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`policy-${width}-reduced.png`),
      fullPage: true,
    });
  }
});
