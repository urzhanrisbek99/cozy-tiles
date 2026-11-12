import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '@core/rules';
import { RACK_COLS } from '@/features/arrange-tiles';

export const TILE_GAP = 3;
const TILE_RATIO = 1.3;
const BOARD_PADDING = 28;
const SIDE_DECOR = 380;
const SIDE_ACTIONS = 250;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));

export function useTileSizes(boardArea: RefObject<HTMLElement | null>) {
  const [board, setBoard] = useState(40);
  const [rack, setRack] = useState(48);

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      const side = (width > 1280 ? SIDE_DECOR : 0) + (width > 900 ? SIDE_ACTIONS : 0);
      setRack(clamp((width - side - 48 - TILE_GAP * (RACK_COLS - 1)) / RACK_COLS, 30, 50));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useLayoutEffect(() => {
    const el = boardArea.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const byWidth = (width - BOARD_PADDING - TILE_GAP * (BOARD_COLS - 1)) / BOARD_COLS;
      const byHeight = (height - BOARD_PADDING - TILE_GAP * (BOARD_ROWS - 1)) / BOARD_ROWS / TILE_RATIO;
      setBoard(clamp(Math.min(byWidth, byHeight), 16, 52));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardArea]);

  return { board, rack };
}
