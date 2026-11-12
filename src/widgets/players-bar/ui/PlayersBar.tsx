import { useEffect, useState, type RefObject } from 'react';
import type { ChatMessage, Reaction, RoomView } from '@core/types';
import { CatFace } from '@/entities/player';
import { SecondsLeft, TimerRing } from '@/features/turn-timer';
import { socket } from '@/shared/api/socket';
import { audio } from '@/shared/lib/audio/engine';

const REACTION_MS = 2400;
const BUBBLE_MS = 5000;
const BUBBLE_LENGTH = 70;

interface Props {
  view: RoomView;
  deadline: number | null;
  placedThisTurn: number;
  poolRef: RefObject<HTMLDivElement | null>;
}

function tilesWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'плитка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'плитки';
  return 'плиток';
}

function useTableTalk() {
  const [reactions, setReactions] = useState<(Reaction & { key: number })[]>([]);
  const [bubbles, setBubbles] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let seq = 0;
    const timers = new Set<number>();
    const later = (ms: number, run: () => void) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
    };
    const onReaction = (reaction: Reaction) => {
      const item = { ...reaction, key: ++seq };
      setReactions((list) => [...list, item]);
      audio.pop();
      later(REACTION_MS, () => setReactions((list) => list.filter((x) => x.key !== item.key)));
    };
    const onChat = (message: ChatMessage) => {
      if (message.playerId === null) return;
      setBubbles((list) => [...list.filter((x) => x.playerId !== message.playerId), message]);
      later(BUBBLE_MS, () => setBubbles((list) => list.filter((x) => x.id !== message.id)));
    };
    socket.on('reaction', onReaction);
    socket.on('chat', onChat);
    return () => {
      socket.off('reaction', onReaction);
      socket.off('chat', onChat);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return { reactions, bubbles };
}

export function PlayersBar({ view, deadline, placedThisTurn, poolRef }: Props) {
  const { reactions, bubbles } = useTableTalk();
  const playing = view.phase === 'playing';

  return (
    <header className="players">
      {view.players.map((p) => {
        const turn = playing && p.id === view.turnPlayerId;
        const count = turn ? Math.max(0, p.count - placedThisTurn) : p.count;
        return (
          <div key={p.id} data-player={p.id} className={`chip ${turn ? 'turn' : ''} ${p.online ? '' : 'offline'} ${p.left ? 'left' : ''}`}>
            <div className="chip-avatar">
              <CatFace coat={p.avatar} awake={turn} />
              {turn && deadline !== null && view.turnSeconds > 0 && <TimerRing deadline={deadline} total={view.turnSeconds} />}
              {!p.left && <span className="chip-count">{count}</span>}
            </div>
            <div className="chip-text">
              <span className="chip-name">
                {p.name}
                {p.id === view.you && <em> (ты)</em>}
              </span>
              <span className="chip-meta">
                {p.left ? (
                  'вышел(а)'
                ) : !p.online ? (
                  'нет связи…'
                ) : (
                  <>
                    <b key={count} className="bump">
                      {count}
                    </b>{' '}
                    {tilesWord(count)}
                  </>
                )}
                {turn && deadline !== null && <SecondsLeft deadline={deadline} />}
              </span>
            </div>
            {reactions
              .filter((r) => r.playerId === p.id)
              .map((r) => (
                <span key={r.key} className="reaction">
                  {r.emoji}
                </span>
              ))}
            {bubbles
              .filter((m) => m.playerId === p.id)
              .map((m) => (
                <span key={m.id} className="say">
                  {m.text.length > BUBBLE_LENGTH ? `${m.text.slice(0, BUBBLE_LENGTH)}…` : m.text}
                </span>
              ))}
          </div>
        );
      })}
      <div className="pool" ref={poolRef} title="Плиток в мешочке">
        <span>👜</span>
        <b key={view.pool} className="bump">
          {view.pool}
        </b>
      </div>
    </header>
  );
}
