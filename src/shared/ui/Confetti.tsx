import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/shared/lib/motion';

const COLORS = ['#f08aa2', '#ffbe4a', '#7fc8f8', '#b79cf0', '#8fdcaa', '#fff3c4', '#ff9f7a'];
const BURSTS_AT_MS = [0, 550, 1150, 1800, 2500, 3300];
const RAIN_MS = 5200;
const BURST_SIZE = 70;
const GRAVITY = 0.16;
const DRAG = 0.985;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  flip: number;
  color: string;
  life: number;
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function piece(x: number, y: number, vx: number, vy: number): Piece {
  return {
    x,
    y,
    vx,
    vy,
    size: 5 + Math.random() * 7,
    spin: (Math.random() - 0.5) * 0.3,
    angle: Math.random() * Math.PI,
    flip: Math.random() * Math.PI,
    color: pick(COLORS),
    life: 1,
  };
}

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || prefersReducedMotion()) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const pieces: Piece[] = [];
    const burst = () => {
      const x = width * (0.15 + Math.random() * 0.7);
      const y = height * (0.18 + Math.random() * 0.3);
      for (let i = 0; i < BURST_SIZE; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 9;
        pieces.push(piece(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2));
      }
    };
    const timers = BURSTS_AT_MS.map((ms) => window.setTimeout(burst, ms));

    const startedAt = performance.now();
    let last = startedAt;
    let frame = 0;
    const draw = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      const raining = now - startedAt < RAIN_MS;
      if (raining) for (let i = 0; i < 3; i++) pieces.push(piece(Math.random() * width, -12, (Math.random() - 0.5) * 2, 1 + Math.random() * 2));

      ctx.clearRect(0, 0, width, height);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.flip += 0.18 * dt;
        if (!raining) p.life -= 0.012 * dt;
        if (p.y > height + 20 || p.life <= 0) {
          pieces.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (raining || pieces.length) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
