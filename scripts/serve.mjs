import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const headers = await readFile(path.join(root, "_headers"), "utf8").catch(
  () => "",
);
const csp = headers.match(/Content-Security-Policy: (.+)/)?.[1];
// Test-server telemetry only; this script is not emitted into the static site.
// Count completed response bodies, including repeated full transfers of one URL.
const transfers = [];
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};
createServer(async (req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  if (pathname === "/__test_transfers") {
    res
      .writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      .end(JSON.stringify(transfers));
    return;
  }
  const file = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.once("finish", () =>
      transfers.push({
        path: pathname,
        status: res.statusCode,
        bodyBytes: body.byteLength,
      }),
    );
    res
      .writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        ...(csp ? { "Content-Security-Policy": csp } : {}),
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
      })
      .end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(4705, "127.0.0.1");
