/**
 * CronyGO Voice Module - Final v3
 * 2つの大事な処理を内蔵:
 * ① 単語連続なし (連続する同じ言葉を自動除去)
 * ② マイクエコー防止 (AIが喋ってる間は認識を完全停止)
 * 
 * 使い方 (app.js側):
 * import { VoiceManager } from './voice.js';
 * const voice = new VoiceManager({
 *   lang: 'ja-JP',
 *   onFinal: (text) => { inputEl.value = text; sendMessage(); },
 *   onInterim: (text) => { voiceStatusEl.textContent = text; },
 *   onStatus: (text, state) => { statusEl.textContent = text; }
 * });
 * micBtn.addEventListener('click', () => voice.isListening ? voice.stop() : voice.start());
 * // LLM生成後に読み上げたい時
 * voice.speak(aiReplyText);
 */

export class VoiceManager {
  constructor(options = {}) {
    this.lang = options.lang || 'ja-JP';
    this.onFinal = options.onFinal || (() => {});
    this.onInterim = options.onInterim || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.autoRestartDelay = options.autoRestartDelay || 300;

    // 状態
    this.isListening = false;
    this.isSpeaking = false;
    this.wasListeningBeforeSpeak = false;
    this.recognition = null;
    this.finalBuffer = '';
    this.lastFinalChunk = '';

    // ブラウザ対応チェック
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported = !!this.SpeechRecognition;
  }

  // ==============================
  // ① 単語連続なし処理 (大事1)
  // ==============================
  removeConsecutiveDuplicates(text) {
    if (!text || text.length < 2) return text;
    let t = text.trim();

    // パターンA: スペース区切りの連続 (ありがとう ありがとう) -> ありがとう
    t = t.replace(/(\S+)(?:\s+\1)+/g, '$1');

    // パターンB: 日本語の塊の連続 (こんにちはこんにちは -> こんにちは)
    let changed = true;
    while (changed) {
      changed = false;
      const maxLen = Math.min(20, Math.floor(t.length / 2));
      for (let len = maxLen; len >= 1; len--) {
        const a = t.slice(-2 * len, -len);
        const b = t.slice(-len);
        if (a && a === b) {
          t = t.slice(0, -len);
          changed = true;
          break;
        }
      }
    }

    // パターンC: 1文字の異常な連続 (ああああ -> ああ)
    t = t.replace(/(.)\1{2,}/g, '$1$1');

    return t;
  }

  dedupFinalAccumulation(finalText, newChunk) {
    if (!newChunk) return finalText;
    // 同じfinalが2回来るバグ対策 (continuousの定番)
    if (finalText.endsWith(newChunk)) return finalText;
    newChunk = this.removeConsecutiveDuplicates(newChunk);
    let combined = finalText + newChunk;
    combined = this.removeConsecutiveDuplicates(combined);
    return combined;
  }

  init() {
    if (!this.isSupported) {
      this.onStatus('このブラウザは音声認識非対応 (Chrome/Edge推奨)', 'idle');
      return null;
    }

    const rec = new this.SpeechRecognition();
    rec.lang = this.lang;
    rec.continuous = true;      // 永遠に聞く
    rec.interimResults = true;  // 途中結果も出す

    rec.onstart = () => {
      if (!this.isSpeaking) {
        this.onStatus('聞いています... (永遠モード)', 'hearing');
      }
    };

    rec.onresult = (event) => {
      // ===== エコー防止: AIが喋ってる間は文字起こししない =====
      if (this.isSpeaking) return;

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          const before = this.finalBuffer;
          const newText = transcript.trim();
          // 同じ塊が連続で来たら無視
          if (newText === this.lastFinalChunk) continue;

          this.finalBuffer = this.dedupFinalAccumulation(this.finalBuffer, newText);
          this.lastFinalChunk = newText;

          if (this.finalBuffer !== before && this.finalBuffer.length > 0) {
            this.onFinal(this.finalBuffer);
          }
        } else {
          interim += transcript;
        }
      }

      if (interim && !this.isSpeaking) {
        const cleanedInterim = this.removeConsecutiveDuplicates(interim);
        this.onInterim(this.finalBuffer + cleanedInterim, cleanedInterim, this.finalBuffer);
      }
    };

    rec.onend = () => {
      if (this.isSpeaking) return; // AI会話中は再開しない
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

    // マイク許可チェック
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

    try {
      this.recognition.start();
    } catch {
      setTimeout(() => {
        try { this.recognition.start(); } catch {}
      }, 200);
    }
    return true;
  }

  stop() {
    this.isListening = false;
    this.isSpeaking = false;
    this.wasListeningBeforeSpeak = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    this.onStatus('停止中', 'idle');
  }

  // ==============================
  // ② マイクエコー防止処理 (大事2)
  // ==============================
  speak(text, opts = {}) {
    if (!text) return;

    // 読み上げ前にマイクを確実にOFF (エコー防止)
    this.wasListeningBeforeSpeak = this.isListening;
    if (this.isListening && this.recognition) {
      this.isSpeaking = true;
      this.isListening = false;
      try { this.recognition.stop(); } catch {}
    } else {
      this.isSpeaking = true;
    }

    this.onStatus('AIが話しています... マイク一時OFF', 'speaking');

    // 既存の読み上げをキャンセル
    window.speechSynthesis.cancel();

    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = opts.lang || this.lang;
    uttr.rate = opts.rate || 1.1;
    uttr.pitch = opts.pitch || 1;

    // 日本語ボイス優先
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang.startsWith('ja')) || voices[0];
    if (jaVoice) uttr.voice = jaVoice;

    uttr.onstart = () => {
      this.isSpeaking = true;
    };

    uttr.onend = () => {
      this.isSpeaking = false;
      // 元々マイクONだった場合のみ自動で再開
      if (this.wasListeningBeforeSpeak) {
        this.isListening = true;
        this.onStatus('待機中... 喋ってください', 'on');
        setTimeout(() => {
          if (this.isListening && !this.isSpeaking && this.recognition) {
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

  cancelSpeak() {
    window.speechSynthesis.cancel();
    this.isSpeaking = false;
  }

  clearBuffer() {
    this.finalBuffer = '';
    this.lastFinalChunk = '';
  }
}
