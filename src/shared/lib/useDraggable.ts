import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const EDGE = 8;

interface Point {
  x: number;
  y: number;
}

function read(key: string): Point | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? { x: saved.x, y: saved.y } : null;
  } catch {
    return null;
  }
}

function save(key: string, point: Point) {
  try {
    localStorage.setItem(key, JSON.stringify(point));
  } catch {
    return;
  }
}

export function useDraggable(storageKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<Point | null>(null);
  const [position, setPosition] = useState<Point | null>(() => read(storageKey));
  const latest = useRef(position);
  latest.current = position;

  const clamp = useCallback((point: Point): Point => {
    const el = ref.current;
    const maxX = window.innerWidth - (el?.offsetWidth ?? 0) - EDGE;
    const maxY = window.innerHeight - (el?.offsetHeight ?? 0) - EDGE;
    return { x: Math.max(EDGE, Math.min(point.x, maxX)), y: Math.max(EDGE, Math.min(point.y, maxY)) };
  }, []);

  useLayoutEffect(() => {
    setPosition((current) => current && clamp(current));
  }, [clamp]);

  useEffect(() => {
    const onResize = () => setPosition((current) => current && clamp(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    grab.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!grab.current) return;
    latest.current = clamp({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y });
    setPosition(latest.current);
  };

  const onPointerUp = () => {
    if (!grab.current) return;
    grab.current = null;
    if (latest.current) save(storageKey, latest.current);
  };

  const style: CSSProperties | undefined = position ? { left: position.x, top: position.y, right: 'auto' } : undefined;
  return { ref, style, handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}
