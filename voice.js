export class VoiceManager {
  constructor(options = {}) {
    this.lang = options.lang || 'ja-JP';
    this.onFinal = options.onFinal || (() => {});
    this.onInterim = options.onInterim || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onAutoSend = options.onAutoSend || null; // ★自動送信コールバック
    this.autoRestartDelay = options.autoRestartDelay || 300;
    this.autoSendDelay = options.autoSendDelay || 1200; // ★無音で自動送信

    this.isListening = false;
    this.isSpeaking = false;
    this.wasListeningBeforeSpeak = false;
    this.recognition = null;
    this.finalBuffer = '';
    this.lastFinalChunk = '';
    this._autoSendTimer = null;

    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported =!!this.SpeechRecognition;
  }

  removeConsecutiveDuplicates(text) {
    if (!text || text.length < 2) return text;
    let t = text.trim();
    t = t.replace(/(\S+)(?:\s+\1)+/g, '$1');
    // 日本語の塊の重複は末尾2回だけ見る、過激なループはやめる
    t = t.replace(/(.{2,20})\1$/g, '$1');
    t = t.replace(/(.)\1{3,}/g, '$1$1');
    return t;
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

      // ★ここが重要: 毎回全resultsから組み立て直す
      let fullFinal = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal) {
          fullFinal += transcript;
        } else {
          interim += transcript;
        }
      }

      fullFinal = this.removeConsecutiveDuplicates(fullFinal);

      // finalが更新された時だけ
      if (fullFinal && fullFinal!== this.finalBuffer) {
        this.finalBuffer = fullFinal;
        this.onFinal(this.finalBuffer);

        // ★自動送信は無音1.2秒後に1回だけ
        if (this.onAutoSend) {
          clearTimeout(this._autoSendTimer);
          this._autoSendTimer = setTimeout(() => {
            if (this.finalBuffer) {
              this.onAutoSend(this.finalBuffer);
            }
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
          if (this.isListening &&!this.isSpeaking) {
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
          if (this.isListening &&!this.isSpeaking) {
            try { rec.start(); } catch {}
          }
        }, 800);
      }
    };

    this.recognition = rec;
    return rec;
  }

  async start() { /* ここは同じでOK */
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
    this.onStatus('停止中', 'idle');
  }

  speak(text, opts = {}) {
    if (!text) return;
    this.wasListeningBeforeSpeak = this.isListening;
    if (this.isListening && this.recognition) {
      this.isSpeaking = true;
      this.isListening = false;
      try { this.recognition.stop(); } catch {}
    } else {
      this.isSpeaking = true;
    }
    clearTimeout(this._autoSendTimer);
    this.onStatus('AIが話しています... マイク一時OFF', 'speaking');
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = opts.lang || this.lang;
    uttr.rate = opts.rate || 1.1;
    uttr.pitch = opts.pitch || 1;
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang.startsWith('ja')) || voices[0];
    if (jaVoice) uttr.voice = jaVoice;
    uttr.onstart = () => { this.isSpeaking = true; };
    uttr.onend = () => {
      this.isSpeaking = false;
      if (this.wasListeningBeforeSpeak) {
        this.isListening = true;
        this.onStatus('待機中... 喋ってください', 'on');
        setTimeout(() => {
          if (this.isListening &&!this.isSpeaking && this.recognition) {
            try { this.recognition.start(); } catch {}
          }
        }, 400);
      } else {
        this.onStatus('停止中', 'idle');
      }
      if (opts.onEnd) opts.onEnd();
    };
    uttr.onerror = (e) => {
      console.error('[TTS error]', e);
      this.isSpeaking = false;
      if (this.wasListeningBeforeSpeak) {
        this.isListening = true;
        try { this.recognition.start(); } catch {}
      }
      if (opts.onError) opts.onError(e);
    };
    window.speechSynthesis.speak(uttr);
  }

  cancelSpeak() { window.speechSynthesis.cancel(); this.isSpeaking = false; }
  clearBuffer() { this.finalBuffer = ''; this.lastFinalChunk = ''; clearTimeout(this._autoSendTimer); }
}
