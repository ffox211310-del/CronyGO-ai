import * as webllm from "@mlc-ai/web-llm";

// 軽量モデル - HFから取得される。スマホ向け最軽量
const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

// Message形式の会話履歴
let messages = [
  { role: "system", content: "あなたは親切で簡潔なAIアシスタントです。日本語で答えてください。" }
];

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");

let engine = null;
let isGenerating = false;

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

async function initModel() {
  statusEl.textContent = "モデル準備中...";
  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p) => {
        statusEl.textContent = `${Math.round(p.progress * 100)}% - ${p.text}`;
        progressBar.style.width = `${p.progress * 100}%`;
      }
    });
    statusEl.textContent = "Ready - Offline OK";
    statusEl.classList.add("ready");
    progressBar.style.width = "100%";
    setTimeout(() => progressBar.style.opacity = "0", 500);
    inputEl.disabled = false;
    sendEl.disabled = false;
    inputEl.placeholder = "メッセージを入力...";
  } catch (e) {
    statusEl.textContent = "エラー: WebGPU未対応かも";
    console.error(e);
    addMessage("assistant", "エラー: " + e.message + "\nChrome/Edge最新版でWebGPUを有効にしてください。");
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isGenerating || !engine) return;

  // ユーザー発言
  addMessage("user", text);
  messages.push({ role: "user", content: text });
  inputEl.value = "";

  // アシスタント枠を先に作る (streaming用)
  const assistantDiv = addMessage("assistant", "");
  isGenerating = true;
  sendEl.disabled = true;

  try {
    // WebLLMのMessage形式 + streaming
    const chunks = await engine.chat.completions.create({
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512
    });

    let fullReply = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content || "";
      fullReply += delta;
      assistantDiv.textContent = fullReply;
      chatEl.scrollTop = chatEl.scrollHeight;
    }

    // 履歴に追加
    messages.push({ role: "assistant", content: fullReply });

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

// 起動
inputEl.disabled = true;
sendEl.disabled = true;
initModel();
