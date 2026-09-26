Third-Party Notices

CronyGO includes or uses the following third-party software, models, and fonts. These components are not covered by the MIT License applied to the original CronyGO code and remain subject to their respective licenses.

---

1. WebLLM

Package: "@mlc-ai/web-llm"
Version: "0.2.79"
License: Apache License 2.0
Copyright: MLC-AI and contributors

WebLLM is used as the browser-side inference engine for running supported language models with WebGPU.

---

2. wllama

Package: "@wllama/wllama"
Version: "3.5.1"
License: MIT License
Copyright: ngxson and contributors (wllama), ggerganov and contributors (llama.cpp)

wllama is used as the browser-side GGUF inference engine (WebAssembly port of llama.cpp) for running gguf models.

The wllama source code and its license are available from https://github.com/ngxson/wllama
The underlying llama.cpp is licensed under MIT License.

wllama.wasm is a WebAssembly build of llama.cpp.

---

3. Qwen2.5

Models:
- Qwen2.5-0.5B-Instruct
- Qwen2.5-1.5B-Instruct
- Qwen2.5-3B-Instruct
- Qwen2.5-7B-Instruct

License: Apache License 2.0
Copyright: Alibaba Cloud / Qwen team

Used for local browser-based inference (MLC-compiled).

---

4. Serow

Model: Serow-Qwen2.5-0.5B-Instruct-gguf (Serow-0.5B.Q4_K_M.gguf)
Base model: Qwen2.5-0.5B-Instruct
License: Apache License 2.0 (inherited from Qwen2.5)
Copyright: WebAIPocket (fine-tune), Alibaba Cloud / Qwen team (base model)

Serow is a Japanese fine-tuned variant of Qwen2.5-0.5B, created by CronyGO author.
Distributed as GGUF and used via wllama for local browser-based inference.
Base model license (Apache 2.0) remains applicable.

---

5. llm-jp-3-1.8B

Model: llm-jp-3-1.8b-instruct3-Q4_K_M.gguf
Base model: llm-jp/llm-jp-3-1.8b-instruct3
GGUF conversion: mmnga/llm-jp-3-1.8b-instruct3-gguf
License: Apache License 2.0
Copyright: LLM-jp and contributors; mmnga (GGUF conversion)
Source: https://huggingface.co/llm-jp/llm-jp-3-1.8b-instruct3
GGUF: https://huggingface.co/mmnga/llm-jp-3-1.8b-instruct3-gguf
Direct file: https://huggingface.co/mmnga/llm-jp-3-1.8b-instruct3-gguf/resolve/main/llm-jp-3-1.8b-instruct3-Q4_K_M.gguf

llm-jp-3-1.8B is a Japanese-capable GGUF model used via wllama for local browser-based inference.
The base model is licensed under the Apache License 2.0.

---

6. Gemma

Models:
- Gemma-2-2B-it (gemma-2-2b-it-q4f16_1-MLC, q4f32_1-MLC)
- Gemma-2-2B-JPN-it (gemma-2-2b-jpn-it-q4f16_1-MLC / q4f32_1-MLC)

License: Gemma Terms of Use
Copyright: Google LLC
Source: https://ai.google.dev/gemma/terms

MLC-compiled versions (mlc-ai/...) remain subject to Gemma Terms.

---

7. SmolLM2

Models:
- SmolLM2-135M-Instruct (base model)
- SmolLM2-135M-Instruct-q0f16-MLC (MLC-compiled)
- SmolLM2-135M-Instruct-Q4_K_M.gguf (GGUF variant)

License: Apache License 2.0
Copyright: HuggingFaceTB and contributors; MLC compilation by mlc-ai; GGUF conversion by Unsloth
Source: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct
MLC: https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q0f16-MLC
GGUF: https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF
Direct files:
- MLC: https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q0f16-MLC/resolve/main/
- GGUF: https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf

SmolLM2-135M-Instruct is a tiny 135M instruct model used for local browser-based inference.
MLC-compiled versions are used via WebLLM for WebGPU inference, and the GGUF variant is used via wllama for WebAssembly (llama.cpp) inference.
Both base model and MLC/GGUF variants are licensed under the Apache License 2.0.

---

8. LFM2.5-1.2B-JP

Model: LFM2.5-1.2B-JP-Q4_K_M.gguf
Base model: LiquidAI/LFM2.5-1.2B-JP
License: LFM Open License v1.0
Copyright: Liquid AI, Inc.
Source: https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP
GGUF: https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-202606-GGUF
Direct file: https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-GGUF/resolve/main/LFM2.5-1.2B-JP-Q4_K_M.gguf

LFM2.5-1.2B-JP is a Japanese-specialized compact language model developed by Liquid AI.
Used via wllama for local browser-based inference.
The model is distributed under the LFM Open License v1.0, which includes a commercial use limitation (free for entities with annual revenue under $10 million).

---

9. DeepSeek-R1-Distill-Qwen-1.5B

Model: DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf
Base model: deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
GGUF conversion: unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF
License: MIT License
Copyright: DeepSeek and contributors; Unsloth (GGUF conversion)
Source: https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
GGUF: https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF
Direct file: https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf

DeepSeek-R1-Distill-Qwen-1.5B is a distilled reasoning model derived from DeepSeek-R1 and Qwen2.5-Math-1.5B.
Used via wllama for local browser-based inference.
Licensed under the MIT License.

---

10. Inter

Font: Inter
License: SIL Open Font License 1.1 (OFL-1.1)

UI font.

---

11. JetBrains Mono

Font: JetBrains Mono
License: SIL Open Font License 1.1 (OFL-1.1)

Monospace font.

---

License Separation

The original source code of CronyGO is licensed under the MIT License.
The third-party components listed above are separately licensed and are not relicensed under the MIT License.

---

Important Note

CronyGO does not claim ownership of the third-party software, models, or fonts listed above.
