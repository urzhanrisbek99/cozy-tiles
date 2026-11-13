import { useEffect, useRef, useState, type FormEvent, type HTMLAttributes } from 'react';
import type { ChatMessage } from '@core/types';
import { CatFace } from '@/entities/player';

const QUICK = ['Привет! 👋', 'Начинаем? ✨', 'Удачи всем 🍀', 'Хороший ход 👏', 'Минутку ☕'];
const MAX_LENGTH = 200;

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

interface Props {
  messages: ChatMessage[];
  you: string;
  send: (text: string) => Promise<boolean>;
  title: string;
  hint: string;
  onClose?: () => void;
  headerProps?: HTMLAttributes<HTMLElement>;
  autoFocus?: boolean;
}

export function Chat({ messages, you, send, title, hint, onClose, headerProps, autoFocus }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (list && pinned.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    pinned.current = true;
    if (await send(value)) setText('');
  };

  return (
    <section className="card chat" aria-label={title}>
      <div className="chat-inner">
        <header className={`chat-head ${headerProps ? 'movable' : ''}`} {...headerProps}>
          <span>💬 {title}</span>
          {onClose && (
            <button className="chat-close" onClick={onClose} aria-label="Закрыть чат">
              ✕
            </button>
          )}
        </header>

        <div
          className="chat-list"
          ref={listRef}
          role="log"
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-icon">🐾</span>
              <p>{hint}</p>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.playerId === null) {
              return (
                <div key={m.id} className="msg system">
                  {m.text}
                </div>
              );
            }
            const prev = messages[i - 1];
            const head = !prev || prev.playerId !== m.playerId || m.at - prev.at > 120_000;
            const mine = m.playerId === you;
            return (
              <div key={m.id} className={`msg ${mine ? 'mine' : ''} ${head ? 'head' : ''}`}>
                {!mine && <div className="msg-avatar">{head && <CatFace coat={m.avatar} awake />}</div>}
                <div className="msg-body">
                  {head && (
                    <span className="msg-name">
                      {mine ? 'Ты' : m.name} <time>{clock(m.at)}</time>
                    </span>
                  )}
                  <span className="bubble">{m.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="chat-quick">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                pinned.current = true;
                void send(q);
              }}
            >
              {q}
            </button>
          ))}
        </div>

        <form className="chat-form" onSubmit={submit}>
          <input
            value={text}
            maxLength={MAX_LENGTH}
            placeholder="Напиши сообщение…"
            aria-label="Сообщение"
            autoComplete="off"
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" disabled={!text.trim()} aria-label="Отправить">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 12l15-7-5 15-3-6z" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
}
