import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Loc, Zone } from '@/entities/tile';

const DRAG_SLOP = 6;
const HOLD_FIRST_MS = 320;
const HOLD_NEXT_MS = 190;
const SNAP_MARGIN = 28;

export interface DragState {
  ids: number[];
  zone: Zone;
}

interface Point {
  x: number;
  y: number;
}

interface Gesture {
  ids: number[];
  from: Loc;
  start: Point;
  at: Point;
  grab: Point;
  width: number;
  height: number;
  started: boolean;
  timer: number;
}

interface Options {
  root: RefObject<HTMLElement | null>;
  gap: number;
  disabled: boolean;
  canGrab: (from: Loc) => boolean;
  tileAt: (loc: Loc) => number | null;
  canExtend: (ids: number[], next: number) => boolean;
  landing: (ids: number[], to: Loc) => Loc[];
  onExtend: (count: number) => void;
  onDrop: (ids: number[], from: Loc, to: Loc | null, released: Point[]) => void;
}

const toLoc = (cell: HTMLElement): Loc => ({ zone: cell.dataset.zone as Zone, r: Number(cell.dataset.r), c: Number(cell.dataset.c) });

function nearestCell(area: Element, x: number, y: number): Loc | null {
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  area.querySelectorAll<HTMLElement>('[data-zone]').forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    const dist = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (dist < bestDist) {
      best = cell;
      bestDist = dist;
    }
  });
  return best ? toLoc(best) : null;
}

function locate(root: HTMLElement | null, x: number, y: number): Loc | null {
  const hit = document.elementFromPoint(x, y);
  const cell = hit?.closest<HTMLElement>('[data-zone]');
  if (cell) return toLoc(cell);
  for (const area of root?.querySelectorAll('.board, .rack') ?? []) {
    const rect = area.getBoundingClientRect();
    const inside =
      x >= rect.left - SNAP_MARGIN && x <= rect.right + SNAP_MARGIN && y >= rect.top - SNAP_MARGIN && y <= rect.bottom + SNAP_MARGIN;
    if (inside) return nearestCell(area, x, y);
  }
  return null;
}

const tileCentre = (g: Gesture, at: Point): Point => ({ x: at.x - g.grab.x + g.width / 2, y: at.y - g.grab.y + g.height / 2 });

export function useTileDrag(options: Options) {
  const [picked, setPicked] = useState<number[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const hovered = useRef<{ key: string; cells: Element[] }>({ key: '', cells: [] });
  const latest = useRef(options);
  latest.current = options;

  const highlight = (to: Loc | null, ids: number[]) => {
    const key = to ? `${to.zone}:${to.r}:${to.c}:${ids.length}` : '';
    if (key === hovered.current.key) return;
    hovered.current.cells.forEach((el) => el.classList.remove('over'));
    hovered.current = { key, cells: [] };
    if (!to) return;
    for (const cell of latest.current.landing(ids, to)) {
      const el = latest.current.root.current?.querySelector(`[data-zone="${cell.zone}"][data-r="${cell.r}"][data-c="${cell.c}"]`);
      if (!el) continue;
      el.classList.add('over');
      hovered.current.cells.push(el);
    }
  };

  const placeGhost = () => {
    const g = gesture.current;
    if (g && ghostRef.current) ghostRef.current.style.transform = `translate3d(${g.at.x - g.grab.x}px, ${g.at.y - g.grab.y}px, 0)`;
  };

  const extend = () => {
    const g = gesture.current;
    if (!g || g.started) return;
    const next = latest.current.tileAt({ ...g.from, c: g.from.c + g.ids.length });
    if (next === null || !latest.current.canExtend(g.ids, next)) return;
    g.ids = [...g.ids, next];
    setPicked(g.ids);
    latest.current.onExtend(g.ids.length);
    g.timer = window.setTimeout(() => handlers.current.extend(), HOLD_NEXT_MS);
  };

  const move = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    g.at = { x: e.clientX, y: e.clientY };
    if (!g.started) {
      if (Math.hypot(g.at.x - g.start.x, g.at.y - g.start.y) < DRAG_SLOP) return;
      g.started = true;
      window.clearTimeout(g.timer);
      setPicked([]);
      setDrag({ ids: g.ids, zone: g.from.zone });
    }
    placeGhost();
    const centre = tileCentre(g, g.at);
    highlight(locate(latest.current.root.current, centre.x, centre.y), g.ids);
  };

  const release = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    window.clearTimeout(g.timer);
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowUp);
    highlight(null, []);
    setPicked([]);
    if (!g.started) return;
    const released = g.ids.map((_, i) => ({
      x: e.clientX - g.grab.x + i * (g.width + latest.current.gap),
      y: e.clientY - g.grab.y,
    }));
    const centre = tileCentre(g, { x: e.clientX, y: e.clientY });
    const to = e.type === 'pointercancel' ? null : locate(latest.current.root.current, centre.x, centre.y);
    latest.current.onDrop(g.ids, g.from, to, released);
    setDrag(null);
  };

  const handlers = useRef({ move, release, extend });
  handlers.current = { move, release, extend };
  const onWindowMove = useRef((e: PointerEvent) => handlers.current.move(e)).current;
  const onWindowUp = useRef((e: PointerEvent) => handlers.current.release(e)).current;

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      if (gesture.current) window.clearTimeout(gesture.current.timer);
    },
    [onWindowMove, onWindowUp],
  );

  useLayoutEffect(placeGhost, [drag]);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || options.disabled || gesture.current) return;
    const tile = (e.target as HTMLElement).closest<HTMLElement>('.tile[data-id]');
    const cell = tile?.closest<HTMLElement>('[data-zone]');
    if (!tile || !cell) return;
    const from: Loc = { zone: cell.dataset.zone as Zone, r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
    if (!options.canGrab(from)) return;
    e.preventDefault();
    const rect = cell.getBoundingClientRect();
    const id = Number(tile.dataset.id);
    const at = { x: e.clientX, y: e.clientY };
    gesture.current = {
      ids: [id],
      from,
      start: at,
      at,
      grab: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      width: rect.width,
      height: rect.height,
      started: false,
      timer: window.setTimeout(() => handlers.current.extend(), HOLD_FIRST_MS),
    };
    setPicked([id]);
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
  };

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const draggedSet = useMemo(() => new Set(drag?.ids), [drag]);

  return { onPointerDown, drag, ghostRef, picked: pickedSet, dragged: draggedSet };
}
