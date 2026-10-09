import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist"),
  base = (process.env.SOURCE_TRAIL_BASE || "/").replace(/\/?$/, "/");
const rules = (await readFile(path.join(root, "_headers"), "utf8"))
  .split(/\n(?=\S)/)
  .map((block) => {
    const [route, ...lines] = block.split("\n");
    return {
      route,
      headers: Object.fromEntries(
        lines
          .filter((l) => l.includes(":"))
          .map((l) => {
            const i = l.indexOf(":");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
          }),
      ),
    };
  });
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
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(transfers));
    return;
  }
  if (!pathname.startsWith(base)) {
    res.writeHead(404).end();
    return;
  }
  let file = path.resolve(root, pathname.slice(base.length) || "index.html");
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    const headers = Object.assign(
      {},
      ...rules
        .filter((r) =>
          r.route.endsWith("*")
            ? pathname.startsWith(r.route.slice(0, -1))
            : r.route === pathname,
        )
        .map((r) => r.headers),
    );
    res.once("finish", () =>
      transfers.push({
        path: pathname,
        status: res.statusCode,
        bodyBytes: body.length,
      }),
    );
    res
      .writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        ...headers,
        "Content-Length": body.length,
      })
      .end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(Number(process.env.PORT || 4733), "127.0.0.1");
