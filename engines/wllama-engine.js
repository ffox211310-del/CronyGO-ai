//いえーい
import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/index.js";
import { MODELS, MMPROJ} from "../models.js";

export class WllamaEngine {
  id = "wllama";
  supportsHotStop = true;
  wllama = null;
  WASM_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/wasm/wllama.wasm";
  _abortFn = null;
  _abort = null;
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
  let modelUrl = MODELS[modelKeyOrUrl] || modelKeyOrUrl;
  
  // ★ blob: URL または .gguf を含むかをチェック
  const isBlob = modelUrl.startsWith('blob:');
  const isGGUF = modelUrl.toLowerCase().includes('.gguf');

  if (!isBlob && !isGGUF) {
    // 既存のSerowフォールバック処理は残す
    if (modelKeyOrUrl.includes('Serow')) {
      modelUrl = "https://huggingface.co/WebAIPocket/Serow-Qwen2.5-0.5B-Instruct-gguf/resolve/main/Serow-0.5B.Q4_K_M.gguf";
    } else {
      throw new Error(`Invalid model URL: ${modelUrl} (GGUFまたはローカルファイルである必要があります)`);
    }
  }

  console.log(`[WllamaEngine] loading: ${modelKeyOrUrl} -> ${modelUrl}`);
  

  

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
   
    // VLモデルは mmproj（画像エンコーダ）も一緒にロードする
const mmprojUrl = MMPROJ[modelKeyOrUrl];
const modelSource = mmprojUrl? { url: modelUrl, mmprojUrl}: modelUrl;
if (mmprojUrl) console.log("[Wllama] mmproj:", mmprojUrl);
await this.wllama.loadModelFromUrl(modelSource, {
      n_ctx: contextSize,
      n_gpu_layers: 0,
      n_threads: nThreads,
      // Thinkを分離して reasoning_content で受け取る指定（ロード時）
      reasoning_format: "deepseek",
      // Think専用の上限。本文の max_tokens とは別枠（ロード時）
      reasoning_budget_tokens: 2048,
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
    // 停止はwllama標準のabortSignalでリクエスト自体をキャンセルする（モデルは積んだまま）
  const ac = new AbortController();
  this._abort = ac;

  console.log("[Wllama] generation settings:", {
  temperature: opts.temperature,
  max_tokens: opts.max_tokens,
  repeat_penalty: opts.repeat_penalty,
  context_size: "load-time"
});
  
const completionParams = {
messages,
max_tokens: opts.max_tokens?? 1024,
temperature: opts.temperature?? 0.7,
repeat_penalty: opts.repeat_penalty?? 1.1,
top_p: 0.9,
top_k: 40,
stream: true,
abortSignal: ac.signal,
};
// 設定でOFFの時だけ enable_thinking:false を送る（best-effort）。
// テンプレートがこの変数を見ないモデル（DeepSeek等）は無視して思考を続ける。
// 届いた思考はエンジン側では一切隠さない・剥がさない。
if (opts.thinking === false) {
completionParams.chat_template_kwargs = { enable_thinking: false};
}
const stream = await this.wllama.createChatCompletion(completionParams);
  
  this._stream = stream;

  // Thinkと本文を型付きで分離して返す（正式分離）
try {
for await (const chunk of stream) {
if (this._stopRequested) break;
const deltaObj = chunk?.choices?.[0]?.delta || {};
const rDelta = deltaObj.reasoning_content || "";
if (rDelta) yield { type: "think", text: rDelta};
const delta = deltaObj.content || "";
if (delta) yield { type: "text", text: delta};
}
} catch (e) {
    // abort時はwllamaがAbortError(name: "AbortError")を投げる。停止は正常終了として飲む
    if (this._stopRequested || e?.name === "AbortError") return;
    throw e;
  } finally {
    if (this._abort === ac) this._abort = null;
  }
}

async interrupt() {
  this._stopRequested = true;
    // リクエストをキャンセルするだけ。exit()はしないのでモデル再読み込みは不要
  try { this._abort?.abort(); } catch {}
}

async unload() {
  if (this.wllama) {
    try { await this.wllama.exit(); } catch {}
    this.wllama = null;
  }
}
  async loadFromFile(file, onProgress, opts = {}) {
  if (this.wllama) { try { await this.wllama.exit(); } catch {} }
  this.wllama = new Wllama({ default: this.WASM_URL });

  const nThreads = this.resolveThreads(opts.n_threads);
  onProgress?.(0, `${(file.size/1024/1024).toFixed(1)}MB 読み込み中`);

  await this.wllama.loadModel([file], {
    n_ctx: opts.context_size ?? 4096,
    n_gpu_layers: 0,
    n_threads: nThreads,
    // 同上
    reasoning_format: "deepseek",
    reasoning_budget_tokens: 2048,
  });
  this.localFile = file; // 積み直し用に保持
  onProgress?.(100, "完了");
}
}
