import { memo, useEffect, useRef } from 'react';
import type { Mood } from './audio/engine';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Houses({ y, count, seed }: { y: number; count: number; seed: number }) {
  const rnd = seeded(seed);
  const houses = Array.from({ length: count }, (_, i) => {
    const w = 60 + rnd() * 50;
    const x = (i + 0.2 + rnd() * 0.5) * (1600 / count);
    const h = 40 + rnd() * 30;
    return { x, w, h, lit: rnd() > 0.25, tower: rnd() > 0.85 };
  });
  return (
    <g>
      {houses.map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${y - h.h})`}>
          <rect width={h.w} height={h.h + 20} fill="var(--house)" />
          <path d={`M-8 2 L${h.w / 2} ${-h.h * 0.7} L${h.w + 8} 2 Z`} fill="var(--roof)" />
          {h.tower && <path d={`M${h.w / 2 - 8} ${-h.h * 0.5} v-40 l8 -22 l8 22 v40 z`} fill="var(--roof)" />}
          <rect x={h.w * 0.2} y={h.h * 0.3} width="11" height="13" rx="2" fill={h.lit ? 'var(--window-lit)' : 'var(--window-dark)'} className={h.lit ? 'lit' : ''} />
          <rect x={h.w * 0.62} y={h.h * 0.3} width="11" height="13" rx="2" fill="var(--window-lit)" className="lit" />
        </g>
      ))}
    </g>
  );
}

function City() {
  const rnd = seeded(7);
  const blocks: { x: number; w: number; h: number }[] = [];
  let x = -20;
  while (x < 1620) {
    const w = 70 + rnd() * 90;
    blocks.push({ x, w, h: 120 + rnd() * 220 });
    x += w + 6 + rnd() * 18;
  }
  return (
    <g>
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={500 - b.h} width={b.w} height={b.h} fill={i % 2 ? 'var(--far)' : 'var(--near)'} />
          {Array.from({ length: Math.floor(b.h / 34) }, (_, r) =>
            Array.from({ length: Math.floor(b.w / 28) }, (_, c) =>
              rnd() > 0.6 ? (
                <rect key={`${r}-${c}`} x={b.x + 10 + c * 28} y={500 - b.h + 16 + r * 34} width="12" height="16" rx="2" fill="var(--window-lit)" className="lit" />
              ) : null,
            ),
          )}
        </g>
      ))}
    </g>
  );
}

function Trees({ seed, colors }: { seed: number; colors: string[] }) {
  const rnd = seeded(seed);
  return (
    <g>
      {Array.from({ length: 26 }, (_, i) => {
        const x = i * 64 + rnd() * 40;
        const y = 330 + rnd() * 50;
        const r = 26 + rnd() * 26;
        const color = colors[Math.floor(rnd() * colors.length)];
        return (
          <g key={i}>
            <rect x={x - 3} y={y} width="6" height={r} fill="var(--trunk)" />
            <circle cx={x} cy={y} r={r} fill={color} />
            <circle cx={x - r * 0.5} cy={y + r * 0.3} r={r * 0.6} fill={color} />
            <circle cx={x + r * 0.5} cy={y + r * 0.25} r={r * 0.65} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

function Landscape({ theme }: { theme: Mood }) {
  return (
    <svg className="land" viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {theme === 'rain' && (
        <>
          <path d="M0 250 C200 170 380 190 560 225 C760 140 960 150 1160 215 C1320 165 1480 185 1600 205 V500 H0Z" fill="var(--far)" />
          <path d="M0 330 C260 280 520 310 800 320 C1080 290 1340 280 1600 310 V500 H0Z" fill="var(--near)" />
          <Houses y={360} count={9} seed={3} />
          <rect y="400" width="1600" height="100" fill="var(--water)" />
          <path d="M620 400 q90 -60 180 0" stroke="var(--roof)" strokeWidth="14" fill="none" />
        </>
      )}
      {theme === 'night' && <City />}
      {theme === 'autumn' && (
        <>
          <path d="M0 300 C300 230 600 260 900 290 C1150 250 1400 240 1600 270 V500 H0Z" fill="var(--far)" />
          <Trees seed={11} colors={['#e0743f', '#c9473f', '#efa34a', '#d9603a']} />
          <path d="M0 410 C400 380 1000 390 1600 400 V500 H0Z" fill="var(--near)" />
        </>
      )}
      {theme === 'sakura' && (
        <>
          <path d="M420 330 L800 110 L1180 330 Z" fill="var(--far)" />
          <path d="M733 149 L800 110 L867 149 L842 162 L820 150 L800 166 L778 151 L755 163 Z" fill="#fbf4fb" />
          <rect y="320" width="1600" height="90" fill="var(--water)" />
          <path d="M760 330 h80 M720 352 h160 M770 374 h60" stroke="#ffe3c4" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          <path d="M0 400 C300 370 600 390 900 395 C1200 380 1400 370 1600 385 V500 H0Z" fill="var(--near)" />
          <Trees seed={5} colors={['#f6b6cc', '#f3a2bd', '#fbc9d8']} />
        </>
      )}
    </svg>
  );
}

function StringLights() {
  const bulbs = Array.from({ length: 22 }, (_, i) => {
    const t = i / 21;
    return { x: t * 1600, y: 18 + Math.sin(t * Math.PI * 3) ** 2 * 34 };
  });
  return (
    <svg className="lights" viewBox="0 0 1600 90" preserveAspectRatio="none" aria-hidden>
      <path d={`M ${bulbs.map((b) => `${b.x} ${b.y - 6}`).join(' L ')}`} stroke="#5b4636" strokeWidth="2" fill="none" />
      {bulbs.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r="7" className="bulb" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
      ))}
    </svg>
  );
}

function Branch() {
  const rnd = seeded(21);
  return (
    <svg className="branch" viewBox="0 0 500 260" aria-hidden>
      <path d="M500 20 C400 40 330 60 240 120 C190 150 140 160 60 170" stroke="#6b4a3c" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M330 70 C300 120 280 160 260 210" stroke="#6b4a3c" strokeWidth="6" fill="none" strokeLinecap="round" />
      {Array.from({ length: 40 }, (_, i) => {
        const t = rnd();
        const x = 60 + t * 440 + (rnd() - 0.5) * 60;
        const y = 170 - t * 150 + (rnd() - 0.5) * 70;
        return <circle key={i} cx={x} cy={y} r={8 + rnd() * 10} fill={rnd() > 0.5 ? '#f8c4d6' : '#f3a6c0'} opacity="0.95" />;
      })}
    </svg>
  );
}

interface Particle {
  x: number;
  y: number;
  s: number;
  v: number;
  a: number;
  p: number;
  r: number;
  c: string;
}

function Particles({ theme }: { theme: Mood }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = { rain: 110, night: 90, autumn: 22, sakura: 34 }[theme];
    const palette = {
      rain: ['rgba(225,232,255,0.35)'],
      night: ['#fff6d8', '#ffe9f4', '#e7e3ff'],
      autumn: ['#e0743f', '#c9473f', '#efa34a', '#d98b3a'],
      sakura: ['#f9c6d6', '#f4a9c2', '#ffe0ea'],
    }[theme];

    const spawn = (fresh: boolean): Particle => ({
      x: Math.random() * (w + 200) - 100,
      y: fresh ? Math.random() * h : -20 - Math.random() * 60,
      s: theme === 'rain' ? 10 + Math.random() * 14 : theme === 'night' ? 0.6 + Math.random() * 1.5 : 4 + Math.random() * 6,
      v: theme === 'rain' ? 9 + Math.random() * 6 : 0.5 + Math.random() * 0.9,
      a: Math.random() * Math.PI * 2,
      p: Math.random() * Math.PI * 2,
      r: (Math.random() - 0.5) * 0.04,
      c: palette[Math.floor(Math.random() * palette.length)],
    });

    const ps = Array.from({ length: reduce ? Math.ceil(base / 3) : base }, () => {
      const p = spawn(true);
      if (theme === 'night') p.y = Math.random() * h * 0.6;
      return p;
    });

    let shooting: { x: number; y: number; life: number } | null = null;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        if (theme === 'rain') {
          p.x += p.v * 0.18 * dt;
          p.y += p.v * dt;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.s * 0.18, p.y - p.s);
          ctx.stroke();
          if (p.y > h + 20) Object.assign(p, spawn(false));
        } else if (theme === 'night') {
          p.p += 0.02 * dt;
          ctx.globalAlpha = 0.35 + 0.65 * Math.sin(p.p) ** 2;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          p.p += 0.02 * dt;
          p.a += p.r * dt;
          p.y += p.v * dt;
          p.x += (Math.sin(p.p) * 0.9 + (theme === 'sakura' ? 0.5 : 0.2)) * dt;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.a);
          ctx.fillStyle = p.c;
          ctx.beginPath();
          if (theme === 'autumn') {
            ctx.ellipse(0, 0, p.s * 1.4, p.s * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(90,40,20,0.35)';
            ctx.beginPath();
            ctx.moveTo(-p.s * 1.4, 0);
            ctx.lineTo(p.s * 1.4, 0);
            ctx.stroke();
          } else {
            ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          if (p.y > h + 20 || p.x > w + 60) Object.assign(p, spawn(false));
        }
      }
      if (theme === 'night') {
        if (!shooting && Math.random() < 0.002 * dt) shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, life: 1 };
        if (shooting) {
          shooting.x += 9 * dt;
          shooting.y += 3.5 * dt;
          shooting.life -= 0.025 * dt;
          const g = ctx.createLinearGradient(shooting.x - 90, shooting.y - 35, shooting.x, shooting.y);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, `rgba(255,248,225,${Math.max(0, shooting.life)})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shooting.x - 90, shooting.y - 35);
          ctx.lineTo(shooting.x, shooting.y);
          ctx.stroke();
          if (shooting.life <= 0) shooting = null;
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  return <canvas ref={ref} className="particles" aria-hidden />;
}

export const Scene = memo(function Scene({ theme }: { theme: Mood }) {
  return (
    <div className="scene" aria-hidden>
      <div className="sky" />
      {theme === 'night' && <div className="moon" />}
      {theme === 'sakura' && <div className="sun" />}
      {theme === 'rain' && <div className="clouds" />}
      <Landscape theme={theme} />
      <Particles theme={theme} />
      {(theme === 'autumn' || theme === 'night') && <StringLights />}
      {theme === 'sakura' && <Branch />}
      <div className="lamp-glow" />
      <div className="vignette" />
    </div>
  );
});
