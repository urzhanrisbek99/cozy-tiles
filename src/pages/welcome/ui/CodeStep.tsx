import { useState } from 'react';
import { useSideways } from '@/shared/lib/viewport';

export function CodeStep({ onDone, onBack }: { onDone: (code: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const sideways = useSideways();
  const ready = code.length === 4;
  return (
    <form
      className="card ask"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onDone(code);
      }}
    >
      <h2>Код комнаты</h2>
      <p className="muted">Четыре буквы — спроси у того, кто создал комнату</p>
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
        placeholder="КОД"
        aria-label="Код комнаты"
        autoComplete="off"
        autoCapitalize="characters"
        inputMode={sideways ? 'none' : undefined}
        data-keys="en"
        enterKeyHint="go"
        className="code-input"
      />
      <button className="primary big" disabled={!ready}>
        Войти
      </button>
      <button type="button" className="ghost small" onClick={onBack}>
        Назад
      </button>
    </form>
  );
}
