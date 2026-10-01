import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
const html = await readFile("dist/index.html", "utf8");
const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((match) => !/\bsrc=/.test(match[1]) && match[2].trim())
  .map(
    (match) =>
      `'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`,
  );
const csp = `default-src 'none'; script-src 'self' 'wasm-unsafe-eval' ${[...new Set(hashes)].join(" ")}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`;
await writeFile(
  "dist/_headers",
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`,
);
await mkdir("dist/evidence", { recursive: true });
for (const [from, to] of [
  ["src/data/evaluation.json", "evaluation.json"],
  [
    "docs/superpowers/specs/source-trail-fixture.json",
    "source-trail-fixture.json",
  ],
  ["docs/ARCHITECTURE.md", "architecture.txt"],
  ["README.md", "README.txt"],
])
  await cp(from, `dist/evidence/${to}`);
process.stdout.write(
  `CSP generated with ${hashes.length} inline script hashes.\n`,
);
