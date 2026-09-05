import * as webllm from "@mlc-ai/web-llm";
import { VoiceManager } from "./voice.js";

const MODELS = {
  "Q0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Q1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Q3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "Q7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
  "G2B-jpn": "gemma-2-2b-jpn-it-q4f16_1-MLC",
  "G2B-jpnHv": "gemma-2-2b-jpn-it-q4f32_1-MLC",
};

const DEFAULT_SYSTEM_PROMPT = "あなたはCronyGOです。日本語で簡素に答えてください。強調は **太字** を使ってください。箇条書きは • を使ってください。* は使わないでください。";
const LS_PROMPT_KEY = "cronygo_system_prompt";
const LS_THEME_KEY = "cronygo_theme";
const LS_DEV_CONSOLE_KEY = "cronygo_dev_console";
const MAX_CHARS = 1500;

// ★ 時間キーワード即答用 - システムプロンプトには混ぜない
function getCurrentTimeString() {
  const now = new Date(); // ← スマホのリアルタイム
  const weekdays = ["日曜日","月曜日","火曜日","水曜日","木曜日","金曜日","土曜日"];
  const y = now.getFullYear();
  const m = now.getMonth()+1;
  const d = now.getDate();
  const wd = weekdays[now.getDay()];
  const h = now.getHours();
  const mm = String(now.getMinutes()).padStart(2,'0');
  return `${y}年${m}月${d}日 ${wd} ${h}時${mm}分`;
}
function isTimeQuery(text) {
  const t = text.trim().toLowerCase();
  if (/(今日は何日|今日何日|きょうは何日|今日の日付|何曜日|今何時|いまなんじ|現在時刻|今の時間|いまのじかん)/.test(t)) return true;
  if (t === "何日" || t === "何日?" || t === "何時" || t === "何時?" || t === "何日？" || t === "何時？") return true;
  if (t.includes("何日ですか") || t.includes("何時ですか") || t.includes("何曜日ですか")) return true;
  if (t.includes("今日") && (t.includes("何日") || t.includes("何曜日") || t.includes("日付") || t.includes("曜日"))) return true;
  if ((t.includes("今") || t.includes("現在")) && (t.includes("何時") || t.includes("時間") || t.includes("じかん"))) return true;
  return false;
}

let voice = null;
let engine = null;
let currentKey = null;
let isGenerating = false;
let hasChatted = false;
let lastInputWasVoice = false;

// ===== DEV CONSOLE =====
let devConsoleEnabled = false;
let debugOverlayEl = null;
let debugClearBtn = null;
let debugTestBtn = null;

function loadStoredPrompt() {
  try { return localStorage.getItem(LS_PROMPT_KEY) || DEFAULT_SYSTEM_PROMPT; }
  catch { return DEFAULT_SYSTEM_PROMPT; }
}
function loadStoredTheme() {
  try { return localStorage.getItem(LS_THEME_KEY) || "dark"; }
  catch { return "dark"; }
}
function loadDevConsoleEnabled() {
  try { return localStorage.getItem(LS_DEV_CONSOLE_KEY) === "true"; }
  catch { return false; }
}
function saveDevConsoleEnabled(v) {
  try { localStorage.setItem(LS_DEV_CONSOLE_KEY, v ? "true" : "false"); } catch {}
}
function createDebugOverlay() {
  if (debugOverlayEl) return debugOverlayEl;
  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.style.cssText = 'position:fixed;bottom:80px;left:6px;right:6px;max-height:38vh;overflow:auto;background:rgba(0,0,0,0.88);color:#0f8;font-size:11px;line-height:1.35;padding:8px;border-radius:8px;z-index:99999;white-space:pre-wrap;font-family:monospace;border:1px solid #0f0;';
  document.body.appendChild(el);
  debugOverlayEl = el;
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'クリア';
  clearBtn.style.cssText = 'position:fixed;bottom:48px;right:10px;z-index:100000;background:#0f0;color:#000;border:0;border-radius:12px;padding:5px 12px;font-size:11px;font-weight:600;';
  clearBtn.onclick = () => { if(debugOverlayEl) debugOverlayEl.textContent=''; };
  document.body.appendChild(clearBtn);
  debugClearBtn = clearBtn;
  const testBtn = document.createElement('button');
  testBtn.textContent = 'TTSテスト';
  testBtn.style.cssText = 'position:fixed;bottom:48px;left:10px;z-index:100000;background:#ff0;color:#000;border:0;border-radius:12px;padding:5px 12px;font-size:11px;font-weight:600;';
  testBtn.onclick = () => {
    dbg('--- TTSテスト ---');
    if (voice) voice.speak('テストです。**太字**は声では読まないはず。聞こえますか？');
    else dbg('voice null');
  };
  document.body.appendChild(testBtn);
  debugTestBtn = testBtn;
  return el;
}
function removeDebugOverlay() {
  if (debugOverlayEl) { try { debugOverlayEl.remove(); } catch {} debugOverlayEl=null; }
  if (debugClearBtn) { try { debugClearBtn.remove(); } catch {} debugClearBtn=null; }
  if (debugTestBtn) { try { debugTestBtn.remove(); } catch {} debugTestBtn=null; }
}
function dbg(msg) {
  if (!devConsoleEnabled) return;
  try {
    const el = createDebugOverlay();
    const time = new Date().toLocaleTimeString();
    el.textContent += `[${time}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  } catch {}
  console.log(msg);
}
window.__cronyDbg = (msg) => dbg(msg);
function setDevConsoleEnabled(enabled) {
  devConsoleEnabled = enabled;
  saveDevConsoleEnabled(enabled);
  const toggle = document.getElementById('dev-console-toggle');
  const label = document.getElementById('dev-console-label');
  const bg = document.getElementById('dev-toggle-bg');
  const dot = document.getElementById('dev-toggle-dot');
  if (toggle) toggle.checked = enabled;
  if (label) { label.textContent = enabled ? 'ON' : 'OFF'; label.style.color = enabled ? '#4FD1C5' : '#888'; }
  if (bg) bg.style.background = enabled ? '#4FD1C5' : '#333';
  if (dot) dot.style.transform = enabled ? 'translateX(20px)' : 'translateX(0)';
  if (enabled) {
    createDebugOverlay();
    dbg('dev console ON');
    dbg(`voices=${window.speechSynthesis ? window.speechSynthesis.getVoices().length : 0}`);
  } else {
    dbg('dev console OFF');
    setTimeout(()=>removeDebugOverlay(), 300);
  }
}

let messages = [{ role: "system", content: loadStoredPrompt() }];

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
const devConsoleToggle = document.getElementById("dev-console-toggle");

systemPromptInput.value = loadStoredPrompt();
applyTheme(loadStoredTheme(), false);
devConsoleEnabled = loadDevConsoleEnabled();
setDevConsoleEnabled(devConsoleEnabled);

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    dbg(`voiceschanged ${window.speechSynthesis.getVoices().length}`);
  };
}

// ===== 最終改良版 Markdownレンダー: 太字 + 箇条書き =====
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function renderMarkdown(text) {
  if (!text) return '';
  let t = text.trim();
  t = t.replace(/^\s*\*\*\s*$/gm, '');
  t = t.replace(/\*\*\s*\n\s*([\s\S]+?)\s*\n\s*\*\*/g, '**$1**');
  t = t.replace(/\*\*\s+([\s\S]+?)\s+\*\*/g, '**$1**');
  // 行頭 * - ・ を • に正規化 (Gemmaの箇条書き対策)
  t = t.split('\n').map(line => {
    const m = line.match(/^\s*([\*\-・])\s+(.+)$/);
    if (m) return `• ${m[2]}`;
    return line;
  }).join('\n');

  let html = escapeHtml(t);
  html = html.replace(/\*\*\*([\s\S]+?)\*\*\*/g, (m,p1)=>{ const inner=p1.trim(); return inner ? `<strong><em>${inner}</em></strong>` : ''; });
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, (m,p1)=>{
    const inner = p1.trim();
    if (!inner || inner === ':' ) return '';
    return `<strong>${inner}</strong>`;
  });
  // 斜体は • で始まる行では無効化 (箇条書きを斜体にしない)
  html = html.replace(/(^|[^•\*\n])\*([^*\n•]+?)\*(?!\*)/g, (m, pre, inner)=>{
    if (pre.includes('•')) return m;
    return `${pre}<em>${inner}</em>`;
  });

  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/(<br>\s*)+$/g, '');
  return html.trim();
}

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (role === 'assistant') {
    div.innerHTML = renderMarkdown(content);
  } else {
    div.textContent = content;
  }
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

async function loadModel(key, isReload = false) {
  const MODEL_ID = MODELS[key];
  if (!MODEL_ID) return;
  const isFirstPhase = !hasChatted && !isReload;
  if (engine) {
    if (!isFirstPhase) addMessage("system", `${currentKey} を解放中...`);
    try { await engine.unload(); } catch {}
    engine = null;
  }
  dlBtn.disabled = true;
  dlBtn.textContent = isReload ? "再読込中..." : "読込中...";
  statusEl.className = "loading";
  progressBar.style.opacity = "1";
  progressBar.style.width = "0%";
  progressBar.style.background = "#4FD1C5";
  inputEl.disabled = true;
  sendEl.disabled = true;
  if (isFirstPhase) {
    showFirstLoadingUI(`${key} 準備中...`);
  } else if (isReload) {
    loadingText.textContent = `${key} 積み直し中...`;
    loadingView.classList.add("show");
    chatEl.classList.add("is-first-loading");
    updateLoadingText(`${key} 積み直し中...`);
  } else {
    updateLoadingText("準備中...");
  }
  if (!isFirstPhase) addMessage("system", isReload ? `${key} 再読込開始` : `${key} を読み込み開始。`);
  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p) => {
        const pct = Math.round(p.progress * 100);
        const txt = isReload ? `積み直し ${pct}% ${p.text}` : `${pct}% ${p.text}`;
        updateLoadingText(txt);
        progressBar.style.width = `${pct}%`;
      }
    });
    currentKey = key;
    statusEl.textContent = isReload ? `再起動完了 ${key}` : `Ready ${key}`;
    statusEl.className = "ready";
    progressBar.style.width = "100%";
    setTimeout(() => progressBar.style.opacity = "0", 800);
    dlBtn.textContent = "起動済み";
    dlBtn.classList.add("ready");
    dlBtn.disabled = false;
    inputEl.disabled = false;
    sendEl.disabled = false;
    inputEl.placeholder = `${key}で入力...`;
    hideFirstLoadingUI();
    addMessage("assistant", isReload ? `${key} 積み直し完了！続きをどうぞ` : `${key} 起動完了！`);
    dbg(`model ${key} loaded`);
  } catch (e) {
    dbg(`model load ERROR ${e.message}`);
    console.error(e);
    statusEl.textContent = "エラー";
    statusEl.className = "";
    progressBar.style.background = "#ff4444";
    dlBtn.textContent = "再試行";
    dlBtn.disabled = false;
    hideFirstLoadingUI();
    addMessage("assistant", "エラー: " + e.message);
  }
}
async function sendMessageWithText(forcedText) {
  const text = (forcedText || inputEl.value).trim();
  if (!text || isGenerating) return; // ← !engine をここではチェックしない
  const isVoiceMode = lastInputWasVoice;
  lastInputWasVoice = false;
  if (!hasChatted) { hasChatted = true; hideFirstLoadingUI(); }

  // ★★★ 時間キーワードならAI停止、JS即答 ★★★
  if (isTimeQuery(text)) {
    addMessage("user", text);
    messages.push({ role: "user", content: text });
    inputEl.value = "";
    voicePreview.textContent = '';

    const nowStr = getCurrentTimeString();
    const reply = `${nowStr}です`;

    addMessage("assistant", reply);
    messages.push({ role: "assistant", content: reply });

    dbg(`[TimeQuery] matched "${text}" -> ${reply}`);

    if (voice) {
      voice.speak(reply); // ← テキスト入力でも必ずViceが読み上げる
    }
    return; // ← ここで終了、engine.chat.completions.create には行かない
  }

  if (!engine) {
    addMessage("system", "モデルをダウンロードしてください");
    return;
  }
  addMessage("user", text);

  messages.push({ role: "user", content: text });
  inputEl.value = "";
  voicePreview.textContent = '';

  const assistantDiv = addMessage("assistant", "");
  const killBtn = document.createElement("button");
  killBtn.textContent = "■ 生成を停止";
  killBtn.className = "kill-switch";
  killBtn.style.cssText = "margin:6px 0 10px 0;background:#ff3b3b;color:#fff;border:0;border-radius:18px;padding:6px 14px;font-size:12px;cursor:pointer;align-self:flex-start;";
  assistantDiv.after(killBtn);

  let abortFlag = false;
  let isKilled = false;
  killBtn.onclick = async () => {
    if (abortFlag) return;
    abortFlag = true;
    isKilled = true;
    killBtn.textContent = "停止→再読込中...";
    killBtn.disabled = true;
    try { await engine.interruptGenerate(); } catch {}
    if (voice) voice.clearQueue(true);
    assistantDiv.innerHTML = renderMarkdown(assistantDiv.textContent + "\n\n[停止→積み直し]");
    const keyToReload = currentKey;
    messages = [{ role: "system", content: loadStoredPrompt() }];
    try { killBtn.remove(); } catch {}
    await loadModel(keyToReload, true);
  };

  isGenerating = true; sendEl.disabled = true;
  let full = "";
  let speakBuffer = "";
  const sentenceSplitRegex = /[^。！？\n.!?]+[。！？\n.!?]+/g;
  try {
    const chunks = await engine.chat.completions.create({
      messages, stream: true, temperature: 0.7, max_tokens: 5000
    });
    for await (const chunk of chunks) {
      if (abortFlag) break;
      const delta = chunk.choices[0]?.delta?.content || "";
      full += delta;

      if (full.length >= MAX_CHARS) {
        full = full.slice(0, MAX_CHARS).trim() + "\n\n[1500文字制限→自動で積み直し]";
        assistantDiv.innerHTML = renderMarkdown(full);
        try { await engine.interruptGenerate(); } catch {}
        if (voice) voice.clearQueue(true);
        const keyToReload = currentKey;
        messages = [{ role: "system", content: loadStoredPrompt() }];
        await loadModel(keyToReload, true);
        break;
      }
      // ★重要: ストリーミング中も太字レンダーする
      assistantDiv.innerHTML = renderMarkdown(full);
      chatEl.scrollTop = chatEl.scrollHeight;

      if (isVoiceMode && voice && delta) {
        speakBuffer += delta;
        const matches = speakBuffer.match(sentenceSplitRegex);
        if (matches) {
          let consumed = 0;
          for (const sent of matches) {
            const s = sent.trim();
            if (s) voice.enqueueSpeak(s);
            consumed += sent.length;
          }
          speakBuffer = speakBuffer.slice(consumed);
        }
      }
    }
    // 最後の謎空白を除去
    full = full.trim();
    // 単独 ** 行が末尾に残るのを除去
    full = full.replace(/^\s*\*\*\s*$/gm, '').trim();
    full = full.replace(/\n{3,}/g, '\n\n').trim();

    if (!isKilled) {
      assistantDiv.innerHTML = renderMarkdown(full);
      messages.push({ role: "assistant", content: full });
      if (voice && full && isVoiceMode) {
        const remaining = speakBuffer.trim();
        if (remaining) voice.enqueueSpeak(remaining);
        voice.clearBuffer();
      }
    }
  } catch (e) {
    dbg(`generation ERROR ${e.message}`);
    if (!abortFlag) assistantDiv.innerHTML = renderMarkdown("生成エラー: " + e.message);
  } finally {
    isGenerating = false;
    sendEl.disabled = false;
    inputEl.readOnly = false;
    inputEl.focus();
    try { killBtn.remove(); } catch {}
  }
}

async function sendMessage() { return sendMessageWithText(); }

voice = new VoiceManager({
  lang: 'ja-JP',
  autoSendDelay: 1200,
  onFinal: (text) => { inputEl.value = text; voicePreview.textContent = text; },
  onInterim: (full, interim, finalPart) => { inputEl.value = full; voicePreview.textContent = interim ? `聞き取り: ${interim}` : finalPart; },
  onAutoSend: (text) => {
    const t = text.trim(); if (!t) return;
    dbg(`[AutoSend] "${t.slice(0,40)}"`);
    voicePreview.textContent = '';
    lastInputWasVoice = true;
    sendMessageWithText(t);
    voice.clearBuffer();
  },
  onStatus: (msg, state) => { dbg(`[Status] ${msg} ${state}`); }
});

micBtn.addEventListener('click', () => {
  if (voice.isListening) {
    voice.stop();
    micBtn.classList.remove('on', 'muted');
    inputEl.readOnly = false;
    inputEl.placeholder = `${currentKey || 'モデル'}で入力...`;
  } else {
    if (voice.isSpeaking) voice.clearQueue(false);
    inputEl.blur();
    inputEl.readOnly = true;
    inputEl.placeholder = "聞き取り中...";
    voice.start().then(ok => {
      dbg(`voice.start ${ok}`);
      if(ok) micBtn.classList.add('on');
      else { inputEl.readOnly = false; inputEl.placeholder = `${currentKey || 'モデル'}で入力...`; }
    });
  }
});

sendEl.addEventListener("click", () => { lastInputWasVoice = false; sendMessage(); });
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); lastInputWasVoice = false; sendMessage(); }
});
selectEl.addEventListener("change", () => {
  const key = selectEl.value;
  if (currentKey === key && engine) {
    dlBtn.textContent = "起動済み"; statusEl.textContent = `Ready ${key}`; statusEl.className = "ready";
  } else {
    dlBtn.textContent = "ダウンロード"; dlBtn.classList.remove("ready"); statusEl.textContent = "未DL"; statusEl.className = ""; inputEl.placeholder = `${key} をダウンロードしてください`;
  }
});
dlBtn.addEventListener("click", () => { const key = selectEl.value; if (currentKey === key && engine) return; loadModel(key); });
statusEl.textContent = "未DL";

function openSettings() { settingsPanel.classList.add("show"); settingsOverlay.classList.add("show"); }
function closeSettings() { settingsPanel.classList.remove("show"); settingsOverlay.classList.remove("show"); }
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);
savePromptBtn.addEventListener("click", saveSystemPrompt);
resetPromptBtn.addEventListener("click", resetSystemPrompt);
themeOpts.forEach(btn => { btn.addEventListener("click", () => { applyTheme(btn.dataset.theme, true); }); });
if (devConsoleToggle) { devConsoleToggle.addEventListener('change', (e)=>{ setDevConsoleEnabled(e.target.checked); }); }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => { console.log('[PWA] SW registered', reg.scope); }).catch(err => console.error('[PWA] SW failed', err));
}
