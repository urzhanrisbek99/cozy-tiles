import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BOARD_COLS, INITIAL_MELD, gridIds, type Grid } from '@core/rules';
import type { RoomView } from '@core/types';
import { Cell, TileView, type Loc, type Zone } from '@/entities/tile';
import { flyTile, useTileMotion } from '@/features/animate-tiles';
import {
  RACK_COLS,
  continuesSet,
  dropOnBoard,
  fitRack,
  insertGroup,
  liftFromBoard,
  planBoard,
  sortRack,
  type Cells,
  type DropOptions,
  type SortMode,
} from '@/features/arrange-tiles';
import { useTileDrag } from '@/features/drag-tiles';
import { Countdown } from '@/features/turn-timer';
import { call, socket } from '@/shared/api/socket';
import { audio } from '@/shared/lib/audio/engine';
import { prefersReducedMotion } from '@/shared/lib/motion';
import { Mug, SleepyCat } from '@/shared/ui/illustrations';
import { GameResult } from '@/widgets/game-result';
import { PlayersBar } from '@/widgets/players-bar';
import { TurnActions } from '@/widgets/turn-actions';
import { analyseBoard } from '../model/analyseBoard';
import { useTableLayout } from '../model/useTableLayout';

const DRAFT_THROTTLE_MS = 120;
const REJECT_FLASH_MS = 1600;

interface Props {
  view: RoomView;
  deadline: number | null;
  onLeave: () => void;
  flash: (message: string) => void;
}

const without = (cells: Cells, ids: Set<number>): Cells => cells.map((v) => (v !== null && ids.has(v) ? null : v));
const isTile = (v: number | null): v is number => v !== null;

export function GamePage({ view, deadline, onLeave, flash }: Props) {
  const tiles = useMemo(() => view.tiles, [view.tiles.length]);
  const playing = view.phase === 'playing';
  const myTurn = playing && view.turnPlayerId === view.you;
  const committed = useMemo(() => new Set(gridIds(view.board)), [view.board]);
  const dropOptions = useMemo<DropOptions>(
    () => (view.melded ? {} : { frozen: (id) => committed.has(id) }),
    [view.melded, committed],
  );

  const [board, setBoard] = useState<Grid>(() => view.draft ?? view.board);
  const [rack, setRack] = useState<Cells>(() => fitRack([], view.rack));
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [banner, setBanner] = useState<number | null>(null);
  const [resultHidden, setResultHidden] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef(board);
  const rackRef = useRef(rack);
  const turnKey = useRef('');
  const lastTurn = useRef({ id: view.turnId, player: view.turnPlayerId });
  const knownRack = useRef<Set<number> | null>(null);
  const knownCounts = useRef<Map<string, number> | null>(null);
  const draftTimer = useRef<number | null>(null);
  const rejectTimer = useRef<number | null>(null);
  boardRef.current = board;
  rackRef.current = rack;

  const usage = useMemo(() => {
    let firstCol = BOARD_COLS;
    let lastCol = -1;
    let firstRow = board.length;
    let lastRow = -1;
    board.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v === null) return;
        firstCol = Math.min(firstCol, c);
        lastCol = Math.max(lastCol, c);
        firstRow = Math.min(firstRow, r);
        lastRow = Math.max(lastRow, r);
      }),
    );
    return { firstCol, lastCol, firstRow, lastRow, rackLast: rack.findLastIndex(isTile), rackLength: rack.length };
  }, [board, rack]);
  const layout = useTableLayout(boardAreaRef, usage);

  const sendDraft = useCallback(() => {
    if (draftTimer.current !== null) return;
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = null;
      socket.emit('turn:draft', boardRef.current);
    }, DRAFT_THROTTLE_MS);
  }, []);

  const moveTiles = (ids: number[], from: Loc, to: Loc): boolean => {
    const touchesBoard = from.zone === 'board' || to.zone === 'board';
    if (touchesBoard && !myTurn) return false;
    if (from.zone === 'board' && to.zone === 'rack' && ids.some((id) => committed.has(id))) {
      audio.oops();
      flash('Плитки со стола нельзя забрать в руку');
      return false;
    }
    const moving = new Set(ids);
    let nextBoard: Grid | null = liftFromBoard(boardRef.current, ids, tiles);
    const cells = without(rackRef.current, moving);
    if (to.zone === 'board') nextBoard = dropOnBoard(nextBoard, to.r, to.c, ids, tiles, dropOptions);
    else {
      const row = cells.slice(to.r * RACK_COLS, (to.r + 1) * RACK_COLS);
      if (insertGroup(row, to.c, ids)) cells.splice(to.r * RACK_COLS, RACK_COLS, ...row);
      else nextBoard = null;
    }
    if (!nextBoard) {
      audio.oops();
      return false;
    }
    if (touchesBoard) {
      boardRef.current = nextBoard;
      setBoard(nextBoard);
      sendDraft();
    }
    const nextRack = fitRack(cells, cells.filter(isTile));
    rackRef.current = nextRack;
    setRack(nextRack);
    setFresh((prev) => (ids.some((id) => prev.has(id)) ? new Set([...prev].filter((id) => !moving.has(id))) : prev));
    audio.tock();
    return true;
  };

  const landingCells = (ids: number[], to: Loc): Loc[] => {
    const cols = to.zone === 'board' ? BOARD_COLS : RACK_COLS;
    const start = Math.max(0, Math.min(to.c, cols - ids.length));
    const plain = ids.map((_, i) => ({ ...to, c: start + i }));
    if (to.zone !== 'board' || !myTurn) return plain;
    const moving = new Set(ids);
    const plan = planBoard(liftFromBoard(boardRef.current, ids, tiles), to.r, to.c, ids, tiles, dropOptions);
    if (!plan) return plain;
    const cells: Loc[] = [];
    plan.forEach((row, r) => row.forEach((v, c) => v !== null && moving.has(v) && cells.push({ zone: 'board', r, c })));
    return cells;
  };

  const drag = useTileDrag({
    root: rootRef,
    gap: layout.gap,
    disabled: busy,
    canGrab: (from) => from.zone === 'rack' || myTurn,
    tileAt: ({ zone, r, c }) => {
      if (zone === 'board') return boardRef.current[r]?.[c] ?? null;
      return c < RACK_COLS ? (rackRef.current[r * RACK_COLS + c] ?? null) : null;
    },
    canExtend: (ids, next) => continuesSet(ids.map((id) => tiles[id]), tiles[next]),
    landing: landingCells,
    onExtend: (count) => audio.pick(count),
    onDrop: (ids, from, to, released) => {
      ids.forEach((id, i) => motion.startFrom(id, { ...released[i], kind: 'drop' }));
      if (to) moveTiles(ids, from, to);
    },
  });

  const motion = useTileMotion(rootRef, `${layout.tile}:${layout.rackTile}:${layout.col0}:${layout.row0}:${layout.cols}:${layout.rows}:${layout.rackCells}`, [board, rack, drag.drag]);

  useEffect(() => {
    const key = myTurn ? `mine:${view.turnId}` : 'other';
    const next = myTurn && turnKey.current === key ? boardRef.current : (view.draft ?? view.board);
    turnKey.current = key;

    const root = rootRef.current;
    const chipOf = (id: string | null) => (id ? root?.querySelector(`[data-player="${id}"]`)?.getBoundingClientRect() : undefined);
    const bag = poolRef.current?.getBoundingClientRect();

    const shown = new Set(gridIds(boardRef.current));
    const mine = new Set(view.rack);
    const actor = chipOf(view.turnId === lastTurn.current.id ? view.turnPlayerId : lastTurn.current.player);
    lastTurn.current = { id: view.turnId, player: view.turnPlayerId };
    if (actor) {
      for (const id of gridIds(next)) {
        if (!shown.has(id) && !mine.has(id)) motion.startFrom(id, { x: actor.left + 4, y: actor.top });
      }
    }

    const drawn = knownRack.current ? view.rack.filter((id) => !knownRack.current!.has(id)) : [];
    knownRack.current = mine;
    if (drawn.length) {
      if (bag) drawn.forEach((id) => motion.startFrom(id, { x: bag.left, y: bag.top, kind: 'fly' }));
      setFresh(new Set(drawn));
    }

    if (root && bag && knownCounts.current && playing && !prefersReducedMotion()) {
      for (const p of view.players) {
        const before = knownCounts.current.get(p.id);
        const chip = chipOf(p.id);
        if (p.id !== view.you && before !== undefined && p.count > before && chip) flyTile(root, bag, chip);
      }
    }
    knownCounts.current = new Map(view.players.map((p) => [p.id, p.count]));

    boardRef.current = next;
    setBoard(next);
    const onBoard = new Set(gridIds(next));
    setRack((prev) => fitRack(prev, view.rack.filter((id) => !onBoard.has(id))));
  }, [view, myTurn, playing, motion]);

  useEffect(() => {
    if (!myTurn) return;
    audio.turn();
    setBanner(view.turnId);
    document.title = '✨ Твой ход — Cozy Tiles';
    return () => {
      document.title = 'Cozy Tiles';
    };
  }, [myTurn, view.turnId]);

  useEffect(
    () => () => {
      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
      if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current);
    },
    [],
  );

  const analysis = useMemo(() => analyseBoard(board, tiles, committed), [board, tiles, committed]);

  const resetTurn = () => {
    boardRef.current = view.board;
    setBoard(view.board);
    setRack((prev) => fitRack(prev, view.rack));
    socket.emit('turn:draft', view.board);
    audio.tock();
  };

  const sortTiles = (mode: SortMode) => {
    setRack(sortRack(rack, tiles, mode));
    audio.tock();
  };

  const finishTurn = async () => {
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
    rejectTimer.current = window.setTimeout(() => setRejected(false), REJECT_FLASH_MS);
  };

  const drawTile = async () => {
    setBusy(true);
    const ack = await call('turn:draw');
    setBusy(false);
    if (!ack.ok) flash(ack.error ?? 'Не получилось');
  };

  const flagsFor = (id: number, zone: Zone) => {
    let flags = zone === 'rack' || myTurn ? 'grab' : '';
    if (drag.dragged.has(id)) flags += ' ghosted';
    if (drag.picked.has(id)) flags += ' picked';
    if (zone === 'rack') return fresh.has(id) ? `${flags} fresh` : flags;
    if (!committed.has(id)) flags += ' new';
    if (rejected && analysis.invalid.has(id)) flags += ' bad';
    return flags;
  };

  const style = {
    '--cw': `${layout.tile}px`,
    '--rw': `${layout.rackTile}px`,
    '--gap': `${layout.gap}px`,
    '--cols': layout.cols,
    '--rack-cols': layout.rackCols,
  } as CSSProperties;
  const ended = view.phase === 'ended' && view.result !== null;
  const turnPlayer = view.players.find((p) => p.id === view.turnPlayerId);

  return (
    <div className={`game ${layout.tiny ? 'tiny' : ''}`} style={style} ref={rootRef}>
      <PlayersBar view={view} deadline={deadline} placedThisTurn={analysis.placed} poolRef={poolRef} />

      <div className={`status-line ${myTurn ? 'mine' : ''}`} aria-live="polite">
        {myTurn && <strong>Твой ход ✨</strong>}
        {!myTurn && turnPlayer && <span>Ходит {turnPlayer.name}</span>}
        {view.last && <span className="last">{playing ? '· ' : ''}{view.last}</span>}
        {myTurn && !view.melded && (
          <span className={`meld ${analysis.meldValue >= INITIAL_MELD ? 'ok' : ''}`}>
            Первый выход: {analysis.meldValue} / {INITIAL_MELD}
          </span>
        )}
        {ended && resultHidden && (
          <button className="result-chip" onClick={() => setResultHidden(false)}>
            🏆 Результаты
          </button>
        )}
      </div>

      <div className="board-wrap" ref={boardAreaRef}>
        <div className={`board ${myTurn ? 'active' : ''}`} onPointerDown={drag.onPointerDown}>
          {board.slice(layout.row0, layout.row0 + layout.rows).map((row, i) =>
            row.slice(layout.col0, layout.col0 + layout.cols).map((id, j) => (
              <Cell
                key={(layout.row0 + i) * BOARD_COLS + layout.col0 + j}
                zone="board"
                r={layout.row0 + i}
                c={layout.col0 + j}
                tile={id === null ? null : tiles[id]}
                cls={id === null ? '' : (analysis.setEdge.get(id) ?? '')}
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
        <div className={`rack ${myTurn ? 'active' : ''}`} onPointerDown={drag.onPointerDown}>
          {rack.slice(0, layout.rackCells).map((id, i) => (
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
        <TurnActions
          canAct={myTurn && !busy}
          canFinish={analysis.placed > 0}
          canDraw={analysis.placed === 0}
          canReset={board !== view.board}
          poolEmpty={view.pool === 0}
          onSort={sortTiles}
          onFinish={finishTurn}
          onDraw={drawTile}
          onReset={resetTurn}
        />
        <div className="decor">
          <Mug />
        </div>
      </footer>

      {drag.drag && (
        <div
          className="drag-ghost"
          ref={drag.ghostRef}
          style={drag.drag.zone === 'rack' ? ({ '--cw': 'var(--rw)' } as CSSProperties) : undefined}
        >
          {drag.drag.ids.map((id) => (
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

      {ended && <GameResult view={view} hidden={resultHidden} onHide={() => setResultHidden(true)} onLeave={onLeave} flash={flash} />}
    </div>
  );
}
