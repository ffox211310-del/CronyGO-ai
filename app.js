import * as webllm from "@mlc-ai/web-llm";

const MODELS = {
  "0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
  "14B": "Qwen2.5-14B-Instruct-q4f16_1-MLC",
};

let engine = null;
let currentKey = null; // ★最初はnull。何もDLしないのが重要
let isGenerating = false;
let messages = [{ role: "system", content: "あなたはCronyGOです。日本語で答えてください。" }];

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const selectEl = document.getElementById("model-select");
const dlBtn = document.getElementById("download-btn"); // ★追加

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

// ★モデル読み込みはこの関数1個だけ。ボタン押した時だけ呼ばれる
async function loadModel(key) {
  const MODEL_ID = MODELS[key];

  // 前のモデルがあれば解放。これしないとスマホはメモリで落ちる
  if (engine) {
    addMessage("system", `${currentKey} を解放中...`);
    try { await engine.unload(); } catch {}
    engine = null;
  }

  dlBtn.disabled = true;
  dlBtn.textContent = "読込中...";
  statusEl.textContent = "準備中...";
  statusEl.className = "loading";
  progressBar.style.opacity = "1";
  progressBar.style.width = "0%";
  inputEl.disabled = true;
  sendEl.disabled = true;

  try {
    // CreateMLCEngineは選ばれた1個だけをDLする
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p) => {
        statusEl.textContent = `${Math.round(p.progress * 100)}% ${p.text.slice(0, 20)}`;
        progressBar.style.width = `${p.progress * 100}%`;
      }
    });
    currentKey = key;
    statusEl.textContent = `Ready ${key}`;
    statusEl.className = "ready";
    progressBar.style.width = "100%";
    setTimeout(()=>progressBar.style.opacity="0", 800);
    dlBtn.textContent = "起動済み";
    dlBtn.classList.add("ready");
    dlBtn.disabled = false;
    inputEl.disabled = false;
    sendEl.disabled = false;
    inputEl.placeholder = `${key}で入力...`;
    addMessage("assistant", `${key} 起動完了！`);
  } catch (e) {
    statusEl.textContent = "エラー";
    dlBtn.textContent = "再試行";
    dlBtn.disabled = false;
    addMessage("assistant", "エラー: " + e.message);
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isGenerating ||!engine) return;
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
  finally { isGenerating = false; sendEl.disabled = false; }
}

sendEl.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" &&!e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ★セレクト変更時はDLしない。表示だけ変える
selectEl.addEventListener("change", () => {
  const key = selectEl.value;
  if (currentKey === key && engine) {
    dlBtn.textContent = "起動済み";
    statusEl.textContent = `Ready ${key}`;
  } else {
    dlBtn.textContent = "ダウンロード";
    dlBtn.classList.remove("ready");
    statusEl.textContent = "未DL";
  }
});

// ★ボタン押した時だけDL。ここが一気にDL問題の修正点
dlBtn.addEventListener("click", () => {
  const key = selectEl.value;
  if (currentKey === key && engine) return; // 既に起動済みなら何もしない
  loadModel(key);
});

// ★初回はloadModelを呼ばない。だから全部DLされない
