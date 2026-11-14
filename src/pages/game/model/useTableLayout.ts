import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS, type Grid } from '@core/rules';
import { RACK_COLS } from '@/features/arrange-tiles';
import { localRect, screenMode, viewportSize, type Screen, type Size } from '@/shared/lib/viewport';
import { GAP, TILE_RATIO, chooseView } from '../lib/tableView';

const TIGHT_GAP = 2;
const SMALL_TILE = 18;
const SIDE_DECOR = 380;
const SIDE_ACTIONS = 250;
const RACK_PADDING = 20;
const PHONE_PADDING = { portrait: 16, landscape: 12 };
const RACK_ROWS = 2;
const RACK_TILE = { portrait: 40, landscape: 28 };
const PHONE_TILE = 40;

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
  zoom: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));

function fitTile(area: Size, cols: number, rows: number, padding: number, min: number, max = 52) {
  const fit = (gap: number) => {
    const byWidth = (area.width - padding - gap * (cols - 1)) / cols;
    const byHeight = (area.height - padding - gap * (rows - 1)) / rows / TILE_RATIO;
    return clamp(Math.min(byWidth, byHeight), min, max);
  };
  const tile = fit(GAP);
  return tile < SMALL_TILE ? { tile: fit(TIGHT_GAP), gap: TIGHT_GAP } : { tile, gap: GAP };
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

interface Hand {
  last: number;
  length: number;
}

function plan(screen: Screen, window: Size, area: Size, board: Grid, hand: Hand, shown: TableLayout | null): TableLayout {
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
      rackCells: hand.length,
      rackHeight: null,
      zoom: 0,
    };
  }

  const padding = PHONE_PADDING[screen];
  const view = chooseView({ width: area.width - padding, height: area.height - padding }, board, shown?.zoom);
  const { tile, gap } = fitTile(area, view.cols, view.rows, padding, 8, PHONE_TILE);
  const rack = packRack(area.width - RACK_PADDING, hand.last + 2, screen === 'portrait' ? 9 : 12, RACK_TILE[screen]);
  return {
    screen,
    tile,
    gap,
    rackTile: rack.tile,
    col0: view.col0,
    row0: view.row0,
    cols: view.cols,
    rows: view.rows,
    rackCols: rack.cols,
    rackCells: Math.min(hand.length, rack.cols * rack.rows),
    rackHeight: rack.height,
    zoom: view.zoom,
  };
}

export function useTableLayout(boardArea: RefObject<HTMLElement | null>, board: Grid, rackLast: number, rackLength: number): TableLayout {
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

  return useMemo(() => {
    const screen = screenMode();
    const before = shown.current?.screen === screen ? shown.current : null;
    shown.current = plan(screen, window_, area, board, { last: rackLast, length: rackLength }, before);
    return shown.current;
  }, [window_, area, board, rackLast, rackLength]);
}
