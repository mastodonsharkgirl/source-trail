import { readFile, writeFile, mkdir, cp, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = (process.env.SOURCE_TRAIL_BASE || "/").replace(/\/?$/, "/");
const origins =
  "https://huggingface.co https://us.aws.cdn.hf.co https://raw.githubusercontent.com";
const policy = (hashes = [], external = false) =>
  `default-src 'none'; script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'${external ? " " + origins : ""}; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`;
let headers = `${base}*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`;
for (const [file, route, external] of [
  ["index.html", "", true],
  ["baseline/index.html", "baseline/", false],
]) {
  const html = await readFile("dist/" + file, "utf8");
  const hashes = [
    ...new Set(
      [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
        .filter((m) => !/\bsrc=/.test(m[1]) && m[2].trim())
        .map(
          (m) =>
            `'sha256-${createHash("sha256").update(m[2]).digest("base64")}'`,
        ),
    ),
  ];
  for (const url of [base + route, base + file])
    headers += `${url}\n  Content-Security-Policy: ${policy(hashes, external)}\n`;
}
for (const file of await readdir("dist/_source-trail"))
  if (file.endsWith(".js"))
    headers += `${base}_source-trail/${file}\n  Content-Security-Policy: ${policy([], file.startsWith("generation.worker"))}\n`;
if (headers.split("\n").some((l) => l.length > 2000))
  throw Error("Header exceeds 2000 characters");
await writeFile("dist/_headers", headers);
await mkdir("dist/evidence", { recursive: true });
for (const [from, to] of [
  ["src/data/evaluation.json", "evaluation.json"],
  [
    "docs/superpowers/specs/source-trail-fixture.json",
    "source-trail-fixture.json",
  ],
  ["docs/ARCHITECTURE.md", "architecture.txt"],
  ["README.md", "README.txt"],
  ["src/story/atlas.json", "meadow-atlas.json"],
  ["MODEL_MANIFEST.json", "MODEL_MANIFEST.json"],
])
  await cp(from, "dist/evidence/" + to);
try {
  await cp(
    "docs/story-lab/evaluation.json",
    "dist/evidence/story-evaluation.json",
  );
} catch {}
console.log("Scoped page and worker CSP generated for " + base);
