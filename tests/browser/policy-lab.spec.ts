import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from 'node:fs';
import { serializeProps } from "../../node_modules/astro/dist/runtime/server/serialize.js";
import { checkPolicyExport } from "../../scripts/check-policy-export.mjs";
import {
  buildCaseExport,
  filterRecordedCases,
  METHOD_LABELS,
  validatePolicyData,
} from "../../src/policy/viewer";

const prefix = process.env.SOURCE_TRAIL_BASE || "/";
const data = JSON.parse(readFileSync('src/data/policy-evaluation.json', 'utf8'));
const selectedRun = checkPolicyExport();
const verified = validatePolicyData(data, selectedRun);
const report = verified.evidenceKind === "recorded" ? verified.report : null;

// Response-only test fixtures for error states; no selected/source files change.
async function substitutePolicyData(
  page: import("@playwright/test").Page,
  replacement: unknown,
  pointer: ReturnType<typeof checkPolicyExport>,
) {
  await page.route(`**${prefix}policy-lab/`, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const serialized = serializeProps(
      { data: replacement, base: prefix, selectedRun: pointer },
      { displayName: "PolicyLab", hydrate: "load", astroStaticSlot: true },
    )
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;");
    const island =
      /(<astro-island\b[^>]*component-url="[^"]*PolicyLab[^"]*"[^>]*\bprops=")[^"]*("[^>]*>)/;
    if (!island.test(body))
      throw new Error("Policy Lab island not found in built response");
    await route.fulfill({
      response,
      body: body.replace(island, (_match, opening, closing) => opening + serialized + closing),
    });
  });
}

test("unknown recorded data fails closed in the actual browser", async ({
  page,
}) => {
  await substitutePolicyData(
    page,
    { schemaVersion: 99, notice: "Explicit corrupt-data test fixture" },
    null,
  );
  await page.goto(`${prefix}policy-lab/`);
  await expect(page.getByRole("alert")).toContainText(
    "Recorded evidence could not be verified",
  );
  await expect(page.locator(".policy-method")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export this recorded case" }),
  ).toHaveCount(0);
});

test("actual partial-run fixture keeps missing generation and retained runtime failure visible", async ({
  page,
}) => {
  const partial = JSON.parse(
    await readFile(
      "docs/policy-lab/runs/policy-v7-dev-1/reports/79e816114b4d3ae85318d226dea1c96b659bfa234d3f6c3bac7fc949fd812007/report.json",
      "utf8",
    ),
  );
  await substitutePolicyData(page, partial, {
    schemaVersion: 1,
    runId: partial.runId,
    reportSha256:
      "79e816114b4d3ae85318d226dea1c96b659bfa234d3f6c3bac7fc949fd812007",
  });
  await page.goto(`${prefix}policy-lab/`);
  await expect(page.getByText(partial.runId, { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Saved case", exact: true })
    .selectOption("dev-orientation");
  await expect(
    page.getByRole("region", { name: "Lexical retrieval", exact: true }),
  ).toContainText("Not started");
  await expect(
    page.getByRole("region", { name: "Full context", exact: true }),
  ).toContainText("Runtime error");
  await expect(
    page.getByRole("region", { name: "Semantic retrieval", exact: true }),
  ).toContainText("Valid model output");
});

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
    .getByRole("combobox", { name: "Saved case", exact: true })
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
        "No decoded model response is available.",
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
        .getByRole("combobox", { name: "Fictional tenant", exact: true })
        .selectOption(tenant);
      await page
        .getByRole("combobox", { name: "Recorded role", exact: true })
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
          .getByRole("combobox", { name: "Saved case", exact: true })
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
