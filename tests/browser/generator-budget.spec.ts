import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
const prefix = process.env.SOURCE_TRAIL_BASE || "/";
test("real generator tokenizer budgets exact template and drops overflowing context without GPU", async ({
  page,
}) => {
  const raw = JSON.parse(
    await readFile("docs/story-lab/generation-evaluation.json", "utf8"),
  );
  const sample = raw.samples[0];
  const name = (await readdir("dist/_source-trail")).find((n) =>
    n.startsWith("generation.worker"),
  )!;
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(prefix);
  const counts = await page.evaluate(
    async ({ url, words, passages }) => {
      const worker = new Worker(url, { type: "module" });
      const messages: any[] = [];
      async function ask(id: number, p: any[]) {
        return await new Promise<any>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("Tokenizer timeout")),
            15000,
          );
          worker.onmessage = ({ data }) => {
            if (data.jobId === id) {
              clearTimeout(timer);
              resolve(data);
            }
          };
          worker.onerror = (e) => reject(Error(e.message));
          worker.postMessage({
            type: "budget",
            jobId: id,
            revision: "tokenizer-test",
            words,
            passages: p,
          });
        });
      }
      try {
        messages.push(await ask(1, passages));
        messages.push(
          await ask(
            2,
            passages.map((p: any) => ({ ...p, text: "alpha beta ".repeat(4000) })),
          ),
        );
        return messages;
      } finally {
        worker.terminate();
      }
    },
    {
      url: `${prefix}_source-trail/${name}`,
      words: sample.words,
      passages: sample.retrieved,
    },
  );
  expect(counts[0].context.promptTokens).toBe(207);
  expect(counts[1].context.dropped.length).toBeGreaterThan(0);
  expect(
    counts[1].context.promptTokens + counts[1].context.outputReserve,
  ).toBeLessThanOrEqual(4096);
  expect(requests.every((u) => u.startsWith("http://127.0.0.1:4733/"))).toBe(
    true,
  );
  expect(requests.some((u) => u.includes("params_shard"))).toBe(false);
});
