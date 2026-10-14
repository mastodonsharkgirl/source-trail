import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { performance } from "node:perf_hooks";

/** Verify actual pinned files without loading an encoder or contacting the network. */
export async function verifyPolicyAssets(root, manifest) {
  const started = performance.now();
  if (
    !Array.isArray(manifest.assets) ||
    !manifest.assets.length ||
    manifest.assets.length > 32
  )
    throw new Error("Invalid policy asset manifest");
  const directory = await realpath(root),
    seen = new Set(),
    assetIdentity = [];
  for (const asset of manifest.assets) {
    if (
      !asset ||
      typeof asset.path !== "string" ||
      !/^[a-zA-Z0-9._/-]+$/.test(asset.path) ||
      asset.path.startsWith("/") ||
      asset.path
        .split("/")
        .some((part) => !part || part === "." || part === "..")
    )
      throw new Error("Invalid policy asset path");
    if (seen.has(asset.path)) throw new Error("Duplicate policy asset path");
    seen.add(asset.path);
    if (
      !Number.isInteger(asset.bytes) ||
      asset.bytes < 1 ||
      asset.bytes > 25 * 1024 * 1024 ||
      typeof asset.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(asset.sha256)
    )
      throw new Error("Invalid policy asset size/hash");
    const file = await realpath(join(directory, asset.path));
    if (!file.startsWith(directory + sep))
      throw new Error("Policy asset path escapes the fixed model directory");
    const info = await stat(file);
    if (!info.isFile() || info.size !== asset.bytes)
      throw new Error(`Policy asset size mismatch: ${asset.path}`);
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(file, {
      highWaterMark: 65536,
    })) {
      bytes += chunk.length;
      if (bytes > asset.bytes)
        throw new Error("Policy asset changed while reading");
      hash.update(chunk);
    }
    const sha256 = hash.digest("hex");
    if (bytes !== asset.bytes || sha256 !== asset.sha256)
      throw new Error(`Policy asset hash mismatch: ${asset.path}`);
    assetIdentity.push({ path: asset.path, bytes, sha256 });
  }
  return { assetIdentity, assetVerificationMs: performance.now() - started };
}
