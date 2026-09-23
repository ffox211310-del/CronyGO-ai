export class WllamaEngine {
  id = "wllama";
  wllama = null;
  WASM_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm";
  _abortFn = null;
  _stopRequested = false;

  isReady() { return !!this.wllama; }

  async load(modelKeyOrUrl, onProgress) {
    // ここは変更なし(既存のURL解決ロジックそのまま)
    ...
  }

  async *chat(messages, opts = {}) {
    if (!this.wllama) throw new Error("wllama not loaded");
    this._stopRequested = false;
    this._abortFn = null;

    const queue = [];
    let wake = null;
    let done = false;
    let error = null;

    const push = (piece) => {
      queue.push(piece);
      if (wake) { const w = wake; wake = null; w(); }
    };

    const completion = this.wllama.createChatCompletion(messages, {
      max_tokens: opts.max_tokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      top_p: 0.9,
      top_k: 40,
      onNewToken: (token, piece, currentText, { abortSignal }) => {
        this._abortFn = abortSignal;          // 停止用に握っておく
        if (this._stopRequested) { abortSignal(); return; }
        push(piece);
      },
    }).catch((e) => { error = e; })
      .finally(() => { done = true; if (wake) { const w = wake; wake = null; w(); } });

    while (true) {
      while (queue.length) yield queue.shift();
      if (done) break;
      await new Promise((r) => { wake = r; });
    }
    await completion;
    if (error && !this._stopRequested) throw error; // 停止による中断はエラー扱いしない
  }

  // 本物の停止。モデルは解放しない。
  async interrupt() {
    this._stopRequested = true;
    if (this._abortFn) { try { this._abortFn(); } catch {} }
  }

  async unload() {
    if (this.wllama) {
      try { await this.wllama.exit(); } catch {}
      this.wllama = null;
    }
  }
}
