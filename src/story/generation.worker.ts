import {
  MLCEngine,
  deleteModelAllInfoInCache,
  deleteModelWasmInCache,
  deleteChatConfigInCache,
  type AppConfig,
} from "@mlc-ai/web-llm";
import { Tokenizer } from "@mlc-ai/web-tokenizers";
import manifest from "../../MODEL_MANIFEST.json";
import { budgetContext, type Evidence } from "./core";
const appConfig: AppConfig = {
  model_list: [
    {
      ...manifest.record,
      integrity: { ...manifest.record.integrity, onFailure: "error" },
    },
  ],
  cacheBackend: "cache",
};
let engine: MLCEngine | undefined;
let tokenizer: Tokenizer | undefined;
let cancelled = false;
const post = (data: unknown) => self.postMessage(data);
export type Request = {
  type: "budget" | "load" | "generate" | "cancel" | "unload" | "remove";
  jobId: number;
  revision: string;
  words?: string[];
  passages?: Evidence[];
};
async function loadTokenizer() {
  if (tokenizer) return;
  const response = await fetch(
    `${import.meta.env.BASE_URL}generation/tokenizer.json`,
  );
  if (!response.ok) throw Error("Tokenizer download failed.");
  const bytes = await response.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (
    hash !==
    manifest.verifiedSmallAssets.find((x) => x.name === "tokenizer.json")
      ?.sha256
  )
    throw Error("Tokenizer integrity mismatch.");
  tokenizer = await Tokenizer.fromJSON(bytes);
}
self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const identity = { jobId: data.jobId, revision: data.revision };
  try {
    if (data.type === "cancel") {
      cancelled = true;
      await engine?.interruptGenerate();
      post({ ...identity, type: "cancelled" });
      return;
    }
    if (data.type === "unload") {
      await engine?.unload();
      engine = undefined;
      tokenizer?.dispose();
      tokenizer = undefined;
      post({ ...identity, type: "unloaded" });
      return;
    }
    if (data.type === "remove") {
      await engine?.unload();
      engine = undefined;
      tokenizer?.dispose();
      tokenizer = undefined;
      const modelCache = await caches.open("source-trail-story-v1/model");
      const tensorManifest = new URL("tensor-cache.json", manifest.record.model)
        .href;
      if (await modelCache.match(tensorManifest)) {
        await deleteModelAllInfoInCache(manifest.modelId, appConfig);
      } else {
        // Avoid the library fetching a manifest merely to remove an empty or
        // interrupted download. These supported deletion APIs never fetch.
        await deleteModelWasmInCache(manifest.modelId, appConfig);
        await deleteChatConfigInCache(manifest.modelId, appConfig);
      }
      // The pinned runtime retains tensor-cache.json. Also cover a partial
      // load without that manifest, using only this model's exact known URLs.
      for (const name of [
        "tensor-cache.json",
        ...manifest.files.map((f) => f.path),
      ]) {
        await modelCache.delete(new URL(name, manifest.record.model).href);
      }
      post({ ...identity, type: "removed" });
      return;
    }
    if (data.type === "budget") {
      await loadTokenizer();
      post({
        ...identity,
        type: "budget",
        context: budgetContext(
          data.words ?? [],
          data.passages ?? [],
          (s) => tokenizer!.encode(s).length,
        ),
      });
      return;
    }
    if (data.type === "load") {
      engine = new MLCEngine({
        appConfig,
        logLevel: "SILENT",
        initProgressCallback: (p) =>
          post({
            ...identity,
            type: "progress",
            text: p.text,
            progress: p.progress,
          }),
      });
      await loadTokenizer();
      await engine.reload(manifest.modelId, {
        context_window_size: 4096,
        max_history_size: 1,
      });
      post({ ...identity, type: "ready" });
      return;
    }
    if (!engine || !tokenizer) throw Error("Load the model first.");
    cancelled = false;
    const context = budgetContext(
      data.words ?? [],
      data.passages ?? [],
      (s) => tokenizer!.encode(s).length,
    );
    if (!context.supplied.length)
      throw Error(
        "No source passage fits. Use fewer ideas or shorter sources.",
      );
    post({ ...identity, type: "context", context });
    await engine.resetChat();
    // Text completions apply no additional chat template. The fully rendered, exactly
    // tokenized Qwen template above is the request, including non-thinking prefix.
    const result = await engine.completions.create({
      model: manifest.modelId,
      prompt: context.prompt,
      max_tokens: context.outputReserve,
      temperature: 0.65,
      top_p: 0.9,
      seed: 17,
      stop: ["<|im_end|>", "<|endoftext|>"],
    });
    if (cancelled) return;
    const text = result.choices[0]?.text.trim() ?? "";
    if (!text || text.includes("<think>") || text.includes("</think>"))
      throw Error(
        "The model returned analysis or no paragraph. Try again; nothing has been presented as a story.",
      );
    post({ ...identity, type: "story", text, context, usage: result.usage });
  } catch (error) {
    post({
      ...identity,
      type: "error",
      text:
        error instanceof Error
          ? error.message
          : "Local generation failed. Retry or use the authored sample.",
    });
  }
};
