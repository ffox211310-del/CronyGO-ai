/* ========================================
   Personal AI - Memory
======================================== */

const MEMORY_KEY = "personal_ai_memory";
const HISTORY_KEY = "personal_ai_history";

/* ---------- 今日の会話 ---------- */

export function loadHistory() {
  try {
    return JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

export function saveMessage(role, content) {

  const history = loadHistory();

  history.push({
    role,
    content,
    time: Date.now()
  });

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history)
  );
}

/* ---------- 前回の記憶 ---------- */

export function loadMemory() {

  return localStorage.getItem(
    MEMORY_KEY
  ) || "";
}

/* ---------- 記憶を保存 ---------- */

export function saveMemory(memory) {

  localStorage.setItem(
    MEMORY_KEY,
    memory
  );
}

/* ---------- 今日の会話を要約 ---------- */

export async function createMemory(
  engine,
  history
) {

  if (!history.length) {
    return "今日はまだ会話していません。";
  }

  const conversation =
    history
      .map(message => {

        const name =
          message.role === "user"
            ? "ユーザー"
            : "AI";

        return `${name}: ${message.content}`;

      })
      .join("\n");

  const response =
    await engine.chat.completions.create({

      messages: [

        {
          role: "system",
          content:
            "あなたはパーソナルAIの記憶整理係です。" +
            "今日の会話を、次回の会話で役立つように簡潔に要約してください。" +
            "重要な話題、ユーザーが話したこと、進行中の話などを残してください。" +
            "不要な挨拶や細かい言い回しは省いてください。" +
            "箇条書き中心で、短くまとめてください。"
        },

        {
          role: "user",
          content:
            "以下が今日の会話です。\n\n" +
            conversation
        }

      ],

      temperature: 0.3,

      max_tokens: 512

    });

  return (
    response.choices?.[0]?.message?.content ||
    "今日の会話をうまく整理できませんでした。"
  );
}

/* ---------- その日の履歴を削除 ---------- */

export function clearHistory() {

  localStorage.removeItem(
    HISTORY_KEY
  );
}
