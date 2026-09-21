import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/index.js";
import { MODELS } from "../models.js";

export class WllamaEngine {
  id = "wllama";
  wllama = null;
  WASM_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm";

  // ==== ロード設定（ここで一括管理）====
  LOAD_OPTS = {
    n_ctx: 8192,          // コンテキスト長（4096→8192で余裕を持たせる）
    n_batch: 256,         // バッチサイズ（小さいほど発熱少・遅い）
    n_gpu_layers: 0,      // WASMなのでGPUオフロードなし
    use_cache: true,      // KVキャッシュ有効
    flash_attn: false,    // WASMだと効かないことが多いのでfalse
    cache_type_k: "q8_0", // KVキャッシュを8bit量子化（メモリ節約）
    cache_type_v: "q8_0",
  };

  // ==== 生成設定 ====
  GEN_OPTS = {
    max_tokens: 2048,     // 1024→2048に拡大
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,  // 同じ語の繰り返し抑制
    stream: true,
  };

  MAX_CONT = 3; // 自動継続の最大回数

  isReady() {
    return !!this.wllama;
  }

  getThreadCount() {
    const hc = navigator.hardwareConcurrency || 4;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // スマホは最大4、PCはコア数-1（最低2）
    return isMobile ? Math.min(4, Math.max(2, hc - 1)) : Math.max(2, hc - 1);
  }

  async load(modelKeyOrUrl, onProgress) {
    let modelUrl = MODELS[modelKeyOrUrl] || modelKeyOrUrl;

    if (!modelUrl.toLowerCase().includes(".gguf")) {
      if (modelKeyOrUrl.includes("Serow")) {
        modelUrl = "https://huggingface.co/WebAIPocket/Serow-Qwen2.5-0.5B-Instruct-gguf/resolve/main/Serow-0.5B.Q4_K_M.gguf";
      }
    }

    console.log(`[WllamaEngine] loading: ${modelKeyOrUrl} -> ${modelUrl}`);

    if (!modelUrl.toLowerCase().includes(".gguf")) {
      throw new Error(`Invalid model URL: ${modelUrl}`);
    }

    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
    }
    this.wllama = new Wllama({ default: this.WASM_URL });

    const n_threads = this.getThreadCount();
    console.log(`[WllamaEngine] n_threads=${n_threads} hc=${navigator.hardwareConcurrency}`);

    await this.wllama.loadModelFromUrl(modelUrl, {
      ...this.LOAD_OPTS,
      n_threads,
      progressCallback: ({ loaded, total }) => {
        if (!total) return;
        const pct = Math.round((loaded / total) * 100);
        onProgress?.(pct, `${(loaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`);
      },
    });
  }

  async *chat(messages, opts = {}) {
    if (!this.wllama) throw new Error("wllama not loaded");

    let fullText = "";
    let contCount = 0;

    while (contCount <= this.MAX_CONT) {
      // 2回目以降は「続きを促す」メッセージを差し込む
      const streamMessages =
        contCount === 0
          ? messages
          : [
              ...messages,
              { role: "assistant", content: fullText },
              { role: "user", content: "自然に続けてください。前置きや挨拶は不要です。" },
            ];

      const stream = await this.wllama.createChatCompletion({
        messages: streamMessages,
        ...this.GEN_OPTS,
        max_tokens: opts.max_tokens ?? this.GEN_OPTS.max_tokens,
        temperature: opts.temperature ?? this.GEN_OPTS.temperature,
      });

      let finishReason = null;

      for await (const chunk of stream) {
        const choice = chunk?.choices?.[0];
        const delta = choice?.delta?.content || "";
        if (delta) {
          fullText += delta;
          yield delta;
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      }

      // 停止理由が "length" 以外 → 自然に終わったので終了
      if (finishReason !== "length") break;

      // 文末が自然なら続けない
      const trimmed = fullText.trim();
      if (/[。！？.!?」』）)\n]$/.test(trimmed)) break;

      contCount++;
      console.log(`[WllamaEngine] auto-continue #${contCount} (finish=${finishReason})`);
      // 次のループへ（続きを生成）
    }
  }

  async interrupt() {
    // wllamaは明示的なinterrupt APIが無いので空のまま
  }

  async unload() {
    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
      this.wllama = null;
    }
  }
}
