import { WebLLMEngine } from "./engines/webllm-engine.js";
import { MODELS } from "./models.js";

class EngineManager {
  constructor(){
    this.engines = { mlc: new WebLLMEngine() };
    this.current = null;
    this.currentKey = null;
  }
  async load(modelKey, onProgress){
    const modelId = MODELS[modelKey] || modelKey;
    if(this.current){ await this.current.unload(); this.current=null; }
    this.current = this.engines.mlc;
    await this.current.load(modelId, onProgress);
    this.currentKey = modelKey;
  }
  isReady(){ return !!this.current?.isReady(); }
  async *chat(messages, opts){ if(!this.current) throw new Error("Engine not ready"); yield* this.current.chat(messages, opts); }
  async interrupt(){ await this.current?.interrupt(); }
  async unload(){ if(this.current){ await this.current.unload(); this.current=null; this.currentKey=null; } }
  getCurrentId(){ return this.current?.id || null; }
}
export const engineManager = new EngineManager();
