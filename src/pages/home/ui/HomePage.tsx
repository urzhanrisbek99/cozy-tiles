import { useState } from 'react';
import { CAT_COATS, CatFace } from '@/entities/player';
import type { Prefs } from '@/shared/lib/prefs';
import { isSideways } from '@/shared/lib/viewport';
import { Logo } from '@/widgets/logo';

interface Props {
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onRename: () => void;
  onAskCode: () => void;
}

export function HomePage({ prefs, update, onCreate, onJoin, onRename, onAskCode }: Props) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '');
  const invited = code.length === 4;
  return (
    <main className="card home">
      <Logo>
        <p className="muted">уютные плитки с друзьями · 2–5 игроков</p>
      </Logo>

      <div className="hi">
        <span>
          Привет, <b>{prefs.name}</b>!
        </span>
        <button className="ghost small" onClick={onRename}>
          ✎ Изменить имя
        </button>
      </div>

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
          onPointerDown={(e) => {
            if (!isSideways()) return;
            e.preventDefault();
            onAskCode();
          }}
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
