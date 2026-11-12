import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_COLS, BOARD_ROWS, INITIAL_MELD, gridIds, segments, setValue, type Grid } from '../shared/rules';
import type { Reaction, RoomView } from '../shared/types';
import { audio } from './audio/engine';
import { CatFace, Mug, SleepyCat } from './Cats';
import { call, socket } from './net';
import { TileView } from './TileView';

const RACK_COLS = 16;
const GAP = 3;
const REACTIONS = ['🐾', '❤️', '😹', '☕', '👏', '😴'];

type Zone = 'board' | 'rack';
interface Loc {
  zone: Zone;
  r: number;
  c: number;
}
interface Drag {
  id: number;
  from: Loc;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  started: boolean;
}

const cloneGrid = (g: Grid) => g.map((row) => row.slice());

function reconcileRack(prev: (number | null)[], ids: number[]) {
  const want = new Set(ids);
  const next = prev.map((v) => (v !== null && want.has(v) ? v : null));
  const present = new Set(next);
  const needed = Math.max(2, Math.ceil((ids.length + 1) / RACK_COLS)) * RACK_COLS;
  while (next.length < needed) next.push(null);
  for (const id of ids) {
    if (present.has(id)) continue;
    let i = next.indexOf(null);
    if (i === -1) {
      next.push(...Array<null>(RACK_COLS).fill(null));
      i = next.indexOf(null);
    }
    next[i] = id;
  }
  while (next.length > needed && next.slice(-RACK_COLS).every((v) => v === null)) next.length -= RACK_COLS;
  return next;
}

function insertInRow(row: (number | null)[], c: number, id: number) {
  if (row[c] === null) {
    row[c] = id;
    return true;
  }
  let k = row.indexOf(null, c);
  if (k !== -1) {
    for (let i = k; i > c; i--) row[i] = row[i - 1];
    row[c] = id;
    return true;
  }
  k = row.lastIndexOf(null, c);
  if (k !== -1) {
    for (let i = k; i < c; i++) row[i] = row[i + 1];
    row[c] = id;
    return true;
  }
  return false;
}

function locate(x: number, y: number): Loc | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-zone]');
  if (!el) return null;
  return { zone: el.dataset.zone as Zone, r: Number(el.dataset.r), c: Number(el.dataset.c) };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

interface Props {
  view: RoomView;
  onLeave: () => void;
  flash: (msg: string) => void;
}

export function Game({ view, onLeave, flash }: Props) {
  const tiles = view.tiles;
  const myTurn = view.phase === 'playing' && view.turnPlayerId === view.you;
  const committed = useMemo(() => new Set(gridIds(view.board)), [view.board]);

  const [board, setBoard] = useState<Grid>(() => view.draft ?? view.board);
  const [rack, setRack] = useState<(number | null)[]>(() => reconcileRack([], view.rack));
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [over, setOver] = useState<Loc | null>(null);
  const [busy, setBusy] = useState(false);
  const [cw, setCw] = useState(40);
  const [rw, setRw] = useState(48);
  const [reactions, setReactions] = useState<(Reaction & { key: number })[]>([]);

  const boardRef = useRef(board);
  const rackRef = useRef(rack);
  const dragRef = useRef<Drag | null>(null);
  const turnKey = useRef('');
  const prevRack = useRef<Set<number> | null>(null);
  const draftTimer = useRef<number | null>(null);
  const freshTimer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  boardRef.current = board;
  rackRef.current = rack;

  useEffect(() => {
    const key = myTurn ? `mine:${view.turnId}` : 'other';
    let next: Grid;
    if (myTurn && turnKey.current === key) next = boardRef.current;
    else next = myTurn ? view.board : (view.draft ?? view.board);
    turnKey.current = key;
    setBoard(next);
    const onBoard = new Set(gridIds(next));
    setRack((prev) => reconcileRack(prev, view.rack.filter((id) => !onBoard.has(id))));

    const before = prevRack.current;
    const added = view.rack.filter((id) => !before?.has(id));
    prevRack.current = new Set(view.rack);
    if (added.length && view.phase === 'playing') {
      setFresh(new Set(added));
      if (freshTimer.current !== null) window.clearTimeout(freshTimer.current);
      freshTimer.current = window.setTimeout(() => setFresh(new Set()), 1800);
    }
  }, [view, myTurn]);

  useEffect(() => () => {
    if (freshTimer.current !== null) window.clearTimeout(freshTimer.current);
  }, []);

  useEffect(() => {
    if (myTurn) audio.chime();
  }, [myTurn, view.turnId]);

  const iWon = view.phase === 'ended' && view.result?.winnerId === view.you;
  useEffect(() => {
    if (iWon) audio.win();
  }, [iWon]);

  useEffect(() => {
    let key = 0;
    const onReaction = (r: Reaction) => {
      const item = { ...r, key: ++key + Date.now() };
      setReactions((list) => [...list, item]);
      window.setTimeout(() => setReactions((list) => list.filter((x) => x.key !== item.key)), 2200);
    };
    socket.on('reaction', onReaction);
    return () => {
      socket.off('reaction', onReaction);
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const side = (w > 1280 ? 2 * 190 : 0) + (w > 900 ? 220 : 0);
      setRw(Math.max(30, Math.min(50, Math.floor((w - side - 48 - GAP * (RACK_COLS - 1)) / RACK_COLS))));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const byW = (width - 24 - GAP * (BOARD_COLS - 1)) / BOARD_COLS;
      const byH = (height - 24 - GAP * (BOARD_ROWS - 1)) / BOARD_ROWS / 1.3;
      setCw(Math.max(16, Math.min(52, Math.floor(Math.min(byW, byH)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sendDraft = useCallback(() => {
    if (draftTimer.current !== null) return;
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = null;
      socket.emit('turn:draft', boardRef.current);
    }, 120);
  }, []);

  const move = useCallback(
    (id: number, from: Loc, to: Loc) => {
      if (from.zone === to.zone && from.r === to.r && from.c === to.c) return;
      if ((to.zone === 'board' || from.zone === 'board') && !myTurn) return;
      if (from.zone === 'board' && to.zone === 'rack' && committed.has(id)) {
        audio.oops();
        flash('Плитки со стола нельзя забрать в руку');
        return;
      }
      const b = cloneGrid(boardRef.current);
      const s = rackRef.current.slice();
      if (from.zone === 'board') b[from.r][from.c] = null;
      else s[from.r * RACK_COLS + from.c] = null;
      let ok: boolean;
      if (to.zone === 'board') ok = insertInRow(b[to.r], to.c, id);
      else {
        const row = s.slice(to.r * RACK_COLS, (to.r + 1) * RACK_COLS);
        ok = insertInRow(row, to.c, id);
        if (ok) s.splice(to.r * RACK_COLS, RACK_COLS, ...row);
      }
      if (!ok) return;
      boardRef.current = b;
      setBoard(b);
      setRack(reconcileRack(s, s.filter((v): v is number => v !== null)));
      audio.tock();
      if (from.zone === 'board' || to.zone === 'board') sendDraft();
    },
    [committed, flash, myTurn, sendDraft],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.started && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) {
        d.started = true;
        setDrag({ ...d });
      }
      setPos({ x: e.clientX, y: e.clientY });
      if (d.started) setOver(locate(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setOver(null);
      if (!d?.started) return;
      const to = locate(e.clientX, e.clientY);
      if (to) move(d.id, d.from, to);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, move]);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, id: number, from: Loc) => {
    if (e.button !== 0 || busy) return;
    if (from.zone === 'board' && !myTurn) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const d: Drag = { id, from, startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, started: false };
    dragRef.current = d;
    setDrag(d);
    setPos({ x: e.clientX, y: e.clientY });
  };

  const analysis = useMemo(() => {
    const bad = new Set<number>();
    let meld = 0;
    for (const seg of segments(board)) {
      const value = setValue(seg.map((id) => tiles[id]));
      if (value === null) seg.forEach((id) => bad.add(id));
      else if (seg.every((id) => !committed.has(id))) meld += value;
    }
    const played = gridIds(board).filter((id) => !committed.has(id));
    return { bad, meld, played };
  }, [board, committed, tiles]);

  const resetTurn = () => {
    boardRef.current = view.board;
    setBoard(view.board);
    setRack((prev) => reconcileRack(prev, view.rack));
    socket.emit('turn:draft', view.board);
  };

  const sortRack = (mode: 'color' | 'number') => {
    const ids = rack.filter((v): v is number => v !== null);
    ids.sort((a, b) => {
      const ta = tiles[a];
      const tb = tiles[b];
      if (ta.joker !== tb.joker) return ta.joker ? 1 : -1;
      return mode === 'color' ? ta.color - tb.color || ta.num - tb.num : ta.num - tb.num || ta.color - tb.color;
    });
    const laid: (number | null)[] = [];
    ids.forEach((id, i) => {
      const prev = ids[i - 1];
      if (prev !== undefined) {
        const key = (t: number) => (tiles[t].joker ? -1 : mode === 'color' ? tiles[t].color : tiles[t].num);
        const col = laid.length % RACK_COLS;
        if (key(prev) !== key(id) && col !== 0 && col < RACK_COLS - 1) laid.push(null);
      }
      laid.push(id);
    });
    const fits = laid.length <= Math.max(2, Math.ceil((ids.length + 1) / RACK_COLS)) * RACK_COLS;
    setRack(reconcileRack(fits ? laid : ids, ids));
    audio.tock();
  };

  const endTurn = async () => {
    setBusy(true);
    const ack = await call('turn:end', board);
    setBusy(false);
    if (!ack.ok) {
      audio.oops();
      flash(ack.error ?? 'Ход не принят');
    }
  };

  const drawTile = async () => {
    setBusy(true);
    const ack = await call('turn:draw');
    setBusy(false);
    if (!ack.ok) flash(ack.error ?? 'Не получилось');
  };

  const deadline = useMemo(() => (view.turnEndsIn === null ? null : Date.now() + view.turnEndsIn), [view]);
  const now = useNow(deadline !== null);
  const secondsLeft = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));

  const rackRows = rack.length / RACK_COLS;
  const style = { '--cw': `${cw}px`, '--rw': `${rw}px`, '--gap': `${GAP}px` } as CSSProperties;
  const dragging = drag?.started ? drag : null;
  const isOver = (zone: Zone, r: number, c: number) => over?.zone === zone && over.r === r && over.c === c;

  return (
    <div className="game" style={style}>
      <header className="players">
        {view.players.map((p) => {
          const turn = p.id === view.turnPlayerId;
          const progress = turn && secondsLeft !== null && view.turnSeconds ? secondsLeft / view.turnSeconds : null;
          return (
            <div key={p.id} className={`chip ${turn ? 'turn' : ''} ${p.online ? '' : 'offline'} ${p.left ? 'left' : ''}`}>
              <div className="chip-avatar">
                <CatFace coat={p.avatar} awake={turn} />
                {progress !== null && (
                  <svg className="ring" viewBox="0 0 40 40" aria-hidden>
                    <circle cx="20" cy="20" r="18" pathLength="1" style={{ strokeDashoffset: 1 - progress }} />
                  </svg>
                )}
                {reactions
                  .filter((r) => r.playerId === p.id)
                  .map((r) => (
                    <span key={r.key} className="reaction">
                      {r.emoji}
                    </span>
                  ))}
              </div>
              <div className="chip-text">
                <span className="chip-name">
                  {p.name}
                  {p.id === view.you && <em> (ты)</em>}
                </span>
                <span className="chip-meta">
                  {p.left ? 'вышел(а)' : !p.online ? 'нет связи…' : `${p.count} плиток`}
                  {turn && secondsLeft !== null && ` · ${secondsLeft}с`}
                </span>
              </div>
            </div>
          );
        })}
        <div className="pool" title="Плиток в мешочке">
          <span className="pool-bag">👜</span>
          {view.pool}
        </div>
      </header>

      <div className="status-line" aria-live="polite">
        {myTurn ? (
          <strong>Твой ход ✨</strong>
        ) : (
          <span>Ходит {view.players.find((p) => p.id === view.turnPlayerId)?.name ?? '…'}</span>
        )}
        {view.last && <span className="last"> · {view.last}</span>}
        {myTurn && !view.melded && (
          <span className={`meld ${analysis.meld >= INITIAL_MELD ? 'ok' : ''}`}>
            Первый выход: {analysis.meld} / {INITIAL_MELD}
          </span>
        )}
      </div>

      <div className="board-wrap" ref={wrapRef}>
        <div className={`board ${myTurn ? 'active' : ''}`}>
          {board.map((row, r) =>
            row.map((id, c) => (
              <div key={`${r}-${c}`} className={`cell ${isOver('board', r, c) ? 'over' : ''}`} data-zone="board" data-r={r} data-c={c}>
                {id !== null && (
                  <TileView
                    tile={tiles[id]}
                    flags={[
                      analysis.bad.has(id) ? 'bad' : '',
                      !committed.has(id) ? 'new' : '',
                      dragging?.id === id ? 'ghosted' : '',
                      myTurn ? 'grab' : '',
                    ].join(' ')}
                    onPointerDown={(e) => startDrag(e, id, { zone: 'board', r, c })}
                  />
                )}
              </div>
            )),
          )}
        </div>
      </div>

      <footer className="shelf">
        <div className="decor decor-left">
          <SleepyCat awake={myTurn} />
        </div>
        <div className="rack" style={{ gridTemplateRows: `repeat(${rackRows}, calc(var(--cw) * 1.3))` }}>
          {rack.map((id, i) => {
            const r = Math.floor(i / RACK_COLS);
            const c = i % RACK_COLS;
            return (
              <div key={i} className={`cell ${isOver('rack', r, c) ? 'over' : ''}`} data-zone="rack" data-r={r} data-c={c}>
                {id !== null && (
                  <TileView
                    tile={tiles[id]}
                    flags={[fresh.has(id) ? 'fresh' : '', dragging?.id === id ? 'ghosted' : '', 'grab'].join(' ')}
                    onPointerDown={(e) => startDrag(e, id, { zone: 'rack', r, c })}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="actions">
          <div className="row">
            <button className="ghost small" onClick={() => sortRack('color')} title="Сортировать рядами по цвету">
              1·2·3
            </button>
            <button className="ghost small" onClick={() => sortRack('number')} title="Сортировать группами по числу">
              7·7·7
            </button>
          </div>
          {myTurn && view.phase === 'playing' ? (
            <>
              <button className="primary" disabled={busy || analysis.played.length === 0} onClick={endTurn}>
                Готово
              </button>
              <button className="soft" disabled={busy} onClick={drawTile}>
                {view.pool > 0 ? 'Взять плитку' : 'Пас'}
              </button>
              <button className="ghost small" disabled={busy || board === view.board} onClick={resetTurn}>
                ↺ Сбросить
              </button>
            </>
          ) : (
            <p className="waiting">Можно пока разложить руку</p>
          )}
          <div className="row reactions">
            {REACTIONS.map((e) => (
              <button key={e} className="emoji" onClick={() => socket.emit('react', e)} aria-label={`Реакция ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="decor decor-right">
          <Mug />
        </div>
      </footer>

      {dragging && (
        <div
          className="drag-ghost"
          style={{ left: pos.x - dragging.offX, top: pos.y - dragging.offY, '--cw': dragging.from.zone === 'rack' ? 'var(--rw)' : `${cw}px` } as CSSProperties}
        >
          <TileView tile={tiles[dragging.id]} />
        </div>
      )}

      {view.phase === 'ended' && view.result && <EndOverlay view={view} onLeave={onLeave} flash={flash} />}
    </div>
  );
}

function EndOverlay({ view, onLeave, flash }: Props) {
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
