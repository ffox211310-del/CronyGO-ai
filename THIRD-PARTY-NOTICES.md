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

wllama is used as the browser-side GGUF inference engine (WebAssembly port of llama.cpp) for running Serow models.

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

5. Gemma

Models:
- Gemma-2-2B-it (gemma-2-2b-it-q4f16_1-MLC, q4f32_1-MLC)
- Gemma-2-2B-JPN-it (gemma-2-2b-jpn-it-q4f16_1-MLC / q4f32_1-MLC)

License: Gemma Terms of Use
Copyright: Google LLC
Source: https://ai.google.dev/gemma/terms

MLC-compiled versions (mlc-ai/...) remain subject to Gemma Terms.

---

6. Inter

Font: Inter
License: SIL Open Font License 1.1 (OFL-1.1)

UI font.

---

7. JetBrains Mono

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
