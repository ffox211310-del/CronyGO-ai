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

  removeConsecutiveDuplicates(text) {
    if (!text || text.length < 2) return text;
    let t = text.trim();

    // 1. 同じ文字が4回以上続く -> 2回に圧縮 (例: ああああ -> ああ)
    t = t.replace(/(.)\1{3,}/g, '$1$1');

    // 2. 即時連結の重複を潰す: AIAI -> AI, こんにちはこんにちは -> こんにちは
    // 長さ2〜30の塊が直後にそのまま続くケース
    let prev;
    do {
      prev = t;
      // 英字・英数2文字以上の即時重複 (AI AI など)
      t = t.replace(/([A-Za-z]{2,})(\1)+/g, '$1');
      // 汎用: 任意2文字以上の塊がすぐ続く
      t = t.replace(/(.{2,30})\1+/g, '$1');
    } while (t !== prev);

    // 3. 空白・句読点区切りの重複を潰す: "AIとは？ AIとは？" -> "AIとは？"
    do {
      prev = t;
      // スペース区切り
      t = t.replace(/(.{2,50}?)\s+\1/g, '$1');
      // 全角スペース区切り
      t = t.replace(/(.{2,50}?)[\s　]+\1/g, '$1');
      // 句読点・？！区切りで同じ文が続く
      t = t.replace(/(.{2,50}?)[。！？？！\s　、，,]+\1/g, '$1');
    } while (t !== prev);

    // 4. 文単位で連続同一文を除去: "こんにちは。こんにちは。" -> "こんにちは。"
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

    // 5. 末尾の重複最終保険
    t = t.replace(/(.{2,50})\1$/g, '$1');

    return t.trim();
  }

  init() {
    if (!this.isSupported) {
      this.onStatus('このブラウザは音声認識非対応 (Chrome/Edge推奨)', 'idle');
      return null;
    }
    const rec = new this.SpeechRecognition();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
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
      if (this.isSpeaking) return;
      if (this.isListening) {
        this.onStatus('再接続中...', 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking) {
            try { rec.start(); } catch {}
          }
        }, this.autoRestartDelay);
      } else {
        this.onStatus('停止中', 'idle');
      }
    };

    rec.onerror = (e) => {
      console.error('[Voice]', e);
      if (e.error === 'not-allowed') {
        this.isListening = false;
        this.onStatus('マイク許可が必要です', 'idle');
      } else if (!this.isSpeaking && this.isListening) {
        this.onStatus(`再接続中... (${e.error})`, 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking) {
            try { rec.start(); } catch {}
          }
        }, 800);
      }
    };

    this.recognition = rec;
    return rec;
  }

  async start() {
    if (!this.isSupported) {
      alert('このブラウザは音声認識に対応していません。Chrome / Edge で開いてください。');
      return false;
    }
    if (!this.recognition) this.init();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
    } catch (e) {
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
    try { this.recognition.start(); } catch {
      setTimeout(() => { try { this.recognition.start(); } catch {} }, 200);
    }
    return true;
  }

  stop() {
    this.isListening = false;
    this.isSpeaking = false;
    this.wasListeningBeforeSpeak = false;
    clearTimeout(this._autoSendTimer);
    if (this.recognition) try { this.recognition.stop(); } catch {}
    this.clearQueue(false);
    this.onStatus('停止中', 'idle');
  }

  speak(text, opts = {}) {
    if (!text) return;
    this._speakQueue = [];
    this._currentUtterance = null;
    try { window.speechSynthesis.cancel(); } catch {}
    this._isSpeakingQueue = false;
    this.isSpeaking = false;
    this.enqueueSpeak(text, opts);
  }

  enqueueSpeak(text, opts = {}) {
    const t = text.trim();
    if (!t) return;
    this._speakQueue.push({ text: t, opts });
    if (!this._isSpeakingQueue) {
      this.wasListeningBeforeSpeak = this.isListening;
      if (this.isListening && this.recognition) {
        this.isSpeaking = true;
        this._isSpeakingQueue = true;
        this.isListening = false;
        try { this.recognition.stop(); } catch {}
      } else {
        this.isSpeaking = true;
        this._isSpeakingQueue = true;
      }
      this.onStatus('AIが話しています... マイク一時OFF', 'speaking');
      this._playNext();
    }
  }

  _playNext() {
    if (this._speakQueue.length === 0) {
      this._isSpeakingQueue = false;
      this.isSpeaking = false;
      this._currentUtterance = null;
      if (this.wasListeningBeforeSpeak) {
        this.isListening = true;
        this.wasListeningBeforeSpeak = false;
        this.onStatus('待機中... 喋ってください', 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking && this.recognition) {
            try { this.recognition.start(); } catch {}
          }
        }, 400);
      } else {
        this.onStatus('停止中', 'idle');
      }
      return;
    }

    const { text, opts } = this._speakQueue.shift();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = opts.lang || this.lang;
    uttr.rate = opts.rate || 1.1;
    uttr.pitch = opts.pitch || 1;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const jaVoice = voices.find(v => v.lang.startsWith('ja')) || voices[0];
      if (jaVoice) uttr.voice = jaVoice;
    }

    this._currentUtterance = uttr;
    uttr.onstart = () => { this.isSpeaking = true; this._isSpeakingQueue = true; };
    uttr.onend = () => {
      this._currentUtterance = null;
      setTimeout(() => this._playNext(), 60);
      if (opts.onEnd) opts.onEnd();
    };
    uttr.onerror = (e) => {
      console.error('[TTS error]', e);
      this._currentUtterance = null;
      setTimeout(() => this._playNext(), 120);
      if (opts.onError) opts.onError(e);
    };
    try { window.speechSynthesis.speak(uttr); } catch { this._playNext(); }
  }

  cancelSpeak() { this.clearQueue(true); }

  clearQueue(restartMic = true) {
    this._speakQueue = [];
    this._currentUtterance = null;
    try { window.speechSynthesis.cancel(); } catch {}
    this._isSpeakingQueue = false;
    this.isSpeaking = false;
    if (restartMic && this.wasListeningBeforeSpeak) {
      this.isListening = true;
      this.wasListeningBeforeSpeak = false;
      setTimeout(() => {
        if (this.isListening && this.recognition) {
          try { this.recognition.start(); } catch {}
        }
      }, 300);
    }
  }

  clearBuffer() { this.finalBuffer = ''; this.lastFinalChunk = ''; clearTimeout(this._autoSendTimer); }
}
