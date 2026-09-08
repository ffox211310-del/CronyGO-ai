// wllama-engine.js - Serow / GGUF専用エンジン
// CPU固定 / Temp 0.2 / 簡素プロンプト版

import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/index.js";

let wllama = null;
const WLLAMA_WASM = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm";

// 要件通りの設定
const WLLAMA_CONFIG = {
  n_ctx: 4096,
  n_gpu_layers: 0, // CPU固定
  n_threads: 1,
};
const TEMPERATURE = 0.2;
const SYSTEM_PROMPT = "日本語で簡潔に答えてください。";

// デフォルトSerow
const GGUF_MODELS = {
  "Serow-0.5B": "https://huggingface.co/WebAIPocket/Serow-Qwen2.5-0.5B-Instruct-gguf/resolve/main/Serow-0.5B.Q4_K_M.gguf",
};

const $ = (id) => document.getElementById(id);

let messages = [{ role: "system", content: SYSTEM_PROMPT }];
let currentModelKey = null;

function isGGUF(id) {
  if (!id) return false;
  const s = id.toLowerCase();
  return s.endsWith('.gguf') || s.includes('.gguf') || s.startsWith('http');
}

function ui() {
  return {
    modelSelect: $('model-select'),
    dlBtn: $('download-btn'),
    statusEl: $('status'),
    progressBar: $('progress-bar'),
    chatEl: $('chat'),
    inputEl: $('input'),
    sendBtn: $('send'),
    engineSelect: $('engine-select'),
    engineStatus: $('engine-status'),
    wllamaInput: $('wllama-model-id-input'),
    wllamaLoadBtn: $('wllama-load-btn'),
  };
}

function setStatus(t) {
  const { statusEl } = ui();
  if (statusEl) statusEl.textContent = t;
}
function setProgress(pct) {
  const { progressBar } = ui();
  if (progressBar) progressBar.style.width = `${pct}%`;
}
function addMsg(role, text) {
  const { chatEl } = ui();
  if (!chatEl) return null;
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

async function ensureWllama() {
  if (!wllama) {
    wllama = new Wllama({ default: WLLAMA_WASM });
  }
  return wllama;
}

export async function loadWllamaModel(modelUrl, key, onProgress) {
  const inst = await ensureWllama();
  const { inputEl, dlBtn, progressBar } = ui();
  
  if (progressBar) {
    progressBar.style.opacity = "1";
    progressBar.style.background = "#6ea8fe";
  }
  if (dlBtn) {
    dlBtn.disabled = true;
    dlBtn.textContent = "wllama読込中...";
  }
  if (inputEl) inputEl.disabled = true;

  try {
    // 既存モデル解放
    try { await inst.exit(); } catch {}
    
    setStatus(`${key} ダウンロード中...`);
    
    await inst.loadModelFromUrl(modelUrl, {
      ...WLLAMA_CONFIG,
      progressCallback: ({ loaded, total }) => {
        const pct = total ? Math.round((loaded/total)*100) : 0;
        setProgress(pct);
        setStatus(`${key} ${pct}% ${(loaded/1024/1024).toFixed(1)}MB`);
        onProgress?.(pct, loaded, total);
      }
    });

    currentModelKey = key;
    window._cronyEngineType = 'wllama';
    messages = [{ role: "system", content: SYSTEM_PROMPT }];

    setStatus(`Ready ${key} [wllama/CPU]`);
    if (progressBar) {
      progressBar.style.width = "100%";
      setTimeout(()=> progressBar.style.opacity="0", 800);
    }
    if (dlBtn) {
      dlBtn.textContent = "起動済み";
      dlBtn.disabled = false;
    }
    if (inputEl) {
      inputEl.disabled = false;
      inputEl.placeholder = `${key} と会話...`;
      inputEl.focus();
    }
    addMsg('assistant', `${key} 起動完了！ CPU推論 / Temp ${TEMPERATURE}`);
    
    // エンジン状態表示更新
    const { engineStatus } = ui();
    if (engineStatus) engineStatus.textContent = `wllama - ${key}`;

    return inst;
  } catch (e) {
    console.error("[wllama load error]", e);
    setStatus("wllama読込失敗");
    addMsg('system', `読込失敗: ${e.message}`);
    throw e;
  }
}

async function* chatStream(userText) {
  const inst = await ensureWllama();
  messages.push({ role: "user", content: userText });

  const stream = await inst.createChatCompletion({
    messages,
    max_tokens: 1024,
    temperature: TEMPERATURE, // 0.2固定
    top_p: 0.9,
    top_k: 40,
    stream: true,
  });

  let full = "";
  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content || "";
    if (delta) {
      full += delta;
      yield delta;
    }
  }
  messages.push({ role: "assistant", content: full });
}

// --- UI連携 ---
function initUI() {
  const { modelSelect, wllamaInput, wllamaLoadBtn, engineSelect, engineStatus } = ui();

  // モデルセレクトにSerowを追加
  if (modelSelect && !modelSelect.querySelector('option[value="Serow-0.5B"]')) {
    const opt = document.createElement('option');
    opt.value = "Serow-0.5B";
    opt.textContent = "Serow-0.5B (wllama)";
    modelSelect.appendChild(opt);
  }

  // エンジン切替表示
  const savedEngine = localStorage.getItem('cronygo_engine') || 'auto';
  if (engineSelect) {
    engineSelect.value = savedEngine;
    engineStatus && (engineStatus.textContent = savedEngine);
    engineSelect.addEventListener('change', () => {
      localStorage.setItem('cronygo_engine', engineSelect.value);
      if (engineStatus) engineStatus.textContent = engineSelect.value;
      window._cronyEngineForce = engineSelect.value;
    });
    window._cronyEngineForce = savedEngine;
  }

  // wllama直URL読込ボタン
  wllamaLoadBtn?.addEventListener('click', async () => {
    const url = wllamaInput?.value.trim();
    if (!url) return alert("GGUFのURLを入れてね");
    const key = url.split('/').pop() || "custom-gguf";
    try {
      await loadWllamaModel(url, key);
    } catch {}
  });

  // 既存のダウンロードボタンを横取り (GGUFだったらwllamaで)
  const { dlBtn } = ui();
  if (dlBtn && modelSelect) {
    dlBtn.addEventListener('click', async (e) => {
      const sel = modelSelect.value;
      const force = window._cronyEngineForce || 'auto';
      const targetUrl = GGUF_MODELS[sel] || sel;

      if (force === 'mlc') return; // 強制MLCなら何もしない
      if (force === 'wllama' || isGGUF(targetUrl)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        try {
          const url = GGUF_MODELS[sel] || targetUrl;
          const finalUrl = url.startsWith('http') ? url : `https://huggingface.co/${url}/resolve/main/${url.split('/').pop()}`;
          await loadWllamaModel(finalUrl, sel);
        } catch {}
      }
    }, true); // captureで先に拾う
  }

  // 送信を横取り
  const { sendBtn, inputEl, chatEl } = ui();
  const doSend = async () => {
    if (window._cronyEngineType !== 'wllama') return;
    const text = inputEl?.value.trim();
    if (!text) return;
    
    addMsg('user', text);
    inputEl.value = "";
    inputEl.disabled = true;
    sendBtn.disabled = true;

    const botDiv = addMsg('bot', "");
    let acc = "";
    try {
      for await (const delta of chatStream(text)) {
        acc += delta;
        botDiv.textContent = acc;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
    } catch (err) {
      botDiv.textContent = `エラー: ${err.message}`;
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  };

  sendBtn?.addEventListener('click', (e) => {
    if (window._cronyEngineType === 'wllama') {
      e.stopImmediatePropagation();
      e.preventDefault();
      doSend();
    }
  }, true);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && window._cronyEngineType === 'wllama') {
      e.preventDefault();
      doSend();
    }
  });
}

// グローバル公開 (app.jsからも呼べる)
window.CronyWllama = {
  isGGUF,
  loadWllamaModel,
  getEngine: () => wllama,
  chat: chatStream,
  models: GGUF_MODELS,
};

document.addEventListener('DOMContentLoaded', initUI);
if (document.readyState !== 'loading') initUI();

console.log("[wllama-engine] ready - CPU / Temp 0.2 / 簡素プロンプト");
