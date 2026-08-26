import * as webllm from "@mlc-ai/web-llm";
import { VoiceManager } from "./voice.js";

const MODELS = {
  "0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
  "14B": "Qwen2.5-14B-Instruct-q4f16_1-MLC",
"3-0.6B": "Qwen3-0.6B-q4f16_1-MLC",
};

const DEFAULT_SYSTEM_PROMPT = "あなたはCronyGOです。日本語で簡素に答えてください。";
const LS_PROMPT_KEY = "cronygo_system_prompt";
const LS_THEME_KEY = "cronygo_theme";

let voice = null;
let engine = null;
let currentKey = null;
let isGenerating = false;
let hasChatted = false;
let lastInputWasVoice = false;

function loadStoredPrompt() {
  try { return localStorage.getItem(LS_PROMPT_KEY) || DEFAULT_SYSTEM_PROMPT; }
  catch { return DEFAULT_SYSTEM_PROMPT; }
}
function loadStoredTheme() {
  try { return localStorage.getItem(LS_THEME_KEY) || "dark"; }
  catch { return "dark"; }
}

let messages = [{ role: "system", content: loadStoredPrompt() }];

// ★ループ検知追加: 同じ単語の繰り返しだけ見る
function isSameWordLoop(text, repeat = 4) {
  // 直近200文字だけ見て軽量化
  const tail = text.slice(-200);
  // 1〜10文字の単語が repeat回連続したらループ
  // 日本語の分かち書き無しでも「おはようおはようおはよう」や「ああああ」も検知できる
  const regex = new RegExp(`(.{1,10})\\1{${repeat - 1},}`);
  // ただし1文字の場合は10回以上に厳しくする
  const singleCharRegex = /(.)\1{9,}/;
  return regex.test(tail) || singleCharRegex.test(tail);
}

const chatEl = document.getElementById("chat");
const micBtn = document.getElementById("mic-btn");
const voicePreview = document.getElementById("voice-preview");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const selectEl = document.getElementById("model-select");
const dlBtn = document.getElementById("download-btn");
const loadingView = document.getElementById("loading-view");
const loadingText = document.getElementById("loading-text");

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const systemPromptInput = document.getElementById("system-prompt-input");
const savePromptBtn = document.getElementById("save-prompt-btn");
const resetPromptBtn = document.getElementById("reset-prompt-btn");
const promptStatus = document.getElementById("prompt-status");
const themeOpts = document.querySelectorAll(".theme-opt");

systemPromptInput.value = loadStoredPrompt();
applyTheme(loadStoredTheme(), false);

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}
function showFirstLoadingUI(initialText) {
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
  statusEl.textContent = text;
  if (loadingView.classList.contains("show")) loadingText.textContent = text;
}
function applyTheme(theme, save = true) {
  if (theme === "light") document.body.classList.add("light");
  else document.body.classList.remove("light");
  themeOpts.forEach(btn => { btn.classList.toggle("active", btn.dataset.theme === theme); });
  if (save) { try { localStorage.setItem(LS_THEME_KEY, theme); } catch {} }
}
function saveSystemPrompt() {
  const newPrompt = systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
  try { localStorage.setItem(LS_PROMPT_KEY, newPrompt); } catch {}
  messages[0].content = newPrompt;
  promptStatus.textContent = "保存しました。次の会話から反映されます。";
  promptStatus.style.color = "#4FD1C5";
  setTimeout(() => { promptStatus.textContent = ""; }, 2500);
}
function resetSystemPrompt() {
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  saveSystemPrompt();
  promptStatus.textContent = "デフォルトに戻しました。";
}

async function loadModel(key) {
  const MODEL_ID = MODELS[key];
  if (!MODEL_ID) return;
  const isFirstPhase =!hasChatted;
  if (engine) {
    if (!isFirstPhase) addMessage("system", `${currentKey} を解放中...`);
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
  if (isFirstPhase) showFirstLoadingUI(`${key} 準備中...`);
  else updateLoadingText("準備中...");
  if (!isFirstPhase) addMessage("system", `${key} を読み込み開始。`);
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
    if (isFirstPhase) hideFirstLoadingUI();
    addMessage("assistant", `${key} 起動完了！`);
  } catch (e) {
    console.error(e);
    statusEl.textContent = "エラー";
    statusEl.className = "";
    progressBar.style.background = "#ff4444";
    dlBtn.textContent = "再試行";
    dlBtn.disabled = false;
    if (isFirstPhase) hideFirstLoadingUI();
    addMessage("assistant", "エラー: " + e.message);
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isGenerating ||!engine) return;
  const isVoiceMode = lastInputWasVoice;
  lastInputWasVoice = false;

  if (!hasChatted) { hasChatted = true; hideFirstLoadingUI(); }
  addMessage("user", text);
  messages.push({ role: "user", content: text });
  inputEl.value = "";
  voicePreview.textContent = '';
  const assistantDiv = addMessage("assistant", "");
  isGenerating = true; sendEl.disabled = true;
  try {
    const chunks = await engine.chat.completions.create({
      messages, stream: true, temperature: 0.7, max_tokens: 5000
    });
    let full = "";
    for await (const chunk of chunks) {
      full += chunk.choices[0]?.delta?.content || "";
      assistantDiv.textContent = full;
      chatEl.scrollTop = chatEl.scrollHeight;

      // ★ここで同じ単語ループだけ検知して停止
      if (isSameWordLoop(full, 4)) {
        full += "\n\n[同じ単語の繰り返しを検知したため停止しました]";
        assistantDiv.textContent = full;
        try { await engine.interruptGenerate(); } catch {}
        break;
      }
    }
    messages.push({ role: "assistant", content: full });

    if (voice && full && isVoiceMode) {
      voice.clearBuffer();
      voice.speak(full);
    }
  } catch (e) { assistantDiv.textContent = "生成エラー: " + e.message; }
  finally { isGenerating = false; sendEl.disabled = false; inputEl.readOnly = false; inputEl.focus(); }
}

// ===== VOICE INIT BLOCK =====
voice = new VoiceManager({
  lang: 'ja-JP',
  onFinal: (text) => {
    inputEl.value = text;
    voicePreview.textContent = '';
    voice.clearBuffer();
    lastInputWasVoice = true;
    sendMessage();
  },
  onInterim: (full, interim, finalPart) => {
    voicePreview.textContent = interim? `聞き取り: ${interim}` : finalPart;
  },
  onStatus: (msg, state) => {
    console.log('[Voice]', msg, state);
  }
});

micBtn.addEventListener('click', () => {
  if (voice.isListening) {
    voice.stop();
    micBtn.classList.remove('on', 'muted');
    inputEl.readOnly = false;
    inputEl.placeholder = `${currentKey || 'モデル'}で入力...`;
  } else {
    inputEl.blur();
    inputEl.readOnly = true;
    inputEl.placeholder = "聞き取り中...";

    voice.start().then(ok => {
      if(ok) micBtn.classList.add('on');
      else {
        inputEl.readOnly = false;
        inputEl.placeholder = `${currentKey || 'モデル'}で入力...`;
      }
    });
  }
});
// ===== END VOICE INIT =====

sendEl.addEventListener("click", () => {
  lastInputWasVoice = false;
  sendMessage();
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" &&!e.shiftKey) {
    e.preventDefault();
    lastInputWasVoice = false;
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
statusEl.textContent = "未DL";

function openSettings() {
  settingsPanel.classList.add("show");
  settingsOverlay.classList.add("show");
}
function closeSettings() {
  settingsPanel.classList.remove("show");
  settingsOverlay.classList.remove("show");
}
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);
savePromptBtn.addEventListener("click", saveSystemPrompt);
resetPromptBtn.addEventListener("click", resetSystemPrompt);
themeOpts.forEach(btn => {
  btn.addEventListener("click", () => { applyTheme(btn.dataset.theme, true); });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    console.log('[PWA] SW registered', reg.scope);
  }).catch(err => console.error('[PWA] SW failed', err));
}
