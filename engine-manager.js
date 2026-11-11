import { WebLLMEngine } from "./engines/webllm-engine.js";
import { WllamaEngine } from "./engines/wllama-engine.js";
import { MODELS, isGGUFModel } from "./models.js";

class EngineManager {
  constructor() {
    this.engines = {
      mlc: new WebLLMEngine(),
      wllama: new WllamaEngine(),
    };
    this.current = null;
    this.currentKey = null;
  }

  pickEngine(modelId) {
    if (isGGUFModel(modelId)) return this.engines.wllama;
    return this.engines.mlc;
  }

  async load(modelKey, onProgress, opts = {}) {
    if (this.current) {
      console.log(`[EngineManager] unloading ${this.current.id}`);
      await this.current.unload();
      this.current = null;
    }

    const modelId = MODELS[modelKey] || modelKey;
    const engine = this.pickEngine(modelId);
    console.log(`[EngineManager] loading ${modelKey} -> ${engine.id} : ${modelId}`);

    this.current = engine;
    
    await this.current.load(modelKey, onProgress, opts);
   
    this.currentKey = modelKey;
  }

  isReady() {
    return !!this.current?.isReady();
  }
//停止
  supportsHotStop() {
    return !!this.current?.supportsHotStop;
  }
//↑ここまで停止関係
  async *chat(messages, opts) {
   if (!this.current) throw new Error("No engine loaded");
   // チャンク形式を {type:"text"|"think", text} に統一する。
   // 文字列で返すエンジン（WebLLM）は本文として包み直す。Wllamaは最初から型付き。
   for await (const chunk of this.current.chat(messages, opts)) {
   if (typeof chunk === "string") yield { type: "text", text: chunk};
   else yield chunk;
 }
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
  async loadLocalFile(file, onProgress, opts = {}) {
  if (this.current) { await this.current.unload(); this.current = null; }
  this.current = this.engines.wllama;
  await this.current.loadFromFile(file, onProgress, opts);
  this.currentKey = file.name;
  }
}

export const engineManager = new EngineManager();


