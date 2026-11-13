import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
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
const LANDSCAPE_ACTIONS = 180;

export type Screen = 'desktop' | 'portrait' | 'landscape';

export interface TableUsage {
  boardCols: number;
  boardRows: number;
  rackLast: number;
  rackLength: number;
}

export interface TableLayout {
  screen: Screen;
  tile: number;
  rackTile: number;
  gap: number;
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

function fitTile(area: Size, cols: number, rows: number, padding: number, min: number) {
  const fit = (gap: number) => {
    const byWidth = (area.width - padding - gap * (cols - 1)) / cols;
    const byHeight = (area.height - padding - gap * (rows - 1)) / rows / TILE_RATIO;
    return clamp(Math.min(byWidth, byHeight), min, 52);
  };
  const tile = fit(GAP);
  return tile < TINY_TILE ? { tile: fit(TIGHT_GAP), gap: TIGHT_GAP } : { tile, gap: GAP };
}

function plan(screen: Screen, window: Size, area: Size, usage: TableUsage): TableLayout {
  if (screen === 'desktop') {
    const side = (window.width > 1280 ? SIDE_DECOR : 0) + (window.width > 900 ? SIDE_ACTIONS : 0);
    const { tile, gap } = fitTile(area, BOARD_COLS, BOARD_ROWS, 28, 16);
    return {
      screen,
      tile,
      gap,
      rackTile: clamp((window.width - side - 48 - GAP * (RACK_COLS - 1)) / RACK_COLS, 30, 50),
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      rackCols: RACK_COLS,
      rackCells: usage.rackLength,
      tiny: false,
    };
  }

  const portrait = screen === 'portrait';
  const cols = roundUp(usage.boardCols + 2, 4, portrait ? 12 : 16, BOARD_COLS);
  const rows = portrait ? BOARD_ROWS : roundUp(usage.boardRows + 1, 2, 4, BOARD_ROWS);
  const rackCols = portrait ? 9 : RACK_COLS;
  const rackWidth = portrait ? window.width - 36 : window.width - LANDSCAPE_ACTIONS - 44;
  const { tile, gap } = fitTile(area, cols, rows, 24, 8);
  return {
    screen,
    tile,
    gap,
    rackTile: clamp((rackWidth - GAP * (rackCols - 1)) / rackCols, 22, 44),
    cols,
    rows,
    rackCols,
    rackCells: Math.min(usage.rackLength, roundUp(usage.rackLast + 3, rackCols, portrait ? rackCols * 2 : rackCols, Infinity)),
    tiny: tile < TINY_TILE,
  };
}

export function useTableLayout(boardArea: RefObject<HTMLElement | null>, usage: TableUsage): TableLayout {
  const [window_, setWindow] = useState(viewport);
  const [area, setArea] = useState<Size>({ width: 600, height: 400 });

  useEffect(() => {
    const measure = () => setWindow(viewport());
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useLayoutEffect(() => {
    const el = boardArea.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setArea((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardArea]);

  const { boardCols, boardRows, rackLast, rackLength } = usage;
  return useMemo(
    () => plan(screenOf(window_), window_, area, { boardCols, boardRows, rackLast, rackLength }),
    [window_, area, boardCols, boardRows, rackLast, rackLength],
  );
}
