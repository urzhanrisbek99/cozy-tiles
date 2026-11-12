import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '@core/rules';
import { RACK_COLS } from '@/features/arrange-tiles';

export const TILE_GAP = 3;
const TILE_RATIO = 1.3;
const BOARD_PADDING = 28;
const SIDE_DECOR = 380;
const SIDE_ACTIONS = 250;
const PHONE_WIDTH = 520;
const PHONE_BOARD_COLS = 10;
const PHONE_RACK_COLS = 8.5;
const SHORT_HEIGHT = 500;
const SHORT_BOARD_COLS = 18;
const SHORT_RACK_TILE = 34;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));
const isPhone = () => window.innerWidth <= PHONE_WIDTH;
const isShortLandscape = () => window.innerHeight <= SHORT_HEIGHT && window.innerWidth > window.innerHeight;

function rackTile() {
  const width = window.innerWidth;
  if (isShortLandscape()) return SHORT_RACK_TILE;
  if (isPhone()) return clamp((width - 40 - TILE_GAP * 8) / PHONE_RACK_COLS, 32, 46);
  const side = (width > 1280 ? SIDE_DECOR : 0) + (width > 900 ? SIDE_ACTIONS : 0);
  return clamp((width - side - 48 - TILE_GAP * (RACK_COLS - 1)) / RACK_COLS, 30, 50);
}

function boardTile(area: HTMLElement) {
  const { width, height } = area.getBoundingClientRect();
  const small = isPhone() || isShortLandscape();
  const cols = isShortLandscape() ? SHORT_BOARD_COLS : isPhone() ? PHONE_BOARD_COLS : BOARD_COLS;
  const byWidth = (width - BOARD_PADDING - TILE_GAP * (cols - 1)) / cols;
  const byHeight = (height - BOARD_PADDING - TILE_GAP * (BOARD_ROWS - 1)) / BOARD_ROWS / TILE_RATIO;
  return clamp(Math.min(byWidth, byHeight), small ? 20 : 16, 52);
}

export function useTileSizes(boardArea: RefObject<HTMLElement | null>) {
  const [board, setBoard] = useState(40);
  const [rack, setRack] = useState(rackTile);

  useEffect(() => {
    const measure = () => setRack(rackTile());
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useLayoutEffect(() => {
    const el = boardArea.current;
    if (!el) return;
    const measure = () => setBoard(boardTile(el));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardArea]);

  return { board, rack };
}
