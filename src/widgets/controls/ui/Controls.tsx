import { useEffect, useState } from 'react';
import { THEMES } from '@/shared/config/themes';
import { audio } from '@/shared/lib/audio/engine';
import type { Prefs } from '@/shared/lib/prefs';

export function Controls({
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
