import { test, expect } from "@playwright/test";
const prefix = process.env.SOURCE_TRAIL_BASE || "/";
test("decorative WebGL pauses and loses context safely while DOM remains usable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    (window as any).__draws = 0;
    for (const name of ["drawElements", "drawArrays"] as const) {
      const original = WebGL2RenderingContext.prototype[name];
      (WebGL2RenderingContext.prototype[name] as any) = function (
        this: WebGL2RenderingContext,
        ...args: any[]
      ) {
        (window as any).__draws++;
        return (original as any).apply(this, args);
      };
    }
  });
  await page.goto(prefix);
  await expect(page.locator(".word-tablet")).toHaveCount(18);
  await page.waitForTimeout(500);
  const hasCanvas = await page.locator(".horizon-canvas canvas").count();
  if (hasCanvas) {
    await page.getByText("Appearance", { exact: true }).click();
    await page.getByLabel("Pause atmosphere").check();
    await page.waitForTimeout(80);
    const before = await page.evaluate(() => (window as any).__draws);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as any).__draws)).toBe(before);
    await page.getByLabel("Pause atmosphere").uncheck();
    await page.locator(".horizon-canvas canvas").evaluate((canvas) => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect(page.locator(".horizon-canvas canvas")).toHaveCSS(
      "display",
      "none",
    );
  }
  await page.getByRole("button", { name: "rainbow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "rainbow", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: info.outputPath("atmosphere-fallback.png"),
    fullPage: true,
  });
});
