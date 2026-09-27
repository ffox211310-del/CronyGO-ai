import * as webllm from "@mlc-ai/web-llm";
import { VoiceManager } from "./voice.js";
import {
  loadHistory,
  saveMessage,
  loadMemory,
  saveMemory,
  createMemory,
  clearHistory
} from "./memory.js";


/* ========================================
   WebLLM
======================================== */

const MODELS = {
  small:
    "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",

  medium:
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",

  large:
    "Qwen2.5-3B-Instruct-q4f16_1-MLC"
};

const MODEL_KEY =
  "personal_ai_model";

const DEFAULT_MODEL =
  "medium";

const selectedModel =
  localStorage.getItem(MODEL_KEY)
  || DEFAULT_MODEL;

const MODEL_ID =
  MODELS[selectedModel];

let engine = null;
let busy = false;
let voice = null;
let voiceMode = false;

/* ========================================
   DOM
======================================== */

const bot =
  document.getElementById("bot");

const bubble =
  document.getElementById("bubble");

const input =
  document.getElementById("input");

const micButton =
  document.getElementById("micButton");

const settingsPanel =
  document.getElementById("settingsPanel");

const modelOptions =
  document.querySelectorAll(".model-option");

const settingsCurrent =
  document.getElementById("settingsCurrent");

const reloadButton =
  document.getElementById("reloadButton");

const settingsClose =
  document.getElementById("settingsClose");

const MODEL_NAMES = {
  small: "小",
  medium: "中",
  large: "大"
};


function updateModelUI() {

  const current =
    localStorage.getItem(MODEL_KEY)
    || DEFAULT_MODEL;

  modelOptions.forEach(button => {

    button.classList.toggle(
      "selected",
      button.dataset.model === current
    );

  });

  settingsCurrent.textContent =
    "現在：" + MODEL_NAMES[current];

}


modelOptions.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const model =
        button.dataset.model;

      localStorage.setItem(
        MODEL_KEY,
        model
      );

      updateModelUI();

    }
  );

});


updateModelUI();

/* ========================================
   設定パネル
======================================== */

bot.addEventListener(
  "click",
  () => {

    settingsPanel.classList.toggle("open");

  }
);

reloadButton.addEventListener(
  "click",
  () => {

    location.reload();

  }
);

settingsClose.addEventListener(
  "click",
  () => {

    settingsPanel.classList.remove("open");

  }
);
// 新DOM
const deviceLangInfo = document.getElementById("deviceLangInfo");
const voiceSelect = document.getElementById("voiceSelect");
const voiceCurrent = document.getElementById("voiceCurrent");
const voiceTestButton = document.getElementById("voiceTestButton");

function refreshDeviceInfo() {
  const primary = navigator.language;
  const all = (navigator.languages || [primary]).join(", ");
  const count = voice? voice.getVoices().length : 0;
  deviceLangInfo.innerHTML = `端末言語: <b>${primary}</b><br>対応言語: ${all}<br>利用可能な声: ${count}件`;
}

function populateVoices() {
  const voices = voice.getVoices();
  if (!voices.length) {
    voiceSelect.innerHTML = '<option>読み込み中...</option>';
    return;
  }
  const sorted = [...voices].sort((a,b) => {
    if(a.lang.startsWith("ja") &&!b.lang.startsWith("ja")) return -1;
    if(!a.lang.startsWith("ja") && b.lang.startsWith("ja")) return 1;
    return a.lang.localeCompare(b.lang);
  });
  voiceSelect.innerHTML = "";
  sorted.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})${v.default? " ★" : ""}`;
    opt.dataset.lang = v.lang;
    voiceSelect.appendChild(opt);
  });
  const savedURI = localStorage.getItem("personal_ai_voice_uri");
  if(savedURI) voiceSelect.value = savedURI;
  else {
    const ja = sorted.find(v => v.lang.startsWith("ja"));
    if(ja) voiceSelect.value = ja.voiceURI;
  }
  voiceCurrent.textContent = `現在: ${voiceSelect.selectedOptions[0]?.textContent}`;
}

voiceSelect.addEventListener("change", () => {
  voice.setVoiceByURI(voiceSelect.value);
  voiceCurrent.textContent = `現在: ${voiceSelect.selectedOptions[0]?.textContent}`;
});

voiceTestButton.addEventListener("click", async () => {
  const lang = voiceSelect.selectedOptions[0]?.dataset?.lang || "ja-JP";
  let txt = "こんにちは。こちらが選択中の声です。";
  if(!lang.startsWith("ja")) txt = "Hello, this is the selected voice.";
  await voice.speak(txt);
});

// voicesは非同期で来るので
speechSynthesis.onvoiceschanged = () => {
  populateVoices();
  refreshDeviceInfo();
};

// 設定パネル開いた時にも更新
bot.addEventListener("click", () => {
  if(settingsPanel.classList.contains("open")) {
    refreshDeviceInfo();
    populateVoices();
  }
});

/* ========================================
   初回案内
======================================== */

const introOverlay =
  document.getElementById("introOverlay");

const introStart =
  document.getElementById("introStart");

const INTRO_KEY =
  "personal_ai_intro_seen";


function closeIntro() {

  introOverlay.classList.add("hidden");

  localStorage.setItem(
    INTRO_KEY,
    "true"
  );
}


if (
  localStorage.getItem(INTRO_KEY) === "true"
) {

  introOverlay.classList.add("hidden");

}


introStart.addEventListener(
  "click",
  closeIntro
);

/* ========================================
   会話履歴
======================================== */

let history = loadHistory();


/* ========================================
   星空
======================================== */

(function createStars() {

  const box =
    document.getElementById("stars");

  for (let i = 0; i < 50; i++) {

    const star =
      document.createElement("div");

    star.className = "star";

    star.style.left =
      Math.random() * 100 + "%";

    star.style.top =
      Math.random() * 100 + "%";

    star.style.animationDelay =
      (Math.random() * 5).toFixed(2) + "s";

    star.style.opacity =
      (0.1 + Math.random() * 0.4)
        .toFixed(2);

    box.appendChild(star);
  }

})();


/* ========================================
   瞬き
======================================== */

const eyes =
  document.querySelectorAll(".eye");

function blink() {

  if (
    bot.classList.contains("speaking")
  ) {
    return;
  }

  eyes.forEach(e =>
    e.classList.add("blink")
  );

  setTimeout(() => {

    eyes.forEach(e =>
      e.classList.remove("blink")
    );

  }, 120);
}

(function blinkLoop() {

  setTimeout(() => {

    blink();

    if (Math.random() < 0.25) {
      setTimeout(blink, 240);
    }

    blinkLoop();

  }, 1800 + Math.random() * 3000);

})();


/* ========================================
   喋っている状態
======================================== */

let speakTimer = null;

function startSpeaking() {

  clearTimeout(speakTimer);

  bot.classList.add("speaking");
}

function stopSpeaking(delay = 100) {

  clearTimeout(speakTimer);

  speakTimer = setTimeout(() => {

    bot.classList.remove("speaking");

  }, delay);
}


/* ========================================
   テロップ
======================================== */

function showText(
  text,
  speed = 0.045
) {

  clearTimeout(speakTimer);

  bubble.classList.remove("fade-out");
  bubble.classList.remove("loading");

  bubble.innerHTML = "";

  startSpeaking();

  const chars = [...text];

  chars.forEach((ch, i) => {

    const span =
      document.createElement("span");

    span.textContent = ch;

    span.style.animationDelay =
      (i * speed).toFixed(2) + "s";

    bubble.appendChild(span);

  });

  const totalMs =
    chars.length * speed * 1000 + 700;

  speakTimer = setTimeout(() => {

    bot.classList.remove("speaking");

  }, totalMs);
}


/* ========================================
   フェードアウト
======================================== */

async function fadeOutText() {

  bubble.classList.add("fade-out");

  await new Promise(resolve =>
    setTimeout(resolve, 400)
  );

  bubble.innerHTML = "";

  bubble.classList.remove(
    "fade-out"
  );
}


/* ========================================
   ステータス
======================================== */

function showStatus(text) {

  clearTimeout(speakTimer);

  bot.classList.remove("speaking");

  bubble.innerHTML = "";

  bubble.classList.add("loading");

  bubble.textContent = text;
}


/* ========================================
   WebLLMロード
======================================== */

async function loadModel() {

  try {

    showStatus(
      "AIを起動しています…"
    );

    engine =
      await webllm.CreateMLCEngine(
        MODEL_ID,
        {
          initProgressCallback:
            progress => {

              const text =
                progress.text || "";

              console.log(
                "[WebLLM]",
                text
              );

              if (
                text.includes("Loading") ||
                text.includes("loading")
              ) {

                showStatus(
                  "AIを準備しています…"
                );

              } else if (
                text.includes("Fetching") ||
                text.includes("fetch")
              ) {

                showStatus(
                  "AIを迎えにいっています…"
                );

              } else {

                showStatus(
                  "もうすぐ話せるよ…"
                );
              }

            }
        }
      );

    showText(
      "準備できたよ。今日は、どうだった？"
    );

    input.disabled = false;

  } catch (error) {

    console.error(error);

    showStatus(
      "AIの起動に失敗しちゃった…"
    );

  }
}


/* ========================================
   終了ワード
======================================== */

function isEndCommand(text) {

  const commands = [
    "今日は終了",
    "今日はおやすみ"
  ];

  return commands.includes(
    text.trim()
  );
}


/* ========================================
   記憶整理
======================================== */

async function finishDay() {

  busy = true;
  input.disabled = true;

  await fadeOutText();

  showStatus(
    "今日の記憶を整理中…"
  );

  try {

    /*
     * 今日の会話をQwenに要約させる
     */

    const memory =
      await createMemory(
        engine,
        history
      );

    /*
     * 保存
     */

    saveMemory(memory);

    /*
     * 今回の履歴は役目を終えたので削除
     */

    clearHistory();

    history = [];

    await fadeOutText();

    showText(
      "今日のこと、覚えておくね。"
    );

    /*
     * テロップを少し見せる
     */

    await new Promise(resolve =>
      setTimeout(resolve, 1800)
    );

    /*
     * CronyGOへ移動
     */

    window.location.href =
      "https://cronygo.vercel.app";

  } catch (error) {

    console.error(
      "Memory error:",
      error
    );

    await fadeOutText();

    showText(
      "ごめん、今日は記憶を整理できなかった…"
    );

    busy = false;
    input.disabled = false;
  }
}


/* ========================================
   AIに質問
======================================== */

async function askAI(text) {

  if (!engine) {
    return;
  }

  busy = true;
  input.disabled = true;
 
  let answer = "";


  /* ---------- ユーザー発話 ---------- */

  await fadeOutText();

  showText(
    "「" + text + "」",
    0.025
  );

  /*
   * 履歴へ保存
   */

  saveMessage(
    "user",
    text
  );

  history.push({
    role: "user",
    content: text
  });


  /* ---------- 少し間 ---------- */

  await new Promise(resolve =>
    setTimeout(resolve, 500)
  );


  /* ---------- 思考 ---------- */

  await fadeOutText();

  showStatus(
    "考えているよ…"
  );


  try {

    /*
     * 前回の記憶
     */

    const memory =
      loadMemory();


    /*
     * システムプロンプト
     */

    const systemPrompt =
      "あなたは親しみやすいパーソナルAIです。" +
      "日本語で自然に会話してください。" +
      "回答は簡潔にしてください。" +
      "堅苦しい表現は避けてください。";


    /*
     * 前回の記憶があれば追加
     */

    const messages = [

      {
        role: "system",
        content:
          memory
            ? systemPrompt +
              "\n\n[前回のあらすじ]\n" +
              memory
            : systemPrompt
      }

    ];


    /*
     * 今日の会話
     */

    history.forEach(message => {

      messages.push({
        role: message.role,
        content: message.content
      });

    });


    /*
     * AI生成
     */

    const response =
      await engine.chat.completions.create({

        messages,

        temperature: 0.7,

        max_tokens: 256

      });


    answer =
  response
    .choices?.[0]
    ?.message
    ?.content
    ||
    "うまく答えられなかったみたい。";

    /*
     * AIの返答を保存
     */

    saveMessage(
      "assistant",
      answer
    );

    history.push({
      role: "assistant",
      content: answer
    });


    /* ---------- 表示 ---------- */

    await fadeOutText();

    showText(answer);


  } catch (error) {

    console.error(error);

    answer =
  "ごめん、ちょっと考えがうまくまとまらなかった。";

await fadeOutText();

showText(answer);

  }


busy = false;

input.disabled = false;

// 入力欄からフォーカスを外す
if (document.activeElement === input) {
  input.blur();
}


/* ========================================
   回答読み上げ
======================================== */

if (voiceMode && voice && answer) {

  await voice.speak(answer);

  if (!busy) {
    voice.start();
  }

}
}


/* ========================================
   入力
======================================== */

input.addEventListener(
  "keydown",
  async e => {

    if (e.key !== "Enter") {
      return;
    }

    e.preventDefault();

    const text =
      input.value.trim();

    if (!text || busy) {
      return;
    }

    input.value = "";


    /*
     * 終了ワードなら
     * AIへの通常質問にはしない
     */

    if (isEndCommand(text)) {

      await finishDay();

      return;
    }


    /*
     * 通常会話
     */

    await askAI(text);

  }
);

//ボイス系
voice = new VoiceManager({
  
  onResult: async text => {

    if (busy) {
      return;
    }

    if (!text) {
      return;
    }

    if (isEndCommand(text)) {

      await finishDay();

      return;
    }

    await askAI(text);

  },

  onStart: () => {

    micButton.classList.add("listening");

  },

  onEnd: () => {

    micButton.classList.remove(
      "listening"
    );

  },

  onError: error => {

    micButton.classList.remove(
      "listening"
    );

    console.warn(
      "Voice error:",
      error
    );

  }

});

/* ========================================
   マイクボタン
======================================== */

micButton.addEventListener(
  "click",
  () => {

    if (!voice) {
      return;
    }

    if (busy) {
      return;
    }

    if (voiceMode) {

      voiceMode = false;

      if (voice.listening) {
        voice.stop();
      }

      micButton.classList.remove(
        "listening"
      );

      return;
    }

    voiceMode = true;

    voice.start();

  }
);

/* ========================================
   起動
======================================== */

window.addEventListener(
  "load",
  () => {

    loadModel();

  }
);
