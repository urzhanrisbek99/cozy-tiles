import type { SortMode } from '@/features/arrange-tiles';
import { socket } from '@/shared/api/socket';

const REACTIONS = ['🐾', '❤️', '😹', '☕', '👏', '😴'];

interface Props {
  canAct: boolean;
  canFinish: boolean;
  canDraw: boolean;
  canReset: boolean;
  poolEmpty: boolean;
  onSort: (mode: SortMode) => void;
  onFinish: () => void;
  onDraw: () => void;
  onReset: () => void;
}

export function TurnActions({ canAct, canFinish, canDraw, canReset, poolEmpty, onSort, onFinish, onDraw, onReset }: Props) {
  return (
    <div className="actions">
      <div className="sort-row">
        <button className="ghost small" onClick={() => onSort('run')} title="Собрать ряды по порядку">
          1·2·3
        </button>
        <button className="ghost small" onClick={() => onSort('group')} title="Собрать группы одинаковых чисел">
          7·7·7
        </button>
      </div>
      <button className="primary" disabled={!canAct || !canFinish} onClick={onFinish}>
        Готово
      </button>
      <button className="soft" disabled={!canAct || !canDraw} onClick={onDraw}>
        {poolEmpty ? 'Пас' : 'Взять плитку'}
      </button>
      <button className="ghost small reset" disabled={!canAct || !canReset} onClick={onReset} title="Сбросить ход">
        ↺ <span>Сбросить</span>
      </button>
      <div className="reactions">
        {REACTIONS.map((emoji) => (
          <button key={emoji} className="emoji" onClick={() => socket.emit('react', emoji)} aria-label={`Реакция ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
