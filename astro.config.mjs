import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      conditions: [
        "onnxruntime-web-use-extern-wasm",
        "module",
        "browser",
        "development|production",
      ],
    },
    worker: { format: "es" },
  },
});
