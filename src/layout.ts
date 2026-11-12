import { COLORS, MAX_NUM, setValue, type Tile } from '../shared/rules';

export const RACK_COLS = 16;
const RACK_MIN = RACK_COLS * 2;
const SPLIT = -1;

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

export function dropOnBoard(row: Cells, c: number, ids: number[], tiles: Tile[]): boolean {
  const k = ids.length;
  const start = Math.max(0, Math.min(c, row.length - k));
  if (row[start] !== null && start + k + 1 <= row.length) {
    let l = start;
    while (l > 0 && row[l - 1] !== null) l--;
    let r = start;
    while (r < row.length && row[r] !== null) r++;
    const left = row.slice(l, start) as number[];
    const right = row.slice(start, r) as number[];
    const valid = (set: number[]) => setValue(set.map((id) => tiles[id])) !== null;
    if (left.length && !valid([...left, ...ids, ...right])) {
      const seq = valid([...left, ...ids]) && valid(right) ? [...ids, SPLIT] : valid(left) && valid([...ids, ...right]) ? [SPLIT, ...ids] : null;
      const copy = row.slice();
      if (seq && insertGroup(copy, start, seq)) {
        copy.forEach((v, i) => (row[i] = v === SPLIT ? null : v));
        return true;
      }
    }
  }
  return insertGroup(row, c, ids);
}

export function continuesSet(picked: Tile[], next: Tile) {
  if (picked.length > 1) return setValue([...picked, next]) !== null;
  const a = picked[0];
  if (a.joker || next.joker) return true;
  return a.color === next.color ? Math.abs(a.num - next.num) === 1 : a.num === next.num;
}

export function arrange(ids: number[], tiles: Tile[], mode: SortMode) {
  const pool = new Set(ids.filter((id) => !tiles[id].joker));
  const take = (set: number[]) => set.forEach((id) => pool.delete(id));

  const runs = () => {
    const out: number[][] = [];
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
            take(run);
            out.push(run);
            found = true;
          }
          n = m;
        }
        if (!found) break;
      }
    }
    return out;
  };

  const groups = () => {
    const out: number[][] = [];
    for (let n = 1; n <= MAX_NUM; n++) {
      for (;;) {
        const by = new Map<number, number>();
        for (const id of pool) if (tiles[id].num === n && !by.has(tiles[id].color)) by.set(tiles[id].color, id);
        if (by.size < 3) break;
        const group = [...by.keys()].sort((a, b) => a - b).map((color) => by.get(color)!);
        take(group);
        out.push(group);
      }
    }
    return out;
  };

  const sets = mode === 'run' ? [...runs(), ...groups()] : [...groups(), ...runs()];
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
