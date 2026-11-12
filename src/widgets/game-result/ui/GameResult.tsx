import { useEffect, useState } from 'react';
import type { GameResult as Result, RoomView } from '@core/types';
import { CatFace } from '@/entities/player';
import { call } from '@/shared/api/socket';
import { audio } from '@/shared/lib/audio/engine';
import { Confetti } from '@/shared/ui/Confetti';

const REASONS: Record<Result['reason'], string> = {
  out: 'выложил(а) все плитки',
  stalemate: 'меньше всего очков в руке',
  alone: 'остался(ась) за столом',
};

interface Props {
  view: RoomView;
  onLeave: () => void;
  flash: (message: string) => void;
}

export function GameResult({ view, onLeave, flash }: Props) {
  const result = view.result!;
  const winner = result.ranks[0];
  const isHost = view.hostId === view.you;
  const won = winner.id === view.you;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    audio.celebrate(won);
  }, [won]);

  const playAgain = async () => {
    const ack = await call('game:again');
    if (!ack.ok) flash(ack.error ?? 'Не получилось');
  };

  return (
    <>
      <Confetti />
      {hidden ? (
        <button className="result-chip" onClick={() => setHidden(false)}>
          🏆 Показать результаты
        </button>
      ) : (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className="card end-card">
            <button className="end-hide" onClick={() => setHidden(true)} title="Скрыть и посмотреть на стол">
              Скрыть
            </button>
            <CatFace coat={winner.avatar} awake className="end-cat" />
            <h2 id="end-title">{won ? 'Ты победил(а)! 🎉' : `${winner.name} побеждает!`}</h2>
            <p className="muted">{REASONS[result.reason]}</p>
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
                {result.ranks.map((rank, place) => (
                  <tr key={rank.id} className={rank.id === view.you ? 'me' : ''}>
                    <td>{place === 0 ? '👑' : place + 1}</td>
                    <td className="rank-name">
                      <CatFace coat={rank.avatar} awake={place === 0} className="mini-cat" />
                      {rank.name}
                    </td>
                    <td>{rank.value}</td>
                    <td className={rank.delta >= 0 ? 'plus' : 'minus'}>{rank.delta >= 0 ? `+${rank.delta}` : rank.delta}</td>
                    <td>{rank.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              {isHost ? (
                <button className="primary" onClick={playAgain}>
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
      )}
    </>
  );
}
