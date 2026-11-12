import { useState } from 'react';
import { CAT_COATS, CatFace } from '@/entities/player';
import { Glyph } from '@/entities/tile';
import type { Prefs } from '@/shared/lib/prefs';

export function HomePage({
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
