// CronyGO i18n - UI strings dictionary + language switching
// Usage: t("key") in JS, data-i18n="key" etc. in HTML.
// Missing keys fall back to Japanese, then to the key itself.
// 今後多言語大変だなー
//やることメモ残しておきます。11月23日現在　専用選択UI、CPUスレッド数自由記載、
const I18N = {
  ja: {
    newChat: "+ 新しいチャット",
    menuAria: "メニュー",
    modelSelectAria: "モデルを選択",
    welcomeBubble: "こんにちは！初回はモデルをダウンロードします。2回目からはオフラインで動きます。WebGPU対応ブラウザが必要です。",
    loadingNotice: "ダウンロード中はフォアグラウンドで表示してください",
    loadingText: "準備中...",
    attachClearAria: "添付を取り消す",
    fileClearAria: "ファイルを取り消す",
    plusFile: "ファイルをアップロード",
    plusImage: "画像を追加",
    plusCamera: "カメラで撮る",
    inputPlaceholder: "モデルをダウンロードしてください",
    attachBtnAria: "追加メニュー",
    attachBtnTitle: "追加",
    settingsAria: "設定",
    statusNotDownloaded: "待機中",
    micAria: "マイク",
    micTitle: "マイク",
    stopAria: "生成を停止",
    stopTitle: "生成を停止",
    sendAria: "送信",
    mpTitle: "モデルを選ぶ",
    closeAria: "閉じる",
    mpFoot: "選択後、再度押していただくとダウンロードが始まります。",
    settingsTitle: "設定",
    groupGeneration: "生成設定",
    sysPromptLabel: "システムプロンプト",
    saveBtn: "保存",
    resetBtn: "リセット",
    genParamsLabel: "生成パラメータ",
    tempDesc: "低い=正確、高い=創造的",
    maxTokensDesc: "1回の返答の長さ",
    fileLimitLabel: "ファイル文字数上限",
    fileLimitDesc: "ファイル添付で読み取る文字数（0=無制限・自己責任）",
    thinkLabel: "Think（思考過程）",
    thinkDesc: "ONの場合、対応モデル（GGUF）の思考過程を回答とは別枠で表示します",
    thinkNote: "※ このスイッチは、ThinkのON/OFFができるモデルのみに対応しています。対応していないモデルでは、OFFにしても思考が続くことがあります。",
    contextLabel: "コンテキスト",
    contextDesc: "会話に保持できる情報量",
    contextWarn: "⚠ 変更後は再ダウンロードしてください",
    threadsLabel: "CPUスレッド数",
    threadsAuto: "自動（端末に合わせる）",
    threadsDesc: "GGUFモデルの推論に使うスレッド数",
    threadsWarn: "⚠ 変更後はモデルを再読込してください",
    repeatLabel: "リピートペナルティ",
    repeatName: "繰り返し抑制",
    repeatDesc: "高いほど同じ単語や表現の繰り返しを抑えます",
    groupLocal: "ローカルモデル (GGUF)",
    localDesc: "サーバーにアップロードせず、端末内のGGUFファイルを直接読み込みます。<br><span style=\"color:var(--accent);\">※大容量モデルはメモリ不足でタブが落ちる場合があります</span>",
    localLoadBtn: "GGUFファイルを選択して読み込む",
    groupCustom: "カスタム",
    langLabel: "言語",
    ttsVoiceLabel: "読み上げ音声",
    ttsTestBtn: "試聴",
    ttsReloadBtn: "再読込",
    bargeInLabel: "読み上げへの割り込み",
    bargeInDesc: "読み上げ中の音声割り込み",
    bgLabel: "チャット背景",
    bgPickBtn: "写真を選ぶ",
    bgClearBtn: "消す",
    groupData: "データ",
    cacheLabel: "モデルキャッシュ",
    cacheUsageLabel: "使用量",
    cacheClearBtn: "キャッシュを削除",
    cacheRefreshBtn: "更新",
    cacheDesc: "消すと再DLが必要になります",
    exportLabel: "会話エクスポート",
    exportDesc: "今開いている会話をファイルに書き出します（画像は含まれません）",
    devConsoleLabel: "開発者コンソール",
    devStateLabel: "状態",
    groupAbout: "CronyGOについて",
    tutTitle: "<span class=\"brand-font\">CronyGO</span>へようこそ!!",
    tutP1: "本サイトでは、Web上でさまざまなAIをローカルで動かすことができます。",
    tutP2: "まずはモデル名をタップしてモデルを選択してみましょう。もう一度押すことでダウンロードが始まります。",
    tutP3: "Smollm,LFMなどが特に軽量なモデルです。",
    tutP4: "<strong>MLC</strong>と書いてあるモデルは、古いOSや端末では動かない場合があります。(WebGPUを使用するため)",
    tutP5: "反対に、<strong>GGUF</strong>と書かれているモデルは比較的古い端末でも動く可能性があります。まずは<strong>LFM2.5 350M</strong>をダウンロードすることをおすすめします。",
    tutP6: "余裕があったら多言語対応の<strong>Qwen</strong>シリーズなどもオススメです。",
    tutP7: "また、自分の端末から直接モデルファイルをアップロードすることもできます。",
    tutStartBtn: "はじめる"
  },
  en: {
    newChat: "+ New Chat",
    menuAria: "Menu",
    modelSelectAria: "Select a model",
    welcomeBubble: "Hello! The first time, you will download a model. After that, it works offline. A WebGPU-capable browser is required.",
    loadingNotice: "Please keep this page in the foreground while downloading",
    loadingText: "Preparing...",
    attachClearAria: "Remove attachment",
    fileClearAria: "Remove file",
    plusFile: "Upload a file",
    plusImage: "Add an image",
    plusCamera: "Take a photo",
    inputPlaceholder: "Please download a model",
    attachBtnAria: "Add menu",
    attachBtnTitle: "Add",
    settingsAria: "Settings",
    statusNotDownloaded: "Not downloaded",
    micAria: "Microphone",
    micTitle: "Microphone",
    stopAria: "Stop generating",
    stopTitle: "Stop generating",
    sendAria: "Send",
    mpTitle: "Choose a model",
    closeAria: "Close",
    mpFoot: "Tap once to select, then tap the same model again to start the download.",
    settingsTitle: "Settings",
    groupGeneration: "Generation",
    sysPromptLabel: "System Prompt",
    saveBtn: "Save",
    resetBtn: "Reset",
    genParamsLabel: "Generation Parameters",
    tempDesc: "Lower = more precise, higher = more creative",
    maxTokensDesc: "Length of one reply",
    fileLimitLabel: "File character limit",
    fileLimitDesc: "Characters read from attached files (0 = unlimited, at your own risk)",
    thinkLabel: "Think (reasoning)",
    thinkDesc: "When ON, the reasoning of supported models (GGUF) is shown in a separate block from the answer",
    thinkNote: "Note: this switch only works with models that support Think ON/OFF. On unsupported models, reasoning may continue even when OFF.",
    contextLabel: "Context",
    contextDesc: "How much of the conversation is kept in memory",
    contextWarn: "⚠ Please re-download after changing this",
    threadsLabel: "CPU Threads",
    threadsAuto: "Auto (match device)",
    threadsDesc: "Threads used for GGUF model inference",
    threadsWarn: "⚠ Please reload the model after changing this",
    repeatLabel: "Repeat Penalty",
    repeatName: "Repetition suppression",
    repeatDesc: "Higher values suppress repeated words and phrases",
    groupLocal: "Local Model (GGUF)",
    localDesc: "Loads GGUF files directly from your device, without uploading them to a server.<br><span style=\"color:var(--accent);\">* Large models may crash the tab if memory runs out</span>",
    localLoadBtn: "Select and load a GGUF file",
    groupCustom: "Custom",
    langLabel: "Language",
    ttsVoiceLabel: "Text-to-Speech Voice",
    ttsTestBtn: "Preview",
    ttsReloadBtn: "Reload",
    bargeInLabel: "Barge-in during speech",
    bargeInDesc: "When ON, you can interrupt the AI while it is speaking, using your voice. May misfire in noisy environments",
    bgLabel: "Chat Background",
    bgPickBtn: "Choose a photo",
    bgClearBtn: "Remove",
    groupData: "Data",
    cacheLabel: "Model Cache",
    cacheUsageLabel: "Usage",
    cacheClearBtn: "Delete cache",
    cacheRefreshBtn: "Refresh",
    cacheDesc: "Deleting the cache requires re-downloading",
    exportLabel: "Export Conversation",
    exportDesc: "Saves the currently open conversation to a file (images are not included)",
    devConsoleLabel: "Developer Console",
    devStateLabel: "State",
    groupAbout: "About CronyGO",
    tutTitle: "Welcome to <span class=\"brand-font\">CronyGO</span>!!",
    tutP1: "On this site, you can run a variety of AI models locally, right on the web.",
    tutP2: "First, tap a model name to select it. Tap it once more to start the download.",
    tutP3: "Models such as SmolLM and LFM are especially lightweight.",
    tutP4: "Models marked <strong>MLC</strong> may not run on older OSes or devices (they use WebGPU).",
    tutP5: "In contrast, models marked <strong>GGUF</strong> may work even on relatively old devices. We recommend downloading <strong>LFM2.5 350M</strong> first.",
    tutP6: "If you have room to spare, the multilingual <strong>Qwen</strong> series is also a great choice.",
    tutP7: "You can also upload model files directly from your own device.",
    tutStartBtn: "Get Started"
  }
};

const LANG_KEY = "cronygo_lang";

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && I18N[saved]) return saved;
  } catch (e) {}
  const nav = (navigator.language || "ja").toLowerCase();
  return nav.startsWith("ja") ? "ja" : "en";
}

let currentLang = detectLang();

export function getLang() { return currentLang; }

export function t(key) {
  const dict = I18N[currentLang];
  if (dict && dict[key] != null) return dict[key];
  if (I18N.ja[key] != null) return I18N.ja[key];
  return key;
}

export function applyI18n() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll(".lang-select").forEach((s) => { s.value = currentLang; });
}

export function setLang(v) {
  if (!I18N[v]) return;
  currentLang = v;
  try { localStorage.setItem(LANG_KEY, v); } catch (e) {}
  applyI18n();
}

export function initI18n() {
  applyI18n();
  document.querySelectorAll(".lang-select").forEach((s) => {
    s.addEventListener("change", (e) => setLang(e.target.value));
  });
}
