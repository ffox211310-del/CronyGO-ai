export const MODELS = {
  "Q0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Q1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Q3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "Q7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
  "Sm135M": "SmolLM2-135M-Instruct-q0f16-MLC",
  "G2B-jpn": "gemma-2-2b-jpn-it-q4f16_1-MLC",
  "G2B-jpnHv": "gemma-2-2b-jpn-it-q4f32_1-MLC",
  "Smollm-135M": "https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf",
  "Qwen-0.5B": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
  "DeepSeek-1.5B": "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
  "llm-jp-3-1.8B": "https://huggingface.co/mmnga/llm-jp-3-1.8b-instruct3-gguf/resolve/main/llm-jp-3-1.8b-instruct3-Q4_K_M.gguf",
  "Qwen-0.5BJP": "https://huggingface.co/mradermacher/Qwen2.5-0.5B-Instruct-Ja-SFT-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Ja-SFT.Q4_K_M.gguf",
  "LFM-1.2BJP": "https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-GGUF/resolve/main/LFM2.5-1.2B-JP-Q4_K_M.gguf",
  "Serow-0.5B": "https://huggingface.co/WebAIPocket/Serow-Qwen2.5-0.5B-Instruct-gguf/resolve/main/Serow-0.5B.Q4_K_M.gguf",
};

export function isGGUFModel(modelId) {
  if (!modelId) return false;
  const s = modelId.toLowerCase();
  return s.endsWith('.gguf') || s.includes('.gguf') || s.startsWith('http');
}
