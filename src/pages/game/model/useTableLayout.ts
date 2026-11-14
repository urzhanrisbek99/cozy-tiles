import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '@core/rules';
import { RACK_COLS } from '@/features/arrange-tiles';
import { localRect, screenMode, viewportSize, type Screen, type Size } from '@/shared/lib/viewport';

const TILE_RATIO = 1.3;
const GAP = 3;
const TIGHT_GAP = 2;
const TINY_TILE = 18;
const SIDE_DECOR = 380;
const SIDE_ACTIONS = 250;
const RACK_PADDING = 20;
const PHONE_PADDING = { portrait: 16, landscape: 12 };
const RACK_ROWS = 2;
const RACK_TILE = { portrait: 40, landscape: 28 };
const PHONE_TILE = 40;
const ZOOM = [36, 31, 27, 23, 20, 17, 14, 12, 10, 8];
const CROWDED = 0.45;
const ROOMY = 0.35;

export interface TableUsage {
  firstCol: number;
  lastCol: number;
  firstRow: number;
  lastRow: number;
  tiles: number;
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
  rackHeight: number | null;
  tiny: boolean;
  zoom: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));

interface Span {
  start: number;
  size: number;
}

const usedSpan = (first: number, last: number): Span | null => (last < 0 ? null : { start: first, size: last - first + 1 });

function place(used: Span | null, size: number, total: number, keep?: number) {
  const last = total - size;
  if (!used) return clamp(keep ?? last / 2, 0, last);
  const margin = Math.max(0, Math.min(1, Math.floor((size - used.size) / 2)));
  const lowest = clamp(used.start + used.size + margin - size, 0, last);
  const highest = Math.max(lowest, Math.min(last, used.start - margin));
  return clamp(keep ?? (lowest + highest) / 2, lowest, highest);
}

function zoomLevel(area: Size, padding: number, usedCols: number, usedRows: number, tiles: number, shown?: number) {
  const count = (space: number, cell: number, total: number) => clamp((space - padding + GAP) / (cell + GAP), 1, total);
  let level = { zoom: ZOOM[0], cols: 1, rows: 1 };
  for (const zoom of ZOOM) {
    const cols = count(area.width, zoom, BOARD_COLS);
    const rows = count(area.height, zoom * TILE_RATIO, BOARD_ROWS);
    level = { zoom, cols, rows };
    const whole = cols === BOARD_COLS && rows === BOARD_ROWS;
    const room = shown !== undefined && zoom > shown ? ROOMY : CROWDED;
    if (whole || (cols >= usedCols && rows >= usedRows && tiles <= cols * rows * room)) break;
  }
  return level;
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

function packRack(width: number, cells: number, fewest: number, largest: number) {
  const firstCols = Math.max(fewest, Math.floor((width + GAP) / (largest + GAP)));
  const fit = (cols: number, rows: number, height: number) =>
    Math.min((width - GAP * (cols - 1)) / cols, (height - GAP * (rows - 1)) / rows / TILE_RATIO);
  const base = clamp(fit(firstCols, 1, Infinity), 20, largest);
  const height = RACK_ROWS * base * TILE_RATIO + GAP * (RACK_ROWS - 1) + 1;
  let best = { cols: firstCols, rows: RACK_ROWS, tile: 0, height };
  for (let cols = firstCols; cols <= firstCols * 3; cols++) {
    const rows = Math.max(RACK_ROWS, Math.ceil(cells / cols));
    const tile = clamp(fit(cols, rows, height), 10, largest);
    if (tile > best.tile) best = { cols, rows, tile, height };
  }
  return best;
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
      rackHeight: null,
      tiny: false,
      zoom: 0,
    };
  }

  const portrait = screen === 'portrait';
  const usedCols = usedSpan(usage.firstCol, usage.lastCol);
  const usedRows = usedSpan(usage.firstRow, usage.lastRow);
  const padding = PHONE_PADDING[screen];
  const level = zoomLevel(area, padding, usedCols?.size ?? 0, usedRows?.size ?? 0, usage.tiles, shown?.zoom);
  const { tile, gap } = fitTile(area, level.cols, level.rows, padding, 8, PHONE_TILE);
  const rack = packRack(area.width - RACK_PADDING, usage.rackLast + 2, portrait ? 9 : 12, RACK_TILE[screen]);
  return {
    screen,
    tile,
    gap,
    rackTile: rack.tile,
    col0: place(usedCols, level.cols, BOARD_COLS, shown?.col0),
    row0: place(usedRows, level.rows, BOARD_ROWS, shown?.row0),
    cols: level.cols,
    rows: level.rows,
    rackCols: rack.cols,
    rackCells: Math.min(usage.rackLength, rack.cols * rack.rows),
    rackHeight: rack.height,
    tiny: tile < TINY_TILE,
    zoom: level.zoom,
  };
}

export function useTableLayout(boardArea: RefObject<HTMLElement | null>, usage: TableUsage): TableLayout {
  const [window_, setWindow] = useState(viewportSize);
  const [area, setArea] = useState<Size>({ width: 600, height: 400 });
  const shown = useRef<TableLayout | null>(null);

  useLayoutEffect(() => {
    const el = boardArea.current;
    if (!el) return;
    const same = (a: Size, b: Size) => a.width === b.width && a.height === b.height;
    const measure = () => {
      const { width, height } = localRect(el);
      const next = viewportSize();
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

  const { firstCol, lastCol, firstRow, lastRow, tiles, rackLast, rackLength } = usage;
  return useMemo(() => {
    const screen = screenMode();
    const before = shown.current?.screen === screen ? shown.current : null;
    shown.current = plan(screen, window_, area, { firstCol, lastCol, firstRow, lastRow, tiles, rackLast, rackLength }, before);
    return shown.current;
  }, [window_, area, firstCol, lastCol, firstRow, lastRow, tiles, rackLast, rackLength]);
}
