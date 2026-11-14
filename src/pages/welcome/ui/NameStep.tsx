import { useEffect, useState } from 'react';
import { CatFace } from '@/entities/player';
import { holdUpright } from '@/shared/lib/viewport';
import { Logo } from '@/widgets/logo';

const HELLO_MS = 2400;

interface Props {
  name: string;
  avatar: number;
  greet: boolean;
  onDone: (name: string) => void;
  onBack?: () => void;
}

export function NameStep({ name, avatar, greet, onDone, onBack }: Props) {
  const [greeting, setGreeting] = useState(greet);
  const [draft, setDraft] = useState(name);
  useEffect(holdUpright, []);

  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => setGreeting(false), HELLO_MS);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  if (greeting) {
    return (
      <main className="card ask hello" onClick={() => setGreeting(false)}>
        <Logo title="Добро пожаловать">
          <p className="muted">в Cozy Tiles — уютные плитки с друзьями</p>
        </Logo>
        <div className="hello-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  const clean = draft.trim();
  return (
    <form
      className="card ask"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onDone(clean);
      }}
    >
      <CatFace coat={avatar} awake className="ask-cat" />
      <h2>Как тебя зовут?</h2>
      <p className="muted">Так тебя увидят друзья за столом</p>
      <input
        autoFocus
        value={draft}
        maxLength={16}
        placeholder="Например, Мурка"
        aria-label="Имя"
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="primary big" disabled={!clean}>
        {onBack ? 'Сохранить' : 'Продолжить'}
      </button>
      {onBack && (
        <button type="button" className="ghost small" onClick={onBack}>
          Назад
        </button>
      )}
    </form>
  );
}
