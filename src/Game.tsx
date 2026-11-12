import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_COLS, BOARD_ROWS, INITIAL_MELD, gridIds, setValue, type Grid, type Tile } from '../shared/rules';
import type { ChatMessage, Reaction, RoomView } from '../shared/types';
import { audio } from './audio/engine';
import { CatFace, Mug, SleepyCat } from './Cats';
import { RACK_COLS, arrange, continuesSet, dropOnBoard, fitRack, insertGroup, layoutRack, planDrop, type Cells, type SortMode } from './layout';
import { call, socket } from './net';
import { TileView } from './TileView';

const GAP = 3;
const DRAG_SLOP = 6;
const HOLD_FIRST_MS = 320;
const HOLD_NEXT_MS = 190;
const REACTIONS = ['🐾', '❤️', '😹', '☕', '👏', '😴'];

type Zone = 'board' | 'rack';

interface Loc {
  zone: Zone;
  r: number;
  c: number;
}

interface Point {
  x: number;
  y: number;
  kind?: 'drop' | 'fly';
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface Gesture {
  ids: number[];
  from: Loc;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offX: number;
  offY: number;
  w: number;
  started: boolean;
  timer: number;
}

const cloneGrid = (g: Grid) => g.map((row) => row.slice());
const isId = (v: number | null): v is number => v !== null;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function locate(x: number, y: number): Loc | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-zone]');
  if (!el) return null;
  return { zone: el.dataset.zone as Zone, r: Number(el.dataset.r), c: Number(el.dataset.c) };
}

function tilesWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'плитка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'плитки';
  return 'плиток';
}

function useTimeLeft(deadline: number) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, deadline - Date.now()));
    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, [deadline]);
  return left;
}

const Ring = memo(function Ring({ deadline, total }: { deadline: number; total: number }) {
  const left = useTimeLeft(deadline);
  return (
    <svg className="ring" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" pathLength="1" style={{ strokeDashoffset: 1 - Math.min(1, left / (total * 1000)) }} />
    </svg>
  );
});

const Seconds = memo(function Seconds({ deadline }: { deadline: number }) {
  const s = Math.ceil(useTimeLeft(deadline) / 1000);
  return <span className={`secs ${s <= 10 ? 'low' : ''}`}> · {s}с</span>;
});

const Countdown = memo(function Countdown({ deadline, root }: { deadline: number; root: { current: HTMLElement | null } }) {
  const s = Math.ceil(useTimeLeft(deadline) / 1000);
  const hurry = s > 0 && s <= 10;
  useEffect(() => {
    if (hurry) audio.clock(s <= 3);
  }, [s, hurry]);
  useEffect(() => {
    const el = root.current;
    el?.classList.toggle('hurry', hurry);
    return () => el?.classList.remove('hurry');
  }, [hurry, root]);
  if (!hurry) return null;
  return (
    <div className="countdown" key={s} aria-hidden>
      {s}
    </div>
  );
});

interface CellProps {
  zone: Zone;
  r: number;
  c: number;
  tile: Tile | null;
  cls: string;
  flags: string;
}

const Cell = memo(function Cell({ zone, r, c, tile, cls, flags }: CellProps) {
  return (
    <div className={`cell ${cls}`} data-zone={zone} data-r={r} data-c={c}>
      {tile && <TileView tile={tile} flags={flags} data-id={tile.id} />}
    </div>
  );
});

interface Props {
  view: RoomView;
  deadline: number | null;
  onLeave: () => void;
  flash: (msg: string) => void;
}

export function Game({ view, deadline, onLeave, flash }: Props) {
  const tiles = useMemo(() => view.tiles, [view.tiles.length]);
  const playing = view.phase === 'playing';
  const myTurn = playing && view.turnPlayerId === view.you;
  const committed = useMemo(() => new Set(gridIds(view.board)), [view.board]);

  const [board, setBoard] = useState<Grid>(() => view.draft ?? view.board);
  const [rack, setRack] = useState<Cells>(() => fitRack([], view.rack));
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<number[]>([]);
  const [drag, setDrag] = useState<{ ids: number[]; zone: Zone } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [banner, setBanner] = useState<number | null>(null);
  const [cw, setCw] = useState(40);
  const [rw, setRw] = useState(48);
  const [reactions, setReactions] = useState<(Reaction & { key: number })[]>([]);
  const [says, setSays] = useState<ChatMessage[]>([]);

  const boardRef = useRef(board);
  const rackRef = useRef(rack);
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const hoverEls = useRef<Element[]>([]);
  const hoverKey = useRef('');
  const places = useRef(new Map<number, Point>());
  const origins = useRef(new Map<number, Point>());
  const layoutSig = useRef('');
  const turnKey = useRef('');
  const lastTurn = useRef({ id: view.turnId, player: view.turnPlayerId });
  const prevRack = useRef<Set<number> | null>(null);
  const prevCounts = useRef<Map<string, number> | null>(null);
  const draftTimer = useRef<number | null>(null);
  const rejectTimer = useRef<number | null>(null);
  boardRef.current = board;
  rackRef.current = rack;

  useEffect(() => {
    const key = myTurn ? `mine:${view.turnId}` : 'other';
    const next = myTurn && turnKey.current === key ? boardRef.current : (view.draft ?? view.board);
    turnKey.current = key;

    const shown = new Set(gridIds(boardRef.current));
    const mine = new Set(view.rack);
    const actor = view.turnId === lastTurn.current.id ? view.turnPlayerId : lastTurn.current.player;
    lastTurn.current = { id: view.turnId, player: view.turnPlayerId };
    const chip = actor ? rootRef.current?.querySelector(`[data-player="${actor}"]`)?.getBoundingClientRect() : null;
    if (chip) {
      for (const id of gridIds(next)) {
        if (!shown.has(id) && !mine.has(id)) origins.current.set(id, { x: chip.left + 4, y: chip.top });
      }
    }

    const before = prevRack.current;
    prevRack.current = mine;
    if (before) {
      const added = view.rack.filter((id) => !before.has(id));
      if (added.length) {
        const bag = poolRef.current?.getBoundingClientRect();
        if (bag) added.forEach((id) => origins.current.set(id, { x: bag.left, y: bag.top, kind: 'fly' }));
        setFresh(new Set(added));
      }
    }

    const counts = new Map(view.players.map((p) => [p.id, p.count]));
    const root = rootRef.current;
    const bag = poolRef.current?.getBoundingClientRect();
    if (root && bag && prevCounts.current && playing && !reduceMotion()) {
      for (const p of view.players) {
        const was = prevCounts.current.get(p.id);
        if (p.id === view.you || was === undefined || p.count <= was) continue;
        const chip = root.querySelector(`[data-player="${p.id}"]`)?.getBoundingClientRect();
        if (!chip) continue;
        const card = document.createElement('div');
        card.className = 'fly-tile';
        root.appendChild(card);
        const dx = chip.left + 8 - bag.left;
        const dy = chip.top + 4 - bag.top;
        card.style.left = `${bag.left + 10}px`;
        card.style.top = `${bag.top + 4}px`;
        card
          .animate(
            [
              { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
              { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + 54}px) scale(1.15) rotate(-8deg)`, opacity: 1, offset: 0.5 },
              { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.2 },
            ],
            { duration: 820, easing: 'ease-in-out' },
          )
          .finished.finally(() => card.remove());
      }
    }
    prevCounts.current = counts;

    boardRef.current = next;
    setBoard(next);
    const onBoard = new Set(gridIds(next));
    setRack((prev) => fitRack(prev, view.rack.filter((id) => !onBoard.has(id))));
  }, [view, myTurn]);

  useEffect(() => {
    if (!myTurn) return;
    audio.turn();
    setBanner(view.turnId);
    document.title = '✨ Твой ход — Cozy Tiles';
    return () => {
      document.title = 'Cozy Tiles';
    };
  }, [myTurn, view.turnId]);

  const iWon = view.phase === 'ended' && view.result?.winnerId === view.you;
  useEffect(() => {
    if (iWon) audio.win();
  }, [iWon]);

  useEffect(() => {
    let seq = 0;
    const timers = new Set<number>();
    const onReaction = (r: Reaction) => {
      const item = { ...r, key: ++seq };
      setReactions((list) => [...list, item]);
      audio.pop();
      const t = window.setTimeout(() => {
        timers.delete(t);
        setReactions((list) => list.filter((x) => x.key !== item.key));
      }, 2400);
      timers.add(t);
    };
    const onChat = (m: ChatMessage) => {
      if (m.playerId === null) return;
      setSays((list) => [...list.filter((x) => x.playerId !== m.playerId), m]);
      const t = window.setTimeout(() => {
        timers.delete(t);
        setSays((list) => list.filter((x) => x.id !== m.id));
      }, 5000);
      timers.add(t);
    };
    socket.on('reaction', onReaction);
    socket.on('chat', onChat);
    return () => {
      socket.off('reaction', onReaction);
      socket.off('chat', onChat);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const side = (w > 1280 ? 2 * 190 : 0) + (w > 900 ? 250 : 0);
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
      const byW = (width - 28 - GAP * (BOARD_COLS - 1)) / BOARD_COLS;
      const byH = (height - 28 - GAP * (BOARD_ROWS - 1)) / BOARD_ROWS / 1.3;
      setCw(Math.max(16, Math.min(52, Math.floor(Math.min(byW, byH)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sig = `${cw}:${rw}:${window.innerWidth}:${window.innerHeight}`;
    const first = layoutSig.current === '';
    const animate = !reduceMotion() && (first || sig === layoutSig.current);
    const prev = places.current;
    const next = new Map<number, Point>();
    let dealt = 0;
    root.querySelectorAll<HTMLElement>('.cell > .tile[data-id]').forEach((el) => {
      const id = Number(el.dataset.id);
      const rect = el.parentElement!.getBoundingClientRect();
      next.set(id, { x: rect.left, y: rect.top });
      if (!animate) return;
      const from = origins.current.get(id) ?? prev.get(id);
      if (from) {
        const dx = from.x - rect.left;
        const dy = from.y - rect.top;
        const dist = Math.hypot(dx, dy);
        const at = `translate(${dx}px, ${dy}px)`;
        if (from.kind === 'fly') {
          el.animate(
            [
              { transform: `${at} scale(0.55) rotate(-12deg)`, opacity: 0.3, zIndex: 6 },
              { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 46}px) scale(1.25) rotate(4deg)`, opacity: 1, zIndex: 6, offset: 0.62 },
              { transform: 'translate(0, 0) scale(1)', opacity: 1, zIndex: 6 },
            ],
            { duration: 780, easing: 'ease-in-out' },
          );
        } else if (from.kind === 'drop') {
          el.animate(
            [
              { transform: `${at} translateY(-4px) rotate(3deg) scale(1.08)`, zIndex: 6 },
              { transform: 'translate(0, 0) scale(1)', zIndex: 6 },
            ],
            { duration: Math.min(520, 240 + dist * 0.4), easing: EASE },
          );
        } else if (dist >= 1) {
          el.animate([{ transform: at, zIndex: 5 }, { transform: 'translate(0, 0)', zIndex: 5 }], {
            duration: Math.min(620, 280 + dist * 0.45),
            easing: EASE,
          });
        }
      } else {
        el.animate(
          [
            { transform: 'translateY(10px) scale(0.6)', opacity: 0 },
            { transform: 'translateY(0) scale(1)', opacity: 1 },
          ],
          { duration: 320, delay: first ? dealt++ * 28 : 0, fill: 'backwards', easing: EASE },
        );
      }
    });
    origins.current.clear();
    places.current = next;
    layoutSig.current = sig;
  }, [board, rack, cw, rw, drag]);

  const sendDraft = useCallback(() => {
    if (draftTimer.current !== null) return;
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = null;
      socket.emit('turn:draft', boardRef.current);
    }, 120);
  }, []);

  const moveGroup = (ids: number[], from: Loc, to: Loc): boolean => {
    const touchesBoard = from.zone === 'board' || to.zone === 'board';
    if (touchesBoard && !myTurn) return false;
    if (from.zone === 'board' && to.zone === 'rack' && ids.some((id) => committed.has(id))) {
      audio.oops();
      flash('Плитки со стола нельзя забрать в руку');
      return false;
    }
    const moving = new Set(ids);
    const b = cloneGrid(boardRef.current);
    const s = rackRef.current.slice();
    if (from.zone === 'board') {
      for (const row of b) row.forEach((v, i) => v !== null && moving.has(v) && (row[i] = null));
    } else {
      s.forEach((v, i) => v !== null && moving.has(v) && (s[i] = null));
    }
    let ok: boolean;
    if (to.zone === 'board') ok = dropOnBoard(b[to.r], to.c, ids, tiles);
    else {
      const row = s.slice(to.r * RACK_COLS, (to.r + 1) * RACK_COLS);
      ok = insertGroup(row, to.c, ids);
      if (ok) s.splice(to.r * RACK_COLS, RACK_COLS, ...row);
    }
    if (!ok) {
      audio.oops();
      return false;
    }
    if (touchesBoard) {
      boardRef.current = b;
      setBoard(b);
      sendDraft();
    }
    const nextRack = fitRack(s, s.filter(isId));
    rackRef.current = nextRack;
    setRack(nextRack);
    setFresh((prev) => (ids.some((id) => prev.has(id)) ? new Set([...prev].filter((id) => !moving.has(id))) : prev));
    audio.tock();
    return true;
  };

  const setHover = (to: Loc | null, ids: number[]) => {
    const key = to ? `${to.zone}:${to.r}:${to.c}:${ids.length}` : '';
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    hoverEls.current.forEach((el) => el.classList.remove('over'));
    hoverEls.current = [];
    if (!to) return;
    const count = ids.length;
    const cols = to.zone === 'board' ? BOARD_COLS : RACK_COLS;
    const start = Math.max(0, Math.min(to.c, cols - count));
    let landing = ids.map((_, i) => start + i);
    if (to.zone === 'board' && myTurn) {
      const moving = new Set(ids);
      const row = boardRef.current[to.r].map((v) => (v !== null && moving.has(v) ? null : v));
      const plan = planDrop(row, to.c, ids, tiles);
      if (plan) landing = ids.map((id) => plan.indexOf(id));
    }
    for (const c of landing) {
      const el = rootRef.current?.querySelector(`[data-zone="${to.zone}"][data-r="${to.r}"][data-c="${c}"]`);
      if (!el) continue;
      el.classList.add('over');
      hoverEls.current.push(el);
    }
  };

  const placeGhost = () => {
    const g = gesture.current;
    if (g && ghostRef.current) ghostRef.current.style.transform = `translate3d(${g.x - g.offX}px, ${g.y - g.offY}px, 0)`;
  };

  const growSelection = () => {
    const g = gesture.current;
    if (!g || g.started) return;
    const c = g.from.c + g.ids.length;
    const next =
      g.from.zone === 'board'
        ? (boardRef.current[g.from.r]?.[c] ?? null)
        : c < RACK_COLS
          ? (rackRef.current[g.from.r * RACK_COLS + c] ?? null)
          : null;
    if (next === null || !continuesSet(g.ids.map((id) => tiles[id]), tiles[next])) return;
    g.ids = [...g.ids, next];
    setPicked(g.ids);
    audio.pick(g.ids.length);
    g.timer = window.setTimeout(() => handlers.current.growSelection(), HOLD_NEXT_MS);
  };

  const onMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    g.x = e.clientX;
    g.y = e.clientY;
    if (!g.started) {
      if (Math.hypot(g.x - g.startX, g.y - g.startY) < DRAG_SLOP) return;
      g.started = true;
      window.clearTimeout(g.timer);
      setPicked([]);
      setDrag({ ids: g.ids, zone: g.from.zone });
    }
    placeGhost();
    setHover(locate(g.x, g.y), g.ids);
  };

  const onUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    window.clearTimeout(g.timer);
    window.removeEventListener('pointermove', winMove);
    window.removeEventListener('pointerup', winUp);
    window.removeEventListener('pointercancel', winUp);
    setHover(null, []);
    setPicked([]);
    if (!g.started) return;
    g.ids.forEach((id, i) => origins.current.set(id, { x: e.clientX - g.offX + i * (g.w + GAP), y: e.clientY - g.offY, kind: 'drop' }));
    const to = e.type === 'pointercancel' ? null : locate(e.clientX, e.clientY);
    if (to) moveGroup(g.ids, g.from, to);
    setDrag(null);
  };

  const handlers = useRef({ onMove, onUp, growSelection });
  handlers.current = { onMove, onUp, growSelection };
  const winMove = useRef((e: PointerEvent) => handlers.current.onMove(e)).current;
  const winUp = useRef((e: PointerEvent) => handlers.current.onUp(e)).current;

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', winMove);
      window.removeEventListener('pointerup', winUp);
      window.removeEventListener('pointercancel', winUp);
      if (gesture.current) window.clearTimeout(gesture.current.timer);
      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
      if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current);
    },
    [winMove, winUp],
  );

  useLayoutEffect(placeGhost, [drag]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || busy || gesture.current) return;
    const tileEl = (e.target as HTMLElement).closest<HTMLElement>('.tile[data-id]');
    const cell = tileEl?.closest<HTMLElement>('[data-zone]');
    if (!tileEl || !cell) return;
    const from: Loc = { zone: cell.dataset.zone as Zone, r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
    if (from.zone === 'board' && !myTurn) return;
    e.preventDefault();
    const rect = cell.getBoundingClientRect();
    const id = Number(tileEl.dataset.id);
    gesture.current = {
      ids: [id],
      from,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      w: rect.width,
      started: false,
      timer: window.setTimeout(() => handlers.current.growSelection(), HOLD_FIRST_MS),
    };
    setPicked([id]);
    window.addEventListener('pointermove', winMove);
    window.addEventListener('pointerup', winUp);
    window.addEventListener('pointercancel', winUp);
  };

  const analysis = useMemo(() => {
    const cls = new Map<number, string>();
    const bad = new Set<number>();
    let meld = 0;
    let played = 0;
    for (const row of board) {
      let c = 0;
      while (c < row.length) {
        if (row[c] === null) {
          c++;
          continue;
        }
        let e = c;
        while (e < row.length && row[e] !== null) e++;
        const seg = row.slice(c, e) as number[];
        const value = setValue(seg.map((id) => tiles[id]));
        const own = seg.filter((id) => !committed.has(id)).length;
        played += own;
        if (value === null) seg.forEach((id) => bad.add(id));
        else {
          seg.forEach((id, i) => cls.set(id, i === 0 ? 's-start' : i === seg.length - 1 ? 's-end' : 's-mid'));
          if (own === seg.length) meld += value;
        }
        c = e;
      }
    }
    return { cls, bad, meld, played };
  }, [board, committed, tiles]);

  const resetTurn = () => {
    boardRef.current = view.board;
    setBoard(view.board);
    setRack((prev) => fitRack(prev, view.rack));
    socket.emit('turn:draft', view.board);
    audio.tock();
  };

  const sortRack = (mode: SortMode) => {
    const ids = rack.filter(isId);
    const { sets, rest } = arrange(ids, tiles, mode);
    setRack(fitRack(layoutRack(sets, rest, rack.length / RACK_COLS), ids));
    audio.tock();
  };

  const endTurn = async () => {
    setBusy(true);
    const ack = await call('turn:end', boardRef.current);
    setBusy(false);
    if (ack.ok) {
      setFresh(new Set());
      return;
    }
    audio.oops();
    flash(ack.error ?? 'Ход не принят');
    setRejected(true);
    if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current);
    rejectTimer.current = window.setTimeout(() => setRejected(false), 1600);
  };

  const drawTile = async () => {
    setBusy(true);
    const ack = await call('turn:draw');
    setBusy(false);
    if (!ack.ok) flash(ack.error ?? 'Не получилось');
  };

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const dragSet = useMemo(() => new Set(drag?.ids), [drag]);
  const canAct = myTurn && !busy;
  const style = { '--cw': `${cw}px`, '--rw': `${rw}px`, '--gap': `${GAP}px` } as CSSProperties;

  const flagsFor = (id: number, zone: Zone) => {
    let f = zone === 'rack' || myTurn ? 'grab' : '';
    if (dragSet.has(id)) f += ' ghosted';
    if (pickedSet.has(id)) f += ' picked';
    if (zone === 'board') {
      if (!committed.has(id)) f += ' new';
      if (rejected && analysis.bad.has(id)) f += ' bad';
    } else if (fresh.has(id)) f += ' fresh';
    return f;
  };

  return (
    <div className="game" style={style} ref={rootRef}>
      <header className="players">
        {view.players.map((p) => {
          const turn = playing && p.id === view.turnPlayerId;
          return (
            <div
              key={p.id}
              data-player={p.id}
              className={`chip ${turn ? 'turn' : ''} ${p.online ? '' : 'offline'} ${p.left ? 'left' : ''}`}
            >
              <div className="chip-avatar">
                <CatFace coat={p.avatar} awake={turn} />
                {turn && deadline !== null && view.turnSeconds > 0 && <Ring deadline={deadline} total={view.turnSeconds} />}
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
                      <b key={p.count} className="bump">
                        {p.count}
                      </b>{' '}
                      {tilesWord(p.count)}
                    </>
                  )}
                  {turn && deadline !== null && <Seconds deadline={deadline} />}
                </span>
              </div>
              {reactions
                .filter((r) => r.playerId === p.id)
                .map((r) => (
                  <span key={r.key} className="reaction">
                    {r.emoji}
                  </span>
                ))}
              {says
                .filter((m) => m.playerId === p.id)
                .map((m) => (
                  <span key={m.id} className="say">
                    {m.text.length > 70 ? `${m.text.slice(0, 70)}…` : m.text}
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

      <div className={`status-line ${myTurn ? 'mine' : ''}`} aria-live="polite">
        {myTurn ? (
          <strong>Твой ход ✨</strong>
        ) : (
          <span>Ходит {view.players.find((p) => p.id === view.turnPlayerId)?.name ?? '…'}</span>
        )}
        {view.last && <span className="last">· {view.last}</span>}
        {myTurn && !view.melded && (
          <span className={`meld ${analysis.meld >= INITIAL_MELD ? 'ok' : ''}`}>
            Первый выход: {analysis.meld} / {INITIAL_MELD}
          </span>
        )}
      </div>

      <div className="board-wrap" ref={wrapRef}>
        <div className={`board ${myTurn ? 'active' : ''}`} onPointerDown={onDown}>
          {board.map((row, r) =>
            row.map((id, c) => (
              <Cell
                key={r * BOARD_COLS + c}
                zone="board"
                r={r}
                c={c}
                tile={id === null ? null : tiles[id]}
                cls={id === null ? '' : (analysis.cls.get(id) ?? '')}
                flags={id === null ? '' : flagsFor(id, 'board')}
              />
            )),
          )}
        </div>
      </div>

      <footer className="shelf">
        <div className="decor">
          <SleepyCat awake={myTurn} />
        </div>
        <div className={`rack ${myTurn ? 'active' : ''}`} onPointerDown={onDown}>
          {rack.map((id, i) => (
            <Cell
              key={i}
              zone="rack"
              r={Math.floor(i / RACK_COLS)}
              c={i % RACK_COLS}
              tile={id === null ? null : tiles[id]}
              cls=""
              flags={id === null ? '' : flagsFor(id, 'rack')}
            />
          ))}
        </div>
        <div className="actions">
          <div className="sort-row">
            <button className="ghost small" onClick={() => sortRack('run')} title="Собрать ряды по порядку">
              1·2·3
            </button>
            <button className="ghost small" onClick={() => sortRack('group')} title="Собрать группы одинаковых чисел">
              7·7·7
            </button>
          </div>
          <button className="primary" disabled={!canAct || analysis.played === 0} onClick={endTurn}>
            Готово
          </button>
          <button className="soft" disabled={!canAct} onClick={drawTile}>
            {view.pool > 0 ? 'Взять плитку' : 'Пас'}
          </button>
          <button className="ghost small" disabled={!canAct || board === view.board} onClick={resetTurn}>
            ↺ Сбросить
          </button>
          <div className="reactions">
            {REACTIONS.map((emoji) => (
              <button key={emoji} className="emoji" onClick={() => socket.emit('react', emoji)} aria-label={`Реакция ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div className="decor">
          <Mug />
        </div>
      </footer>

      {drag && (
        <div className="drag-ghost" ref={ghostRef} style={drag.zone === 'rack' ? ({ '--cw': 'var(--rw)' } as CSSProperties) : undefined}>
          {drag.ids.map((id) => (
            <div key={id} className="ghost-slot">
              <TileView tile={tiles[id]} />
            </div>
          ))}
        </div>
      )}

      {myTurn && deadline !== null && <Countdown deadline={deadline} root={rootRef} />}

      {banner !== null && playing && (
        <div className="turn-banner" key={banner} aria-hidden>
          Твой ход ✨
        </div>
      )}

      {view.phase === 'ended' && view.result && <EndOverlay view={view} onLeave={onLeave} flash={flash} />}
    </div>
  );
}

function EndOverlay({ view, onLeave, flash }: Omit<Props, 'deadline'>) {
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
