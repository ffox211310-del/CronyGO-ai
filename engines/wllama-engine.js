//いえーい
import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.2.3/esm/index.js";
import { MODELS } from "../models.js";

export class WllamaEngine {
  id = "wllama";
  supportsHotStop = true;
  wllama = null;
  WASM_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.2.3/esm/wasm/wllama.wasm";
  _abortFn = null;
  _stopRequested = false;

  isReady() { return !!this.wllama; }

  // スレッド数の決定
  // ①手動設定(数値) ②自動(端末のコア数から算出) ③マルチスレッド不可(false)の場合のみ -1
  resolveThreads(setting) {
    if (!self.crossOriginIsolated) {
      console.warn("[Wllama] crossOriginIsolated=false → n_threads: -1");
      return -1;
    }
    const cores = navigator.hardwareConcurrency || 4;
    if (typeof setting === "number" && setting >= 1) {
      return Math.min(setting, Math.max(cores, 1));
    }
    // 自動: 2コア残す（スマホのbig.LITTLE対策）、上限8
    return Math.max(1, Math.min(cores - 2, 8));
  }

 async load(modelKeyOrUrl, onProgress, opts = {}) {
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

    const contextSize = opts.context_size ?? 4096;
    console.log("[Wllama] context:", contextSize);

    const nThreads = this.resolveThreads(opts.n_threads);
    console.log("[Wllama] threads:", nThreads,
      "(setting:", opts.n_threads, ", cores:", navigator.hardwareConcurrency,
      ", isolated:", self.crossOriginIsolated, ")");
   
    await this.wllama.loadModelFromUrl(modelUrl, {
      n_ctx: contextSize,
      n_gpu_layers: 0,
      n_threads: nThreads,
      progressCallback: ({ loaded, total }) => {
        if (!total) return;
        const pct = Math.round((loaded / total) * 100);
        onProgress?.(pct, `${(loaded/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB`);
      }
    });
  }

//生成エラー:1163217991の修整
async *chat(messages, opts = {}) {
  if (!this.wllama) throw new Error("wllama not loaded");
  this._stopRequested = false;
  this._stream = null;

  console.log("[Wllama] generation settings:", {
  temperature: opts.temperature,
  max_tokens: opts.max_tokens,
  repeat_penalty: opts.repeat_penalty,
  context_size: "load-time"
});
  
  const stream = await this.wllama.createChatCompletion({
  messages,
  max_tokens: opts.max_tokens ?? 1024,
  temperature: opts.temperature ?? 0.7,
  repeat_penalty: opts.repeat_penalty ?? 1.1,
  top_p: 0.9,
  top_k: 40,
  stream: true,
});
  
  this._stream = stream;

  for await (const chunk of stream) {
    if (this._stopRequested) break;
    const delta = chunk?.choices?.[0]?.delta?.content || "";
    if (delta) yield delta;
  }
}

async interrupt() {
  this._stopRequested = true;
  // OAI互換のstreamオブジェクトなら controller.abort() を持つことがある(OpenAI SDK方式)
  try { this._stream?.controller?.abort?.(); } catch {}
}

async unload() {
  if (this.wllama) {
    try { await this.wllama.exit(); } catch {}
    this.wllama = null;
  }
}
}
