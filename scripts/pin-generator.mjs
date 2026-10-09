import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { prebuiltAppConfig, modelVersion } from "@mlc-ai/web-llm";
const id = "Qwen3.5-0.8B-q4f16_1-MLC";
const record = prebuiltAppConfig.model_list.find((x) => x.model_id === id);
if (!record)
  throw Error("Pinned WebLLM release does not include requested model");
const revision = "0ec138972555613c1d7812a821778ad0398c8790";
const libRevision = "025bcaf3780fa8254f5e5efd3bfea0a5397248f4";
const model = `https://huggingface.co/mlc-ai/${id}/resolve/${revision}/`;
const model_lib = record.model_lib.replace("/main/", `/${libRevision}/`);
const tree = await (
  await fetch(`https://huggingface.co/api/models/mlc-ai/${id}/tree/${revision}`)
).json();
const integrity = { onFailure: "error", tokenizer: {} };
const assets = [];
await fs.mkdir("public/generation", { recursive: true });
for (const [name, url] of [
  ["mlc-chat-config.json", model + "mlc-chat-config.json"],
  ["tokenizer.json", model + "tokenizer.json"],
  ["model.wasm", model_lib],
]) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sri = "sha256-" + createHash("sha256").update(bytes).digest("base64");
  assets.push({
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    url,
  });
  if (name === "model.wasm") integrity.model_lib = sri;
  else if (name === "mlc-chat-config.json") integrity.config = sri;
  else {
    integrity.tokenizer[name] = sri;
    await fs.writeFile("public/generation/tokenizer.json", bytes);
  }
}
const manifest = {
  schema: 1,
  modelId: id,
  revision,
  libraryRevision: libRevision,
  runtime: "@mlc-ai/web-llm 0.2.85",
  modelVersion,
  license: "Apache-2.0",
  licenseSource: "https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE",
  record: { ...record, model, model_lib, integrity },
  files: tree.map((x) => ({
    path: x.path,
    bytes: x.size,
    sha256: x.lfs?.oid ?? null,
  })),
  verifiedSmallAssets: assets,
  weightBytes: tree
    .filter((x) => x.path.endsWith(".bin"))
    .reduce((a, x) => a + x.size, 0),
  measuredBrowserTransferBytes: null,
  realGenerationStatus: "pending resource grant",
  context: 4096,
  outputCap: 256,
  cacheNamespace: "source-trail-story-v1",
  notes:
    "Runtime VRAM estimate is not measured VRAM or disk. Weight files pinned by immutable revision; runtime verifies config, tokenizer and WASM SRI. Tensor hashes are provenance, not an extra runtime verification claim.",
};
await fs.writeFile(
  "MODEL_MANIFEST.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    weightBytes: manifest.weightBytes,
    smallAssets: assets.map((x) => ({ name: x.name, bytes: x.bytes })),
  }),
);
