import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyPolicyAssets } from "../scripts/policy-assets.mjs";

async function withAssets(
  run: (
    root: string,
    manifest: { assets: { path: string; bytes: number; sha256: string }[] },
  ) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "source-trail-policy-assets-"));
  const content = Buffer.from("Synthetic local model file; no inference.");
  await mkdir(join(root, "synthetic"), { recursive: true });
  await writeFile(join(root, "synthetic/model.bin"), content);
  const manifest = {
    assets: [
      {
        path: "synthetic/model.bin",
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      },
    ],
  };
  try {
    await run(root, manifest);
  } finally {
    const target = resolve(root),
      parent = resolve(tmpdir());
    if (
      !target.startsWith(parent + sep) ||
      !basename(target).startsWith("source-trail-policy-assets-")
    )
      throw new Error("Unsafe test cleanup target");
    await rm(target, { recursive: true, force: true });
  }
}

describe("actual installed Policy Lab asset verification", () => {
  it("records hashes and sizes measured from file bytes", async () => {
    await withAssets(async (root, manifest) => {
      const verified = await verifyPolicyAssets(root, manifest);
      expect(verified.assetIdentity).toEqual(manifest.assets);
      expect(verified.assetVerificationMs).toBeGreaterThanOrEqual(0);
    });
  });
  it("rejects a changed file even when its size and declared hash remain plausible", async () => {
    await withAssets(async (root, manifest) => {
      await writeFile(
        join(root, manifest.assets[0].path),
        Buffer.alloc(manifest.assets[0].bytes, 65),
      );
      await expect(verifyPolicyAssets(root, manifest)).rejects.toThrow(/hash/i);
    });
  });
  it("rejects missing, duplicated and escaping manifest entries", async () => {
    await withAssets(async (root, manifest) => {
      await expect(
        verifyPolicyAssets(root, {
          assets: [...manifest.assets, manifest.assets[0]],
        }),
      ).rejects.toThrow(/duplicate/i);
      await expect(
        verifyPolicyAssets(root, {
          assets: [{ ...manifest.assets[0], path: "../outside.bin" }],
        }),
      ).rejects.toThrow(/path/i);
      await expect(
        verifyPolicyAssets(root, {
          assets: [{ ...manifest.assets[0], path: "missing.bin" }],
        }),
      ).rejects.toThrow();
    });
  });
});
