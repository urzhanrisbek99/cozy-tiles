import { memo } from 'react';
import type { Tile } from '@core/rules';
import { TileView } from './TileView';

export type Zone = 'board' | 'rack';

export interface Loc {
  zone: Zone;
  r: number;
  c: number;
}

interface Props extends Loc {
  tile: Tile | null;
  cls: string;
  flags: string;
}

export const Cell = memo(function Cell({ zone, r, c, tile, cls, flags }: Props) {
  return (
    <div className={`cell ${cls}`} data-zone={zone} data-r={r} data-c={c}>
      {tile && <TileView tile={tile} flags={flags} data-id={tile.id} />}
    </div>
  );
});
