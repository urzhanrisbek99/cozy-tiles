import { useLayoutEffect, useRef, type RefObject } from 'react';
import { EASE, prefersReducedMotion } from '@/shared/lib/motion';
import { localRect } from '@/shared/lib/viewport';

export interface Origin {
  x: number;
  y: number;
  kind?: 'drop' | 'fly';
}

function animateFrom(el: HTMLElement, from: Origin, dx: number, dy: number) {
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
}

export function useTileMotion(root: RefObject<HTMLElement | null>, layoutKey: string, deps: unknown[]) {
  const places = useRef(new Map<number, Origin>());
  const origins = useRef(new Map<number, Origin>());
  const lastLayout = useRef('');

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const layout = `${layoutKey}:${window.innerWidth}:${window.innerHeight}`;
    const first = lastLayout.current === '';
    const animate = !prefersReducedMotion() && (first || layout === lastLayout.current);
    const prev = places.current;
    const next = new Map<number, Origin>();
    let dealt = 0;
    el.querySelectorAll<HTMLElement>('.cell > .tile[data-id]').forEach((tile) => {
      const id = Number(tile.dataset.id);
      const rect = localRect(tile.parentElement!);
      next.set(id, { x: rect.left, y: rect.top });
      if (!animate) return;
      const from = origins.current.get(id) ?? prev.get(id);
      if (from) animateFrom(tile, from, from.x - rect.left, from.y - rect.top);
      else {
        tile.animate(
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
    lastLayout.current = layout;
  }, [layoutKey, ...deps]);

  return useRef({
    startFrom: (id: number, origin: Origin) => origins.current.set(id, origin),
  }).current;
}
