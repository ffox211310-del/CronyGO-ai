import { VoiceManager } from "./voice.js";
import { MODELS } from "./models.js";
import { engineManager } from "./engine-manager.js";

const FIXED_MODEL_KEY = "G2B-jpn";
const FIXED_MODEL_ID = MODELS[FIXED_MODEL_KEY];

const DEFAULT_SYSTEM_PROMPT = "あなたはCronyGO、防災AIアシスタントです。日本語で簡素かつ的確に答えてください。避難や備蓄、安否確認についてわかりやすく案内します。";
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
let debugClearBtn = null;
let debugTestBtn = null;

const MAX_CHARS = 1500;
const DEFAULT_TEMP = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

function getCurrentTimeString() {
  const now = new Date();
  const weekdays = ["日曜日","月曜日","火曜日","水曜日","木曜日","金曜日","土曜日"];
  return `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${weekdays[now.getDay()]} ${now.getHours()}時${String(now.getMinutes()).padStart(2,'0')}分`;
}
function isTimeQuery(text) {
  const t = text.trim().toLowerCase();
  if (/(今日は何日|今日何日|きょうは何日|今日の日付|何曜日|今何時|いまなんじ|現在時刻|今の時間)/.test(t)) return true;
  if (t === "何日" || t === "何時") return true;
  return false;
}

function loadStoredPrompt(){ try{ return localStorage.getItem(LS_PROMPT_KEY) || DEFAULT_SYSTEM_PROMPT; }catch{ return DEFAULT_SYSTEM_PROMPT; } }
function loadStoredTemp(){ return parseFloat(localStorage.getItem(LS_TEMP_KEY) || DEFAULT_TEMP); }
function loadStoredMaxTokens(){ return parseInt(localStorage.getItem(LS_MAX_TOKENS_KEY) || DEFAULT_MAX_TOKENS); }
function loadStoredTheme(){ try{ return localStorage.getItem(LS_THEME_KEY) || "dark"; }catch{ return "dark"; } }
function loadDevConsoleEnabled(){ try{ return localStorage.getItem(LS_DEV_CONSOLE_KEY)==="true"; }catch{ return false; } }
function saveDevConsoleEnabled(v){ try{ localStorage.setItem(LS_DEV_CONSOLE_KEY, v?"true":"false"); }catch{} }

function createDebugOverlay(){
  if(debugOverlayEl) return debugOverlayEl;
  const el=document.createElement('div');
  el.id='debug-overlay';
  el.style.cssText='position:fixed;bottom:80px;left:6px;right:6px;max-height:38vh;overflow:auto;background:rgba(0,0,0,0.88);color:#0f8;font-size:11px;line-height:1.35;padding:8px;border-radius:8px;z-index:99999;white-space:pre-wrap;font-family:monospace;border:1px solid #0f0;';
  document.body.appendChild(el);
  debugOverlayEl=el;
  const clearBtn=document.createElement('button');
  clearBtn.textContent='クリア';
  clearBtn.style.cssText='position:fixed;bottom:48px;right:10px;z-index:100000;background:#0f0;color:#000;border:0;border-radius:12px;padding:5px 12px;font-size:11px;font-weight:600;';
  clearBtn.onclick=()=>{ if(debugOverlayEl) debugOverlayEl.textContent=''; };
  document.body.appendChild(clearBtn); debugClearBtn=clearBtn;
  const testBtn=document.createElement('button');
  testBtn.textContent='TTSテスト';
  testBtn.style.cssText='position:fixed;bottom:48px;left:10px;z-index:100000;background:#ff0;color:#000;border:0;border-radius:12px;padding:5px 12px;font-size:11px;font-weight:600;';
  testBtn.onclick=()=>{ if(voice) voice.speak('テストです。聞こえますか？'); };
  document.body.appendChild(testBtn); debugTestBtn=testBtn;
  return el;
}
function removeDebugOverlay(){
  if(debugOverlayEl) try{ debugOverlayEl.remove(); }catch{} debugOverlayEl=null;
  if(debugClearBtn) try{ debugClearBtn.remove(); }catch{} debugClearBtn=null;
  if(debugTestBtn) try{ debugTestBtn.remove(); }catch{} debugTestBtn=null;
}
function dbg(msg){
  if(!devConsoleEnabled) return;
  try{
    const el=createDebugOverlay();
    const time=new Date().toLocaleTimeString();
    el.textContent+=`[${time}] ${msg}\n`;
    el.scrollTop=el.scrollHeight;
  }catch{} console.log("[CronyGO]", msg);
}
window.__cronyDbg=(msg)=>dbg(msg);
function setDevConsoleEnabled(enabled){
  devConsoleEnabled=enabled;
  saveDevConsoleEnabled(enabled);
  const toggle=document.getElementById('dev-console-toggle');
  const label=document.getElementById('dev-console-label');
  const bg=document.getElementById('dev-toggle-bg');
  const dot=document.getElementById('dev-toggle-dot');
  if(toggle) toggle.checked=enabled;
  if(label){ label.textContent=enabled?'ON':'OFF'; label.style.color=enabled?'#4FD1C5':'#888'; }
  if(bg) bg.style.background=enabled?'#4FD1C5':'#333';
  if(dot) dot.style.transform=enabled?'translateX(20px)':'translateX(0)';
  if(enabled){ createDebugOverlay(); dbg('dev console ON'); }
  else{ dbg('dev console OFF'); setTimeout(()=>removeDebugOverlay(),300); }
}

let messages=[{ role:"system", content:loadStoredPrompt() }];

// DOM
const chatEl=document.getElementById("chat");
const micBtn=document.getElementById("mic-btn");
const voicePreview=document.getElementById("voice-preview");
const inputEl=document.getElementById("input");
const sendEl=document.getElementById("send");
const progressBar=document.getElementById("progress-bar");
const loadingView=document.getElementById("loading-view");
const loadingText=document.getElementById("loading-text");
const newRoomBtn=document.getElementById("new-room-btn");
const roomListEl=document.getElementById("room-list");
const modeSelect=document.getElementById("mode-select");
const homeBtn=document.getElementById("home-btn");
const menuBtn=document.getElementById("menu-btn");
const roomDrawer=document.getElementById("room-drawer");
const roomOverlay=document.getElementById("room-overlay");
const roomClose=document.getElementById("room-close");
const settingsBtn=document.getElementById("settings-btn");
const settingsPanel=document.getElementById("settings-panel");
const settingsOverlay=document.getElementById("settings-overlay");
const settingsClose=document.getElementById("settings-close");
const systemPromptInput=document.getElementById("system-prompt-input");
const savePromptBtn=document.getElementById("save-prompt-btn");
const resetPromptBtn=document.getElementById("reset-prompt-btn");
const promptStatus=document.getElementById("prompt-status");
const themeOpts=document.querySelectorAll(".theme-opt");
const tempSlider=document.getElementById("temp-slider");
const tempValue=document.getElementById("temp-value");
const maxTokensInput=document.getElementById("max-tokens-input");
const devConsoleToggle=document.getElementById("dev-console-toggle");
const ttsVoiceSelect=document.getElementById("tts-voice-select");
const bgUpload=document.getElementById("bg-upload");
const bgUploadBtn=document.getElementById("bg-upload-btn");
const bgClearBtn=document.getElementById("bg-clear-btn");

systemPromptInput.value=loadStoredPrompt();
if(tempSlider){
  tempSlider.value=loadStoredTemp();
  if(tempValue) tempValue.textContent=tempSlider.value;
  tempSlider.addEventListener('input', e=>{
    if(tempValue) tempValue.textContent=e.target.value;
    localStorage.setItem(LS_TEMP_KEY, e.target.value);
  });
}
if(maxTokensInput){
  maxTokensInput.value=loadStoredMaxTokens();
  maxTokensInput.addEventListener('change', e=>{ localStorage.setItem(LS_MAX_TOKENS_KEY, e.target.value); });
}

async function refreshCacheInfo(){
  const usageEl=document.getElementById('cache-usage');
  const modelEl=document.getElementById('cache-model-name');
  const dlStatus=document.getElementById('dl-status');
  try{
    const estimate=await navigator.storage.estimate();
    const mb=((estimate.usage||0)/1024/1024).toFixed(1);
    if(usageEl) usageEl.textContent=`使用量: ${mb} MB`;
  }catch{
    if(usageEl) usageEl.textContent='使用量: 取得失敗';
    dbg('cache estimate failed');
  }
  if(modelEl) modelEl.textContent=`${FIXED_MODEL_KEY} (${FIXED_MODEL_ID})`;
  if(dlStatus && !engineManager.isReady()){
    dlStatus.textContent=`未ダウンロード - 自動DLを試行中...`;
  }
}
document.getElementById('cache-refresh-btn')?.addEventListener('click', refreshCacheInfo);
document.getElementById('cache-clear-btn')?.addEventListener('click', async ()=>{
  if(!confirm('モデルキャッシュを削除しますか？次回は再ダウンロードが必要です')) return;
  localStorage.removeItem('webllm_model_id');
  if('caches' in window){
    try{
      const keys=await caches.keys();
      for(const k of keys) await caches.delete(k);
    }catch(e){ dbg(`cache clear error ${e.message}`); }
  }
  alert('キャッシュ削除しました');
  refreshCacheInfo();
});
document.getElementById('force-dl-btn')?.addEventListener('click', ()=>loadFixedModel(true));
refreshCacheInfo();

function loadStoredMode(){ try{ return localStorage.getItem(LS_MODE_KEY) || "normal"; }catch{ return "normal"; } }

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function renderMarkdown(t){
  if(!t) return "";
  let html=escapeHtml(t.trim());
  html=html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  html=html.replace(/\n{3,}/g, "\n\n");
  html=html.replace(/\n/g, "<br>");
  return html;
}
function addMessage(role, content){
  const div=document.createElement("div");
  div.className=`msg ${role}`;
  div.innerHTML=role==="assistant" ? renderMarkdown(content) : escapeHtml(content);
  chatEl.appendChild(div);
  chatEl.scrollTop=chatEl.scrollHeight;
  return div;
}
function showLoading(text){
  loadingText.textContent=text || "準備中...";
  loadingView.classList.add("show");
  chatEl.classList.add("is-first-loading");
}
function hideLoading(){
  loadingView.classList.remove("show");
  chatEl.classList.remove("is-first-loading");
}
function updateProgress(pct, text){
  progressBar.classList.add("show");
  progressBar.style.width=`${pct}%`;
  progressBar.style.background="#4FD1C5";
  if(text) loadingText.textContent=text;
  if(pct>=100) setTimeout(()=>{ progressBar.classList.remove("show"); progressBar.style.width="0%"; }, 800);
}
function updateProgressError(text){
  progressBar.classList.add("show");
  progressBar.style.background="#ff4444";
  progressBar.style.width="100%";
  if(text) loadingText.textContent=text;
}
function applyTheme(theme, save=true){
  if(theme==="light") document.body.classList.add("light"); else document.body.classList.remove("light");
  themeOpts.forEach(b=>b.classList.toggle("active", b.dataset.theme===theme));
  if(save) try{ localStorage.setItem(LS_THEME_KEY, theme); }catch{}
}
applyTheme(loadStoredTheme(), false);
devConsoleEnabled=loadDevConsoleEnabled();
setDevConsoleEnabled(devConsoleEnabled);

function saveSystemPrompt(){
  const v=systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
  try{ localStorage.setItem(LS_PROMPT_KEY, v); }catch{}
  messages[0].content=v;
  promptStatus.textContent="保存しました。次の会話から反映されます。";
  promptStatus.style.color="#4FD1C5";
  setTimeout(()=>promptStatus.textContent="", 2500);
}
function resetSystemPrompt(){ systemPromptInput.value=DEFAULT_SYSTEM_PROMPT; saveSystemPrompt(); promptStatus.textContent="デフォルトに戻しました。"; }

// Rooms
function loadRooms(){ try{ const r=localStorage.getItem(LS_ROOMS); return r?JSON.parse(r):[]; }catch{ return []; } }
function saveRooms(){ try{ localStorage.setItem(LS_ROOMS, JSON.stringify(rooms)); }catch{} }
function loadRoomMessages(id){ try{ const r=localStorage.getItem(LS_ROOM_PREFIX+id); return r?JSON.parse(r):[]; }catch{ return []; } }
function saveRoomMessages(id, msgs){ try{ localStorage.setItem(LS_ROOM_PREFIX+id, JSON.stringify(msgs)); }catch(e){ console.warn(e); } }
function getHistory(){ return messages.slice(1); }
function saveCurrentRoomHistory(){
  if(!currentRoomId) return;
  saveRoomMessages(currentRoomId, getHistory());
  const room=rooms.find(r=>r.id===currentRoomId);
  if(room && room.title==="新しいチャット" && getHistory().length>0){
    const first=getHistory().find(m=>m.role==="user");
    if(first){ room.title=first.content.slice(0,20)+(first.content.length>20?"…":""); saveRooms(); renderRoomList(); }
  }
}
function renderRoomList(){
  if(!roomListEl) return;
  roomListEl.innerHTML=rooms.map(r=>`
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
    const div=document.createElement("div");
    div.className="msg assistant";
    div.textContent="こんにちは、CronyGOです。防災について何でも聞いてください。";
    chatEl.insertBefore(div, loadingView);
    hasChatted=false; hideLoading(); return;
  }
  history.forEach(m=>addMessage(m.role, m.content));
  hasChatted=true; hideLoading();
}
function switchRoom(id){
  if(!id || id===currentRoomId){ closeDrawer(); return; }
  saveCurrentRoomHistory();
  currentRoomId=id; localStorage.setItem(LS_CURRENT, id);
  const history=loadRoomMessages(id);
  messages=[{role:"system", content:loadStoredPrompt()}, ...history];
  renderChatFromHistory(history); renderRoomList(); closeDrawer();
}
function createRoom(){
  saveCurrentRoomHistory();
  const id=Date.now().toString();
  const newRoom={ id, title:"新しいチャット", createdAt:Date.now() };
  rooms.unshift(newRoom); saveRooms();
  currentRoomId=id; localStorage.setItem(LS_CURRENT, id);
  messages=[{role:"system", content:loadStoredPrompt()}];
  hasChatted=false; renderChatFromHistory([]); renderRoomList(); closeDrawer(); saveRoomMessages(id, []);
}
function deleteRoom(id){
  if(rooms.length<=1){
    saveRoomMessages(id, []); messages=[{role:"system", content:loadStoredPrompt()}];
    const room=rooms.find(r=>r.id===id); if(room) room.title="新しいチャット";
    saveRooms(); renderChatFromHistory([]); renderRoomList(); return;
  }
  rooms=rooms.filter(r=>r.id!==id); saveRooms();
  try{ localStorage.removeItem(LS_ROOM_PREFIX+id); }catch{}
  if(id===currentRoomId){
    currentRoomId=rooms[0].id; localStorage.setItem(LS_CURRENT, currentRoomId);
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
  renderChatFromHistory(history); renderRoomList();
}

// Mode select
if(modeSelect){
  modeSelect.value=loadStoredMode();
  modeSelect.addEventListener('change', e=>{
    const v=e.target.value;
    try{ localStorage.setItem(LS_MODE_KEY, v); }catch{}
    const label=modeSelect.options[modeSelect.selectedIndex].textContent;
    addMessage("system", `【防災モード切替】${label} に切り替えました。※v0.1αではUIのみ`);
    dbg(`mode changed to ${v}`);
  });
}

// Engine load with full error handling
async function loadFixedModel(isReload=false){
  const key=FIXED_MODEL_KEY;
  const isFirstPhase=!hasChatted && !isReload;
  inputEl.disabled=true; sendEl.disabled=true;
  progressBar.style.opacity="1"; progressBar.style.width="0%"; progressBar.style.background="#4FD1C5";
  if(isFirstPhase) showLoading(`${key} 準備中...`);
  else{
    loadingText.textContent=isReload?`${key} 積み直し中...`:`${key} 読み込み中...`;
    if(isReload){ loadingView.classList.add("show"); chatEl.classList.add("is-first-loading"); }
  }
  const dlStatus=document.getElementById("dl-status");
  if(dlStatus) dlStatus.textContent=`${key} を読み込み開始...`;
  if(!isFirstPhase) addMessage("system", isReload?`${key} 再読込開始`:`${key} を読み込み開始。初回は時間がかかります。`);
  dbg(`loadModel start ${key} reload=${isReload}`);
  try{
    await engineManager.load(key, (pct, text)=>{
      const txt=isReload?`積み直し ${pct}% ${text}`:`${pct}% ${text}`;
      updateProgress(pct, txt);
      if(dlStatus) dlStatus.textContent=txt;
      dbg(`progress ${pct}% ${text}`);
    });
    currentKey=key;
    if(dlStatus) dlStatus.textContent=`Ready ${key} [${engineManager.getCurrentId()}]`;
    updateProgress(100, `Ready ${key}`);
    setTimeout(()=>progressBar.style.opacity="0",800);
    inputEl.disabled=false; sendEl.disabled=false;
    inputEl.placeholder="メッセージを入力...";
    hideLoading();
    addMessage("assistant", isReload?`${key} 積み直し完了！続きをどうぞ`:`${key} 起動完了！防災について何でも聞いてください。`);
    dbg(`model ${key} loaded via ${engineManager.getCurrentId()}`);
  }catch(e){
    console.error(e);
    dbg(`model load ERROR ${e.message}`);
    if(dlStatus) dlStatus.textContent=`エラー: ${e.message}`;
    updateProgressError(`エラー: ${e.message}`);
    hideLoading();
    addMessage("assistant", `⚠️ モデル読み込みエラー: ${e.message}\n\n・WebGPU対応ブラウザか確認\n・メモリ不足の場合はタブを閉じて再試行\n・詳細は設定 > 詳細情報 > 再DLを押してください`);
  }
}

// Chat with kill switch and max chars and time query
async function sendMessageWithText(forcedText){
  const text=(forcedText || inputEl.value).trim();
  if(!text || isGenerating) return;
  const isVoiceMode=lastInputWasVoice;
  lastInputWasVoice=false;
  if(!hasChatted){ hasChatted=true; hideLoading(); }

  if(isTimeQuery(text)){
    addMessage("user", text);
    messages.push({ role:"user", content:text });
    saveCurrentRoomHistory();
    inputEl.value=""; voicePreview.textContent="";
    const nowStr=getCurrentTimeString();
    const reply=`${nowStr}です`;
    addMessage("assistant", reply);
    messages.push({ role:"assistant", content:reply });
    saveCurrentRoomHistory();
    if(isVoiceMode && voice) voice.speak(reply);
    dbg(`TimeQuery matched "${text}" -> ${reply}`);
    return;
  }

  if(!engineManager.isReady()){
    addMessage("system", "⚠️ モデルがまだ読み込まれていません。自動ダウンロード中です。しばらくお待ちください。");
    addMessage("assistant", "モデル準備中です。設定 > 詳細情報のステータスを確認してください。");
    return;
  }
  addMessage("user", text);
  messages.push({ role:"user", content:text });
  saveCurrentRoomHistory();
  inputEl.value=""; voicePreview.textContent="";
  const assistantDiv=addMessage("assistant", "");
  const killBtn=document.createElement("button");
  killBtn.textContent="■ 生成を停止";
  killBtn.className="kill-switch";
  killBtn.style.cssText="margin:6px 0 10px 0;background:#ff3b3b;color:#fff;border:0;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;align-self:flex-start;";
  assistantDiv.after(killBtn);
  let abortFlag=false; let isKilled=false;
  killBtn.onclick=async()=>{
    if(abortFlag) return;
    abortFlag=true; isKilled=true;
    killBtn.textContent="停止→再読込中..."; killBtn.disabled=true;
    try{ await engineManager.interrupt(); }catch(e){ dbg(`interrupt error ${e.message}`); }
    if(voice) voice.clearQueue(true);
    assistantDiv.innerHTML=renderMarkdown(assistantDiv.textContent+"\n\n[停止→積み直し]");
    const keyToReload=currentKey || FIXED_MODEL_KEY;
    messages=[{ role:"system", content:loadStoredPrompt() }];
    try{ killBtn.remove(); }catch{}
    await loadFixedModel(true);
  };
  isGenerating=true; sendEl.disabled=true;
  let full=""; let speakBuffer=""; const sentenceSplitRegex=/[^。！？\n.!?]+[。！？\n.!?]+/g;
  try{
    const temp=parseFloat(localStorage.getItem(LS_TEMP_KEY) || 0.7);
    const max_tokens=parseInt(localStorage.getItem(LS_MAX_TOKENS_KEY) || 1024);
    for await (const delta of engineManager.chat(messages, { temperature: temp, max_tokens })){
      if(abortFlag) break;
      full+=delta;
      if(full.length>=MAX_CHARS){
        full=full.slice(0, MAX_CHARS).trim()+"\n\n[1500文字制限→自動で積み直し]";
        assistantDiv.innerHTML=renderMarkdown(full);
        try{ await engineManager.interrupt(); }catch{}
        if(voice) voice.clearQueue(true);
        const keyToReload=currentKey || FIXED_MODEL_KEY;
        messages=[{ role:"system", content:loadStoredPrompt() }];
        await loadFixedModel(true);
        break;
      }
      assistantDiv.innerHTML=renderMarkdown(full);
      chatEl.scrollTop=chatEl.scrollHeight;
      if(isVoiceMode && voice && delta){
        speakBuffer+=delta;
        const matches=speakBuffer.match(sentenceSplitRegex);
        if(matches){
          let consumed=0;
          for(const sent of matches){
            const s=sent.trim(); if(s) voice.enqueueSpeak(s);
            consumed+=sent.length;
          }
          speakBuffer=speakBuffer.slice(consumed);
        }
      }
    }
    full=full.trim().replace(/^\s*\*\*\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    if(!isKilled){
      assistantDiv.innerHTML=renderMarkdown(full);
      messages.push({ role:"assistant", content:full });
      saveCurrentRoomHistory();
      if(voice && full && isVoiceMode){
        const remaining=speakBuffer.trim();
        if(remaining) voice.enqueueSpeak(remaining);
        voice.clearBuffer();
      }
    }
  }catch(e){
    dbg(`generation ERROR ${e.message}`);
    if(!abortFlag){
      assistantDiv.innerHTML=renderMarkdown(`⚠️ 生成エラー: ${e.message}\n\n再試行するか、設定 > 詳細情報 > 再DLを試してください。`);
      const dlStatus=document.getElementById("dl-status");
      if(dlStatus) dlStatus.textContent=`生成エラー: ${e.message}`;
    }
  }finally{
    isGenerating=false; sendEl.disabled=false; inputEl.readOnly=false; inputEl.focus();
    try{ killBtn.remove(); }catch{}
  }
}

voice=new VoiceManager({
  lang:'ja-JP',
  autoSendDelay:1200,
  onFinal:(text)=>{ inputEl.value=text; voicePreview.textContent=text; },
  onInterim:(full, interim, finalPart)=>{ inputEl.value=full; voicePreview.textContent=interim?`聞き取り: ${interim}`:finalPart; },
  onAutoSend:(text)=>{
    const t=text.trim(); if(!t) return;
    dbg(`[AutoSend] "${t.slice(0,40)}"`);
    voicePreview.textContent=''; lastInputWasVoice=true; sendMessageWithText(t); voice.clearBuffer();
  },
  onStatus:(msg, state)=>{ dbg(`[Voice Status] ${msg} ${state}`); }
});

micBtn.addEventListener('click', ()=>{
  if(voice.isListening){
    voice.stop(); micBtn.classList.remove('on'); inputEl.readOnly=false; inputEl.placeholder="メッセージを入力...";
  }else{
    if(voice.isSpeaking) voice.clearQueue(false);
    inputEl.blur(); inputEl.readOnly=true; inputEl.placeholder="聞き取り中...";
    voice.start().then(ok=>{
      dbg(`voice.start ${ok}`);
      if(ok) micBtn.classList.add('on');
      else{ inputEl.readOnly=false; inputEl.placeholder="メッセージを入力..."; }
    });
  }
});
sendEl.addEventListener("click", ()=>{ lastInputWasVoice=false; sendMessageWithText(); });
inputEl.addEventListener("keydown", e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); lastInputWasVoice=false; sendMessageWithText(); } });

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
  devConsoleToggle.addEventListener('change', e=>{ setDevConsoleEnabled(e.target.checked); });
}

// TTS
function refreshVoiceList(){
  if(!ttsVoiceSelect || !window.speechSynthesis) return;
  const voices=window.speechSynthesis.getVoices();
  if(!voices.length){ ttsVoiceSelect.innerHTML='<option>読み込み中... 少し待つか再読込押して</option>'; return; }
  const ja=voices.filter(v=>v.lang.toLowerCase().startsWith('ja'));
  const other=voices.filter(v=>!v.lang.toLowerCase().startsWith('ja'));
  const sorted=[...ja.sort((a,b)=>a.name.localeCompare(b.name)), ...other.sort((a,b)=>a.name.localeCompare(b.name))];
  const saved=localStorage.getItem("cronygo_tts_voice");
  ttsVoiceSelect.innerHTML='';
  sorted.forEach(v=>{
    const opt=document.createElement('option'); opt.value=v.voiceURI; opt.textContent=`${v.name} (${v.lang})${ja.includes(v)?' ★':''}`;
    ttsVoiceSelect.appendChild(opt);
  });
  if(saved) ttsVoiceSelect.value=saved; else if(ja[0]) ttsVoiceSelect.value=ja[0].voiceURI;
}
if(ttsVoiceSelect){
  ttsVoiceSelect.addEventListener('change', ()=>{
    const uri=ttsVoiceSelect.value;
    if(voice) voice.setPreferredVoice(uri);
    try{ localStorage.setItem("cronygo_tts_voice", uri); }catch{}
  });
}
document.getElementById('tts-test-btn')?.addEventListener('click', ()=>{ const txt="こんにちは、クロニーゴーです。"; if(voice) voice.speak(txt); });
document.getElementById('tts-reload-voices-btn')?.addEventListener('click', refreshVoiceList);
if(window.speechSynthesis){
  window.speechSynthesis.onvoiceschanged=()=>{ dbg(`voiceschanged ${window.speechSynthesis.getVoices().length}`); refreshVoiceList(); };
  setTimeout(refreshVoiceList, 400); setTimeout(refreshVoiceList, 1500);
}

// BG
const LS_BG="cronygo_chat_bg";
function applyBg(dataUrl){
  if(dataUrl){ chatEl.style.backgroundImage=`url("${dataUrl}")`; chatEl.classList.add('has-custom-bg'); }
  else{ chatEl.style.backgroundImage=''; chatEl.classList.remove('has-custom-bg'); }
}
try{ const savedBg=localStorage.getItem(LS_BG); if(savedBg) applyBg(savedBg); }catch{}
bgUploadBtn?.addEventListener('click', ()=>bgUpload?.click());
bgClearBtn?.addEventListener('click', ()=>{ localStorage.removeItem(LS_BG); applyBg(null); });
bgUpload?.addEventListener('change', async e=>{
  const file=e.target.files[0]; if(!file) return;
  const dataUrl=await new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas'); const max=1024; let w=img.width, h=img.height;
      if(w>max||h>max){ const r=Math.min(max/w, max/h); w*=r; h*=r; }
      c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.src=URL.createObjectURL(file);
  });
  try{ localStorage.setItem(LS_BG, dataUrl); applyBg(dataUrl); }catch{ alert('画像が大きすぎます。もっと小さい画像で試して'); }
});

// Params
if(tempSlider){
  tempSlider.addEventListener('input', e=>{
    const v=e.target.value;
    const tv=document.getElementById('temp-value'); if(tv) tv.textContent=v;
    localStorage.setItem(LS_TEMP_KEY, v);
  });
}
if(maxTokensInput){
  maxTokensInput.addEventListener('change', e=>{ localStorage.setItem(LS_MAX_TOKENS_KEY, e.target.value); });
}

// Rooms events
newRoomBtn?.addEventListener('click', createRoom);
roomListEl?.addEventListener('click', e=>{
  const del=e.target.closest('.room-del-btn');
  if(del){ e.stopPropagation(); if(confirm('このルームを削除しますか？')) deleteRoom(del.dataset.delId); return; }
  const item=e.target.closest('.room-item'); if(!item) return; switchRoom(item.dataset.id);
});

// Init
initRooms();
if(!engineManager.isReady()){ loadFixedModel(); }
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeDrawer(); closeSettings(); } });
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').then(reg=>{ console.log('[PWA] SW registered', reg.scope); }).catch(err=>{ console.error('[PWA] SW failed', err); dbg(`SW failed ${err.message}`); });
}
