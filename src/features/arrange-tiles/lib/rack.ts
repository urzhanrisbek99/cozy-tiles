import { COLORS, MAX_NUM, type Tile } from '@core/rules';

export const RACK_COLS = 16;
const RACK_MIN = RACK_COLS * 2;

export type Cells = (number | null)[];
export type SortMode = 'run' | 'group';

export function fitRack(cells: Cells, ids: number[]): Cells {
  const want = new Set(ids);
  const next = cells.map((v) => (v !== null && want.has(v) ? v : null));
  const present = new Set(next);
  const addRow = () => next.push(...Array<null>(RACK_COLS).fill(null));
  while (next.length < RACK_MIN || next.length % RACK_COLS) next.push(null);
  for (const id of ids) {
    if (present.has(id)) continue;
    if (!next.includes(null)) addRow();
    next[next.indexOf(null)] = id;
  }
  while (next.length > RACK_MIN && next.slice(-RACK_COLS).every((v) => v === null)) next.length -= RACK_COLS;
  if (!next.includes(null)) addRow();
  return next;
}

export function insertGroup(row: Cells, c: number, ids: number[]): boolean {
  const k = ids.length;
  if (row.filter((v) => v === null).length < k) return false;
  const start = Math.max(0, Math.min(c, row.length - k));
  if (row.slice(start, start + k).every((v) => v === null)) {
    ids.forEach((id, i) => (row[start + i] = id));
    return true;
  }
  let need = k;
  const right: Cells = [];
  for (let i = start; i < row.length; i++) {
    if (row[i] === null && need > 0) need--;
    else right.push(row[i]);
  }
  const left = row.slice(0, start);
  for (let i = left.length - 1; i >= 0 && need > 0; i--) {
    if (left[i] === null) {
      left.splice(i, 1);
      need--;
    }
  }
  const next = [...left, ...ids, ...right];
  for (let i = 0; i < row.length; i++) row[i] = next[i];
  return true;
}

function takeRuns(pool: Set<number>, tiles: Tile[]) {
  const runs: number[][] = [];
  for (let color = 0; color < COLORS; color++) {
    for (;;) {
      const at = new Map<number, number>();
      for (const id of pool) if (tiles[id].color === color && !at.has(tiles[id].num)) at.set(tiles[id].num, id);
      let found = false;
      for (let n = 1; n <= MAX_NUM; n++) {
        if (!at.has(n)) continue;
        let m = n;
        while (at.has(m + 1)) m++;
        if (m - n >= 2) {
          const run: number[] = [];
          for (let x = n; x <= m; x++) run.push(at.get(x)!);
          run.forEach((id) => pool.delete(id));
          runs.push(run);
          found = true;
        }
        n = m;
      }
      if (!found) break;
    }
  }
  return runs;
}

function takeGroups(pool: Set<number>, tiles: Tile[]) {
  const groups: number[][] = [];
  for (let n = 1; n <= MAX_NUM; n++) {
    for (;;) {
      const byColor = new Map<number, number>();
      for (const id of pool) if (tiles[id].num === n && !byColor.has(tiles[id].color)) byColor.set(tiles[id].color, id);
      if (byColor.size < 3) break;
      const group = [...byColor.keys()].sort((a, b) => a - b).map((color) => byColor.get(color)!);
      group.forEach((id) => pool.delete(id));
      groups.push(group);
    }
  }
  return groups;
}

export function arrange(ids: number[], tiles: Tile[], mode: SortMode) {
  const pool = new Set(ids.filter((id) => !tiles[id].joker));
  const sets =
    mode === 'run' ? [...takeRuns(pool, tiles), ...takeGroups(pool, tiles)] : [...takeGroups(pool, tiles), ...takeRuns(pool, tiles)];
  const rest = [...pool].sort((a, b) => {
    const ta = tiles[a];
    const tb = tiles[b];
    return mode === 'run' ? ta.color - tb.color || ta.num - tb.num : ta.num - tb.num || ta.color - tb.color;
  });
  rest.push(...ids.filter((id) => tiles[id].joker));
  return { sets, rest };
}

export function layoutRack(sets: number[][], rest: number[], rows: number): Cells {
  const cells: Cells = [];
  for (const set of sets) {
    const col = cells.length % RACK_COLS;
    if (col !== 0) {
      if (col + 1 + set.length > RACK_COLS) while (cells.length % RACK_COLS) cells.push(null);
      else cells.push(null);
    }
    cells.push(...set);
  }
  if (rest.length) {
    if (cells.length % RACK_COLS) cells.push(null);
    cells.push(...rest);
  }
  return cells.length <= rows * RACK_COLS ? cells : [...sets.flat(), ...rest];
}

export function sortRack(cells: Cells, tiles: Tile[], mode: SortMode): Cells {
  const ids = cells.filter((v): v is number => v !== null);
  const { sets, rest } = arrange(ids, tiles, mode);
  return fitRack(layoutRack(sets, rest, cells.length / RACK_COLS), ids);
}
