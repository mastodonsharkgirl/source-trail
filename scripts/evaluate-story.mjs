import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";
const raw = await readFile("docs/story-lab/fixture.json");
const hash = createHash("sha256").update(raw).digest("hex");
if (hash !== "4925918450faaea53b7d571247b80da33c1d6fdd533263f51d1d8703edeab265")
  throw Error("Frozen fixture changed");
const f = JSON.parse(raw);
const sources = f.pack.sources.filter((s) => s.status === "current");
env.allowRemoteModels = false;
env.useFSCache = false;
const modelPath = path.resolve(
  "public/models/Xenova/all-MiniLM-L6-v2/751bff37182d3f1213fa05d7196b954e230abad9",
);
const model = await pipeline("feature-extraction", modelPath, {
  dtype: "q8",
  device: "cpu",
});
const opts = { pooling: "mean", normalize: true };
const vectors = (
  await model(
    sources.map((s) => s.text),
    opts,
  )
).tolist();
const terms = (s) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
async function measure(row) {
  const q = terms(row.query),
    vector = (await model(row.query, opts)).tolist()[0];
  const semantic = sources
    .map((s, i) => ({
      id: s.id,
      version: s.version,
      start: 0,
      end: s.text.length,
      score: vectors[i].reduce((sum, v, j) => sum + v * vector[j], 0),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const lexical = sources
    .map((s) => {
      const t = terms(s.text);
      return {
        id: s.id,
        version: s.version,
        start: 0,
        end: s.text.length,
        score:
          [...q].filter((x) => t.has(x)).length /
          Math.sqrt(Math.max(1, q.size * t.size)),
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { ...row, semantic, lexical };
}
const development = [];
for (const row of f.development) development.push(await measure(row));
const candidates = [0, 1, ...development.map((r) => r.semantic[0].score)];
const correct = (t) =>
  development.filter((r) => r.semantic[0].score >= t === r.gold.length > 0)
    .length;
const threshold = candidates.sort(
  (a, b) => correct(b) - correct(a) || b - a,
)[0];
const heldOut = [];
for (const row of f.heldOut) heldOut.push(await measure(row));
function summary(rows, method) {
  const answerable = rows.filter((r) => r.gold.length),
    missing = rows.filter((r) => !r.gold.length);
  const hits = (r) =>
    r[method]
      .slice(0, 3)
      .filter((p) =>
        r.gold.some(
          (g) =>
            g.id === p.id &&
            g.version === p.version &&
            g.start === p.start &&
            g.end === p.end,
        ),
      ).length;
  const accepted = (r) =>
    method === "semantic"
      ? r.semantic[0].score >= threshold
      : r.lexical[0].score > 0;
  return {
    answerableDenominator: answerable.length,
    noAnswerDenominator: missing.length,
    hitAt3: answerable.filter((r) => hits(r) > 0).length / answerable.length,
    recallAt3:
      answerable.reduce((sum, r) => sum + hits(r) / r.gold.length, 0) /
      answerable.length,
    answerableAccepted: answerable.filter(accepted).length,
    noAnswerFalsePositives: missing.filter(accepted).length,
  };
}
const result = {
  fixtureSha256: hash,
  definitions: {
    hitAt3:
      "Fraction of answerable queries with at least one gold version/span in top 3.",
    recallAt3:
      "Mean fraction of gold version/spans recovered in top 3 for each answerable query.",
  },
  runtime:
    "Transformers.js 4.3.0 real Node CPU MiniLM q8; not a browser GPU benchmark",
  semanticThreshold: threshold,
  thresholdSelection:
    "Development only; maximize answer/no-answer count with conservative tie-break",
  development: {
    lexical: summary(development, "lexical"),
    semantic: summary(development, "semantic"),
    rows: development,
  },
  heldOut: {
    lexical: summary(heldOut, "lexical"),
    semantic: summary(heldOut, "semantic"),
    rows: heldOut,
  },
  generation: JSON.parse(
    await readFile("docs/story-lab/generation-evaluation.json", "utf8"),
  ),
  limitations:
    "18 tiny authored questions; ranking metrics are not story truth or creativity scores. No tuning on held-out failures.",
};
await writeFile(
  "docs/story-lab/evaluation.json",
  JSON.stringify(result, null, 2) + "\n",
);
await model.dispose();
console.log(
  JSON.stringify({
    threshold,
    heldOut: result.heldOut.lexical,
    semantic: result.heldOut.semantic,
  }),
);
