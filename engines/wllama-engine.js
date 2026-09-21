import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/index.js";
import { MODELS } from "../models.js";

export class WllamaEngine {
  id = "wllama";
  wllama = null;
  WASM_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm";

  // ==== ロード設定（ABORT対策で最小限）====
  LOAD_OPTS = {
    n_ctx: 4096,       // 8192はメモリを食うので4096に固定
    n_gpu_layers: 0,   // WASMなのでGPUオフロードなし
    n_batch: 128,      // 小さめにしてメモリと発熱を抑制
    use_cache: true,   // KVキャッシュ有効
    flash_attn: false, // WASMでは効かないのでfalse
  };

  // ==== 生成設定 ====
  GEN_OPTS = {
    max_tokens: 2048,      // 1024→2048に拡大（切れ対策）
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,   // 0.5B特有のループ抑制
    stream: true,
  };

  // ==== スレッド数（固定。ABORTしたら順に下げる）====
  THREAD_CANDIDATES = [4, 2, 1];

  MAX_CONT = 3; // 自動継続の最大回数

  isReady() {
    return !!this.wllama;
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

    // 前回のエンジンがあれば終了
    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
      this.wllama = null;
    }

    let lastError = null;

    // スレッド数を4→2→1と下げながらリトライ
    for (const n_threads of this.THREAD_CANDIDATES) {
      try {
        console.log(`[WllamaEngine] try n_threads=${n_threads}`);
        this.wllama = new Wllama({ default: this.WASM_URL });

        await this.wllama.loadModelFromUrl(modelUrl, {
          ...this.LOAD_OPTS,
          n_threads,
          progressCallback: ({ loaded, total }) => {
            if (!total) return;
            const pct = Math.round((loaded / total) * 100);
            onProgress?.(pct, `${(loaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`);
          },
        });

        console.log(`[WllamaEngine] loaded OK (n_threads=${n_threads})`);
        return; // 成功したら抜ける

      } catch (e) {
        lastError = e;
        console.warn(`[WllamaEngine] load failed with n_threads=${n_threads}: ${e.message}`);

        // 失敗したインスタンスを片付ける
        try { await this.wllama?.exit(); } catch {}
        this.wllama = null;

        // ABORT以外のエラーは即座に投げる（URL不正など）
        const msg = (e.message || "").toLowerCase();
        if (!msg.includes("abort") && !msg.includes("memory") && !msg.includes("oom")) {
          throw e;
        }
        // ABORT系は次のスレッド数で再挑戦
      }
    }

    // 全部失敗
    throw new Error(`モデル初期化に失敗（n_threads 4/2/1 すべてABORT）: ${lastError?.message || "unknown"}`);
  }

  async *chat(messages, opts = {}) {
    if (!this.wllama) throw new Error("wllama not loaded");

    let fullText = "";
    let contCount = 0;

    while (contCount <= this.MAX_CONT) {
      // 2回目以降は「続きを促す」メッセージを差し込む
      const streamMessages = contCount === 0
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

      // "length" 以外なら自然に終わったので終了
      if (finishReason !== "length") break;

      // 文末が自然なら続けない
      const trimmed = fullText.trim();
      if (/[。！？.!?」』）)\n]$/.test(trimmed)) break;

      contCount++;
      console.log(`[WllamaEngine] auto-continue #${contCount} (finish=${finishReason})`);
    }
  }

  async interrupt() {
    // wllamaは明示的なinterrupt APIが無いので空のまま
    // 停止はapp.js側のabortFlagで制御
  }

  async unload() {
    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
      this.wllama = null;
    }
  }
}
