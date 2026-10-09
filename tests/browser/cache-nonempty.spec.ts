import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const prefix = process.env.SOURCE_TRAIL_BASE || "/";
test("real remove control clears representative nonempty model keys and preserves unrelated entries offline", async ({
  page,
}, info) => {
  const manifest = JSON.parse(await readFile("MODEL_MANIFEST.json", "utf8"));
  await page.goto(prefix);
  await page.evaluate(
    async ({ model, lib }) => {
      const cache = await caches.open("source-trail-story-v1/model");
      await cache.put(
        model + "tensor-cache.json",
        new Response(
          JSON.stringify({ records: [{ dataPath: "params_shard_0.bin" }] }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
      await cache.put(
        model + "params_shard_0.bin",
        new Response("REPRESENTATIVE FIXTURE; NOT MODEL WEIGHTS"),
      );
      await cache.put(
        model + "tokenizer.json",
        new Response("REPRESENTATIVE TOKENIZER FIXTURE"),
      );
      await cache.put(
        "https://example.invalid/unrelated-entry",
        new Response("retain same-cache sentinel"),
      );
      await (
        await caches.open("source-trail-story-v1/config")
      ).put(model + "mlc-chat-config.json", new Response("{}"));
      await (
        await caches.open("source-trail-story-v1/wasm")
      ).put(lib, new Response("REPRESENTATIVE WASM FIXTURE"));
      await (
        await caches.open("unrelated-sentinel")
      ).put("/keep", new Response("retain separate cache"));
    },
    { model: manifest.record.model, lib: manifest.record.model_lib },
  );
  const external: string[] = [];
  await page.route("https://**", (r) => {
    external.push(r.request().url());
    return r.abort();
  });
  await page
    .getByText("Privacy, downloads and session controls", { exact: true })
    .click();
  await page.getByRole("button", { name: "Remove downloaded model" }).click();
  await expect(page.getByRole("status")).toContainText(
    "downloaded generator removed",
  );
  const after = await page.evaluate(
    async ({ model, lib }) => {
      const cache = await caches.open("source-trail-story-v1/model");
      return {
        ownedModelKeys: (await cache.keys())
          .filter((k) => k.url.startsWith(model))
          .map((k) => k.url),
        configPresent: !!(await (
          await caches.open("source-trail-story-v1/config")
        ).match(model + "mlc-chat-config.json")),
        wasmPresent: !!(await (
          await caches.open("source-trail-story-v1/wasm")
        ).match(lib)),
        sameCacheSentinel: await (await cache.match(
          "https://example.invalid/unrelated-entry",
        ))!.text(),
        otherCacheSentinel: await (await (
          await caches.open("unrelated-sentinel")
        ).match("/keep"))!.text(),
      };
    },
    { model: manifest.record.model, lib: manifest.record.model_lib },
  );
  expect(after.ownedModelKeys).toEqual([]);
  expect(after.configPresent).toBe(false);
  expect(after.wasmPresent).toBe(false);
  expect(after.sameCacheSentinel).toBe("retain same-cache sentinel");
  expect(after.otherCacheSentinel).toBe("retain separate cache");
  expect(external).toEqual([]);
  await info.attach("nonempty-cache-removal", {
    body: JSON.stringify(
      {
        kind: "Representative nonempty CacheStorage fixture; real UI and library deletion APIs, no inference",
        after,
        externalRequests: external,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
