import { VoiceManager} from "./voice.js";
import { MODELS, MMPROJ} from "./models.js";
import { engineManager} from "./engine-manager.js";
import { EVENT_ICONS} from "./events.js";
import { marked} from "./lib/marked.esm.js";
import DOMPurify from "./lib/purify.esm.js";

const DEFAULT_SYSTEM_PROMPT = "あなたは様々な質問に答えるアシスタントです。簡素かつ丁寧に答えなさい。";
const LS_PROMPT_KEY = "cronygo_system_prompt";
const LS_THEME_KEY = "cronygo_theme";
const LS_DEV_CONSOLE_KEY = "cronygo_dev_console";
const LS_CUSTOM_MODELS = "cronygo_custom_models";
function loadCustomModels(){
  try{ return JSON.parse(localStorage.getItem(LS_CUSTOM_MODELS) || "[]"); }catch{ return []; }
}
function saveCustomModels(list){
  try{ localStorage.setItem(LS_CUSTOM_MODELS, JSON.stringify(list)); }catch{}
}
const MAX_CHARS = 1500;

const LS_ROOMS = "cronygo_rooms";
const LS_CURRENT = "cronygo_current_room";
const LS_ROOM_PREFIX = "cronygo_room_";
let rooms = [];
let currentRoomId = null;



let voice = null;
let currentKey = null;
let isGenerating = false;
let hasChatted = false;
let lastInputWasVoice = false;

// DEV CONSOLE
let devConsoleEnabled = false;
let debugOverlayEl = null;
let debugClearBtn = null;
let debugTestBtn = null;

function loadStoredPrompt() {
  try { return localStorage.getItem(LS_PROMPT_KEY) || DEFAULT_SYSTEM_PROMPT; }
  catch { return DEFAULT_SYSTEM_PROMPT; }
}

const DEFAULT_TEMP = 0.7;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_CONTEXT_SIZE = 4096;
const DEFAULT_REPEAT_PENALTY = 1.1;

function loadStoredTemp(){
  return parseFloat(localStorage.getItem('cronygo_temp') || DEFAULT_TEMP);
}

function loadStoredMaxTokens(){
  return parseInt(localStorage.getItem('cronygo_max_tokens') || DEFAULT_MAX_TOKENS);
}

function loadStoredContextSize(){
  return parseInt(localStorage.getItem('cronygo_context_size') || DEFAULT_CONTEXT_SIZE);
}

function loadStoredRepeatPenalty(){
  return parseFloat(
    localStorage.getItem('cronygo_repeat_penalty') || DEFAULT_REPEAT_PENALTY
  );
}

const tempSlider = document.getElementById('temp-slider');
const tempValue = document.getElementById('temp-value');
const maxTokensInput = document.getElementById('max-tokens-input');
const thinkToggle = document.getElementById('think-toggle');

const repeatPenaltySlider = document.getElementById('repeat-penalty-slider');
const repeatPenaltyValue = document.getElementById('repeat-penalty-value');

if(repeatPenaltySlider){
  repeatPenaltySlider.value = loadStoredRepeatPenalty();

  if(repeatPenaltyValue){
    repeatPenaltyValue.textContent = repeatPenaltySlider.value;
  }

  repeatPenaltySlider.addEventListener('input', (e)=>{
    if(repeatPenaltyValue){
      repeatPenaltyValue.textContent = e.target.value;
    }

    localStorage.setItem(
      'cronygo_repeat_penalty',
      e.target.value
    );
  });
}

const contextSizeSelect = document.getElementById('context-size');

if(contextSizeSelect){
  contextSizeSelect.value = loadStoredContextSize();

  contextSizeSelect.addEventListener('change', (e)=>{
    localStorage.setItem('cronygo_context_size', e.target.value);
  });
}

const threadSelect = document.getElementById('thread-count');
const threadInfo = document.getElementById('thread-info');

function loadStoredThreads(){
  const v = localStorage.getItem('cronygo_threads') || 'auto';
  return v === 'auto' ? 'auto' : (parseInt(v) || 'auto');
}

if(threadSelect){
  threadSelect.value = String(loadStoredThreads());

  // 端末のコア数がわかる範囲に選択肢を絞る（最低でも8まで残す）
  const cores = navigator.hardwareConcurrency || 4;
  [...threadSelect.options].forEach(o=>{
    if(o.value !== 'auto' && parseInt(o.value) > Math.max(cores, 8)) o.remove();
  });

  if(threadInfo){
    threadInfo.textContent = self.crossOriginIsolated
      ? `この端末: 論理コア ${cores}`
      : `この環境ではマルチスレッドが使えません（crossOriginIsolated=false）。自動で通常動作になります`;
  }

  threadSelect.addEventListener('change', (e)=>{
    localStorage.setItem('cronygo_threads', e.target.value);
  });
}

if(tempSlider){
  tempSlider.value = loadStoredTemp();
  if(tempValue) tempValue.textContent = tempSlider.value;
  tempSlider.addEventListener('input', (e)=>{
    if(tempValue) tempValue.textContent = e.target.value;
    localStorage.setItem('cronygo_temp', e.target.value);
  });
}
if(maxTokensInput){
  maxTokensInput.value = loadStoredMaxTokens();
  maxTokensInput.addEventListener('change', (e)=>{
    localStorage.setItem('cronygo_max_tokens', e.target.value);
  });
}
const fileLimitInput = document.getElementById('file-limit-input');
if(fileLimitInput){
  fileLimitInput.value = loadFileLimit();
  fileLimitInput.addEventListener('change', (e)=>{
    let v = parseInt(e.target.value);
    if(!Number.isFinite(v) || v < 0) v = 1000;
    e.target.value = v;
    localStorage.setItem('cronygo_file_limit', String(v));
    refreshFileLimitLabel();
  });
}
if(thinkToggle){
　thinkToggle.checked = localStorage.getItem('cronygo_thinking')!== '0';
　thinkToggle.addEventListener('change', (e)=>{
　localStorage.setItem('cronygo_thinking', e.target.checked? '1': '0');
　});
}
async function refreshCacheInfo(){
  const usageEl = document.getElementById('cache-usage');
  const modelEl = document.getElementById('cache-model-name');
  try{
    const estimate = await navigator.storage.estimate();
    const mb = ((estimate.usage||0)/1024/1024).toFixed(1);
    if(usageEl) usageEl.textContent = `${mb} MB`;
  }catch{ if(usageEl) usageEl.textContent = '取得失敗'; }
  if(modelEl) modelEl.textContent = localStorage.getItem('webllm_model_id') || selectEl?.value || '未取得';
}
document.getElementById('cache-refresh-btn')?.addEventListener('click', refreshCacheInfo);
document.getElementById('cache-clear-btn')?.addEventListener('click', async ()=>{
  if(!confirm('モデルキャッシュを削除しますか？次回は再ダウンロードが必要です')) return;
  localStorage.removeItem('webllm_model_id');
  if('caches' in window){
    const keys = await caches.keys();
    for(const k of keys) await caches.delete(k);
  }
  alert('キャッシュ削除しました');
  refreshCacheInfo();
});
refreshCacheInfo();

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
const voicePreview = document.getElementById("voice-preview") || { textContent: ""};
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const selectEl = document.getElementById("model-select");

function refreshModelSelect(){
  // base MODELS をセレクトに自動追加 (Serow等)
  Object.keys(MODELS).forEach(key=>{
    if ([...selectEl.options].some(op=>op.value===key)) return;
    const opt = document.createElement('option');
    opt.value = key;
    // Serowは目立つように
    opt.textContent = key.includes('Serow') ? `${key}` : key;
    selectEl.appendChild(opt);
  });
  const custom = loadCustomModels();
  [...selectEl.options].forEach(o=>{ if(o.dataset.custom) o.remove(); });
  custom.forEach(fullId=>{
    const base = fullId.split('/').pop().replace(/-MLC$/,'').slice(0,28);
    let key = base; let n=1;
    while(MODELS[key] && MODELS[key]!==fullId) key = `${base}_${n++}`;
    MODELS[key] = fullId;
    if(![...selectEl.options].some(op=>op.value===key)){
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `★ ${key}`;
      opt.dataset.custom = "1";
      selectEl.appendChild(opt);
    }
  });
  renderCustomModelList();
}
function renderCustomModelList(){
  const el = document.getElementById('custom-model-list');
  if(!el) return;
  const list = loadCustomModels();
  if(!list.length){ el.innerHTML = '<span style="font-size:11px; opacity:.5;">まだ登録なし</span>'; return; }
  el.innerHTML = list.map(id=>`
    <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:6px 8px; border-radius:6px; font-size:11px; margin-bottom:4px;">
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${id}</span>
      <button data-del="${id}" style="margin-left:8px; border:1px solid #444; background:transparent; color:#f55; border-radius:4px; padding:2px 6px;">削除</button>
    </div>
  `).join('');
}
const loadingView = document.getElementById("loading-view");
const loadingText = document.getElementById("loading-text");
const newRoomBtn = document.getElementById('new-room-btn');
const roomListEl = document.getElementById('room-list');

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
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsVoiceDesc = document.getElementById('tts-voice-desc');
const ttsTestBtn = document.getElementById('tts-test-btn');
const ttsReloadBtn = document.getElementById('tts-reload-voices-btn');

systemPromptInput.value = loadStoredPrompt();
applyTheme(loadStoredTheme(), false);
devConsoleEnabled = loadDevConsoleEnabled();
setDevConsoleEnabled(devConsoleEnabled);

// Chat BG
const bgUpload = document.getElementById('bg-upload');
const bgUploadBtn = document.getElementById('bg-upload-btn');
const bgClearBtn = document.getElementById('bg-clear-btn');
const bgOpacity = document.getElementById('bg-opacity');
const LS_BG = "cronygo_chat_bg";
const LS_BG_OP = "cronygo_chat_bg_op";
function applyBg(dataUrl){
if(dataUrl){
document.body.style.backgroundImage = `url("${dataUrl}")`;
chatEl.classList.add('has-custom-bg');
}else{
document.body.style.backgroundImage = '';
chatEl.classList.remove('has-custom-bg');
}
}
function applyOpacity(v){
  document.documentElement.style.setProperty('--chat-bg-overlay', v/100);
  try{ localStorage.setItem(LS_BG_OP, String(v)); }catch{}
}
try{
  const savedBg = localStorage.getItem(LS_BG);
  const savedOp = localStorage.getItem(LS_BG_OP);
  if(savedBg) applyBg(savedBg);
  if(savedOp){
    if(bgOpacity) bgOpacity.value = savedOp;
    applyOpacity(savedOp);
  } else if(bgOpacity){
    applyOpacity(bgOpacity.value);
  }
}catch{}
bgUploadBtn?.addEventListener('click', ()=> bgUpload?.click());
bgClearBtn?.addEventListener('click', ()=>{
  localStorage.removeItem(LS_BG);
  applyBg(null);
});
bgOpacity?.addEventListener('input', (e)=> applyOpacity(e.target.value));
bgUpload?.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const dataUrl = await new Promise((res)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      const max = 1024;
      let w = img.width, h = img.height;
      if(w>max || h>max){ const r = Math.min(max/w, max/h); w*=r; h*=r; }
      c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
  try{
    localStorage.setItem(LS_BG, dataUrl);
    applyBg(dataUrl);
  }catch(err){
    alert('画像が大きすぎます。もっと小さい画像で試して');
  }
});

// TTS
function refreshVoiceList() {
  if (!ttsVoiceSelect ||!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    ttsVoiceSelect.innerHTML = '<option>読み込み中... 少し待つか再読込押して</option>';
    return;
  }
  const ja = voices.filter(v => v.lang.toLowerCase().startsWith('ja'));
  const other = voices.filter(v =>!v.lang.toLowerCase().startsWith('ja'));
  const sorted = [...ja.sort((a,b)=>a.name.localeCompare(b.name)),...other.sort((a,b)=>a.name.localeCompare(b.name))];
  const saved = localStorage.getItem("cronygo_tts_voice");
  ttsVoiceSelect.innerHTML = '';
  sorted.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})${ja.includes(v)?' ★':''}`;
    ttsVoiceSelect.appendChild(opt);
  });
  if (saved) ttsVoiceSelect.value = saved;
  else if (ja[0]) ttsVoiceSelect.value = ja[0].voiceURI;
  updateVoiceDesc();
}
function updateVoiceDesc() {
  if (!ttsVoiceDesc ||!ttsVoiceSelect) return;
  const v = window.speechSynthesis.getVoices().find(x => x.voiceURI === ttsVoiceSelect.value);
  if (v) ttsVoiceDesc.textContent = `選択中: ${v.name} / ${v.lang}`;
}
if (ttsVoiceSelect) {
  ttsVoiceSelect.addEventListener('change', () => {
    const uri = ttsVoiceSelect.value;
    if (voice) voice.setPreferredVoice(uri);
    try { localStorage.setItem("cronygo_tts_voice", uri); } catch {}
    updateVoiceDesc();
  });
}
if (ttsTestBtn) {
  ttsTestBtn.addEventListener('click', () => {
    const txt = "こんにちは、クロニーゴーです。この声はいかがですか？";
    if (voice) voice.speak(txt);
  });
}
if (ttsReloadBtn) {
  ttsReloadBtn.addEventListener('click', refreshVoiceList);
}
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    dbg(`voiceschanged ${window.speechSynthesis.getVoices().length}`);
    refreshVoiceList();
  };
  setTimeout(refreshVoiceList, 400);
  setTimeout(refreshVoiceList, 1500);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function preprocessMarkdown(text) {
let t = text;
// ** だけの行を消す（従来の掃除）
t = t.replace(/^\s*\*\*\s*$/gm, '');
// ** の内側に改行・余分な空白がある太字を整える（従来の掃除）
t = t.replace(/\*\*\s*\n\s*([\s\S]+?)\s*\n\s*\*\*/g, '**$1**');
t = t.replace(/\*\*\s+([\s\S]+?)\s+\*\*/g, '**$1**');
// 見出し：# の直後に空白が無い場合は補う（##見出し → ## 見出し）
t = t.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
// 行頭の ・ / • 箇条書きを - にそろえる（marked のリストとして読ませる）
t = t.replace(/^[ \t]*[・•][ \t]*(.+)$/gm, '- $1');
// 表：区切り行（|---|）が無い表は、ヘッダ行の列数で区切り行を補う
const isRow = (s) => /^\s*\|/.test(s);
const isDelim = (s) => /^[|:\-\s]+$/.test(s.trim()) && s.includes('-');
const cellCount = (s) => {
let x = s.trim();
if (x.startsWith('|')) x = x.slice(1);
if (x.endsWith('|')) x = x.slice(0, -1);
return x.split('|').length;
};
const lines = t.split('\n');
const out = [];
for (let i = 0; i < lines.length; i++) {
out.push(lines[i]);
// 表の開始行（直前が表の行ではない行）でのみ補う
const isBlockStart = i === 0 ||!isRow(lines[i - 1]);
if (isBlockStart && isRow(lines[i]) &&!isDelim(lines[i]) && i + 1 < lines.length && isRow(lines[i + 1]) &&!isDelim(lines[i + 1])) {
out.push('| ' + Array(cellCount(lines[i])).fill('---').join(' | ') + ' |');
}
}
return out.join('\n');
}

marked.setOptions({ gfm: true, breaks: true});

function renderMarkdown(text) {
if (!text) return '';
const t = preprocessMarkdown(String(text).trim());
let html;
try {
html = marked.parse(t);
} catch {
// 万一パースに失敗したら、最低限エスケープ＋改行だけして返す
return escapeHtml(t).replace(/\n/g, '<br>');
}
return DOMPurify.sanitize(html);
}


// 思考ブロック（折りたたみ）を組み立てる。本文とは別枠
function createThinkBlock(thinkText, collapsed = true) {
const block = document.createElement("div");
block.className = "think-block" + (collapsed? " closed": "");
const head = document.createElement("div");
head.className = "think-head";
head.innerHTML = '<span>思考</span><span class="think-chev">▾</span>';
const body = document.createElement("div");
body.className = "think-body";
body.textContent = thinkText || "";
head.addEventListener("click", () => block.classList.toggle("closed"));
block.appendChild(head);
block.appendChild(body);
return block;
}

// 生成ログ（PocketPal風の3点表示）。数値は履歴に保存して復元時も出す
function formatGenStats(s){
  const ttft = s.ttft >= 10000 ? (s.ttft / 1000).toFixed(1) + "s" : s.ttft + "ms";
  return `${Math.round(s.mspt)}ms/トークン, ${s.tps.toFixed(2)} トークン/秒, ${ttft} TTFT`;
}
function createGenStatsEl(s){
  const el = document.createElement("div");
  el.className = "msg-stats";
  el.textContent = formatGenStats(s);
  return el;
}

// 回答の下のアクション行（コピー＋生成ログ）。再生成ボタンは最後の回答にだけ後から付く
function createMsgActionsEl(content, stats){
  const row = document.createElement("div");
  row.className = "msg-actions";
  const copyBtn = document.createElement("button");
  copyBtn.className = "msg-act-btn msg-copy-btn";
  copyBtn.title = "コピー";
  copyBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(content); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
    copyBtn.classList.add("copied");
    setTimeout(() => copyBtn.classList.remove("copied"), 1200);
  });
  row.appendChild(copyBtn);
  if (stats) row.appendChild(createGenStatsEl(stats));
  return row;
}
function createRegenBtn(row){
  const btn = document.createElement("button");
  btn.className = "msg-act-btn msg-regen-btn";
  btn.title = "再生成";
  btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  btn.addEventListener("click", () => regenerateLast(row));
  return btn;
}
function placeRegenButton(row){
  document.querySelectorAll(".msg-regen-btn").forEach(b => b.remove());
  if (row) row.prepend(createRegenBtn(row));
}
// 最後の回答を消して、同じ会話でもう一度生成する（送信済み編集の土台）
function regenerateLast(row){
  if (isGenerating) return;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return;
  if (!engineManager.isReady()) { addMessage("system", "モデルをダウンロードしてください"); return; }
  messages.pop();
  if (row) {
    const bubble = row.previousElementSibling;
    const think = bubble?.previousElementSibling;
    if (think?.classList.contains("think-block")) think.remove();
    if (bubble?.classList.contains("msg")) bubble.remove();
    row.remove();
  }
  saveCurrentRoomHistory();
  sendMessageWithText(null, true);
}

// ===== 送信済みプロンプトの編集 =====
let editingIndex = null;
// 自分の発言を長押し（500ms）すると編集が開く。スクロールや移動では開かない
function attachEditGesture(bubbleDiv, index){
  let timer = null, sx = 0, sy = 0;
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    bubbleDiv.classList.remove("pressing");
  };
  bubbleDiv.addEventListener("pointerdown", (e) => {
    sx = e.clientX; sy = e.clientY;
    bubbleDiv.classList.add("pressing");
    timer = setTimeout(() => {
      timer = null;
      bubbleDiv.classList.remove("pressing");
      if (navigator.vibrate) navigator.vibrate(10);
      startEditMessage(index, bubbleDiv);
    }, 500);
  });
  bubbleDiv.addEventListener("pointermove", (e) => {
    if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel();
  });
  bubbleDiv.addEventListener("pointerup", cancel);
  bubbleDiv.addEventListener("pointercancel", cancel);
  bubbleDiv.addEventListener("contextmenu", (e) => e.preventDefault());
}
// 自分の発言を編集する。保存すると、その発言より後ろを切り捨てて再生成する
function startEditMessage(index, bubbleDiv){
  if (isGenerating || editingIndex !== null) return;
  const msg = messages[index];
  if (!msg || msg.role !== "user" || msg.img) return;
  if (!engineManager.isReady()) { addMessage("system", "モデルをダウンロードしてください"); return; }
  editingIndex = index;
  const marker = msg.content.indexOf("\n\n【ファイル「");
  const question = marker >= 0 ? msg.content.slice(0, marker) : msg.content;
  const fileSuffix = marker >= 0 ? msg.content.slice(marker) : "";
  bubbleDiv.innerHTML = "";
  if (fileSuffix) {
    const note = document.createElement("div");
    note.className = "msg-edit-note";
    note.textContent = "ファイルの内容はそのまま残ります";
    bubbleDiv.appendChild(note);
  }
  const ta = document.createElement("textarea");
  ta.className = "msg-edit-area";
  ta.value = question;
  ta.rows = 3;
  bubbleDiv.appendChild(ta);
  const btnRow = document.createElement("div");
  btnRow.className = "msg-edit-btns";
  const saveBtn = document.createElement("button");
  saveBtn.className = "msg-edit-save";
  saveBtn.textContent = "保存して再生成";
  saveBtn.addEventListener("click", () => {
    const newQ = ta.value.trim();
    if (!newQ) return;
    if (!engineManager.isReady()) { addMessage("system", "モデルをダウンロードしてください"); return; }
    const newContent = newQ + fileSuffix;
    editingIndex = null;
    messages.length = index;
    saveCurrentRoomHistory();
    renderChatFromHistory(getHistory());
    sendMessageWithText(newContent);
  });
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "msg-edit-cancel";
  cancelBtn.textContent = "キャンセル";
  cancelBtn.addEventListener("click", () => { editingIndex = null; renderChatFromHistory(getHistory()); });
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  bubbleDiv.appendChild(btnRow);
  ta.focus();
}

function addMessage(role, content, think, imgData, stats) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (role === 'assistant') {
    div.innerHTML = renderMarkdown(content);
  } else if (role === 'user' && content.includes("\n\n【ファイル「")) {
    // ファイル添付は本文を畳んで、質問＋ファイル名チップだけ見せる（送信内容・履歴データはそのまま）
    div.textContent = content.slice(0, content.indexOf("\n\n【ファイル「"));
    const name = (content.match(/【ファイル「([^」]*)」の内容】/) || [])[1] || "ファイル";
    const chip = document.createElement("div");
    chip.className = "msg-file-chip";
    chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span></span>';
    chip.querySelector("span").textContent = name;
    div.appendChild(chip);
  } else {
    div.textContent = content;
  }
  // 履歴から復元した送信画像（data URL）を吹き出し内に表示する
  if (role === 'user' && imgData) {
    const im = document.createElement("img");
    im.src = imgData;
    im.className = "msg-img";
    im.alt = "添付画像";
    div.appendChild(im);
  }
// 履歴にThinkがあれば、本文の上に畳んだ状態で復元する
if (role === 'assistant' && think) {
chatEl.appendChild(createThinkBlock(think, true));
}
chatEl.appendChild(div);
if (role === 'assistant' && (content || stats)) chatEl.appendChild(createMsgActionsEl(content, stats));
chatEl.scrollTop = chatEl.scrollHeight;
return div;
}

function showAssistantPending(el) {
  el.classList.add("pending");
  el.innerHTML = `
    <div class="pending-answer" role="status" aria-live="polite">
      <img class="pending-icon" src="./assets/Teal.png" alt="" onerror="this.style.display='none'">
      <span class="pending-text">回答を生成しています...</span>
    </div>
  `;
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

// ROOMS
function loadRooms(){
  try{ const r = localStorage.getItem(LS_ROOMS); return r? JSON.parse(r) : []; }catch{ return []; }
}
function saveRooms(){
  try{ localStorage.setItem(LS_ROOMS, JSON.stringify(rooms)); }catch{}
}
function loadRoomMessages(id){
  try{ const r = localStorage.getItem(LS_ROOM_PREFIX+id); return r? JSON.parse(r) : []; }catch{ return []; }
}

function saveRoomMessages(id, msgs){
  try{ localStorage.setItem(LS_ROOM_PREFIX+id, JSON.stringify(msgs)); }
  catch(e){
    // 容量オーバー時は画像とファイル本文を落として、テキストだけでも保存を試みる
    try{
      const stripped = msgs.map(m => { const { img, ...rest } = m; if (typeof rest.content === "string") rest.content = rest.content.replace(/\n\n【ファイル「[^」]*」の内容】[\s\S]*?【ファイルここまで】/g, ""); return rest; });
      localStorage.setItem(LS_ROOM_PREFIX+id, JSON.stringify(stripped));
    }catch{ console.warn(e); }
  }
}

function getHistory(){ return messages.slice(1); }
function saveCurrentRoomHistory(){
  if(!currentRoomId) return;
  saveRoomMessages(currentRoomId, getHistory());
  const room = rooms.find(r=>r.id===currentRoomId);
  if(room){
    room.updatedAt = Date.now();
    if(room.title==="新しいチャット" && getHistory().length>0){
      const firstUser = getHistory().find(m=>m.role==="user");
      if(firstUser){
        room.title = firstUser.content.slice(0,20) + (firstUser.content.length>20?"…":"");
      }
    }
    saveRooms(); renderRoomList();
  }
}

  // ===== 会話エクスポート（JSON / Markdown） =====
function exportFileBase(){
  const room = rooms.find(r=>r.id===currentRoomId);
  const title = (room?.title || "チャット").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 30) || "チャット";
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return `CronyGO-${ymd}-${title}`;
}
function downloadTextFile(text, name, type){
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 自動クリックで落ちないブラウザ向けに、設定内に実リンクも出す（自分のタップなら確実に落ちる）
  const area = document.getElementById("export-link-area");
  if(area){
    area.innerHTML = "";
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.textContent = name + " をダウンロード";
    link.style.color = "var(--accent)";
    area.appendChild(link);
  }
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
function exportChat(format){
  const history = getHistory();
  if(!history.length){ addMessage("system", "エクスポートする会話がありません"); return; }
  const room = rooms.find(r=>r.id===currentRoomId);
  if(format === "json"){
    const data = {
      app: "CronyGO",
      version: 1,
      exportedAt: new Date().toISOString(),
      room: {
        title: room?.title || "",
        createdAt: room ? new Date(room.createdAt || parseInt(room.id)).toISOString() : null,
        model: room?.model || ""
      },
      messages: history.map(m => { const { img, ...rest } = m; return rest; })
    };
    downloadTextFile(JSON.stringify(data, null, 2), exportFileBase() + ".json", "application/json");
    return;
  }
  const lines = [];
  lines.push(`# ${room?.title || "チャット"}`);
  lines.push("");
  lines.push(`- エクスポート日: ${new Date().toLocaleString()}`);
  if(room) lines.push(`- 部屋の作成日: ${new Date(room.createdAt || parseInt(room.id)).toLocaleDateString()}`);
  if(room?.model) lines.push(`- モデル: ${room.model}`);
  lines.push(`- 発言数: ${history.length}`);
  lines.push("- システムプロンプトは含まれていません。画像はエクスポートされません。");
  lines.push("");
  for(const m of history){
    if(m.role === "user"){
      lines.push("## ユーザー");
      lines.push("");
      const fm = m.content.match(/\n\n【ファイル「([^」]*)」の内容】\n([\s\S]*?)\n【ファイルここまで】$/);
      if(fm){
        lines.push(m.content.slice(0, m.content.indexOf("\n\n【ファイル「")));
        lines.push("");
        lines.push(`<details><summary>添付ファイル: ${fm[1]}</summary>`);
        lines.push("");
        lines.push(fm[2]);
        lines.push("");
        lines.push("</details>");
      } else {
        lines.push(m.content);
      }
      if(m.img) lines.push("\n[画像を添付しました]");
    } else if(m.role === "assistant"){
      lines.push("## CronyGO");
      lines.push("");
      if(m.think){
        lines.push("<details><summary>思考過程</summary>");
        lines.push("");
        lines.push(m.think);
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
      lines.push(m.content);
    }
    lines.push("");
  }
  downloadTextFile(lines.join("\n"), exportFileBase() + ".md", "text/markdown");
}
function roomBucketLabel(ts){
  const now = new Date();
  const d = new Date(ts);
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if(days <= 0) return "今日";
  if(days === 1) return "昨日";
  if(days <= 6) return "今週";
  if(days <= 13) return "先週";
  if(days <= 29) return "一ヶ月前";
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if(months <= 1) return "一ヶ月前";
  if(months < 12) return months + "ヶ月前";
  const years = Math.floor(months / 12);
  return years === 1 ? "一年前" : years + "年前";
}
function renderRoomList(){
  if(!roomListEl) return;
  const sorted = [...rooms].sort((a, b) => (b.updatedAt || b.createdAt || parseInt(b.id)) - (a.updatedAt || a.createdAt || parseInt(a.id)));
  let lastLabel = "";
  let html = "";
  for(const r of sorted){
    const ts = r.updatedAt || r.createdAt || parseInt(r.id);
    const label = roomBucketLabel(ts);
    if(label !== lastLabel){ html += `<div class="room-group-label">${label}</div>`; lastLabel = label; }
    html += `
    <div class="room-item ${r.id===currentRoomId?'active':''}" data-id="${r.id}" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <div style="min-width:0; flex:1;">
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${r.title}</span>
        <span style="font-size:10px; opacity:0.5;">${new Date(ts).toLocaleDateString()}</span>
      </div>

      <div style="display:flex; gap:4px; flex-shrink:0;">
      
  <button class="room-rename-btn"
  data-rename-id="${r.id}"
  aria-label="名前変更"
  title="名前変更"
  style="
    width:24px;
    height:24px;
    border-radius:50%;
    border:1px solid #333;
    background:transparent;
    color:#888;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0;
    line-height:1;
  ">
  ✎
</button>

 <button class="room-del-btn"
  data-del-id="${r.id}"
  aria-label="削除"
  title="削除"
  style="
    width:24px;
    height:24px;
    border-radius:50%;
    border:1px solid #333;
    background:transparent;
    color:#888;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0;
    line-height:1;
  ">
  ×
</button>

</div>
      
    </div>
  `;
  }
  roomListEl.innerHTML = html;
}
const WELCOME_TEXT = "こんにちは！さっそくモデルをダウンロードしてチャットを始めましょう！";
function clearChatUI(){
  
  chatEl.querySelectorAll('.msg,.think-block,.msg-stats,.msg-actions').forEach(el=>el.remove());
  
  if(!chatEl.contains(loadingView)){
    chatEl.appendChild(loadingView);
  }
}
function renderChatFromHistory(history){
  clearChatUI();
  if(history.length === 0){
    const div = document.createElement("div");
    div.className = "msg assistant";
    div.textContent = WELCOME_TEXT;
    chatEl.insertBefore(div, loadingView);
    hasChatted = false;
    hideFirstLoadingUI();
    return;
  }
  
  
  editingIndex = null;
  history.forEach((m, i) => {
    const d = addMessage(m.role, m.content, m.think, m.img, m.stats);
    if (m.role === "user" && !m.img) attachEditGesture(d, i + 1);
  });
  if (history[history.length - 1]?.role === "assistant") {
    const rows = chatEl.querySelectorAll(".msg-actions");
    if (rows.length) placeRegenButton(rows[rows.length - 1]);
  }
  hasChatted = true;
  hideFirstLoadingUI();
}
function switchRoom(id){
  if(!id || id===currentRoomId){ closeDrawer(); return; }
  saveCurrentRoomHistory();
  currentRoomId = id;
  localStorage.setItem(LS_CURRENT, id);
  const history = loadRoomMessages(id);
  messages = [{ role: "system", content: loadStoredPrompt() },...history];
  renderChatFromHistory(history);
  renderRoomList();
  closeDrawer();
}
function createRoom(){
  saveCurrentRoomHistory();
  const id = Date.now().toString();
  const newRoom = { id, title:"新しいチャット", createdAt: Date.now(), model: currentKey || selectEl.value };
  rooms.unshift(newRoom);
  saveRooms();
  currentRoomId = id;
  localStorage.setItem(LS_CURRENT, id);
  messages = [{ role: "system", content: loadStoredPrompt() }];
  hasChatted = false;
  renderChatFromHistory([]);
  renderRoomList();
  closeDrawer();
  saveRoomMessages(id, []);
}

function renameRoom(id){
  const room = rooms.find(r => r.id === id);
  if(!room) return;

  const newName = prompt('ルーム名を入力してください', room.title);

  if(newName === null) return;

  const title = newName.trim();

  if(!title){
    alert('ルーム名を入力してください');
    return;
  }

  room.title = title.slice(0, 50);

  saveRooms();
  renderRoomList();
}

function deleteRoom(id){
  if(rooms.length <= 1){
    saveRoomMessages(id, []);
    messages = [{ role: "system", content: loadStoredPrompt() }];
    const room = rooms.find(r=>r.id===id);
    if(room) room.title = "新しいチャット";
    saveRooms();
    renderChatFromHistory([]);
    renderRoomList();
    return;
  }
  rooms = rooms.filter(r=>r.id!== id);
  saveRooms();
  try{ localStorage.removeItem(LS_ROOM_PREFIX+id); }catch{}
  if(id === currentRoomId){
    currentRoomId = rooms[0].id;
    localStorage.setItem(LS_CURRENT, currentRoomId);
    const history = loadRoomMessages(currentRoomId);
    messages = [{ role: "system", content: loadStoredPrompt() },...history];
    renderChatFromHistory(history);
  }
  renderRoomList();
}
function initRooms(){
  rooms = loadRooms();
  if(rooms.length===0){
    createRoom();
    return;
  }
  currentRoomId = localStorage.getItem(LS_CURRENT) || rooms[0].id;
  const history = loadRoomMessages(currentRoomId);
  messages = [{ role: "system", content: loadStoredPrompt() },...history];
  renderChatFromHistory(history);
  renderRoomList();
}
function initCustomModelUI(){
  refreshModelSelect();
  try {
    const saved = localStorage.getItem('cronygo_model');
    if (saved && [...selectEl.options].some(o => o.value === saved)) {
      selectEl.value = saved;
      selectEl.dispatchEvent(new Event('change'));
    }
  } catch {}
  document.getElementById('custom-model-add-btn')?.addEventListener('click', ()=>{
    const input = document.getElementById('custom-model-id-input');
    const id = input?.value.trim();
    if(!id ||!id.includes('/')){
      alert('HF ID形式で\n例: mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC');
      return;
    }
    const list = loadCustomModels();
    if(list.includes(id)){ alert('登録済み'); return; }
    list.unshift(id);
    saveCustomModels(list);
    if(input) input.value='';
    refreshModelSelect();
  });
  document.getElementById('custom-model-list')?.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-del]');
    if(!b) return;
    const id = b.dataset.del;
    saveCustomModels(loadCustomModels().filter(x=>x!==id));
    Object.keys(MODELS).forEach(k=>{ if(MODELS[k]===id) delete MODELS[k]; });
    refreshModelSelect();
  });
}

function resetSystemPrompt() {
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  saveSystemPrompt();
  promptStatus.textContent = "デフォルトに戻しました。";
}

// ===== エンジン周りは engine-manager に委譲 =====
async function loadModel(key, isReload = false) {
  const isFirstPhase = !hasChatted && !isReload;

  localVisionLoaded = false;
  statusEl.textContent = isReload? "再読込中...": "読込中...";
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
  if (!isFirstPhase) addMessage("system", isReload? `${key} 再読込開始` : `${key} を読み込み開始。`);

  try {
    
    const context_size = parseInt(
  localStorage.getItem('cronygo_context_size') || 4096
);
    const storedThreads = localStorage.getItem('cronygo_threads') || 'auto';
    const n_threads = storedThreads === 'auto' ? 'auto' : parseInt(storedThreads);

if (key.startsWith("__local__:")) {
  // ローカルモデルは保持しているFileから積み直す
  const file = engineManager.engines.wllama.localFile;
  if (!file) throw new Error("ローカルファイルが見つかりません。選び直してください");
  await engineManager.loadLocalFile(file, null, { context_size, n_threads });
} else {
  await engineManager.load(
    key,
    (pct, text) => {
      const txt = isReload
        ? `積み直し ${pct}% ${text}`
        : `${pct}% ${text}`;

      updateLoadingText(txt);
      statusEl.textContent = txt;
      progressBar.style.width = `${pct}%`;
    },
    { context_size, n_threads }
  );
}

    currentKey = key;
    statusEl.textContent = isReload? `再起動完了 ${key}` : `Ready ${key} [${engineManager.getCurrentId()}]`;
    statusEl.className = "ready";
    progressBar.style.width = "100%";
    setTimeout(() => progressBar.style.opacity = "0", 800);
    inputEl.disabled = false;
    sendEl.disabled = false;
    inputEl.placeholder = `${key}で入力...`;
    hideFirstLoadingUI();
    addMessage("assistant", isReload? `${key} 積み直し完了！続きをどうぞ` : `${key} 起動完了！`);
    if (isVisionModel() && !/Firefox/i.test(navigator.userAgent)) {
      addMessage("system", "画像認識は Firefox での実行を推奨します。Chromeなど一部ブラウザでは処理が止まることがあります。");
    }
    dbg(`model ${key} loaded via ${engineManager.getCurrentId()}`);
  } catch (e) {
    dbg(`model load ERROR ${e.message}`);
    console.error(e);
    statusEl.textContent = "エラー";
    statusEl.className = "";
    progressBar.style.background = "#ff4444";
    hideFirstLoadingUI();
    addMessage("assistant", "エラー: " + e.message);
  }
}

// Vision step2：添付可否は「MMPROJキー」ではなくこのフラグで判定する（LFM限定をやめる）。
// 標準モデルは MMPROJ 定義があれば ON。ローカルモデルは mmproj 付きで読めた時に
// localVisionLoaded を true にする（立てる配線はエンジン側ブロック）。
let localVisionLoaded = false;
function isVisionModel() {
  if (engineManager.getCurrentId() !== "wllama") return false;
  return !!MMPROJ[engineManager.currentKey] || localVisionLoaded;
}

// ===== 画像添付（Vision step1：WllamaのVLモデル専用） =====
let pendingImage = null; // { buffer: ArrayBuffer, url: string}
const imageInput = document.getElementById("image-input");
const attachPreview = document.getElementById("attach-preview");
const attachThumb = document.getElementById("attach-thumb");

function clearPendingImage() {
if (pendingImage?.url) URL.revokeObjectURL(pendingImage.url);
pendingImage = null;
attachPreview.hidden = true;
attachThumb.removeAttribute("src");
}
document.getElementById("attach-clear").addEventListener("click", clearPendingImage);

document.getElementById("attach-btn").addEventListener("click", () => {
  const menu = document.getElementById("plus-menu");
  
  const imgRow = document.getElementById("plus-menu-image");
  const camRow = document.getElementById("plus-menu-camera");
  // 開くたびに今のモデルの状態で有効/無効を決め直す（モデル切替後に古い状態が残らない）
  imgRow.disabled = !isVisionModel();
  camRow.disabled = !isVisionModel();
  
  menu.hidden = !menu.hidden;
});
document.getElementById("plus-menu-image").addEventListener("click", () => {
  document.getElementById("plus-menu").hidden = true;
  imageInput.click();
});
document.getElementById("plus-menu-camera").addEventListener("click", () => {
  document.getElementById("plus-menu").hidden = true;
  document.getElementById("camera-input").click();
});

// ===== ファイル添付（txt / md / PDF のテキスト読み取り） =====
let pendingFile = null; // { name: string, text: string }
const fileInput = document.getElementById("file-input");
const filePreview = document.getElementById("file-preview");
const fileNameEl = document.getElementById("file-name");

function loadFileLimit() {
  const v = parseInt(localStorage.getItem("cronygo_file_limit"));
  return Number.isFinite(v) && v >= 0 ? v : 1000;
}
function refreshFileLimitLabel() {
  const el = document.getElementById("plus-menu-file-limit");
  if (!el) return;
  const lim = loadFileLimit();
  el.textContent = lim === 0 ? "無制限" : lim + "文字まで";
}
function clearPendingFile() {
  pendingFile = null;
  filePreview.hidden = true;
  fileNameEl.textContent = "";
}
document.getElementById("file-clear").addEventListener("click", clearPendingFile);
document.getElementById("plus-menu-file").addEventListener("click", () => {
  document.getElementById("plus-menu").hidden = true;
  fileInput.click();
});
fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  fileInput.value = "";
  if (!f) return;
  let text = "";
  try {
    if (/\.pdf$/i.test(f.name)) {
      fileNameEl.textContent = "PDFを読み取り中…";
      filePreview.hidden = false;
      const pdfjs = await import("./lib/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        pages.push(tc.items.map(i => i.str + (i.hasEOL ? "\n" : "")).join(""));
      }
      text = pages.join("\n");
    } else {
      text = await f.text();
    }
  } catch {
    clearPendingFile();
    addMessage("system", "ファイルを読み取れませんでした");
    return;
  }
  text = text.trim();
  if (!text) {
    clearPendingFile();
    addMessage("system", "ファイルからテキストを抽出できませんでした");
    return;
  }
  const lim = loadFileLimit();
  if (lim > 0 && text.length > lim) text = text.slice(0, lim);
  clearPendingImage();
  pendingFile = { name: f.name, text };
  fileNameEl.textContent = f.name;
  filePreview.hidden = false;
});
refreshFileLimitLabel();
async function handleImageSelect(input) {
const f = input.files?.[0];
input.value = "";
if (!f) return;
clearPendingImage();
clearPendingFile();
  
  // 速度対策：モデルに渡す画像は長辺256pxまで縮小（画像トークン256→64、表示用URLは元のまま）
  // ついでに履歴保存用のサムネイル（長辺256pxのJPEG data URL）も同じcanvasで作る
  let sendBuf;
  let thumbUrl = null;
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
    const cvs = document.createElement("canvas");
    cvs.width = Math.round(bmp.width * scale);
    cvs.height = Math.round(bmp.height * scale);
    cvs.getContext("2d").drawImage(bmp, 0, 0, cvs.width, cvs.height);
    thumbUrl = cvs.toDataURL("image/jpeg", 0.7);
    if (scale < 1) {
      const blob = await new Promise(r => cvs.toBlob(r, "image/jpeg", 0.85));
      sendBuf = await blob.arrayBuffer();
    } else {
      sendBuf = await f.arrayBuffer();
    }
    bmp.close?.();
  } catch {
    sendBuf = await f.arrayBuffer();
  }
  pendingImage = { buffer: sendBuf, url: URL.createObjectURL(f), thumb: thumbUrl };
  
attachThumb.src = pendingImage.url;
attachPreview.hidden = false;
}
imageInput.addEventListener("change", () => handleImageSelect(imageInput));
const cameraInput = document.getElementById("camera-input");
cameraInput.addEventListener("change", () => handleImageSelect(cameraInput));

async function sendMessageWithText(forcedText, isRegen = false) {
  
let text = isRegen ? "" : (forcedText || inputEl.value).trim();
  
const img = isRegen ? null : pendingImage;
const file = isRegen ? null : pendingFile;
  if (isGenerating) return;
  if (!isRegen && !text && !img && !file) return;
if (!text && img) text = "この画像について説明してください";
if (!text && file) text = "このファイルについて説明してください";
const content = file ? text + "\n\n【ファイル「" + file.name + "」の内容】\n" + file.text + "\n【ファイルここまで】" : text;
  const isVoiceMode = lastInputWasVoice;
  lastInputWasVoice = false;
  if (!hasChatted) { hasChatted = true; hideFirstLoadingUI(); }

  

  if (!engineManager.isReady()) {
    addMessage("system", "モデルをダウンロードしてください");
    return;
  }

  const userDiv = isRegen ? [...chatEl.querySelectorAll(".msg.user")].pop() : addMessage("user", content);
  
  if (img) {
const im = document.createElement("img");
im.src = img.url;
im.className = "msg-img";
im.alt = "添付画像";
userDiv.appendChild(im);
// 吹き出し表示用に URL は生かす（revokeしない）。添付状態だけ解除
pendingImage = null;
attachPreview.hidden = true;
attachThumb.removeAttribute("src");
}
  if (file) {
clearPendingFile();
}
  
  if (!isRegen) messages.push({ role: "user", content, ...(img?.thumb ? { img: img.thumb } : {}) });
  if (!isRegen && !img) attachEditGesture(userDiv, messages.length - 1);
  
    if (!isRegen) { saveCurrentRoomHistory(); inputEl.value = ""; }
  voicePreview.textContent = '';

  const assistantDiv = addMessage("assistant", "");
  document.querySelectorAll(".msg-regen-btn").forEach(b => b.remove());
  
  let firstTokenReceived = false;

  // 1トークン目が出るまでの待機UI
  showAssistantPending(assistantDiv);

  const killBtn = document.getElementById("kill-btn");
  killBtn.hidden = false;
  killBtn.disabled = false;
  sendEl.hidden = true;

  //Wllamaのみ停止のアプローチを変える
  let abortFlag = false;
  let isKilled = false;
killBtn.onclick = async () => {
  if (abortFlag) return;
  abortFlag = true;
  isKilled = true;
  killBtn.disabled = true;
  try { await engineManager.interrupt(); } catch {}
  if (voice) voice.clearQueue(true);
 
  
  
};
//ここまで

  // ===== 自動スクロール制御 =====
// 送信直後は一番下へ。
// 生成中は「ユーザープロンプトが見切れる直前」で下スクロールを止める。

let autoScrollEnabled = true;
const STOP_MARGIN = 14;

function getPromptLimit() {
  if (!userDiv || !userDiv.isConnected) return Infinity;

  const chatRect = chatEl.getBoundingClientRect();
  const userRect = userDiv.getBoundingClientRect();

  // chatEl内でのユーザープロンプトの上端位置
  const userTop = userRect.top - chatRect.top + chatEl.scrollTop;

  // 見切れる直前で止めたいので、少し手前を上限にする
  return Math.max(0, userTop - STOP_MARGIN);
}

function smartScroll() {
  if (!autoScrollEnabled) return;

  const maxScroll = Math.max(0, chatEl.scrollHeight - chatEl.clientHeight);
  const limit = getPromptLimit();

  // 一番下まで行きたいが、プロンプトが見切れる手前で止める
  const target = Math.min(maxScroll, limit);

  // 下方向にだけ動かす（上に引き戻さない）
  if (target > chatEl.scrollTop + 1) {
    chatEl.scrollTop = target;
  }
}

// ユーザーが自分でスクロール操作したら自動スクロールを止める
function stopAutoScroll() {
  autoScrollEnabled = false;
}

chatEl.addEventListener("wheel", stopAutoScroll, { passive: true });
chatEl.addEventListener("touchmove", stopAutoScroll, { passive: true });

// 送信直後
requestAnimationFrame(() => {
  const maxScroll = Math.max(0, chatEl.scrollHeight - chatEl.clientHeight);
  const limit = getPromptLimit();

  // 基本は一番下へ。
  // ただし、一番下だとプロンプトが切れる場合はその手前を優先する。
  chatEl.scrollTop = Math.min(maxScroll, limit);

  // もし「プロンプトが切れても絶対に一番下へ飛ばしたい」なら、
  // 上の行を消して↓にする
  // chatEl.scrollTop = maxScroll;
});
  isGenerating = true; sendEl.disabled = true;
// Think専用の受け皿。本文（full）とは完全に分ける
let full = "";
let hitMaxChars = false;
let speakBuffer = "";
let thinkFull = "";
let thinkBlockEl = null;
let thinkBodyEl = null;
let thinkCollapsed = false;
const sentenceSplitRegex = /[^。！？\n.!?]+[。！？\n.!?]+/g;
try {
  // ===== UX改善: GPU(WebLLM)負荷前の描画完了待ち =====
  // スマホでのキーボード格納やスクロール、待機UIの描画をブラウザに確実に完了させる
  if (engineManager.getCurrentId() === 'mlc') {
    await new Promise(resolve => setTimeout(resolve, 800)); // 0.8秒待つ
  }
  // ===================================================

  const temp = parseFloat(
    localStorage.getItem('cronygo_temp') || 0.7
  );

const max_tokens = parseInt(
  localStorage.getItem('cronygo_max_tokens') || 1024
);

const repeat_penalty = parseFloat(
  localStorage.getItem('cronygo_repeat_penalty') || 1.1
);

// 送信時は think フィールドを落とす（履歴の表示専用。モデルには送らない）
const sendMessages = messages.map(m => ({ role: m.role, content: m.content}));

  // 画像は添付ターンの最後のuser発言にだけ part として混ぜる（履歴はテキストのみ）
if (img) {
const lastUser = [...sendMessages].reverse().find(m => m.role === "user");
if (lastUser) lastUser.content = [
{ type: "text", text: lastUser.content},
{ type: "image", data: img.buffer},
];
}
  
// 設定スイッチ（デフォルトON。'0'の時だけOFF）
const thinkingOn = localStorage.getItem('cronygo_thinking')!== '0';
// Wllama時のみ実効max_tokensにThink予算(+2048)を上乗せする。
// Think自体の上限はロード時の reasoning_budget_tokens: 2048 が担保する
const effMaxTokens = engineManager.getCurrentId() === 'wllama' && thinkingOn ? max_tokens + 2048 : max_tokens;
// 生成ログの計測（TTFT＝最初のチャンクまで、速度＝チャンク間の間隔から算出）
const genT0 = performance.now();
let genFirstAt = 0;
let genLastAt = 0;
let genTokens = 0;
// 生成開始前に停止されていたら生成自体を始めない（開始前のinterruptはエンジンに効かないため）
for await (const chunk of abortFlag? []: engineManager.chat(sendMessages, {
temperature: temp,
max_tokens: effMaxTokens,
repeat_penalty,
thinking: thinkingOn
})) {
  
    // ★停止/上限到達後はbreakせず「捨て読み」してストリームを自然終了させる。
  // WebLLMは生成ごとに内部ロックを取り、自然終了時にしか解放しない。
  // for awaitを途中で抜けるとロックが残り、次の生成がロック待ちで永久に始まらない（実機で発生）。
  // interrupt済みなら生成はすぐ終わる。最悪でもmax_tokensで必ず終わるので捨て読みは有限。
  if (abortFlag || hitMaxChars) continue;
  // 生成ログ: 処理したチャンクを数える（1チャンク≒1トークンの簡易計測）
  { const tNow = performance.now(); if (!genFirstAt) genFirstAt = tNow; genLastAt = tNow; genTokens++; }

  // Thinkチャンクは本文と別枠へ。full・文字数カウント・TTSには一切入れない
if (chunk.type === "think") {
thinkFull += chunk.text;
if (!thinkBlockEl) {
thinkBlockEl = createThinkBlock("", false);
assistantDiv.before(thinkBlockEl);
thinkBodyEl = thinkBlockEl.querySelector(".think-body");
// 思考が始まったら待機UIは畳んで、本文バブルは本文が来るまで隠す
assistantDiv.classList.remove("pending");
assistantDiv.innerHTML = "";
assistantDiv.style.display = "none";
}
thinkBodyEl.textContent = thinkFull;
thinkBodyEl.scrollTop = thinkBodyEl.scrollHeight;
smartScroll();
continue;
}
const delta = chunk.text;

// 本文が始まったら思考ブロックを畳み、本文バブルを出す
if (thinkBlockEl &&!thinkCollapsed) {
thinkCollapsed = true;
thinkBlockEl.classList.add("closed");
assistantDiv.style.display = "";
}

  full += delta;

  // 最初の意味のあるトークンが来たら待機UIを解除
  if (!firstTokenReceived && full.trim().length > 0) {
    firstTokenReceived = true;
    assistantDiv.classList.remove("pending");
  }

  if (full.length >= MAX_CHARS) {
    firstTokenReceived = true;
    assistantDiv.classList.remove("pending");
    /*停止処理変更*/
    full = full.slice(0, MAX_CHARS).trim() + "\n\n[1500文字制限で停止]";
    assistantDiv.innerHTML = renderMarkdown(full);
    hitMaxChars = true;
    try { await engineManager.interrupt(); } catch {}
    if (voice) voice.clearQueue(true);
  }

  // 描画は最初のトークンが来てから
  if (firstTokenReceived) {
    assistantDiv.innerHTML = renderMarkdown(full);
    smartScroll();
  }

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

  // 生成ログの集計（2トークン未満は速度が出せないので付けない）
const genStats = (() => {
  if (!genFirstAt || genTokens < 2) return null;
  const mspt = (genLastAt - genFirstAt) / (genTokens - 1);
  if (!(mspt > 0)) return null;
  return { ttft: Math.round(genFirstAt - genT0), mspt: Math.round(mspt * 10) / 10, tps: Math.round(100000 / mspt) / 100, tokens: genTokens };
})();
    full = full.trim();
full = full.replace(/^\s*\*\*\s*$/gm, '').trim();
full = full.replace(/\n{3,}/g, '\n\n').trim();

assistantDiv.classList.remove("pending");

if (isKilled) {
  if (full || thinkFull) {
assistantDiv.style.display = "";
assistantDiv.innerHTML = renderMarkdown((full? full + "\n\n": "") + "[生成を停止しました]");
messages.push({ role: "assistant", content: full,...(thinkFull? { think: thinkFull}: {}),...(genStats? { stats: genStats}: {})});
saveCurrentRoomHistory();
{ const row = createMsgActionsEl(full, genStats); assistantDiv.after(row); placeRegenButton(row); }
} else {
    assistantDiv.innerHTML = renderMarkdown("[生成を停止しました]");
    }
} else if (full) {
  assistantDiv.innerHTML = renderMarkdown(full);
  // 制限マーカーは表示専用。履歴には本文だけ入れる
  const contentForHistory = hitMaxChars
    ? full.replace(/\n\n\[1500文字制限で停止\]$/, "")
    : full;
  messages.push({ role: "assistant", content: contentForHistory,...(thinkFull? { think: thinkFull}: {}),...(genStats? { stats: genStats}: {})});
  saveCurrentRoomHistory();
  { const row = createMsgActionsEl(contentForHistory, genStats); assistantDiv.after(row); placeRegenButton(row); }
  if (voice && isVoiceMode && !hitMaxChars) {
    const remaining = speakBuffer.trim();
    if (remaining) voice.enqueueSpeak(remaining);
  voice.clearBuffer();
  }
  } else {
assistantDiv.style.display = "";
assistantDiv.innerHTML = '<span class="pending-text">（応答がありませんでした）</span>';
}
  } catch (e) {
  dbg(`generation ERROR ${e.message}`);
  
  assistantDiv.classList.remove("pending");
assistantDiv.style.display = "";
if (!abortFlag) assistantDiv.innerHTML = renderMarkdown("生成エラー: " + e.message);
  
}finally {
try {
  chatEl.removeEventListener("wheel", stopAutoScroll);
  chatEl.removeEventListener("touchmove", stopAutoScroll);
} catch {}

isGenerating = false;
sendEl.disabled = false;
inputEl.readOnly = false;
    // 現在フォーカスが当たっていれば外す（キーボードを隠す）
    if (document.activeElement === inputEl) {
      inputEl.blur();
    }
    
    try { killBtn.hidden = true; killBtn.onclick = null; sendEl.hidden = false;} catch {}
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

sendEl.addEventListener("click", () => { lastInputWasVoice = false; sendMessage(); syncInputHeight();});
inputEl.addEventListener("keydown", (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === "Enter" &&!e.shiftKey) { e.preventDefault(); lastInputWasVoice = false; sendMessage(); syncInputHeight();}
});

function syncInputHeight() {
inputEl.style.height = "auto";
inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
syncComposerPad();
}
function syncComposerPad() {
const composerEl = document.getElementById("composer");
if (!composerEl ||!chatEl) return;
chatEl.style.paddingBottom = (composerEl.offsetHeight + 16) + "px";
}
inputEl.addEventListener("input", syncInputHeight);
window.addEventListener("resize", syncComposerPad);
syncComposerPad();

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); lastInputWasVoice = false; sendMessage(); }
});
selectEl.addEventListener("change", () => {
  const key = selectEl.value;
  try { localStorage.setItem('cronygo_model', key); } catch {}
  if (currentKey === key && engineManager.isReady()) {
  statusEl.textContent = `Ready ${key}`; statusEl.className = "ready";
  } else {
  statusEl.textContent = "未DL"; statusEl.className = ""; inputEl.placeholder = `${key} をダウンロードしてください`;
 }
});
statusEl.textContent = "未DL";
//ここから変えたーーーー
const localGgufBtn = document.getElementById('local-gguf-btn');
const localGgufFile = document.getElementById('local-gguf-file');
const localGgufStatus = document.getElementById('local-gguf-status');
const localSavedList = document.getElementById('local-saved-list');

// ---------- ブラウザ内に保存（OPFS） ----------
async function getModelDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('models', { create: true });
}
async function saveLocalModel(file) {
  try { await navigator.storage.persist?.(); } catch {}
  const dir = await getModelDir();
  const fh = await dir.getFileHandle(file.name, { create: true });
  const w = await fh.createWritable();
  await file.stream().pipeTo(w);
}
async function listLocalModels() {
  const dir = await getModelDir();
  const names = [];
  for await (const [name] of dir.entries()) names.push(name);
  return names;
}
async function getLocalModel(name) {
  const dir = await getModelDir();
  return (await dir.getFileHandle(name)).getFile();
}
async function deleteLocalModel(name) {
  const dir = await getModelDir();
  await dir.removeEntry(name);
}

// ---------- 保存済み一覧の表示 ----------
async function renderSavedList() {
  if (!localSavedList) return;
  let names = [];
  try { names = await listLocalModels(); } catch { return; }
  
  const bodies = names.filter(n => !n.endsWith('.mmproj.gguf'));
  if (!bodies.length) {
    localSavedList.innerHTML = '<span style="font-size:11px;opacity:.5;">保存済みモデルなし</span>';
    return;
  }
  localSavedList.innerHTML = bodies.map(n => `
  
    <div style="display:flex;align-items:center;gap:6px;background:#1a1a1a;padding:6px 8px;border-radius:6px;font-size:11px;margin-top:4px;">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n)}${names.includes(n + '.mmproj.gguf') ? ' <span style="color:#4FD1C5;">[VL]</span>' : ''}</span>
      <button data-run="${escapeHtml(n)}" style="border:1px solid #4FD1C5;background:transparent;color:#4FD1C5;border-radius:4px;padding:2px 8px;">起動</button>
      <button data-del="${escapeHtml(n)}" style="border:1px solid #444;background:transparent;color:#f55;border-radius:4px;padding:2px 8px;">削除</button>
    </div>
  `).join('');
}

// ---------- 読み込み本体（選択ファイルも保存済みも共通） ----------

async function startLocalModel(file, saveToBrowser, mmprojFile = null) {
  
  const fileName = file.name;
  const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
  localVisionLoaded = false;

  if (localGgufStatus) {
    localGgufStatus.textContent = `読み込み中: ${fileName} (${fileSizeMB} MB) 展開中...`;
    localGgufStatus.style.color = 'var(--accent)';
  }
  inputEl.disabled = true;
  sendEl.disabled = true;

  try {
    const context_size = parseInt(localStorage.getItem('cronygo_context_size') || 4096);
    const storedThreads = localStorage.getItem('cronygo_threads') || 'auto';
    const n_threads = storedThreads === 'auto' ? 'auto' : parseInt(storedThreads);

    await engineManager.loadLocalFile(file, null, { context_size, n_threads, mmprojFile });

    // VLとして読み込めたら画像添付を有効化（表示ブロックの isVisionModel が参照）
    localVisionLoaded = !!mmprojFile;

    // 新しく選んだファイルだけ、ブラウザに保存
    if (saveToBrowser) {
      if (localGgufStatus) localGgufStatus.textContent = `保存中: ${fileName}`;
      
      
      try { await saveLocalModel(file); }
      catch (e) { console.warn('保存失敗', e); }
      if (mmprojFile) {
        try { await saveLocalModel(new File([mmprojFile], fileName + '.mmproj.gguf')); }
        catch (e) { console.warn('mmproj保存失敗', e); }
      }
    }

    currentKey = "__local__:" + fileName;
    statusEl.textContent = `Ready: ${fileName}`;
    statusEl.className = "ready";
    inputEl.placeholder = `${fileName} で入力...`;

    // ★ テキストボックス復活
    inputEl.disabled = false;
    sendEl.disabled = false;
    progressBar.style.opacity = "0";

    if (localGgufStatus) {
      localGgufStatus.textContent = `起動完了: ${fileName}`;
      localGgufStatus.style.color = '#4FD1C5';
    }
    hideFirstLoadingUI();
    addMessage("assistant", `ローカルモデル「${fileName}」の読み込みが完了しました！`);
    if (isVisionModel() && !/Firefox/i.test(navigator.userAgent)) {
      addMessage("system", "画像認識は Firefox での実行を推奨します。Chromeなど一部ブラウザでは処理が止まることがあります。");
    }
    renderSavedList();
  } catch (err) {
    console.error(err);
    if (localGgufStatus) {
      localGgufStatus.textContent = `エラー: ${err.message}`;
      localGgufStatus.style.color = '#ff4444';
    }
    alert(`読み込みに失敗しました: ${err.message}\nメモリ不足の可能性があります。`);
  }
}

// ---------- ボタン類 ----------
if (localGgufBtn && localGgufFile) {
  localGgufBtn.addEventListener('click', () => localGgufFile.click());

  localGgufFile.addEventListener('change', async (e) => {
    const files = [...e.target.files].filter(f => f.name.toLowerCase().endsWith('.gguf'));
    if (!files.length) {
      alert('GGUFファイルを選択してください');
      localGgufFile.value = '';
      return;
    }
    // ファイル名で判定：名前に mmproj を含む方がプロジェクタ、もう一方が本体
    const mmprojFile = files.find(f => f.name.toLowerCase().includes('mmproj')) || null;
    const file = files.find(f => f !== mmprojFile);
    if (!file) {
      alert('モデル本体のGGUFも一緒に選択してください');
      localGgufFile.value = '';
      return;
    }
    await startLocalModel(file, true, mmprojFile);
    localGgufFile.value = '';
  });
}

localSavedList?.addEventListener('click', async (e) => {
  const run = e.target.closest('button[data-run]');
  const del = e.target.closest('button[data-del]');
  
  if (run) {
    const file = await getLocalModel(run.dataset.run);
    let mmprojFile = null;
    try { mmprojFile = await getLocalModel(run.dataset.run + '.mmproj.gguf'); } catch {}
    await startLocalModel(file, false, mmprojFile);
  } else if (del) {
    if (!confirm(`「${del.dataset.del}」を削除しますか？`)) return;
    await deleteLocalModel(del.dataset.del);
    try { await deleteLocalModel(del.dataset.del + '.mmproj.gguf'); } catch {}
    renderSavedList();
  }
  
});

renderSavedList();
//ここまで変えたーーーーーー
function openSettings() { settingsPanel.classList.add("show"); settingsOverlay.classList.add("show"); }
function closeSettings() { settingsPanel.classList.remove("show"); settingsOverlay.classList.remove("show"); }
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);
document.querySelectorAll('.settings-group-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const group = btn.closest('.settings-group');
    const isOpen = group.classList.contains('open');
    document.querySelectorAll('.settings-group').forEach(g=>g.classList.remove('open'));
    if(!isOpen) group.classList.add('open');
  });
});
savePromptBtn.addEventListener("click", saveSystemPrompt);
resetPromptBtn.addEventListener("click", resetSystemPrompt);
themeOpts.forEach(btn => { btn.addEventListener("click", () => { applyTheme(btn.dataset.theme, true); }); });
if (devConsoleToggle) { devConsoleToggle.addEventListener('change', (e)=>{ setDevConsoleEnabled(e.target.checked); }); }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => { console.log('[PWA] SW registered', reg.scope); }).catch(err => console.error('[PWA] SW failed', err));
}

const menuBtn = document.getElementById('menu-btn');
const roomDrawer = document.getElementById('room-drawer');
const roomOverlay = document.getElementById('room-overlay');
const openDrawer = () => { roomDrawer?.classList.add('open'); roomOverlay?.classList.add('open'); };
const closeDrawer = () => { roomDrawer?.classList.remove('open'); roomOverlay?.classList.remove('open'); };
menuBtn?.addEventListener('click', openDrawer);
roomOverlay?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if(e.key==='Escape') closeDrawer(); });

initRooms();
setTimeout(initCustomModelUI, 100);

newRoomBtn?.addEventListener('click', createRoom);

document.getElementById('export-json-btn')?.addEventListener('click', ()=>exportChat("json"));
document.getElementById('export-md-btn')?.addEventListener('click', ()=>exportChat("md"));

roomListEl?.addEventListener('click', (e)=>{

  // 名前変更
  const renameBtn = e.target.closest('.room-rename-btn');
  if(renameBtn){
    e.stopPropagation();

    const renameId = renameBtn.dataset.renameId;
    renameRoom(renameId);

    return;
  }

  // 削除
  const delBtn = e.target.closest('.room-del-btn');
  if(delBtn){
    e.stopPropagation();

    const delId = delBtn.dataset.delId;

    if(confirm('このルームを削除しますか？')){
      deleteRoom(delId);
    }

    return;
  }

  // ルーム選択
  const item = e.target.closest('.room-item');
  if(!item) return;

  switchRoom(item.dataset.id);
});

// ===== モデル選択UI (mp-) =====

const MP_INFO = {
  "Q0.5B":      { name: "Qwen2.5 0.5B",      desc: "WebLLMで動く最軽量枠" },
  "Q1.5B":      { name: "Qwen2.5 1.5B",      desc: "標準。会話になる" },
  "Q3B":        { name: "Qwen2.5 3B",        desc: "端末によっては厳しい" },
  "Q7B":        { name: "Qwen2.5 7B",        desc: "PC推奨。スマホは快適ではないかも" },
  "Sm135M":     { name: "Smollm 135M",    desc: "WebLLMの動作テスト" },
  "Llama1B":        { name: "Llama 1B",        desc: "Meta製の英語強めモデル" },
  "Llama3B":        { name: "Llama 3B",        desc: "同じくLlamaの3Bバージョン" },
  "G2B-jpn":    { name: "Gemma JP 2B",    desc: "日本語に強い。重さはQwen1.5Bクラス" },
  "G2B-jpnHv":  { name: "Gemma JP 2B Hv", desc: "上記のq4f32版。少し重い" },
  //ここからGGUF
  "Smollm-135M":  { name: "Smollm 135M",  desc: "Wllamaの動作確認用" },
  "Qwen-0.5B":  { name: "Qwen2.5 0.5B",      desc: "GGUFのQwen0.5。MLCと比較してみよう" },
  "Qwen3-0.6B":  { name: "Qwen3 0.6B",      desc: "軽量でありながらThinkモード搭載" },
  "DeepSeek-1.5B":  { name: "DeepSeek 1.5B",  desc: "DeepSeekR1で蒸留したQwen" },
  "llm-jp-3-1.8B": { name: "llm-jp 1.8B", desc: "国立情報学研究所(NII)によって作成。" },
  "LFM-1.2BJP":  { name: "LFM2.5 1.2BJP",  desc: "日本語ヨシ、スピードヨシ" },
  "LFM-350M":  { name: "LFM2.5 350M",  desc: "軽量なのに会話がスムーズ" },
  "LFM-VL-450M": { name: "LFM2.5 VL 450M", desc: "画像が読めるVLモデル（Wllama・実験中）"},
  "FalconH1-1.5B":  { name: "FalconH1 1.5B",  desc: "独自のアーキテクチャで高速推論が可能。" },
  //"Serow-0.5B": { name: "Serow 0.5B",     desc: "WebAIPocket製のβ試験型" },
  "Diffenion-Mk.1":  { name: "Diffenion Mk.1",  desc: "ディベートに特化したWebAIPocketオリジナルモデル" },
};

(() => {
  const trigger = document.getElementById('mp-trigger');
  const label   = document.getElementById('mp-trigger-label');
  const overlay = document.getElementById('mp-overlay');
  const sheet   = document.getElementById('mp-sheet');
  const listEl  = document.getElementById('mp-list');
  const closeBtn = document.getElementById('mp-close');
const missing = ['mp-trigger','mp-trigger-label','mp-overlay','mp-sheet','mp-list','mp-close'].filter(id => !document.getElementById(id));
if (missing.length || !selectEl) { alert('mp: 見つからない → ' + missing.join(', ')); return; }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isGguf = key => { const id = MODELS[key] || ''; return /\.gguf/i.test(id) || id.startsWith('http'); };
  const info = key => MP_INFO[key] || { name: key, desc: '' };

  function updateLabel(){
    label.textContent = info(selectEl.value).name;
  }

  function render(){
    listEl.innerHTML = [...selectEl.options].map(o => {
      const key = o.value;
      const custom = !!o.dataset.custom;
      const i = info(key);
      const name = custom ? key : i.name;
      const desc = custom ? (MODELS[key] || '') : i.desc;
      const selected = key === selectEl.value;
      const live = key === currentKey && engineManager.isReady();
      return `
        <button type="button" class="mp-item${selected ? ' selected' : ''}" data-key="${esc(key)}">
          <div class="mp-item-main">
            <span class="mp-item-name">${esc(name)}</span>
            <span class="mp-item-desc">${esc(desc)}</span>
          </div>
          <div class="mp-badges">
            ${live ? '<span class="mp-badge live">起動中</span>' : ''}
            ${custom ? '<span class="mp-badge">★ カスタム</span>' : ''}
            <span class="mp-badge">${isGguf(key) ? 'GGUF' : 'MLC'}</span>
          </div>
          <span class="mp-check"></span>
        </button>`;
    }).join('');
  }

  const open  = () => { render(); overlay.classList.add('open'); sheet.classList.add('open'); };
  const close = () => { overlay.classList.remove('open'); sheet.classList.remove('open'); };

  trigger.addEventListener('click', open);
  overlay.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  listEl.addEventListener('click', e => {
    const b = e.target.closest('.mp-item');
    if (!b) return;
    selectEl.value = b.dataset.key;
    selectEl.dispatchEvent(new Event('change'));  // 既存のchange処理をそのまま動かす
    updateLabel();
    close();
  });

  // カスタムモデルの追加/削除、Serow自動追加でoptionが変わったら追従
  new MutationObserver(() => {
    updateLabel();
    if (sheet.classList.contains('open')) render();
  }).observe(selectEl, { childList: true });

  updateLabel();
})();

// ==============================
// チュートリアル 初回表示
// ==============================

const TUTORIAL_SEEN_KEY = "cronygo_tutorial_seen";

const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorialPanel = document.getElementById("tutorial-panel");
const tutorialStartBtn = document.getElementById("tutorial-start-btn");

function openTutorial() {
  tutorialOverlay?.classList.add("show");
  tutorialPanel?.classList.add("show");
}

function closeTutorial() {
  tutorialOverlay?.classList.remove("show");
  tutorialPanel?.classList.remove("show");
}

// 初回だけ自動表示
function showTutorialIfFirstVisit() {
  if (localStorage.getItem(TUTORIAL_SEEN_KEY) === "true") return;

  openTutorial();
}

// 「はじめる」を押したら閉じて、閲覧済みとして保存
tutorialStartBtn?.addEventListener("click", () => {
  closeTutorial();
  localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
});

showTutorialIfFirstVisit();

// ==========================================
// イベント・アイコン管理システム (v7 - シンプル・CSS優先版)
// ==========================================
// ※ import { EVENT_ICONS } from "./events.js"; はファイル先頭に記述済みとします

const LS_UNLOCKED_ICONS = 'cronygo_unlocked_icons';
const LS_CURRENT_ICON = 'cronygo_current_icon';

function getUnlockedIcons() { try { return JSON.parse(localStorage.getItem(LS_UNLOCKED_ICONS) || "[]"); } catch { return []; } }
function saveUnlockedIcons(list) { try { localStorage.setItem(LS_UNLOCKED_ICONS, JSON.stringify(list)); } catch {} }
function getCurrentIconId() { return localStorage.getItem(LS_CURRENT_ICON) || 'default'; }
function setCurrentIconId(id) { localStorage.setItem(LS_CURRENT_ICON, id); }

function getActiveEvent() { return EVENT_ICONS.find(e => e.active === true); }

function getIconSrc(iconId) {
    if (iconId === 'default') return "./assets/CronyGOicon.jpg";
    const ev = EVENT_ICONS.find(e => e.id === iconId);
    return ev ? ev.img : "./assets/CronyGOicon.jpg";
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.9); color: #fff; padding: 12px 24px;
        border-radius: 20px; z-index: 99999; font-size: 14px; font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: none; border: 1px solid var(--accent);
        animation: fadeInOut 3s forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style'); style.id = 'toast-styles';
    style.textContent = `@keyframes fadeInOut { 0% { opacity: 0; transform: translate(-50%, 20px); } 15%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -20px); } }`;
    document.head.appendChild(style);
}

// 1. ロード画面へのイベントアイコン注入
function setupEventIcon() {
    const lvEl = document.getElementById('loading-view');
    if (!lvEl) return;

    // デフォルトアイコン (CronyGOicon.jpg)
    const defaultIcon = document.getElementById('loading-icon-dark');
    // ライト用は邪魔なので強制非表示 (縦に2個出るのを防止)
    const lightIcon = document.getElementById('loading-icon-light');
    if (lightIcon) lightIcon.style.display = 'none';

    // イベント用アイコン要素
    let eventIcon = lvEl.querySelector('.app-icon-target');
    if (!eventIcon) {
        eventIcon = document.createElement('img');
        eventIcon.className = 'app-icon-target'; // ★CSS(.app-icon-target)でサイズ・デザインを制御
        // インラインスタイルにはサイズを書かず、表示切替用のみに留める
        eventIcon.style.cssText = 'display:none; cursor:pointer; margin-bottom:10px;';
        const textEl = document.getElementById('loading-text');
        if (textEl) lvEl.insertBefore(eventIcon, textEl); else lvEl.appendChild(eventIcon);
    }

    const currentId = getCurrentIconId();
    const activeEvent = getActiveEvent();
    const unlocked = getUnlockedIcons();

    let showEventIcon = false;
    let isClickable = false;

    // --- 表示ロジック ---
    if (currentId !== 'default') {
        // 【設定でイベントアイコンが選択されている】
        const selectedEvent = EVENT_ICONS.find(e => e.id === currentId);
        if (selectedEvent && unlocked.includes(selectedEvent.id)) {
            eventIcon.src = selectedEvent.img;
            showEventIcon = true;
            isClickable = false;
        }
    } else {
        // 【設定はデフォルト】
        if (activeEvent && !unlocked.includes(activeEvent.id)) {
            // 期間中 かつ 未ゲット → ゲットチャンス
            eventIcon.src = activeEvent.img;
            showEventIcon = true;
            isClickable = true;
        }
    }

    // --- DOM操作 ---
    if (showEventIcon) {
        // イベントアイコンを表示、デフォルトは隠す
        eventIcon.style.display = 'block';
        if (defaultIcon) defaultIcon.style.display = 'none';

        if (isClickable) {
            eventIcon.onclick = () => {
                if (!unlocked.includes(activeEvent.id)) {
                    unlocked.push(activeEvent.id);
                    saveUnlockedIcons(unlocked);
                    showToast(`🎉 ${activeEvent.name}アイコンを発見しました！`);
                    eventIcon.animate([
                        { transform: 'scale(1)' }, 
                        { transform: 'scale(1.1) rotate(5deg)' }, 
                        { transform: 'scale(1)' }
                    ], { duration: 600 });
                } else {
                    showToast(`${activeEvent.name}アイコンはすでに発見済みです`);
                }
            };
        } else {
            eventIcon.onclick = null;
        }
    } else {
        // デフォルトアイコンを表示、イベント用は隠す
        eventIcon.style.display = 'none';
        eventIcon.onclick = null;
        if (defaultIcon) defaultIcon.style.display = 'block';
    }
}

// 2. 設定UIへの注入
function injectIconSettings() {
    const panel = document.getElementById('settings-panel');
    if (!panel || document.getElementById('icon-settings-section')) return;

    const customGroupContent = document.querySelector('#group-custom .settings-group-content');
    if (!customGroupContent) return;

    const section = document.createElement('div');
    section.id = 'icon-settings-section';
    section.className = 'settings-section';
    section.style.marginTop = '20px';
    section.innerHTML = `
        <label class="settings-label">アイコン変更</label>
        <div class="settings-desc">イベントで発見したアイコンを適用できます。</div>
        <div id="icon-options" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;"></div>
    `;
    customGroupContent.appendChild(section);
    renderIconOptions();
}

function renderIconOptions() {
    const container = document.getElementById('icon-options');
    if (!container) return;
    container.innerHTML = '';
    const current = getCurrentIconId();
    const unlocked = getUnlockedIcons();

    container.appendChild(createIconBtn('default', 'デフォルト', "./assets/CronyGOicon.jpg", current));
    EVENT_ICONS.forEach(ev => {
        if (unlocked.includes(ev.id)) container.appendChild(createIconBtn(ev.id, ev.name, ev.img, current));
    });
}

function createIconBtn(id, label, src, currentId) {
    const btn = document.createElement('button');
    btn.className = 'theme-opt';
    btn.style.cssText = `display:flex; flex-direction:column; align-items:center; justify-content:center; width:80px; height:90px; padding:8px; border-radius:12px; border:1px solid var(--border-light); background:var(--bg-input); color:var(--text); cursor:pointer;`;
    if (id === currentId) { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; }
    btn.innerHTML = `<img src="${src}" style="width:45px; height:45px; object-fit:contain; margin-bottom:6px; border-radius:8px;"><span style="font-size:11px;">${label}</span>`;
    btn.onclick = () => {
        setCurrentIconId(id);
        renderIconOptions();
        setupEventIcon();
        document.querySelectorAll('.pending-icon').forEach(el => el.src = getIconSrc(id));
        showToast('アイコンを変更しました');
    };
    return btn;
}

// ==========================================
// フック (変数衝突回避版)
// ==========================================

const settingsPanelEl = document.getElementById('settings-panel');
if (settingsPanelEl) {
    const observer = new MutationObserver(() => {
        if (settingsPanelEl.classList.contains('show')) injectIconSettings();
    });
    observer.observe(settingsPanelEl, { attributes: true, attributeFilter: ['class'] });
}

const chatCt = document.getElementById('chat');
if (chatCt) {
    const chatObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.classList && node.classList.contains('pending')) {
                    const icon = node.querySelector('.pending-icon');
                    if (icon) icon.src = getIconSrc(getCurrentIconId());
                }
            });
        });
    });
    chatObserver.observe(chatCt, { childList: true, subtree: true });
}

setInterval(() => {
    const lv = document.getElementById('loading-view');
    if (lv && lv.classList.contains('show')) setupEventIcon();
}, 500);
