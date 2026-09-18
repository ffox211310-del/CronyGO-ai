import * as webllm from "@mlc-ai/web-llm";
import { MODELS } from "../models.js";
export class WebLLMEngine {
  id = "webllm-gemma2b-jpn";
  engine = null;
  isReady(){ return !!this.engine; }
  async load(modelKeyOrId, onProgress){
    const MODEL_ID = MODELS[modelKeyOrId] || modelKeyOrId;
    this.engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p)=>{
        const pct = Math.round(p.progress*100);
        onProgress?.(pct, p.text);
      }
    });
  }
  async *chat(messages, opts={}){
    if(!this.engine) throw new Error("Engine not loaded");
    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 1024,
      stream: true
    });
    for await (const chunk of chunks){
      const delta = chunk.choices[0]?.delta?.content || "";
      if(delta) yield delta;
    }
  }
  async interrupt(){ try{ await this.engine?.interruptGenerate(); }catch{} }
  async unload(){ if(this.engine){ try{ await this.engine.unload(); }catch{} this.engine=null; } }
}
