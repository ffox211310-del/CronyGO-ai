import { VoiceManager } from "./voice.js";
import { MODELS } from "./models.js";
import { engineManager } from "./engine-manager.js";

const FIXED_MODEL_KEY = "G2B-jpn";
const FIXED_MODEL_ID = MODELS[FIXED_MODEL_KEY];

const DEFAULT_SYSTEM_PROMPT = "あなたはCronyGO、防災AIアシスタントです。日本語で簡素かつ的確に答えてください。";
const LS_PROMPT_KEY = "cronygo_system_prompt";
const LS_THEME_KEY = "cronygo_theme";
const LS_DEV_CONSOLE_KEY = "cronygo_dev_console";
const LS_MODE_KEY = "cronygo_mode_v01a";
const LS_TEMP_KEY = "cronygo_temp";
const LS_MAX_TOKENS_KEY = "cronygo_max_tokens";

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

let devConsoleEnabled = false;
let debugOverlayEl = null;

const MAX_CHARS = 1500;

function loadStoredPrompt(){
  try{ return localStorage.getItem(LS_PROMPT_KEY) || DEFAULT_SYSTEM_PROMPT; }catch{ return DEFAULT_SYSTEM_PROMPT; }
}
function loadStoredTemp(){ return parseFloat(localStorage.getItem(LS_TEMP_KEY) || "0.7"); }
function loadStoredMaxTokens(){ return parseInt(localStorage.getItem(LS_MAX_TOKENS_KEY) || "1024"); }
function loadStoredTheme(){ try{ return localStorage.getItem(LS_THEME_KEY) || "dark"; }catch{ return "dark"; } }
function loadDevConsoleEnabled(){ try{ return localStorage.getItem(LS_DEV_CONSOLE_KEY)==="true"; }catch{ return false; } }
function saveDevConsoleEnabled(v){ try{ localStorage.setItem(LS_DEV_CONSOLE_KEY, v?"true":"false"); }catch{} }

function dbg(msg){ if(!devConsoleEnabled) return; console.log("[CronyGO]", msg); }

// DOM
const chatEl = document.getElementById("chat");
const micBtn = document.getElementById("mic-btn");
const voicePreview = document.getElementById("voice-preview");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const progressBar = document.getElementById("progress-bar");
const progressWrap = document.getElementById("progress-wrap");
const loadingView = document.getElementById("loading-view");
const loadingText = document.getElementById("loading-text");
const newRoomBtn = document.getElementById("new-room-btn");
const roomListEl = document.getElementById("room-list");
const modeSelect = document.getElementById("mode-select");
const homeBtn = document.getElementById("home-btn");
const menuBtn = document.getElementById("menu-btn");
const roomDrawer = document.getElementById("room-drawer");
const roomOverlay = document.getElementById("room-overlay");
const roomClose = document.getElementById("room-close");

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const systemPromptInput = document.getElementById("system-prompt-input");
const savePromptBtn = document.getElementById("save-prompt-btn");
const resetPromptBtn = document.getElementById("reset-prompt-btn");
const promptStatus = document.getElementById("prompt-status");
const themeOpts = document.querySelectorAll(".theme-opt");
const tempSlider = document.getElementById("temp-slider");
const tempValue = document.getElementById("temp-value");
const maxTokensInput = document.getElementById("max-tokens-input");
const devConsoleToggle = document.getElementById("dev-console-toggle");
const ttsVoiceSelect = document.getElementById("tts-voice-select");
const ttsTestBtn = document.getElementById("tts-test-btn");
const ttsReloadBtn = document.getElementById("tts-reload-voices-btn");
const bgUpload = document.getElementById("bg-upload");
const bgUploadBtn = document.getElementById("bg-upload-btn");
const bgClearBtn = document.getElementById("bg-clear-btn");

// init controls
systemPromptInput.value = loadStoredPrompt();
if(tempSlider){ tempSlider.value = loadStoredTemp(); if(tempValue) tempValue.textContent = tempSlider.value; }
if(maxTokensInput){ maxTokensInput.value = loadStoredMaxTokens(); }

let messages = [{ role: "system", content: loadStoredPrompt() }];

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function renderMarkdown(t){
  if(!t) return "";
  let html = escapeHtml(t.trim());
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br>");
  return html;
}
function addMessage(role, content){
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = role==="assistant" ? renderMarkdown(content) : escapeHtml(content);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}
function showLoading(text){
  loadingText.textContent = text || "準備中...";
  loadingView.classList.add("show");
  chatEl.classList.add("is-first-loading");
}
function hideLoading(){
  loadingView.classList.remove("show");
  chatEl.classList.remove("is-first-loading");
}
function updateProgress(pct, text){
  progressBar.classList.add("show");
  progressBar.style.width = `${pct}%`;
  if(text) loadingText.textContent = text;
  if(pct>=100) setTimeout(()=>{ progressBar.classList.remove("show"); progressBar.style.width="0%"; }, 800);
}
function applyTheme(theme, save=true){
  if(theme==="light") document.body.classList.add("light"); else document.body.classList.remove("light");
  themeOpts.forEach(b=>b.classList.toggle("active", b.dataset.theme===theme));
  if(save) try{ localStorage.setItem(LS_THEME_KEY, theme); }catch{}
}
applyTheme(loadStoredTheme(), false);
devConsoleEnabled = loadDevConsoleEnabled();

function saveSystemPrompt(){
  const v = systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
  try{ localStorage.setItem(LS_PROMPT_KEY, v); }catch{}
  messages[0].content = v;
  promptStatus.textContent = "保存しました";
  setTimeout(()=>promptStatus.textContent="", 2000);
}
function resetSystemPrompt(){ systemPromptInput.value = DEFAULT_SYSTEM_PROMPT; saveSystemPrompt(); }

// Rooms
function loadRooms(){ try{ const r=localStorage.getItem(LS_ROOMS); return r?JSON.parse(r):[]; }catch{ return []; } }
function saveRooms(){ try{ localStorage.setItem(LS_ROOMS, JSON.stringify(rooms)); }catch{} }
function loadRoomMessages(id){ try{ const r=localStorage.getItem(LS_ROOM_PREFIX+id); return r?JSON.parse(r):[]; }catch{ return []; } }
function saveRoomMessages(id, msgs){ try{ localStorage.setItem(LS_ROOM_PREFIX+id, JSON.stringify(msgs)); }catch{} }
function getHistory(){ return messages.slice(1); }
function saveCurrentRoomHistory(){
  if(!currentRoomId) return;
  saveRoomMessages(currentRoomId, getHistory());
  const room = rooms.find(r=>r.id===currentRoomId);
  if(room && room.title==="新しいチャット" && getHistory().length>0){
    const first = getHistory().find(m=>m.role==="user");
    if(first){ room.title = first.content.slice(0,20); saveRooms(); renderRoomList(); }
  }
}
function renderRoomList(){
  if(!roomListEl) return;
  roomListEl.innerHTML = rooms.map(r=>`
    <div class="room-item ${r.id===currentRoomId?'active':''}" data-id="${r.id}">
      <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(r.title)}</span>
      <button class="room-del-btn" data-del-id="${r.id}">×</button>
    </div>
  `).join('');
}
function clearChatUI(){ chatEl.querySelectorAll('.msg').forEach(el=>el.remove()); }
function renderChatFromHistory(history){
  clearChatUI();
  if(history.length===0){
    const div = document.createElement("div");
    div.className = "msg assistant";
    div.textContent = "こんにちは、CronyGOです。防災について何でも聞いてください。";
    chatEl.insertBefore(div, loadingView);
    hasChatted=false;
    hideLoading();
    return;
  }
  history.forEach(m=>addMessage(m.role, m.content));
  hasChatted=true;
  hideLoading();
}
function switchRoom(id){
  if(!id || id===currentRoomId){ closeDrawer(); return; }
  saveCurrentRoomHistory();
  currentRoomId=id;
  localStorage.setItem(LS_CURRENT, id);
  const history=loadRoomMessages(id);
  messages=[{role:"system", content:loadStoredPrompt()}, ...history];
  renderChatFromHistory(history);
  renderRoomList();
  closeDrawer();
}
function createRoom(){
  saveCurrentRoomHistory();
  const id=Date.now().toString();
  const newRoom={ id, title:"新しいチャット", createdAt:Date.now() };
  rooms.unshift(newRoom);
  saveRooms();
  currentRoomId=id;
  localStorage.setItem(LS_CURRENT, id);
  messages=[{role:"system", content:loadStoredPrompt()}];
  hasChatted=false;
  renderChatFromHistory([]);
  renderRoomList();
  closeDrawer();
  saveRoomMessages(id, []);
}
function deleteRoom(id){
  if(rooms.length<=1){
    saveRoomMessages(id, []);
    messages=[{role:"system", content:loadStoredPrompt()}];
    renderChatFromHistory([]);
    renderRoomList();
    return;
  }
  rooms=rooms.filter(r=>r.id!==id);
  saveRooms();
  try{ localStorage.removeItem(LS_ROOM_PREFIX+id); }catch{}
  if(id===currentRoomId){
    currentRoomId=rooms[0].id;
    localStorage.setItem(LS_CURRENT, currentRoomId);
    const history=loadRoomMessages(currentRoomId);
    messages=[{role:"system", content:loadStoredPrompt()}, ...history];
    renderChatFromHistory(history);
  }
  renderRoomList();
}
function initRooms(){
  rooms=loadRooms();
  if(rooms.length===0){ createRoom(); return; }
  currentRoomId=localStorage.getItem(LS_CURRENT) || rooms[0].id;
  const history=loadRoomMessages(currentRoomId);
  messages=[{role:"system", content:loadStoredPrompt()}, ...history];
  renderChatFromHistory(history);
  renderRoomList();
}

// Mode - UI only but store
if(modeSelect){
  const saved = localStorage.getItem(LS_MODE_KEY) || "normal";
  modeSelect.value=saved;
  modeSelect.addEventListener("change", (e)=>{
    const v=e.target.value;
    localStorage.setItem(LS_MODE_KEY, v);
    const label=modeSelect.options[modeSelect.selectedIndex].textContent;
    addMessage("system", `防災モードを「${label}」に切り替えました。※v0.1αではUIのみ`);
  });
}

// Engine - WebLLM Gemma2B-JPN fixed, auto download
async function loadFixedModel(isReload=false){
  const key=FIXED_MODEL_KEY;
  inputEl.disabled=true; sendEl.disabled=true;
  showLoading(isReload? `${key} 再読込中...` : `${key} 準備中...`);
  try{
    await engineManager.load(key, (pct, text)=>{
      updateProgress(pct, `${pct}% ${text}`);
    });
    currentKey=key;
    hideLoading();
    inputEl.disabled=false; sendEl.disabled=false;
    inputEl.placeholder="メッセージを入力...";
    inputEl.focus();
    if(!hasChatted){
      addMessage("assistant", "準備完了しました。防災について何でも聞いてください。");
    }else{
      addMessage("assistant", "モデルの再読込が完了しました。");
    }
    dbg(`loaded ${key}`);
  }catch(e){
    console.error(e);
    hideLoading();
    addMessage("assistant", "モデルの読み込みに失敗しました: "+e.message);
    document.getElementById("dl-status").textContent="エラー: "+e.message;
  }
}

// Chat
async function sendMessageWithText(forcedText){
  const text=(forcedText || inputEl.value).trim();
  if(!text || isGenerating) return;
  const isVoiceMode=lastInputWasVoice;
  lastInputWasVoice=false;
  if(!hasChatted){ hasChatted=true; hideLoading(); }
  if(!engineManager.isReady()){
    addMessage("system", "モデルを読み込み中です。しばらくお待ちください。");
    return;
  }
  addMessage("user", text);
  messages.push({ role:"user", content:text });
  saveCurrentRoomHistory();
  inputEl.value="";
  voicePreview.textContent="";
  const assistantDiv=addMessage("assistant", "");
  isGenerating=true; sendEl.disabled=true;
  let full="";
  try{
    const temp=parseFloat(localStorage.getItem(LS_TEMP_KEY)||"0.7");
    const max_tokens=parseInt(localStorage.getItem(LS_MAX_TOKENS_KEY)||"1024");
    for await (const delta of engineManager.chat(messages, { temperature: temp, max_tokens })){
      full+=delta;
      if(full.length>=MAX_CHARS){
        full=full.slice(0, MAX_CHARS)+"\n\n[文字数制限]";
        assistantDiv.innerHTML=renderMarkdown(full);
        break;
      }
      assistantDiv.innerHTML=renderMarkdown(full);
      chatEl.scrollTop=chatEl.scrollHeight;
      if(isVoiceMode && voice && delta){
        // speak streaming is handled via enqueue in voice manager if needed
      }
    }
    messages.push({ role:"assistant", content:full });
    saveCurrentRoomHistory();
    if(voice && isVoiceMode && full){ voice.speak(full); }
  }catch(e){
    assistantDiv.innerHTML=renderMarkdown("生成エラー: "+e.message);
  }finally{
    isGenerating=false; sendEl.disabled=false; inputEl.focus();
  }
}

// Voice
voice = new VoiceManager({
  lang:'ja-JP',
  autoSendDelay:1200,
  onFinal:(text)=>{ inputEl.value=text; voicePreview.textContent=text; },
  onInterim:(full, interim, finalPart)=>{ inputEl.value=full; voicePreview.textContent=interim?`聞き取り: ${interim}`:finalPart; },
  onAutoSend:(text)=>{
    const t=text.trim(); if(!t) return;
    voicePreview.textContent="";
    lastInputWasVoice=true;
    sendMessageWithText(t);
    voice.clearBuffer();
  },
  onStatus:(msg, state)=>{ dbg(`[Voice] ${msg} ${state}`); }
});

micBtn.addEventListener("click", ()=>{
  if(voice.isListening){
    voice.stop();
    micBtn.classList.remove("on");
    inputEl.placeholder="メッセージを入力...";
  }else{
    if(voice.isSpeaking) voice.clearQueue(false);
    inputEl.blur();
    voice.start().then(ok=>{
      if(ok) micBtn.classList.add("on");
    });
  }
});

sendEl.addEventListener("click", ()=>{ lastInputWasVoice=false; sendMessageWithText(); });
inputEl.addEventListener("keydown", (e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); lastInputWasVoice=false; sendMessageWithText(); } });

// Drawer
const openDrawer=()=>{ roomDrawer?.classList.add("open"); roomOverlay?.classList.add("open"); };
const closeDrawer=()=>{ roomDrawer?.classList.remove("open"); roomOverlay?.classList.remove("open"); };
menuBtn?.addEventListener("click", openDrawer);
roomOverlay?.addEventListener("click", closeDrawer);
roomClose?.addEventListener("click", closeDrawer);
homeBtn?.addEventListener("click", ()=>{ createRoom(); });

// Settings
function openSettings(){ settingsPanel.classList.add("show"); settingsOverlay.classList.add("show"); }
function closeSettings(){ settingsPanel.classList.remove("show"); settingsOverlay.classList.remove("show"); }
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);
document.querySelectorAll(".settings-group-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const group=btn.closest(".settings-group");
    const isOpen=group.classList.contains("open");
    document.querySelectorAll(".settings-group").forEach(g=>g.classList.remove("open"));
    if(!isOpen) group.classList.add("open");
  });
});
savePromptBtn.addEventListener("click", saveSystemPrompt);
resetPromptBtn.addEventListener("click", resetSystemPrompt);
themeOpts.forEach(btn=>{ btn.addEventListener("click", ()=>applyTheme(btn.dataset.theme, true)); });
if(devConsoleToggle){
  devConsoleToggle.checked=devConsoleEnabled;
  devConsoleToggle.addEventListener("change", (e)=>{
    devConsoleEnabled=e.target.checked;
    saveDevConsoleEnabled(devConsoleEnabled);
    document.getElementById("dev-console-label").textContent=devConsoleEnabled?"ON":"OFF";
  });
}
document.getElementById("dev-console-label").textContent=devConsoleEnabled?"ON":"OFF";

// TTS
function refreshVoiceList(){
  if(!ttsVoiceSelect || !window.speechSynthesis) return;
  const voices=window.speechSynthesis.getVoices();
  if(!voices.length){ ttsVoiceSelect.innerHTML="<option>読み込み中...</option>"; return; }
  const ja=voices.filter(v=>v.lang.toLowerCase().startsWith("ja"));
  const other=voices.filter(v=>!v.lang.toLowerCase().startsWith("ja"));
  const sorted=[...ja, ...other];
  const saved=localStorage.getItem("cronygo_tts_voice");
  ttsVoiceSelect.innerHTML="";
  sorted.forEach(v=>{
    const opt=document.createElement("option");
    opt.value=v.voiceURI;
    opt.textContent=`${v.name} (${v.lang})`;
    ttsVoiceSelect.appendChild(opt);
  });
  if(saved) ttsVoiceSelect.value=saved;
  else if(ja[0]) ttsVoiceSelect.value=ja[0].voiceURI;
}
if(ttsVoiceSelect){
  ttsVoiceSelect.addEventListener("change", ()=>{
    voice?.setPreferredVoice(ttsVoiceSelect.value);
  });
}
if(document.getElementById("tts-test-btn")){
  document.getElementById("tts-test-btn").addEventListener("click", ()=>{ voice?.speak("こんにちは、クロニーゴーです。"); });
}
if(document.getElementById("tts-reload-voices-btn")){
  document.getElementById("tts-reload-voices-btn").addEventListener("click", refreshVoiceList);
}
if(window.speechSynthesis){
  window.speechSynthesis.onvoiceschanged=refreshVoiceList;
  setTimeout(refreshVoiceList, 500);
}

// Cache & DL
async function refreshCacheInfo(){
  const usageEl=document.getElementById("cache-usage");
  try{
    const est=await navigator.storage.estimate();
    const mb=((est.usage||0)/1024/1024).toFixed(1);
    if(usageEl) usageEl.textContent=`使用量: ${mb} MB`;
  }catch{ if(usageEl) usageEl.textContent="取得失敗"; }
}
document.getElementById("cache-refresh-btn")?.addEventListener("click", refreshCacheInfo);
document.getElementById("cache-clear-btn")?.addEventListener("click", async ()=>{
  if(!confirm("キャッシュを削除しますか？")) return;
  localStorage.removeItem("webllm_model_id");
  if("caches" in window){
    const keys=await caches.keys();
    for(const k of keys) await caches.delete(k);
  }
  alert("削除しました");
  refreshCacheInfo();
});
document.getElementById("force-dl-btn")?.addEventListener("click", ()=>{ loadFixedModel(true); });
refreshCacheInfo();

// BG
const bgUpload=document.getElementById("bg-upload");
const bgUploadBtn=document.getElementById("bg-upload-btn");
const bgClearBtn=document.getElementById("bg-clear-btn");
const LS_BG="cronygo_chat_bg";
function applyBg(dataUrl){
  if(dataUrl){ chatEl.style.backgroundImage=`url("${dataUrl}")`; chatEl.classList.add("has-custom-bg"); }
  else{ chatEl.style.backgroundImage=""; chatEl.classList.remove("has-custom-bg"); }
}
try{
  const savedBg=localStorage.getItem(LS_BG);
  if(savedBg) applyBg(savedBg);
}catch{}
bgUploadBtn?.addEventListener("click", ()=>bgUpload?.click());
bgClearBtn?.addEventListener("click", ()=>{ localStorage.removeItem(LS_BG); applyBg(null); });
bgUpload?.addEventListener("change", async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  const dataUrl=await new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement("canvas");
      const max=1024; let w=img.width, h=img.height;
      if(w>max||h>max){ const r=Math.min(max/w, max/h); w*=r; h*=r; }
      c.width=w; c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.src=URL.createObjectURL(file);
  });
  try{ localStorage.setItem(LS_BG, dataUrl); applyBg(dataUrl); }catch{ alert("画像が大きすぎます"); }
});

// Params
if(tempSlider){
  tempSlider.addEventListener("input", (e)=>{
    const v=e.target.value;
    if(document.getElementById("temp-value")) document.getElementById("temp-value").textContent=v;
    localStorage.setItem(LS_TEMP_KEY, v);
  });
}
if(maxTokensInput){
  maxTokensInput.addEventListener("change", (e)=>{ localStorage.setItem(LS_MAX_TOKENS_KEY, e.target.value); });
}

// Rooms events
newRoomBtn?.addEventListener("click", createRoom);
roomListEl?.addEventListener("click", (e)=>{
  const del=e.target.closest(".room-del-btn");
  if(del){ e.stopPropagation(); if(confirm("削除しますか？")) deleteRoom(del.dataset.delId); return; }
  const item=e.target.closest(".room-item");
  if(!item) return;
  switchRoom(item.dataset.id);
});

// Init
initRooms();

// Auto download fixed model
if(!engineManager.isReady()){
  loadFixedModel();
}

document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ closeDrawer(); closeSettings(); } });
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
