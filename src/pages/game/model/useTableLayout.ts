import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '@core/rules';
import { RACK_COLS } from '@/features/arrange-tiles';

const TILE_RATIO = 1.3;
const GAP = 3;
const TIGHT_GAP = 2;
const TINY_TILE = 18;
const PHONE_WIDTH = 520;
const SHORT_HEIGHT = 500;
const SIDE_DECOR = 380;
const SIDE_ACTIONS = 250;
const RACK_PADDING = 20;
const PHONE_PADDING = 16;
const PHONE_TILE = 40;
const WIDE_RACK = 20;

export type Screen = 'desktop' | 'portrait' | 'landscape';

export interface TableUsage {
  firstCol: number;
  lastCol: number;
  firstRow: number;
  lastRow: number;
  rackLast: number;
  rackLength: number;
}

export interface TableLayout {
  screen: Screen;
  tile: number;
  rackTile: number;
  gap: number;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
  rackCols: number;
  rackCells: number;
  tiny: boolean;
}

interface Size {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));
const roundUp = (value: number, step: number, min: number, max: number) => Math.min(max, Math.max(min, Math.ceil(value / step) * step));
const viewport = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

function screenOf({ width, height }: Size): Screen {
  if (height <= SHORT_HEIGHT && width > height) return 'landscape';
  return width <= PHONE_WIDTH ? 'portrait' : 'desktop';
}

interface Span {
  start: number;
  size: number;
}

function widen({ start, size }: Span, target: number, total: number, keep?: number): Span {
  const next = Math.min(total, Math.max(size, target));
  const lowest = Math.max(0, start + size - next);
  const highest = Math.min(start, total - next);
  return { start: clamp(keep ?? start - (next - size) / 2, lowest, highest), size: next };
}

function usedSpan(first: number, last: number, min: number, total: number, keep?: number): Span {
  if (last < 0) return widen({ start: total / 2, size: 0 }, min, total, keep);
  const start = Math.max(0, Math.floor((first - 1) / 2) * 2);
  const end = Math.min(total, Math.ceil((last + 2) / 2) * 2);
  return widen({ start, size: end - start }, min, total, keep);
}

function fitTile(area: Size, cols: number, rows: number, padding: number, min: number, max = 52) {
  const fit = (gap: number) => {
    const byWidth = (area.width - padding - gap * (cols - 1)) / cols;
    const byHeight = (area.height - padding - gap * (rows - 1)) / rows / TILE_RATIO;
    return clamp(Math.min(byWidth, byHeight), min, max);
  };
  const tile = fit(GAP);
  return tile < TINY_TILE ? { tile: fit(TIGHT_GAP), gap: TIGHT_GAP } : { tile, gap: GAP };
}

function plan(screen: Screen, window: Size, area: Size, usage: TableUsage, shown: TableLayout | null): TableLayout {
  if (screen === 'desktop') {
    const side = (window.width > 1280 ? SIDE_DECOR : 0) + (window.width > 900 ? SIDE_ACTIONS : 0);
    const { tile, gap } = fitTile(area, BOARD_COLS, BOARD_ROWS, 28, 16);
    return {
      screen,
      tile,
      gap,
      rackTile: clamp((window.width - side - 48 - GAP * (RACK_COLS - 1)) / RACK_COLS, 30, 50),
      col0: 0,
      row0: 0,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      rackCols: RACK_COLS,
      rackCells: usage.rackLength,
      tiny: false,
    };
  }

  const portrait = screen === 'portrait';
  const needCols = usedSpan(usage.firstCol, usage.lastCol, portrait ? 9 : 12, BOARD_COLS, shown?.col0);
  const needRows = usedSpan(usage.firstRow, usage.lastRow, portrait ? 4 : 3, BOARD_ROWS, shown?.row0);
  const { tile, gap } = fitTile(area, needCols.size, needRows.size, PHONE_PADDING, 8, PHONE_TILE);
  const cols = widen(needCols, Math.floor((area.width - PHONE_PADDING + gap) / (tile + gap)), BOARD_COLS, shown?.col0);
  const rows = widen(needRows, Math.floor((area.height - PHONE_PADDING + gap) / (tile * TILE_RATIO + gap)), BOARD_ROWS, shown?.row0);
  const oneMoreRow = usage.rackLast >= RACK_COLS && usage.rackLast < WIDE_RACK - 1;
  const rackCols = portrait ? 9 : oneMoreRow ? WIDE_RACK : RACK_COLS;
  return {
    screen,
    tile,
    gap,
    rackTile: clamp((area.width - RACK_PADDING - GAP * (rackCols - 1)) / rackCols, 22, 44),
    col0: cols.start,
    row0: rows.start,
    cols: cols.size,
    rows: rows.size,
    rackCols,
    rackCells: Math.min(usage.rackLength, roundUp(usage.rackLast + 2, rackCols, portrait ? rackCols * 2 : rackCols, Infinity)),
    tiny: tile < TINY_TILE,
  };
}

export function useTableLayout(boardArea: RefObject<HTMLElement | null>, usage: TableUsage): TableLayout {
  const [window_, setWindow] = useState(viewport);
  const [area, setArea] = useState<Size>({ width: 600, height: 400 });
  const shown = useRef<TableLayout | null>(null);

  useLayoutEffect(() => {
    const el = boardArea.current;
    if (!el) return;
    const same = (a: Size, b: Size) => a.width === b.width && a.height === b.height;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const next = viewport();
      setWindow((prev) => (same(prev, next) ? prev : next));
      setArea((prev) => (same(prev, { width, height }) ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [boardArea]);

  const { firstCol, lastCol, firstRow, lastRow, rackLast, rackLength } = usage;
  return useMemo(() => {
    const screen = screenOf(window_);
    const before = shown.current?.screen === screen ? shown.current : null;
    shown.current = plan(screen, window_, area, { firstCol, lastCol, firstRow, lastRow, rackLast, rackLength }, before);
    return shown.current;
  }, [window_, area, firstCol, lastCol, firstRow, lastRow, rackLast, rackLength]);
}
