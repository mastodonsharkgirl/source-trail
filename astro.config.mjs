import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.SOURCE_TRAIL_BASE || "/",
  build: { assets: "_source-trail" },
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), scopedCache()],
    resolve: {
      conditions: [
        "onnxruntime-web-use-extern-wasm",
        "module",
        "browser",
        "development|production",
      ],
    },
    worker: { format: "es", plugins: () => [scopedCache()] },
  },
});
// WebLLM exposes per-model cache deletion but fixed cache names. Namespace only
// its literal cache scopes at build time; both engine and supported deletion API
// receive the same names. No other site's cache can be touched by this tool.
function scopedCache() {
  return {
    name: "source-trail-cache-scope",
    transform(code, id) {
      if (id.replaceAll("\\", "/").includes("@mlc-ai/web-llm/lib/index.js"))
        return code
          .replaceAll("webllm/model", "source-trail-story-v1/model")
          .replaceAll("webllm/config", "source-trail-story-v1/config")
          .replaceAll("webllm/wasm", "source-trail-story-v1/wasm");
    },
  };
}
