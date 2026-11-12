import type { RoomView } from '@core/types';
import { CatFace } from '@/entities/player';
import { call } from '@/shared/api/socket';

interface Props {
  view: RoomView;
  onLeave: () => void;
  flash: (message: string) => void;
}

export function GameResult({ view, onLeave, flash }: Props) {
  const result = view.result!;
  const winner = result.ranks[0];
  const isHost = view.hostId === view.you;
  const reason =
    result.reason === 'out' ? 'выложил(а) все плитки' : result.reason === 'stalemate' ? 'меньше всего очков в руке' : 'остался(ась) за столом';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className="card end-card">
        <CatFace coat={winner.avatar} awake className="end-cat" />
        <h2 id="end-title">{winner.id === view.you ? 'Ты победил(а)! 🎉' : `${winner.name} побеждает!`}</h2>
        <p className="muted">{reason}</p>
        <table className="ranks">
          <thead>
            <tr>
              <th />
              <th>Игрок</th>
              <th>В руке</th>
              <th>Партия</th>
              <th>Всего</th>
            </tr>
          </thead>
          <tbody>
            {result.ranks.map((r, i) => (
              <tr key={r.id} className={r.id === view.you ? 'me' : ''}>
                <td>{i === 0 ? '👑' : i + 1}</td>
                <td className="rank-name">
                  <CatFace coat={r.avatar} awake={i === 0} className="mini-cat" />
                  {r.name}
                </td>
                <td>{r.value}</td>
                <td className={r.delta >= 0 ? 'plus' : 'minus'}>{r.delta >= 0 ? `+${r.delta}` : r.delta}</td>
                <td>{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          {isHost ? (
            <button
              className="primary"
              onClick={async () => {
                const ack = await call('game:again');
                if (!ack.ok) flash(ack.error ?? 'Не получилось');
              }}
            >
              Ещё партию
            </button>
          ) : (
            <p className="muted">Ждём, пока хозяин комнаты начнёт новую партию…</p>
          )}
          <button className="ghost" onClick={onLeave}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
