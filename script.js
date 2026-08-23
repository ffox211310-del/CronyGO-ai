import React from 'react';
import { createRoot } from 'react-dom/client';

// ---- ユーティリティ ----
const hasOwn = Object.prototype.hasOwnProperty;
const REACT_ELEMENT = Symbol.for('react.element');
const ReactCurrentOwner = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner;

function createElement(type, config, children) {
  let propName;
  const props = {};
  let key = null;
  let ref = null;
  if (config != null) {
    if (config.key !== undefined) key = '' + config.key;
    if (config.ref !== undefined) ref = config.ref;
    for (propName in config) {
      if (hasOwn.call(config, propName) && !hasOwn.call({ key: true, ref: true, __self: true, __source: true }, propName)) {
        props[propName] = config[propName];
      }
    }
  }
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  return {
    $$typeof: REACT_ELEMENT,
    type,
    key,
    ref,
    props,
    _owner: ReactCurrentOwner.current,
  };
}

const P = createElement;
const Q = createElement;

// ---- モデル名 ----
const MODEL_NAME = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

// ---- メインコンポーネント ----
function ChatApp() {
  const [status, setStatus] = React.useState('idle');
  const [statusMsg, setStatusMsg] = React.useState('準備中...');
  const [progress, setProgress] = React.useState(0);
  const [messages, setMessages] = React.useState([
    { role: 'system', content: 'You are a helpful assistant. Answer in Japanese if user speaks Japanese, otherwise match user\'s language. Be concise.' },
  ]);
  const [input, setInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const engineRef = React.useRef(null);
  const logRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // スクロール
  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // エンジン初期化
  React.useEffect(() => {
    let cancelled = false;
    async function initEngine() {
      try {
        setStatus('downloading');
        setStatusMsg('WebLLMモジュールを読み込み中...');
        const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
        if (cancelled) return;
        const engine = await CreateMLCEngine(MODEL_NAME, {
          initProgressCallback: (evt) => {
            if (evt?.text) setStatusMsg(evt.text);
            if (typeof evt?.progress === 'number') {
              setProgress(Math.round(evt.progress * 100));
            }
            if (evt?.text?.toLowerCase().includes('loading') || evt?.text?.includes('モデル')) {
              setStatus('loading');
            }
          },
        });
        if (cancelled) return;
        engineRef.current = engine;
        setStatus('ready');
        setProgress(100);
        setStatusMsg('準備完了 - オフラインで会話可能');
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setStatus('error');
          setStatusMsg(err?.message ?? '読み込みに失敗しました。WebGPU対応ブラウザでお試しください。');
        }
      }
    }
    initEngine();
    return () => { cancelled = true; };
  }, []);

  const displayMessages = messages.filter((m) => m.role !== 'system');

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || status !== 'ready') return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsSending(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine not ready');

      const stream = await engine.chat.completions.create({
        messages: newMessages,
        stream: true,
        temperature: 0.7,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullContent += delta;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: fullContent };
            return copy;
          });
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `エラー: ${err?.message ?? err}` };
        return copy;
      });
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return Q('div', { className: 'root', children: [
    P('header', {
      children: [
        Q('div', { className: 'brand', children: [
          P('div', { className: 'dot', children: 'W' }),
          Q('div', { children: [
            P('div', { className: 'model-name', children: MODEL_NAME }),
            P('div', { className: 'model-sub', children: 'WebLLM • ブラウザ内推論 • Qwen2.5 0.5B' }),
          ] }),
        ] }),
        Q('div', {
          className: 'status-chip',
          title: statusMsg,
          children: [
            P('span', {
              className: `status-dot ${status === 'ready' ? 'ready' : status === 'error' ? 'error' : 'loading'}`,
            }),
            P('span', {
              children: status === 'ready' ? 'Ready • Offline OK' :
                        status === 'error' ? 'Error' :
                        status === 'downloading' ? `${progress}%` :
                        status === 'loading' ? 'Loading' : 'Init',
            }),
          ],
        }),
      ],
    }),
    P('div', { className: 'progress-wrap', 'aria-hidden': true, children: P('div', {
      className: 'progress-bar',
      style: { width: `${status === 'ready' ? 100 : progress}%`, opacity: status === 'ready' ? 0 : 1 },
    }) }),
    status === 'error' && Q('div', { className: 'error-box', children: [
      statusMsg,
      P('div', { style: { marginTop: 8, color: '#a33' }, children: 'ヒント: Chrome / Edge 最新版で WebGPU を有効にしてください。初回はモデル(約400MB)をダウンロードします。' }),
    ] }),
    Q('main', { children: [
      Q('div', { className: 'log', ref: logRef, children: [
        displayMessages.length === 0 && Q('div', { style: { textAlign: 'center', marginTop: 40, color: '#9a9894' }, children: [
          P('div', { style: { fontSize: 28, marginBottom: 12 }, children: '💬' }),
          P('div', { style: { fontSize: 14, fontWeight: 500, color: '#3a3937' }, children: 'オフラインで動く超軽量チャット' }),
          Q('div', { style: { fontSize: 12, marginTop: 6, lineHeight: 1.6 }, children: [
            '初回のみモデルをダウンロード。2回目以降はキャッシュから即時起動・完全オフライン動作。',
            P('br', {}),
            'WebLLM CreateMLCEngine + streaming。',
          ] }),
        ] }),
        displayMessages.map((msg, idx) => Q('div', {
          className: `bubble-row ${msg.role}`,
          children: [
            P('div', { className: `avatar ${msg.role}`, children: msg.role === 'user' ? 'U' : 'Q' }),
            P('div', {
              className: `bubble ${msg.role} ${!msg.content ? 'empty' : ''}`,
              children: msg.content || (isSending ? '▍' : ''),
            }),
          ],
        }, idx)),
        status !== 'ready' && displayMessages.length === 0 && Q('div', {
          style: {
            margin: '22px auto 0',
            background: '#fff',
            border: '1px solid #ece7e0',
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 12.5,
            color: '#5a5957',
            maxWidth: 420,
            width: '100%',
          },
          children: [
            P('div', { style: { fontWeight: 600, marginBottom: 6 }, children: '初回ロード中…' }),
            P('div', { style: { lineHeight: 1.5, wordBreak: 'break-all' }, children: statusMsg }),
            P('div', { style: { marginTop: 10, height: 6, background: '#f3f0ea', borderRadius: 99, overflow: 'hidden' }, children: P('div', {
              style: { width: `${progress}%`, height: '100%', background: '#111', transition: 'width .2s' },
            }) }),
            P('div', { style: { marginTop: 8, fontSize: 11, color: '#9a9894' }, children: '初回は約400MBのダウンロード。2回目以降はブラウザキャッシュからオフライン起動。' }),
          ],
        }),
      ] }),
      Q('div', { className: 'composer-wrap', children: [
        Q('div', { className: 'composer', children: [
          P('input', {
            ref: inputRef,
            value: input,
            onChange: (e) => setInput(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            },
            placeholder: status === 'ready' ? 'メッセージを入力...' : 'モデルを読み込み中...',
            disabled: status !== 'ready' || isSending,
          }),
          P('button', {
            className: 'send-btn',
            onClick: handleSend,
            disabled: status !== 'ready' || !input.trim() || isSending,
            'aria-label': '送信',
            children: Q('svg', {
              width: '18',
              height: '18',
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '2',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              children: [
                P('path', { d: 'm22 2-7 20-4-9-9-4Z' }),
                P('path', { d: 'M22 2 11 13' }),
              ],
            }),
          }),
        ] }),
        status === 'ready' && displayMessages.length <= 1 && !isSending && P('div', {
          className: 'hint',
          children: ['こんにちは！何ができる？', 'JavaScriptでFizzBuzz書いて', '今日の晩ご飯アイデアを3つ', 'WebLLMって何？'].map((text) =>
            P('button', { className: 'hint-chip', onClick: () => setInput(text), children: text }, text)
          ),
        }),
        Q('div', { className: 'foot-note', children: [
          '使用: ', P('code', { children: '@mlc-ai/web-llm' }),
          ' via ', P('code', { children: 'https://esm.run/@mlc-ai/web-llm' }),
          ' / ', P('code', { children: 'CreateMLCEngine' }),
          ' / Message形式 ', P('code', { children: '{role, content}' }),
          ' / streaming • ', P('br', {}),
          Q('span', { style: { opacity: 0.9 }, children: [
            '2回目以降は Cache API に保存されオフラインで動作します（2回目読み込み時はネット不要）。モデル: ',
            MODEL_NAME,
            ' (HF由来 q4f16_1量子化)',
          ] }),
        ] }),
      ] }),
    ] }),
  ] });
}

// ---- レンダリング ----
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);
root.render(React.createElement(React.StrictMode, null, React.createElement(ChatApp)));
