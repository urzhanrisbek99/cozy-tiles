import type { HTMLAttributes } from 'react';
import type { Tile } from '@core/rules';
import { CatFace } from '@/entities/player';

export const COLOR_NAMES = ['розовые сердечки', 'голубые капельки', 'медовые звёздочки', 'чернильные луны'];

const GLYPHS = [
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  'M12 2.7S5 10.3 5 15a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3z',
  'M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21.2l1.6-7L2 9.5l7.1-.6z',
  'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
];

export function Glyph({ color, className }: { color: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'glyph'} aria-hidden>
      <path d={GLYPHS[color]} fill="currentColor" />
    </svg>
  );
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  tile: Tile;
  flags?: string;
  'data-id'?: number;
}

export function TileView({ tile, flags = '', className = '', ...rest }: Props) {
  const label = tile.joker ? 'Котик-джокер' : `${tile.num}, ${COLOR_NAMES[tile.color]}`;
  return (
    <div className={`tile c${tile.color} ${tile.joker ? 'joker' : ''} ${flags} ${className}`} aria-label={label} {...rest}>
      {tile.joker ? (
        <CatFace coat={tile.color === 0 ? 5 : 1} className="joker-face" />
      ) : (
        <>
          <span className="num">{tile.num}</span>
          <Glyph color={tile.color} />
        </>
      )}
    </div>
  );
}
