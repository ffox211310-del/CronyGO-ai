import * as webllm from "@mlc-ai/web-llm";

const MODELS = {
  "0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
  "14B": "Qwen2.5-14B-Instruct-q4f16_1-MLC",
};

let engine = null;
let currentKey = null;
let isGenerating = false;
let hasChatted = false; // 一度でもユーザーが喋ったらtrue。画像表示を止めるフラグ
let messages = [{ role: "system", content: "あなたはCronyGOです。日本語で簡素に答えてください。" }];

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const selectEl = document.getElementById("model-select");
const dlBtn = document.getElementById("download-btn");
const loadingView = document.getElementById("loading-view");
const loadingText = document.getElementById("loading-text");

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function showFirstLoadingUI(initialText) {
  // 会話が始まってたら中央アイコンは出さない
  if (hasChatted) return false;
  loadingText.textContent = initialText || "準備中...";
  loadingView.classList.add("show");
  chatEl.classList.add("is-first-loading");
  return true;
}

function hideFirstLoadingUI() {
  loadingView.classList.remove("show");
  chatEl.classList.remove("is-first-loading");
}

function updateLoadingText(text) {
  // ヘッダーと中央の両方を更新
  statusEl.textContent = text;
  if (loadingView.classList.contains("show")) {
    loadingText.textContent = text;
  }
}

async function loadModel(key) {
  const MODEL_ID = MODELS[key];
  if (!MODEL_ID) return;

  const isFirstPhase = !hasChatted; // 会話前かどうか

  if (engine) {
    if (!isFirstPhase) {
      addMessage("system", `${currentKey} を解放中...`);
    }
    try { await engine.unload(); } catch {}
    engine = null;
  }

  dlBtn.disabled = true;
  dlBtn.textContent = "読込中...";
  statusEl.className = "loading";
  progressBar.style.opacity = "1";
  progressBar.style.width = "0%";
  progressBar.style.background = "#4FD1C5";
  inputEl.disabled = true;
  sendEl.disabled = true;

  // 会話前なら中央にアイコン表示
  if (isFirstPhase) {
    showFirstLoadingUI(`${key} 準備中...`);
  } else {
    updateLoadingText("準備中...");
  }

  if (isFirstPhase) {
    // 会話前のシステムメッセージは隠れるので、別でログを出さない
  } else {
    addMessage("system", `${key} を読み込み開始。`);
  }

  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p) => {
        const pct = Math.round(p.progress * 100);
        const txt = `${pct}% ${p.text}`;
        updateLoadingText(txt);
        progressBar.style.width = `${pct}%`;
      }
    });

    currentKey = key;
    statusEl.textContent = `Ready ${key}`;
    statusEl.className = "ready";
    progressBar.style.width = "100%";
    setTimeout(() => progressBar.style.opacity = "0", 800);

    dlBtn.textContent = "起動済み";
    dlBtn.classList.add("ready");
    dlBtn.disabled = false;
    inputEl.disabled = false;
    sendEl.disabled = false;
    inputEl.placeholder = `${key}で入力...`;

    // 初回ロード演出を終了
    if (isFirstPhase) {
      hideFirstLoadingUI();
    }

    addMessage("assistant", `${key} 起動完了！`);

  } catch (e) {
    console.error(e);
    statusEl.textContent = "エラー";
    statusEl.className = "";
    progressBar.style.background = "#ff4444";
    dlBtn.textContent = "再試行";
    dlBtn.disabled = false;
    if (isFirstPhase) {
      hideFirstLoadingUI();
    }
    addMessage("assistant", "エラー: " + e.message + "\nWebGPU対応のブラウザを使用してください。それでも直らない場合はメモリ不足の可能性があります。より小さいモデルをお試しください。");
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isGenerating || !engine) return;

  // 初めてユーザーが喋った瞬間にフラグを立てる。これ以降は中央アイコンを出さない
  if (!hasChatted) {
    hasChatted = true;
    hideFirstLoadingUI(); // 念のため
  }

  addMessage("user", text);
  messages.push({ role: "user", content: text });
  inputEl.value = "";

  const assistantDiv = addMessage("assistant", "");
  isGenerating = true;
  sendEl.disabled = true;

  try {
    const chunks = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024
    });
    let full = "";
    for await (const chunk of chunks) {
      full += chunk.choices[0]?.delta?.content || "";
      assistantDiv.textContent = full;
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    messages.push({ role: "assistant", content: full });
  } catch (e) {
    assistantDiv.textContent = "生成エラー: " + e.message;
  } finally {
    isGenerating = false;
    sendEl.disabled = false;
    inputEl.focus();
  }
}

sendEl.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

selectEl.addEventListener("change", () => {
  const key = selectEl.value;
  if (currentKey === key && engine) {
    dlBtn.textContent = "起動済み";
    statusEl.textContent = `Ready ${key}`;
    statusEl.className = "ready";
  } else {
    dlBtn.textContent = "ダウンロード";
    dlBtn.classList.remove("ready");
    statusEl.textContent = "未DL";
    statusEl.className = "";
    inputEl.placeholder = `${key} をダウンロードしてください`;
  }
});

dlBtn.addEventListener("click", () => {
  const key = selectEl.value;
  if (currentKey === key && engine) return;
  loadModel(key);
});

// 初回は何もDLしない
statusEl.textContent = "未DL";
