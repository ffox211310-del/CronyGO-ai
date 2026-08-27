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
  }

  _dbg(msg) {
    try {
      if (window.__cronyDbg) window.__cronyDbg(msg);
      console.log(msg);
    } catch {}
  }

  removeConsecutiveDuplicates(text) {
    if (!text || text.length < 2) return text;
    let t = text.trim();
    t = t.replace(/(\S+)(?:\s+\1)+/g, '$1');
    t = t.replace(/(.{2,20})\1$/g, '$1');
    t = t.replace(/(.)\1{3,}/g, '$1$1');
    return t;
  }

  init() {
    if (!this.isSupported) {
      this.onStatus('このブラウザは音声認識非対応 (Chrome/Edge推奨)', 'idle');
      this._dbg('[Voice] not supported');
      return null;
    }
    const rec = new this.SpeechRecognition();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      this._dbg('[Voice] onstart hearing');
      if (!this.isSpeaking) this.onStatus('聞いています... (永遠モード)', 'hearing');
    };
    rec.onresult = (event) => {
      if (this.isSpeaking) return;
      let fullFinal = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal) fullFinal += transcript;
        else interim += transcript;
      }
      fullFinal = this.removeConsecutiveDuplicates(fullFinal);
      if (fullFinal && fullFinal !== this.finalBuffer) {
        this.finalBuffer = fullFinal;
        this.onFinal(this.finalBuffer);
        if (this.onAutoSend) {
          clearTimeout(this._autoSendTimer);
          this._autoSendTimer = setTimeout(() => {
            if (this.finalBuffer) this.onAutoSend(this.finalBuffer);
          }, this.autoSendDelay);
        }
      }
      if (interim) {
        const cleanedInterim = this.removeConsecutiveDuplicates(interim);
        this.onInterim(this.finalBuffer + cleanedInterim, cleanedInterim, this.finalBuffer);
      } else if (fullFinal) {
        this.onInterim(fullFinal, '', fullFinal);
      }
    };
    rec.onend = () => {
      this._dbg(`[Voice] onend isSpeaking=${this.isSpeaking} isListening=${this.isListening}`);
      if (this.isSpeaking) return;
      if (this.isListening) {
        this.onStatus('再接続中...', 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking) {
            try { rec.start(); } catch (e) { this._dbg('[Voice] restart fail '+e.message); }
          }
        }, this.autoRestartDelay);
      } else {
        this.onStatus('停止中', 'idle');
      }
    };
    rec.onerror = (e) => {
      this._dbg(`[Voice] onerror ${e.error} ${e.message||''}`);
      console.error('[Voice]', e);
      if (e.error === 'not-allowed') {
        this.isListening = false;
        this.onStatus('マイク許可が必要です', 'idle');
      } else if (!this.isSpeaking && this.isListening) {
        this.onStatus(`再接続中... (${e.error})`, 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking) {
            try { rec.start(); } catch (e2) { this._dbg('[Voice] restart fail2 '+e2.message); }
          }
        }, 800);
      }
    };
    this.recognition = rec;
    return rec;
  }

  async start() {
    this._dbg('[Voice] start() called');
    if (!this.isSupported) {
      alert('このブラウザは音声認識に対応していません。Chrome / Edge で開いてください。');
      return false;
    }
    if (!this.recognition) this.init();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      this._dbg('[Voice] getUserMedia ok');
    } catch (e) {
      this._dbg('[Voice] getUserMedia FAIL '+e.message);
      alert('マイク許可が必要です: ' + e.message);
      this.onStatus('マイク許可なし', 'idle');
      return false;
    }
    this.isListening = true;
    this.isSpeaking = false;
    this.finalBuffer = '';
    this.lastFinalChunk = '';
    this.wasListeningBeforeSpeak = false;
    clearTimeout(this._autoSendTimer);
    try { this.recognition.start(); this._dbg('[Voice] recognition.start ok'); } catch (e) {
      this._dbg('[Voice] recognition.start FAIL '+e.message);
      setTimeout(() => { try { this.recognition.start(); } catch (e2) { this._dbg('[Voice] retry start FAIL '+e2.message); } }, 200);
    }
    return true;
  }

  stop() {
    this._dbg('[Voice] stop()');
    this.isListening = false;
    this.isSpeaking = false;
    this.wasListeningBeforeSpeak = false;
    clearTimeout(this._autoSendTimer);
    if (this.recognition) try { this.recognition.stop(); } catch {}
    this.clearQueue(false);
    this.onStatus('停止中', 'idle');
  }

  speak(text, opts = {}) {
    this._dbg(`[TTS] speak() called len=${text?.length} text=${text?.slice(0,30)}`);
    if (!text) { this._dbg('[TTS] speak empty skip'); return; }
    this._speakQueue = [];
    this._currentUtterance = null;
    try { window.speechSynthesis.cancel(); } catch(e){ this._dbg('[TTS] cancel FAIL '+e.message); }
    this._isSpeakingQueue = false;
    this.isSpeaking = false;
    this.enqueueSpeak(text, opts);
  }

  enqueueSpeak(text, opts = {}) {
    const t = text.trim();
    if (!t) { this._dbg('[TTS] enqueue empty skip'); return; }
    this._dbg(`[TTS] enqueue "${t.slice(0,40)}" queueLen=${this._speakQueue.length} isSpeakingQueue=${this._isSpeakingQueue} isListening=${this.isListening}`);
    this._speakQueue.push({ text: t, opts });
    if (!this._isSpeakingQueue) {
      this.wasListeningBeforeSpeak = this.isListening;
      if (this.isListening && this.recognition) {
        this.isSpeaking = true;
        this._isSpeakingQueue = true;
        this.isListening = false;
        try { this.recognition.stop(); } catch(e){ this._dbg('[TTS] rec stop FAIL '+e.message); }
      } else {
        this.isSpeaking = true;
        this._isSpeakingQueue = true;
      }
      this.onStatus('AIが話しています...', 'speaking');
      this._playNext();
    }
  }

  _playNext() {
    this._dbg(`[TTS] _playNext queueLen=${this._speakQueue.length}`);
    if (this._speakQueue.length === 0) {
      this._dbg('[TTS] queue empty -> done');
      this._isSpeakingQueue = false;
      this.isSpeaking = false;
      this._currentUtterance = null;
      if (this.wasListeningBeforeSpeak) {
        this.isListening = true;
        this.wasListeningBeforeSpeak = false;
        this.onStatus('待機中... 喋ってください', 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking && this.recognition) {
            try { this.recognition.start(); } catch(e){ this._dbg('[TTS] rec restart FAIL '+e.message); }
          }
        }, 400);
      } else {
        this.onStatus('停止中', 'idle');
      }
      return;
    }

    const { text, opts } = this._speakQueue.shift();
    this._dbg(`[TTS] trying to play "${text.slice(0,40)}" voices=${window.speechSynthesis.getVoices().length} speaking=${window.speechSynthesis.speaking} pending=${window.speechSynthesis.pending}`);

    // speechSynthesis チェック
    if (!window.speechSynthesis) {
      this._dbg('[TTS] speechSynthesis NOT EXISTS');
      this._playNext();
      return;
    }

    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = opts.lang || this.lang;
    uttr.rate = opts.rate || 1.1;
    uttr.pitch = opts.pitch || 1;

    const voices = window.speechSynthesis.getVoices();
    this._dbg(`[TTS] voices.length=${voices.length}`);
    if (voices.length > 0) {
      const jaVoice = voices.find(v => v.lang.startsWith('ja')) || voices[0];
      if (jaVoice) {
        uttr.voice = jaVoice;
        this._dbg(`[TTS] using voice ${jaVoice.name} ${jaVoice.lang}`);
      }
    } else {
      this._dbg('[TTS] voices empty, using default');
    }

    this._currentUtterance = uttr;
    uttr.onstart = () => {
      this._dbg(`[TTS] onstart "${text.slice(0,30)}"`);
      this.isSpeaking = true;
      this._isSpeakingQueue = true;
    };
    uttr.onend = () => {
      this._dbg(`[TTS] onend "${text.slice(0,30)}"`);
      this._currentUtterance = null;
      setTimeout(() => this._playNext(), 80);
      if (opts.onEnd) opts.onEnd();
    };
    uttr.onerror = (e) => {
      this._dbg(`[TTS] onerror ${e.error} "${text.slice(0,30)}"`);
      console.error('[TTS error]', e);
      this._currentUtterance = null;
      setTimeout(() => this._playNext(), 150);
      if (opts.onError) opts.onError(e);
    };
    try {
      window.speechSynthesis.speak(uttr);
      this._dbg('[TTS] speak() called, now speaking='+window.speechSynthesis.speaking);
      // 100ms後にまだspeakingでなければ失敗とみなす
      setTimeout(()=>{
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          this._dbg('[TTS] still NOT speaking after 100ms -> maybe blocked');
        }
      }, 150);
    } catch(e) {
      this._dbg('[TTS] speak() THROW '+e.message);
      this._playNext();
    }
  }

  cancelSpeak() { this._dbg('[TTS] cancelSpeak'); this.clearQueue(true); }

  clearQueue(restartMic = true) {
    this._dbg(`[TTS] clearQueue restartMic=${restartMic} qLen=${this._speakQueue.length}`);
    this._speakQueue = [];
    this._currentUtterance = null;
    try { window.speechSynthesis.cancel(); } catch(e){ this._dbg('[TTS] cancel in clearQueue FAIL '+e.message); }
    this._isSpeakingQueue = false;
    this.isSpeaking = false;
    if (restartMic && this.wasListeningBeforeSpeak) {
      this.isListening = true;
      this.wasListeningBeforeSpeak = false;
      setTimeout(() => {
        if (this.isListening && this.recognition) {
          try { this.recognition.start(); } catch(e){ this._dbg('[TTS] rec restart after clear FAIL '+e.message); }
        }
      }, 300);
    }
  }

  clearBuffer() { this.finalBuffer = ''; this.lastFinalChunk = ''; clearTimeout(this._autoSendTimer); }
}
