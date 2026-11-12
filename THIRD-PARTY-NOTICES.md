Third-Party Notices

CronyGO includes or uses the following third-party software, models, and fonts. These components are not covered by the MIT License applied to the original CronyGO code and remain subject to their respective licenses.

---

WebLLM

Package: "@mlc-ai/web-llm"
Version: "0.2.79"
License: Apache License 2.0
Copyright: MLC-AI and contributors

WebLLM is used as the browser-side inference engine for running supported language models with WebGPU.

---

wllama

Package: "@wllama/wllama"
Version: "3.2.3"
License: MIT License
Copyright: ngxson and contributors (wllama), ggerganov and contributors (llama.cpp)

wllama is used as the browser-side GGUF inference engine (WebAssembly port of llama.cpp) for running gguf models.

The wllama source code and its license are available from https://github.com/ngxson/wllama
The underlying llama.cpp is licensed under MIT License.

wllama.wasm is a WebAssembly build of llama.cpp.

---

marked

Package: "marked"
Version: "12.0.2"
License: MIT License
Copyright: Christopher Jeffrey and contributors

marked is used as the Markdown parser that converts assistant replies (headings, tables, lists, code, etc.) to HTML.

---

DOMPurify

Package: "dompurify"
Version: "3.2.7"
License: Apache License 2.0 / Mozilla Public License 2.0 (dual license)
Copyright: Dr.-Ing. Mario Heiderich, Cure53 and contributors

DOMPurify is used to sanitize the HTML produced from Markdown before it is inserted into the chat view.

---

Qwen2.5＆3

Models:
- Qwen2.5-0.5B-Instruct
- Qwen2.5-1.5B-Instruct
- Qwen2.5-3B-Instruct
- Qwen2.5-7B-Instruct
- Qwen3-0.6B-Instruct

License: Apache License 2.0
Copyright: Alibaba Cloud / Qwen team

Used for local browser-based inference (MLC-compiled＆GGUF-compiled).

---

llm-jp-3-1.8B

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

Gemma

Models:
- Gemma-2-2B-it (gemma-2-2b-it-q4f16_1-MLC, q4f32_1-MLC)
- Gemma-2-2B-JPN-it (gemma-2-2b-jpn-it-q4f16_1-MLC / q4f32_1-MLC)

License: Gemma Terms of Use
Copyright: Google LLC
Source: https://ai.google.dev/gemma/terms

MLC-compiled versions (mlc-ai/...) remain subject to Gemma Terms.

---

SmolLM2

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

LFM2.5-1.2B-JP

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

DeepSeek-R1-Distill-Qwen-1.5B

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

Falcon H1 1.5B

Provider: https://huggingface.co/tiiuae/Falcon-H1-1.5B-Instruct-GGUF
License: falcon-llm-license
WebAIPocket uses this model under license. The model is used for inference using wllama.

---

Inter

Font: Inter
License: SIL Open Font License 1.1 (OFL-1.1)

UI font.

---

JetBrains Mono

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
