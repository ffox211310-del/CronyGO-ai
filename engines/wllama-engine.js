import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/index.js";
import { MODELS } from "../models.js";

export class WllamaEngine {
  id = "wllama";
  wllama = null;
  WASM_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm";

  isReady() {
    return !!this.wllama;
  }

  async load(modelKeyOrUrl, onProgress) {
    // Serow-0.5B みたいなキー名が来てもURLに直す
    let modelUrl = MODELS[modelKeyOrUrl] || modelKeyOrUrl;

    if (!modelUrl.toLowerCase().includes('.gguf')) {
      if (modelKeyOrUrl.includes('Serow')) {
        modelUrl = "https://huggingface.co/WebAIPocket/Serow-Qwen2.5-0.5B-Instruct-gguf/resolve/main/Serow-0.5B.Q4_K_M.gguf";
      }
    }

    console.log(`[WllamaEngine] loading: ${modelKeyOrUrl} -> ${modelUrl}`);

    if (!modelUrl.toLowerCase().includes('.gguf')) {
      throw new Error(`Invalid model URL: ${modelUrl}`);
    }

    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
    }
    this.wllama = new Wllama({ default: this.WASM_URL });

    await this.wllama.loadModelFromUrl(modelUrl, {
      n_ctx: 4096,
      n_gpu_layers: 0,
      n_threads: 1,
      progressCallback: ({ loaded, total }) => {
        if (!total) return;
        const pct = Math.round((loaded / total) * 100);
        onProgress?.(pct, `${(loaded/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB`);
      }
    });
  }

  async *chat(messages, opts = {}) {
    if (!this.wllama) throw new Error("wllama not loaded");

    // messagesはOpenAI形式で来るのでwllamaにそのまま渡す
    // temperatureは要望通り0.2固定
    const stream = await this.wllama.createChatCompletion({
      messages,
      max_tokens: opts.max_tokens ?? 1024,
      temperature: 0.2,
      top_p: 0.9,
      top_k: 40,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (delta) yield delta;
    }
  }

  async interrupt() {
    // wllamaはinterrupt APIが無いのでexitで止める
    // engine-managerがunloadしてくれるのでここは空でOK
  }

  async unload() {
    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
      this.wllama = null;
    }
  }
}
