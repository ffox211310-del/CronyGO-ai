// 将来wllamaをここに追加するだけでマルチエンジンになる
import { WebLLMEngine } from "./engines/webllm-engine.js";
import { MODELS } from "./models.js";

class EngineManager {
  constructor() {
    this.engines = {
      mlc: new WebLLMEngine(),
      // wllama: new WllamaEngine()  ← 後でここに追加
    };
    this.current = null;
    this.currentKey = null;
  }

  // モデルIDからエンジンを選ぶ (今はmlc固定、将来 .gguf なら wllama)
  pickEngine(modelId) {
    const force = localStorage.getItem('cronygo_engine') || 'auto';
    if (force === 'wllama') {
      if (!this.engines.wllama) throw new Error("wllama engine not registered yet");
      return this.engines.wllama;
    }
    // 自動判定: .ggufならwllama
    if (modelId && (modelId.toLowerCase().endsWith('.gguf') || modelId.startsWith('http'))) {
      if (this.engines.wllama) return this.engines.wllama;
    }
    return this.engines.mlc;
  }

  register(id, engineInstance) {
    this.engines[id] = engineInstance;
  }

  async load(modelKey, onProgress) {
    // 既存エンジンを完全にリセット
    if (this.current) {
      await this.current.unload();
      this.current = null;
    }
    const modelId = MODELS[modelKey] || modelKey;
    this.current = this.pickEngine(modelId);
    await this.current.load(modelKey, onProgress);
    this.currentKey = modelKey;
  }

  isReady() {
    return !!this.current?.isReady();
  }

  async *chat(messages, opts) {
    if (!this.current) throw new Error("No engine loaded");
    yield* this.current.chat(messages, opts);
  }

  async interrupt() {
    await this.current?.interrupt();
  }

  async unload() {
    if (this.current) {
      await this.current.unload();
      this.current = null;
      this.currentKey = null;
    }
  }

  getCurrentId() {
    return this.current?.id || null;
  }
}

export const engineManager = new EngineManager();

