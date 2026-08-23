import * as webllm from "@mlc-ai/web-llm";

const MODELS = {
  "0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
  "14B": "Qwen2.5-14B-Instruct-q4f16_1-MLC",
};

let currentKey = document.getElementById("model-select")?.value || "7B";
let engine = null;
let isGenerating = false;
let messages = [
  { role: "system", content: "あなたはCronyGOです。日本語で簡潔に答えてください。" }
];

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const selectEl = document.getElementById("model-select");

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

async function loadModel(key) {
  const MODEL_ID = MODELS[key];
  currentKey = key;
  if (engine) { try { await engine.unload(); } catch {} engine = null; }
  
  statusEl.classList.remove("ready");
  progressBar.style.opacity = "1";
  progressBar.style.width = "0%";
  inputEl.disabled = true; sendEl.disabled = true;
  inputEl.placeholder = `${key} 読み込み中...`;

  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p) => {
        statusEl.textContent = `${Math.round(p.progress*100)}% - ${p.text}`;
        progressBar.style.width = `${p.progress*100}%`;
      }
    });
    statusEl.textContent = `Ready - ${key} Offline`;
    statusEl.classList.add("ready");
    progressBar.style.width = "100%";
    setTimeout(()=>progressBar.style.opacity="0",500);
    inputEl.disabled = false; sendEl.disabled = false;
    inputEl.placeholder = `${key}で入力...`;
    messages = [{ role: "system", content: "あなたはCronyGOです。日本語で簡潔に答えてください。" }];
  } catch (e) {
    statusEl.textContent = "エラー";
    addMessage("assistant", "エラー: " + e.message + "\n14BはPC推奨です。");
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isGenerating || !engine) return;
  addMessage("user", text);
  messages.push({ role: "user", content: text });
  inputEl.value = "";
  const assistantDiv = addMessage("assistant", "");
  isGenerating = true; sendEl.disabled = true;
  try {
    const chunks = await engine.chat.completions.create({ messages, stream: true, temperature: 0.7, max_tokens: 1024 });
    let full = "";
    for await (const chunk of chunks) {
      full += chunk.choices[0]?.delta?.content || "";
      assistantDiv.textContent = full;
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    messages.push({ role: "assistant", content: full });
  } catch (e) { assistantDiv.textContent = "生成エラー: " + e.message; }
  finally { isGenerating = false; sendEl.disabled = false; inputEl.focus(); }
}

sendEl.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
selectEl.addEventListener("change", () => {
  const key = selectEl.value;
  if (confirm(`${key}に切り替える？`)) loadModel(key);
  else selectEl.value = currentKey;
});

inputEl.disabled = true; sendEl.disabled = true;
loadModel(currentKey);
