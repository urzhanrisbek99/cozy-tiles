import type { ReactNode } from 'react';
import { Glyph } from '@/entities/tile';

export function Logo({ title = 'Cozy Tiles', children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="logo">
      <div className="logo-tiles" aria-hidden>
        {[0, 1, 2, 3].map((c) => (
          <span key={c} className={`logo-tile c${c}`}>
            {7}
            <Glyph color={c} />
          </span>
        ))}
      </div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
