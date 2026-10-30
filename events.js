// events.js
// ==========================================
// イベントアイコン管理ファイル
// ==========================================
// 新しいイベントを追加する場合は、この配列にオブジェクトを追記してください。
// active: true で開催中、false で終了（通常アイコンに戻る）

export const EVENT_ICONS = [
    {
        id: "halloween_2026",           // 内部ID (ユニークな名前)
        name: "ハロウィン2026",         // 表示名
        img: "./assets/halloween_icon.png", // 画像パス (assets/eventsフォルダ推奨)
        active: false,                   // ★イベント開催中はtrue、終了したらfalseにするだけ！
    },
    {
        id: "xmas_2026",
        name: "クリスマス2026",
        img: "./assets/xmas.png",
        active: false,                  // 今は非表示
    },
    {
        id: "1st_anniversary",
        name: "1周年記念",
        img: "./assets/anniv.png",
        active: false,
    }
];
