import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_PLAYERS, type Grid } from '../shared/rules';
import type { ChatMessage, RoomView } from '../shared/types';
import { audio, type Mood } from './audio/engine';
import { CAT_COATS, CatFace } from './Cats';
import { Chat } from './Chat';
import { Game } from './Game';
import { call, socket } from './net';
import { playerId, savedRoom, saveRoom, usePrefs, type Prefs } from './prefs';
import { Scene } from './Scene';
import { Glyph } from './TileView';

const THEMES: { id: Mood; icon: string; label: string; color: string }[] = [
  { id: 'rain', icon: '☔', label: 'Дождик', color: '#5d6b8f' },
  { id: 'night', icon: '🌙', label: 'Ночь', color: '#2b2350' },
  { id: 'autumn', icon: '🍂', label: 'Осень', color: '#8a5a6a' },
  { id: 'sakura', icon: '🌸', label: 'Сакура', color: '#c98aa8' },
];

const TURN_OPTIONS = [
  { value: 30, label: '30 сек' },
  { value: 60, label: '1 мин' },
  { value: 90, label: '1,5 мин' },
  { value: 120, label: '2 мин' },
  { value: 0, label: 'без таймера' },
];

const PID = playerId();

export default function App() {
  const [prefs, update] = usePrefs();
  const [view, setView] = useState<RoomView | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [rules, setRules] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const chatHidden = useRef(false);
  chatHidden.current = !!view && view.phase !== 'lobby' && !chatOpen;

  const flash = useCallback((text: string) => {
    const key = Date.now();
    setToast({ text, key });
    window.setTimeout(() => setToast((t) => (t?.key === key ? null : t)), 3200);
  }, []);

  useEffect(() => {
    const rejoin = async () => {
      setConnected(true);
      const code = savedRoom();
      if (!code) return;
      const { name, avatar } = prefsRef.current;
      const ack = await call('room:join', { code, name, avatar, playerId: PID });
      if (!ack.ok) {
        saveRoom(null);
        setView(null);
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (v: RoomView) => {
      setView(v);
      setDeadline(v.turnEndsIn === null ? null : Date.now() + v.turnEndsIn);
    };
    const onDraft = (draft: Grid) =>
      setView((v) => (v && v.phase === 'playing' && v.turnPlayerId !== v.you ? { ...v, draft } : v));
    const onHistory = (history: ChatMessage[]) => setMessages(history);
    const onChat = (message: ChatMessage) => {
      setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message].slice(-80)));
      if (message.playerId === null || message.playerId === PID) return;
      audio.pop();
      if (chatHidden.current) setUnread((n) => n + 1);
    };
    socket.on('state', onState);
    socket.on('draft', onDraft);
    socket.on('chat:history', onHistory);
    socket.on('chat', onChat);
    let build: string | null = null;
    const onBuild = (next: string) => {
      if (build !== null && build !== next) window.location.reload();
      build = next;
    };
    socket.on('build', onBuild);
    socket.on('connect', rejoin);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) void rejoin();
    return () => {
      socket.off('state', onState);
      socket.off('draft', onDraft);
      socket.off('chat:history', onHistory);
      socket.off('chat', onChat);
      socket.off('build', onBuild);
      socket.off('connect', rejoin);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', THEMES.find((t) => t.id === prefs.theme)?.color ?? '#5d6b8f');
    audio.setMood(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    audio.setVolume(prefs.volume);
    audio.sfxEnabled = prefs.sfx;
  }, [prefs.volume, prefs.sfx]);

  useEffect(() => {
    if (!prefs.music) {
      audio.stop();
      return;
    }
    if (audio.isPlaying) return;
    const unlock = () => audio.start();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [prefs.music]);

  useEffect(() => {
    if (!view?.code) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', view.code);
    window.history.replaceState(null, '', url);
  }, [view?.code]);

  const enterRoom = async (event: 'room:create' | 'room:join', code?: string) => {
    if (!prefs.name.trim()) {
      flash('Сначала напиши своё имя');
      return;
    }
    const ack = await call(event, { code, name: prefs.name, avatar: prefs.avatar, playerId: PID });
    if (ack.ok && ack.code) saveRoom(ack.code);
    else flash(ack.error ?? 'Не получилось');
  };

  const leave = async () => {
    await call('room:leave');
    saveRoom(null);
    setView(null);
    setMessages([]);
    setChatOpen(false);
    setUnread(0);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const sendChat = useCallback(
    async (text: string) => {
      const ack = await call('chat:send', text);
      if (!ack.ok) flash(ack.error ?? 'Сообщение не отправилось');
      return ack.ok;
    },
    [flash],
  );

  const toggleChat = () => {
    setChatOpen((open) => !open);
    setUnread(0);
  };

  const inGame = view && view.phase !== 'lobby';

  return (
    <>
      <Scene theme={prefs.theme} />
      <div className={`app ${inGame ? 'in-game' : ''}`}>
        <Controls
          prefs={prefs}
          update={update}
          onRules={() => setRules(true)}
          onLeave={view ? leave : undefined}
          confirmLeave={view?.phase === 'playing'}
          chat={inGame ? { open: chatOpen, unread, toggle: toggleChat } : undefined}
        />
        {!view && <Home prefs={prefs} update={update} onCreate={() => enterRoom('room:create')} onJoin={(c) => enterRoom('room:join', c)} />}
        {view?.phase === 'lobby' && <Lobby view={view} flash={flash} messages={messages} sendChat={sendChat} />}
        {inGame && <Game view={view} deadline={deadline} onLeave={leave} flash={flash} />}
      </div>
      {inGame && chatOpen && (
        <div className="chat-float">
          <Chat messages={messages} you={view.you} send={sendChat} title="Чат" hint="Напиши что-нибудь друзьям — сообщение увидят все за столом" onClose={toggleChat} autoFocus />
        </div>
      )}
      {!connected && <div className="offline-banner">Связь потерялась… переподключаемся ☁️</div>}
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.text}
        </div>
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
    </>
  );
}

function Controls({
  prefs,
  update,
  onRules,
  onLeave,
  confirmLeave,
  chat,
}: {
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  onRules: () => void;
  onLeave?: () => void;
  confirmLeave: boolean;
  chat?: { open: boolean; unread: number; toggle: () => void };
}) {
  return (
    <nav className="controls" aria-label="Настройки">
      <div className="pill themes" role="radiogroup" aria-label="Тема">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={prefs.theme === t.id}
            className={prefs.theme === t.id ? 'on' : ''}
            onClick={() => update({ theme: t.id })}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="pill">
        <button
          className={prefs.music ? 'on' : ''}
          onClick={() => {
            const music = !prefs.music;
            update({ music });
            if (music) audio.start();
          }}
          title={prefs.music ? 'Выключить музыку' : 'Включить лофай'}
          aria-pressed={prefs.music}
        >
          {prefs.music ? '🎵' : '🔇'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={prefs.volume}
          onChange={(e) => update({ volume: Number(e.target.value) })}
          aria-label="Громкость музыки"
        />
        <button className={prefs.sfx ? 'on' : ''} onClick={() => update({ sfx: !prefs.sfx })} title="Звуки плиток" aria-pressed={prefs.sfx}>
          {prefs.sfx ? '🔔' : '🔕'}
        </button>
      </div>
      <div className="pill">
        {chat && (
          <button className={`chat-toggle ${chat.open ? 'on' : ''}`} onClick={chat.toggle} title="Чат" aria-pressed={chat.open}>
            💬
            {chat.unread > 0 && <span className="badge">{chat.unread > 9 ? '9+' : chat.unread}</span>}
          </button>
        )}
        <button onClick={onRules} title="Правила">
          ?
        </button>
      </div>
      {onLeave && <LeaveButton onLeave={onLeave} confirm={confirmLeave} />}
    </nav>
  );
}

function LeaveButton({ onLeave, confirm }: { onLeave: () => void; confirm: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`leave ${armed ? 'armed' : ''}`}
      onClick={() => (confirm && !armed ? setArmed(true) : onLeave())}
      title="Выйти из игры"
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="M15 8l4 4-4 4M19 12H9" />
      </svg>
      <span>{armed ? 'Точно выйти?' : 'Выйти'}</span>
    </button>
  );
}

function Home({
  prefs,
  update,
  onCreate,
  onJoin,
}: {
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '');
  const invited = code.length === 4;
  return (
    <main className="card home">
      <div className="logo">
        <div className="logo-tiles" aria-hidden>
          {[0, 1, 2, 3].map((c) => (
            <span key={c} className={`logo-tile c${c}`}>
              {7}
              <Glyph color={c} />
            </span>
          ))}
        </div>
        <h1>Cozy Tiles</h1>
        <p className="muted">уютные плитки с друзьями · 2–5 игроков</p>
      </div>

      <label className="field">
        <span>Как тебя зовут?</span>
        <input value={prefs.name} maxLength={16} placeholder="Например, Мурка" onChange={(e) => update({ name: e.target.value })} />
      </label>

      <div className="field">
        <span>Твой котик</span>
        <div className="cats" role="radiogroup" aria-label="Аватар">
          {CAT_COATS.map((coat, i) => (
            <button
              key={i}
              role="radio"
              aria-checked={prefs.avatar === i}
              aria-label={coat.label}
              title={coat.label}
              className={`cat-pick ${prefs.avatar === i ? 'on' : ''}`}
              onClick={() => update({ avatar: i })}
            >
              <CatFace coat={i} awake={prefs.avatar === i} />
            </button>
          ))}
        </div>
      </div>

      {!invited && (
        <button className="primary big" onClick={onCreate}>
          Создать комнату
        </button>
      )}
      <form
        className="join"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 4) onJoin(code);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
          placeholder="КОД"
          aria-label="Код комнаты"
          className="code-input"
        />
        <button className={invited ? 'primary' : 'soft'} disabled={code.length !== 4}>
          Войти
        </button>
      </form>
      {invited && (
        <button className="ghost small" onClick={onCreate}>
          или создать свою комнату
        </button>
      )}
    </main>
  );
}

function Lobby({
  view,
  flash,
  messages,
  sendChat,
}: {
  view: RoomView;
  flash: (m: string) => void;
  messages: ChatMessage[];
  sendChat: (text: string) => Promise<boolean>;
}) {
  const me = view.players.find((p) => p.id === view.you);
  const [turnSeconds, setTurnSeconds] = useState(view.turnSeconds);
  const isHost = view.hostId === view.you;
  const link = `${window.location.origin}/?room=${view.code}`;
  const empty = Math.max(0, MAX_PLAYERS - view.players.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      flash('Ссылка скопирована — отправь друзьям 💌');
    } catch {
      flash(link);
    }
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
      <button className="soft small" onClick={copy}>
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
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`} className="empty">
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
              {TURN_OPTIONS.map((o) => (
                <button key={o.value} className={turnSeconds === o.value ? 'on' : ''} onClick={() => setTurnSeconds(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button
            className="primary big"
            disabled={view.players.length < 2}
            onClick={async () => {
              const ack = await call('game:start', { turnSeconds });
              if (!ack.ok) flash(ack.error ?? 'Не получилось');
            }}
          >
            {view.players.length < 2 ? 'Ждём друзей…' : 'Начать игру'}
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

function Rules({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={onClose}>
      <div className="card rules" onClick={(e) => e.stopPropagation()}>
        <h2 id="rules-title">Как играть</h2>
        <p>
          <b>Цель</b> — первой выложить на стол все свои плитки.
        </p>
        <p>
          Плитки — числа от 1 до 13 четырёх цветов: <span className="ink c0">♥ сердечки</span>, <span className="ink c1">💧 капельки</span>,{' '}
          <span className="ink c2">★ звёздочки</span>, <span className="ink c3">☾ луны</span>. Каждой по две (при 5 игроках — по три), плюс
          котики-джокеры. В начале у всех по 14 плиток.
        </p>
        <ul>
          <li>
            <b>Ряд</b> — 3 и больше чисел подряд одного цвета: 4 · 5 · 6 ♥
          </li>
          <li>
            <b>Группа</b> — 3–4 одинаковых числа разных цветов: 8♥ 8💧 8★
          </li>
          <li>Комбинация — это плитки, стоящие вплотную в одной строке. Пустая клетка их разделяет.</li>
          <li>
            <b>Первый выход</b> — комбинации из своих плиток на сумму от 30 очков. До него трогать стол нельзя.
          </li>
          <li>После первого выхода можно как угодно перекладывать всё на столе — главное, чтобы в конце хода все комбинации были правильными.</li>
          <li>Нечего выложить — возьми плитку из мешочка 👜.</li>
          <li>Котик-джокер заменяет любую плитку. Его можно забрать из комбинации, но он должен остаться на столе.</li>
          <li>Если время вышло, а на столе всё собрано правильно — ход засчитывается сам. Если нет, плитки возвращаются в руку и берётся одна из мешочка.</li>
          <li>Если мешочек пуст и все пасуют — побеждает тот, у кого в руке меньше очков.</li>
        </ul>
        <p className="muted">Проигравшие теряют сумму плиток в руке (котик = 30), победитель забирает её себе.</p>
        <button className="primary" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
