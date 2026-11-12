import { setValue, type Grid, type Tile } from '@core/rules';

export interface BoardAnalysis {
  setEdge: Map<number, string>;
  invalid: Set<number>;
  meldValue: number;
  placed: number;
}

export function analyseBoard(board: Grid, tiles: Tile[], committed: Set<number>): BoardAnalysis {
  const setEdge = new Map<number, string>();
  const invalid = new Set<number>();
  let meldValue = 0;
  let placed = 0;
  for (const row of board) {
    let c = 0;
    while (c < row.length) {
      if (row[c] === null) {
        c++;
        continue;
      }
      let end = c;
      while (end < row.length && row[end] !== null) end++;
      const set = row.slice(c, end) as number[];
      const value = setValue(set.map((id) => tiles[id]));
      const own = set.filter((id) => !committed.has(id)).length;
      placed += own;
      if (value === null) set.forEach((id) => invalid.add(id));
      else {
        set.forEach((id, i) => setEdge.set(id, i === 0 ? 's-start' : i === set.length - 1 ? 's-end' : 's-mid'));
        if (own === set.length) meldValue += value;
      }
      c = end;
    }
  }
  return { setEdge, invalid, meldValue, placed };
}
