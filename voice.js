export class VoiceManager {
  constructor(options = {}) {
    this.lang = options.lang || 'ja-JP';
    this.onFinal = options.onFinal || (() => {});
    this.onInterim = options.onInterim || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onAutoSend = options.onAutoSend || null;
    this.autoRestartDelay = options.autoRestartDelay || 300;
    this.autoSendDelay = options.autoSendDelay || 1200;
    this.isListening = false;
    this.isSpeaking = false;
    this.wasListeningBeforeSpeak = false;
    this.recognition = null;
    this.finalBuffer = '';
    this.lastFinalChunk = '';
    this._autoSendTimer = null;
    this._speakQueue = [];
    this._currentUtterance = null;
    this._isSpeakingQueue = false;
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported = !!this.SpeechRecognition;
    // Croni専用ボイス
    this.rate = 0.92;
    this.pitch = 1.38;
   this.LS_VOICE = "cronygo_tts_voice";
    this.preferredVoiceURI = null;
    try{ this.preferredVoiceURI = localStorage.getItem(this.LS_VOICE); }catch{}
  }
  _dbg(msg) { try { if (window.__cronyDbg) window.__cronyDbg(msg); } catch {} }
  removeConsecutiveDuplicates(text) {
    if (!text || text.length < 2) return text;
    let t = text.trim();
    t = t.replace(/(.)\1{3,}/g, '$1$1');
    let prev;
    do { prev = t; t = t.replace(/([A-Za-z]{2,})(\1)+/g, '$1'); t = t.replace(/(.{2,30})\1+/g, '$1'); } while (t !== prev);
    do { prev = t; t = t.replace(/(.{2,50}?)\s+\1/g, '$1'); t = t.replace(/(.{2,50}?)[\s　]+\1/g, '$1'); t = t.replace(/(.{2,50}?)[。！？？！\s　、，,]+\1/g, '$1'); } while (t !== prev);
    const sentenceRegex = /[^。！？\n?！]+[。！？\n?！]?/g;
    const sentences = t.match(sentenceRegex);
    if (sentences && sentences.length > 1) {
      const deduped = [];
      for (let s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;
        const last = deduped[deduped.length - 1];
        if (last && last.trim() === trimmed) continue;
        deduped.push(s);
      }
      t = deduped.join('');
    }
    t = t.replace(/(.{2,50})\1$/g, '$1');
    return t.trim();
  }
  // 改善版: :** や改行 ** や箇条書き記号も消す
  cleanForTTS(text) {
    if (!text) return '';
    let t = text;
    t = t.replace(/^\s*\*\*\s*$/gm, '');
    t = t.replace(/\*\*\s*\n\s*([\s\S]+?)\s*\n\s*\*\*/g, '$1');
    return t
      .replace(/\*\*\*([\s\S]+?)\*\*\*/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, (m,p1)=>p1.trim())
      .replace(/\*([^*\n]+?)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[•\-・]\s+/gm, '') // 箇条書き記号を消す
      .replace(/^[#>\-•・]+\s*/gm, '')
      .replace(/\*/g, '')
      .replace(/　/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  init() {
    if (!this.isSupported) { this.onStatus('このブラウザは音声認識非対応 (Chrome/Edge推奨)', 'idle'); this._dbg('[Voice] not supported'); return null; }
    const rec = new this.SpeechRecognition();
    rec.lang = this.lang; rec.continuous = true; rec.interimResults = true;
    rec.onstart = () => { this._dbg('[Voice] onstart hearing'); if (!this.isSpeaking) this.onStatus('聞いています... (永遠モード)', 'hearing'); };
    rec.onresult = (event) => {
      if (this.isSpeaking) return;
      let fullFinal = ''; let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal) fullFinal += transcript; else interim += transcript;
      }
      fullFinal = this.removeConsecutiveDuplicates(fullFinal);
      if (fullFinal && fullFinal !== this.finalBuffer) {
        this.finalBuffer = fullFinal; this.onFinal(this.finalBuffer);
        if (this.onAutoSend) { clearTimeout(this._autoSendTimer); this._autoSendTimer = setTimeout(() => { if (this.finalBuffer) this.onAutoSend(this.finalBuffer); }, this.autoSendDelay); }
      }
      if (interim) { const cleanedInterim = this.removeConsecutiveDuplicates(interim); this.onInterim(this.finalBuffer + cleanedInterim, cleanedInterim, this.finalBuffer); }
      else if (fullFinal) { this.onInterim(fullFinal, '', fullFinal); }
    };
    rec.onend = () => {
      this._dbg(`[Voice] onend isSpeaking=${this.isSpeaking} isListening=${this.isListening}`);
      if (this.isSpeaking) return;
      if (this.isListening) { this.onStatus('再接続中...', 'on'); setTimeout(() => { if (this.isListening && !this.isSpeaking) { try { rec.start(); } catch (e) { this._dbg('[Voice] restart fail '+e.message); } } }, this.autoRestartDelay); }
      else { this.onStatus('停止中', 'idle'); }
    };
    rec.onerror = (e) => {
      this._dbg(`[Voice] onerror ${e.error}`); console.error('[Voice]', e);
      if (e.error === 'not-allowed') { this.isListening = false; this.onStatus('マイク許可が必要です', 'idle'); }
      else if (!this.isSpeaking && this.isListening) { this.onStatus(`再接続中... (${e.error})`, 'on'); setTimeout(() => { if (this.isListening && !this.isSpeaking) { try { rec.start(); } catch {} } }, 800); }
    };
    this.recognition = rec; return rec;
  }
  async start() {
    this._dbg('[Voice] start()');
    if (!this.isSupported) { alert('このブラウザは音声認識に対応していません。Chrome / Edge で開いてください。'); return false; }
    if (!this.recognition) this.init();
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); this._dbg('[Voice] getUserMedia ok'); }
    catch (e) { this._dbg('[Voice] getUserMedia FAIL '+e.message); alert('マイク許可が必要です: ' + e.message); this.onStatus('マイク許可なし', 'idle'); return false; }
    this.isListening = true; this.isSpeaking = false; this.finalBuffer = ''; this.lastFinalChunk = ''; this.wasListeningBeforeSpeak = false; clearTimeout(this._autoSendTimer);
    try { this.recognition.start(); this._dbg('[Voice] rec start ok'); } catch (e) { this._dbg('[Voice] rec start FAIL '+e.message); setTimeout(() => { try { this.recognition.start(); } catch {} }, 200); }
    return true;
  }
  stop() { this._dbg('[Voice] stop()'); this.isListening = false; this.isSpeaking = false; this.wasListeningBeforeSpeak = false; clearTimeout(this._autoSendTimer); if (this.recognition) try { this.recognition.stop(); } catch {} this.clearQueue(false); this.onStatus('停止中', 'idle'); }
  speak(text, opts = {}) {
    this._dbg(`[TTS] speak len=${text?.length} "${text?.slice(0,30)}"`);
    const cleaned = this.cleanForTTS(text); if (!cleaned) return;
    this._speakQueue = []; this._currentUtterance = null;
    try { window.speechSynthesis.cancel(); } catch {}
    this._isSpeakingQueue = false; this.isSpeaking = false;
    this.enqueueSpeak(cleaned, opts);
  }
  enqueueSpeak(text, opts = {}) {
    const cleaned = this.cleanForTTS(text); const t = cleaned.trim(); if (!t) return;
    this._dbg(`[TTS] enqueue "${t.slice(0,40)}" q=${this._speakQueue.length} speakingQ=${this._isSpeakingQueue}`);
    this._speakQueue.push({ text: t, opts });
    if (!this._isSpeakingQueue) {
      this.wasListeningBeforeSpeak = this.isListening;
      if (this.isListening && this.recognition) { this.isSpeaking = true; this._isSpeakingQueue = true; this.isListening = false; try { this.recognition.stop(); } catch {} }
      else { this.isSpeaking = true; this._isSpeakingQueue = true; }
      this.onStatus('AIが話しています... マイク一時OFF', 'speaking'); this._playNext();
    }
  }
  _playNext() {
    this._dbg(`[TTS] _playNext q=${this._speakQueue.length}`);
    if (this._speakQueue.length === 0) {
      this._dbg('[TTS] queue empty done'); this._isSpeakingQueue = false; this.isSpeaking = false; this._currentUtterance = null;
      if (this.wasListeningBeforeSpeak) { this.isListening = true; this.wasListeningBeforeSpeak = false; this.onStatus('待機中... 喋ってください', 'on'); setTimeout(() => { if (this.isListening && !this.isSpeaking && this.recognition) { try { this.recognition.start(); } catch {} } }, 400); }
      else { this.onStatus('停止中', 'idle'); }
      return;
    }
    const { text, opts } = this._speakQueue.shift();
    this._dbg(`[TTS] play "${text.slice(0,40)}" voices=${window.speechSynthesis.getVoices().length}`);
    const uttr = new SpeechSynthesisUtterance(text); uttr.lang = opts.lang || this.lang; uttr.rate = opts.rate || 1.1; uttr.pitch = opts.pitch || 1;
  
    const voices = this.getVoices();
    let target = null;
    if (this.preferredVoiceURI) target = voices.find(v => v.voiceURI === this.preferredVoiceURI);
    if (!target) target = voices.find(v => v.lang.startsWith('ja') && v.default) || voices.find(v => v.lang.startsWith('ja')) || voices[0];
    if (target){ uttr.voice = target; uttr.lang = target.lang; }
    
    this._currentUtterance = uttr;
    uttr.onstart = () => { this._dbg(`[TTS] onstart "${text.slice(0,20)}"`); this.isSpeaking = true; this._isSpeakingQueue = true; };
    uttr.onend = () => { this._dbg(`[TTS] onend "${text.slice(0,20)}"`); this._currentUtterance = null; setTimeout(() => this._playNext(), 60); if (opts.onEnd) opts.onEnd(); };
    uttr.onerror = (e) => { this._dbg(`[TTS] onerror ${e.error}`); this._currentUtterance = null; setTimeout(() => this._playNext(), 120); if (opts.onError) opts.onError(e); };
    try { window.speechSynthesis.speak(uttr); } catch (e) { this._dbg('[TTS] speak throw '+e.message); this._playNext(); }
  }
    getVoices(){ return window.speechSynthesis.getVoices(); }
  setPreferredVoice(uri){
    this.preferredVoiceURI = uri;
    try{ localStorage.setItem(this.LS_VOICE, uri); }catch{}
  }
  cancelSpeak() { this.clearQueue(true); }
  clearQueue(restartMic = true) {
    this._dbg(`[TTS] clearQueue restart=${restartMic}`); this._speakQueue = []; this._currentUtterance = null;
    try { window.speechSynthesis.cancel(); } catch {}
    this._isSpeakingQueue = false; this.isSpeaking = false;
    if (restartMic && this.wasListeningBeforeSpeak) { this.isListening = true; this.wasListeningBeforeSpeak = false; setTimeout(() => { if (this.isListening && this.recognition) { try { this.recognition.start(); } catch {} } }, 300); }
  }
  clearBuffer() { this.finalBuffer = ''; this.lastFinalChunk = ''; clearTimeout(this._autoSendTimer); }
}
