import { useEffect, useState, type PointerEvent, type ReactNode } from 'react';
import { useSideways } from '@/shared/lib/viewport';

const LETTERS = {
  ru: ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'],
  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
};
const SIGNS = ['1234567890', '-/:;()!?"', '.,+=*#@'];
const CLOSE_GRACE_MS = 150;

type Lang = keyof typeof LETTERS;

const textField = (el: unknown): HTMLInputElement | null =>
  el instanceof HTMLInputElement && el.type === 'text' && !el.readOnly && !el.disabled ? el : null;

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

function write(field: HTMLInputElement, value: string) {
  const limit = field.maxLength > 0 ? field.maxLength : Infinity;
  setValue?.call(field, value.slice(0, limit));
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function Key({ onPress, className = '', children }: { onPress: () => void; className?: string; children: ReactNode }) {
  const press = (e: PointerEvent) => {
    e.preventDefault();
    onPress();
  };
  return (
    <button type="button" tabIndex={-1} className={`key ${className}`} onPointerDown={press} onMouseDown={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

export function Keyboard() {
  const sideways = useSideways();
  const [field, setField] = useState<HTMLInputElement | null>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [signs, setSigns] = useState(false);
  const [shift, setShift] = useState(false);
  const open = sideways && field !== null;

  useEffect(() => {
    let closing = 0;
    const onFocus = (e: FocusEvent) => {
      window.clearTimeout(closing);
      const next = textField(e.target);
      setField(next);
      if (next) {
        setSigns(false);
        setShift(next.autocapitalize !== 'none' && next.value === '');
      }
    };
    const onBlur = () => {
      closing = window.setTimeout(() => setField(textField(document.activeElement)), CLOSE_GRACE_MS);
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    setField(textField(document.activeElement));
    return () => {
      window.clearTimeout(closing);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('keys-open', open);
    if (open) field.scrollIntoView({ block: 'nearest' });
    return () => document.documentElement.classList.remove('keys-open');
  }, [open, field]);

  if (!open) return null;

  const latinOnly = field.dataset.keys === 'en';
  const rows = signs ? SIGNS : LETTERS[latinOnly ? 'en' : lang];
  const keep = () => field.focus({ preventScroll: true });
  const type = (char: string) => {
    write(field, field.value + (shift ? char.toUpperCase() : char));
    setShift(false);
    keep();
  };
  const erase = () => {
    write(field, [...field.value].slice(0, -1).join(''));
    keep();
  };
  const enter = () => {
    if (field.form) field.form.requestSubmit();
    keep();
  };

  return (
    <div className="keys" role="group" aria-label="Клавиатура">
      {rows.map((row, i) => (
        <div className="keys-row" key={`${signs}:${lang}:${i}`}>
          {i === 2 && !signs && (
            <Key className={`wide ${shift ? 'on' : ''}`} onPress={() => setShift((on) => !on)}>
              ⇧
            </Key>
          )}
          {[...row].map((char) => (
            <Key key={char} onPress={() => type(char)}>
              {shift ? char.toUpperCase() : char}
            </Key>
          ))}
          {i === 2 && (
            <Key className="wide" onPress={erase}>
              ⌫
            </Key>
          )}
        </div>
      ))}
      <div className="keys-row">
        <Key className="wide" onPress={() => setSigns((on) => !on)}>
          {signs ? 'АБВ' : '123'}
        </Key>
        {!latinOnly && (
          <Key className="wide" onPress={() => setLang((now) => (now === 'ru' ? 'en' : 'ru'))}>
            {lang === 'ru' ? 'EN' : 'РУ'}
          </Key>
        )}
        <Key className="space" onPress={() => type(' ')}>
          пробел
        </Key>
        <Key className="wide" onPress={() => field.blur()}>
          ▾
        </Key>
        <Key className="enter" onPress={enter}>
          Готово
        </Key>
      </div>
    </div>
  );
}
