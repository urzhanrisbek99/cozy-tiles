import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '@core/rules';
import type { ChatMessage, RoomView } from '@core/types';
import { CatFace } from '@/entities/player';
import { call } from '@/shared/api/socket';
import { Chat } from '@/widgets/chat';

const TURN_OPTIONS = [
  { value: 30, label: '30 сек' },
  { value: 60, label: '1 мин' },
  { value: 90, label: '1,5 мин' },
  { value: 120, label: '2 мин' },
  { value: 0, label: 'без таймера' },
];

interface Props {
  view: RoomView;
  messages: ChatMessage[];
  sendChat: (text: string) => Promise<boolean>;
  flash: (message: string) => void;
}

export function LobbyPage({ view, messages, sendChat, flash }: Props) {
  const [turnSeconds, setTurnSeconds] = useState(view.turnSeconds);
  const me = view.players.find((p) => p.id === view.you);
  const isHost = view.hostId === view.you;
  const enoughPlayers = view.players.length >= MIN_PLAYERS;
  const freeSeats = Math.max(0, MAX_PLAYERS - view.players.length);
  const invite = `${window.location.origin}/?room=${view.code}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      flash('Ссылка скопирована — отправь друзьям 💌');
    } catch {
      flash(invite);
    }
  };

  const start = async () => {
    const ack = await call('game:start', { turnSeconds });
    if (!ack.ok) flash(ack.error ?? 'Не получилось');
  };

  return (
    <main className="lobby-wrap">
      <section className="card lobby">
        <div className="welcome">
          <CatFace coat={me?.avatar ?? 0} awake className="welcome-cat" />
          <div>
            <h2>Добро пожаловать в лобби{me ? `, ${me.name}` : ''}!</h2>
            <p className="muted">Позови друзей и поболтайте в чате, пока все собираются</p>
          </div>
        </div>

        <p className="muted">Код комнаты</p>
        <div className="room-code">{view.code}</div>
        <button className="soft small" onClick={copyInvite}>
          Скопировать приглашение
        </button>

        <ul className="seats">
          {view.players.map((p) => (
            <li key={p.id} className={p.id === view.you ? 'me' : ''}>
              <CatFace coat={p.avatar} awake />
              <span>{p.name}</span>
              {p.id === view.hostId && <em title="Хозяин комнаты">👑</em>}
              {p.score !== 0 && <small>{p.score > 0 ? `+${p.score}` : p.score}</small>}
            </li>
          ))}
          {Array.from({ length: freeSeats }, (_, i) => (
            <li key={`free-${i}`} className="empty">
              <span className="seat-dot" />
              <span>свободно</span>
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <div className="field">
              <span>Время на ход</span>
              <div className="segmented">
                {TURN_OPTIONS.map((option) => (
                  <button key={option.value} className={turnSeconds === option.value ? 'on' : ''} onClick={() => setTurnSeconds(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="primary big" disabled={!enoughPlayers} onClick={start}>
              {enoughPlayers ? 'Начать игру' : 'Ждём друзей…'}
            </button>
          </>
        ) : (
          <p className="muted">Ждём, пока хозяин комнаты 👑 начнёт игру ☕</p>
        )}
      </section>

      <Chat
        messages={messages}
        you={view.you}
        send={sendChat}
        title="Чат лобби"
        hint="Здесь можно общаться, пока все собираются. Поздоровайся первой кнопкой ниже!"
      />
    </main>
  );
}
