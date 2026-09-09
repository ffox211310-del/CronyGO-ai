import * as webllm from "@mlc-ai/web-llm";
import { MODELS } from "../models.js";

// WebLLM専用エンジン - UIは一切触らない
export class WebLLMEngine {
  id = "mlc";
  engine = null;

  isReady() {
    return !!this.engine;
  }

  async load(modelKey, onProgress) {
    let MODEL_ID = MODELS[modelKey];
    if (!MODEL_ID) throw new Error(`Unknown model key: ${modelKey}`);

    const shortId = MODEL_ID.includes('/') ? MODEL_ID.split('/').pop() : MODEL_ID;
    const isFullHF = MODEL_ID.includes('/');
    const appConfig = webllm.prebuiltAppConfig;

    const exists = appConfig.model_list.some(m => m.model_id === shortId || m.model_id === MODEL_ID);
    if (!exists && isFullHF) {
      const fallbackLib = appConfig.model_list.find(m => m.model_id.includes('Qwen2'))?.model_lib
                       || appConfig.model_list[0]?.model_lib;
      appConfig.model_list.push({
        model_id: shortId,
        model: `https://huggingface.co/${MODEL_ID}/resolve/main/`,
        model_lib: fallbackLib,
      });
    }
    if (appConfig.model_list.some(m => m.model_id === shortId)) {
      MODEL_ID = shortId;
    }

    this.engine = await webllm.CreateMLCEngine(MODEL_ID, {
      appConfig: appConfig,
      initProgressCallback: (p) => {
        const pct = Math.round(p.progress * 100);
        onProgress?.(pct, p.text);
      }
    });
  }

  async *chat(messages, opts = {}) {
    if (!this.engine) throw new Error("Engine not loaded");
    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 1024,
      stream: true
    });
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) yield delta;
    }
  }

  async interrupt() {
    try { await this.engine?.interruptGenerate(); } catch {}
  }

  async unload() {
    if (this.engine) {
      try { await this.engine.unload(); } catch {}
      this.engine = null;
    }
  }
}
