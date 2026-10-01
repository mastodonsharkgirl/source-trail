import { readdir, stat } from "node:fs/promises";
import assert from "node:assert/strict";
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = `${directory}/${item.name}`;
    if (item.isDirectory()) await inspect(name);
    else
      assert.ok(
        (await stat(name)).size < 25 * 1024 * 1024,
        `${name} exceeds Pages' 25 MiB file limit`,
      );
  }
}
await inspect("dist");
process.stdout.write("All built files below 25 MiB.\n");
