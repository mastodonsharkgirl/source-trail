import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const m = JSON.parse(await readFile("MODEL_MANIFEST.json", "utf8"));
const a = m.verifiedSmallAssets.find((a) => a.name === "tokenizer.json");
const file = "public/generation/tokenizer.json";
await mkdir("public/generation", { recursive: true });
let bytes;
try {
  bytes = await readFile(file);
} catch {}
if (!bytes || createHash("sha256").update(bytes).digest("hex") !== a.sha256) {
  const r = await fetch(a.url);
  if (!r.ok) throw Error("Tokenizer asset download failed");
  bytes = Buffer.from(await r.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== a.sha256)
    throw Error("Tokenizer integrity mismatch");
  await writeFile(file, bytes);
}
console.log(
  "Verified generator tokenizer; no generator weights downloaded by build.",
);
