import { COLORS, MAX_NUM, setValue, type Tile } from '../shared/rules';

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

interface Block {
  cells: number[];
  want: number;
}

function isSet(cells: number[], tiles: Tile[]) {
  return setValue(cells.map((id) => tiles[id])) !== null;
}

function couldBeSet(cells: number[], tiles: Tile[]) {
  if (cells.length < 2) return true;
  if (cells.length === 2) return continuesSet([tiles[cells[0]]], tiles[cells[1]]);
  return isSet(cells, tiles);
}

function joinSet(set: number[], ids: number[], pointer: number, tiles: Tile[]): number[][] | null {
  const fits = (cells: number[]) => couldBeSet(cells, tiles);
  const valid = (cells: number[]) => isSet(cells, tiles);
  let best: number[][] | null = null;
  let bestDist = Infinity;
  const consider = (i: number, parts: number[][]) => {
    const dist = Math.abs(i - pointer);
    if (dist < bestDist || (dist === bestDist && i > pointer)) {
      best = parts;
      bestDist = dist;
    }
  };
  for (let i = 0; i <= set.length; i++) {
    const merged = [...set.slice(0, i), ...ids, ...set.slice(i)];
    if (fits(merged)) consider(i, [merged]);
  }
  if (best) return best;
  for (let i = 1; i < set.length; i++) {
    const left = set.slice(0, i);
    const right = set.slice(i);
    if (valid([...left, ...ids]) && valid(right)) consider(i, [[...left, ...ids], right]);
    if (valid(left) && valid([...ids, ...right])) consider(i, [left, [...ids, ...right]]);
  }
  return best;
}

export function planDrop(row: Cells, c: number, ids: number[], tiles: Tile[]): Cells | null {
  const cols = row.length;
  const k = ids.length;
  const start = Math.max(0, Math.min(c, cols - k));
  const blocks: Block[] = [];
  for (let i = 0; i < cols; ) {
    if (row[i] === null) {
      i++;
      continue;
    }
    let e = i;
    while (e < cols && row[e] !== null) e++;
    blocks.push({ cells: row.slice(i, e) as number[], want: i });
    i = e;
  }
  const end = (b: Block) => b.want + b.cells.length;
  const fitsTogether = (a: Block, b: Block) => couldBeSet([...a.cells, ...b.cells], tiles);

  const under = blocks.findIndex((b) => c >= b.want && c < end(b));
  const near = blocks.map((_, i) => i).filter((i) => i !== under && blocks[i].want <= start + k && end(blocks[i]) >= start);
  let anchor = -1;
  for (const t of under >= 0 ? [under, ...near] : near) {
    const set = blocks[t];
    const parts = joinSet(set.cells, ids, Math.max(0, Math.min(c - set.want, set.cells.length)), tiles);
    if (!parts) continue;
    const prepended = parts[0][0] === ids[0];
    const want = prepended ? Math.min(set.want, start) : set.want;
    const next: Block[] = [{ cells: parts[0], want }];
    if (parts[1]) next.push({ cells: parts[1], want: want + parts[0].length + 1 });
    blocks.splice(t, 1, ...next);
    anchor = parts[1] && parts[1].includes(ids[0]) ? t + 1 : t;
    break;
  }
  if (anchor < 0) {
    const before = (b: Block) => (c < b.want ? false : c >= end(b) ? true : c - b.want >= b.cells.length / 2);
    anchor = blocks.filter(before).length;
    blocks.splice(anchor, 0, { cells: ids, want: start });
  }

  while (anchor > 0 && end(blocks[anchor - 1]) >= blocks[anchor].want && fitsTogether(blocks[anchor - 1], blocks[anchor])) {
    blocks[anchor - 1].cells = [...blocks[anchor - 1].cells, ...blocks[anchor].cells];
    blocks.splice(anchor, 1);
    anchor--;
  }
  while (anchor < blocks.length - 1 && end(blocks[anchor]) >= blocks[anchor + 1].want && fitsTogether(blocks[anchor], blocks[anchor + 1])) {
    blocks[anchor].cells = [...blocks[anchor].cells, ...blocks[anchor + 1].cells];
    blocks.splice(anchor + 1, 1);
  }

  const n = blocks.length;
  const len = blocks.map((b) => b.cells.length);
  const pos = blocks.map((b) => b.want);
  pos[anchor] = Math.max(0, Math.min(pos[anchor], cols - len[anchor]));
  const pushRight = (from: number) => {
    for (let i = from; i < n; i++) pos[i] = Math.max(pos[i], pos[i - 1] + len[i - 1] + 1);
  };
  const pullLeft = (from: number) => {
    for (let i = from; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - 1 - len[i]);
  };
  pushRight(anchor + 1);
  pullLeft(anchor - 1);
  if (pos[0] < 0) {
    pos[0] = 0;
    pushRight(1);
  }
  if (pos[n - 1] + len[n - 1] > cols) {
    pos[n - 1] = cols - len[n - 1];
    pullLeft(n - 2);
  }
  if (pos[0] < 0) return null;

  const out: Cells = Array<number | null>(cols).fill(null);
  blocks.forEach((b, i) => b.cells.forEach((id, j) => (out[pos[i] + j] = id)));
  return out;
}

export function dropOnBoard(row: Cells, c: number, ids: number[], tiles: Tile[]): boolean {
  const plan = planDrop(row, c, ids, tiles);
  if (!plan) return insertGroup(row, c, ids);
  plan.forEach((v, i) => (row[i] = v));
  return true;
}

export function continuesSet(picked: Tile[], next: Tile) {
  if (picked.length > 1) return setValue([...picked, next]) !== null;
  const a = picked[0];
  if (a.joker || next.joker) return true;
  return a.color === next.color ? next.num === a.num + 1 : a.num === next.num;
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
