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

  async load(modelKey, onProgress) {
    if (this.current) {
      console.log(`[EngineManager] unloading ${this.current.id}`);
      await this.current.unload();
      this.current = null;
    }

    const modelId = MODELS[modelKey] || modelKey;
    const engine = this.pickEngine(modelId);
    console.log(`[EngineManager] loading ${modelKey} -> ${engine.id} : ${modelId}`);

    this.current = engine;
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
