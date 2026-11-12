import type { Grid, Tile } from '@core/rules';
import { insertGroup, type Cells } from './rack';
import { couldBeSet, isSet } from './sets';

interface Block {
  cells: number[];
  want: number;
}

export interface DropOptions {
  frozen?: (id: number) => boolean;
}

export interface RowPlan {
  row: Cells;
  evicted: number[][];
}

function joinSet(set: number[], ids: number[], pointer: number, onCell: number | null, tiles: Tile[]): number[][] | null {
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

  const swapJoker = (j: number) => {
    if (ids.length !== 1 || tiles[ids[0]].joker || !tiles[set[j]]?.joker) return null;
    const swapped = set.slice();
    swapped[j] = ids[0];
    return fits(swapped) ? [swapped, [set[j]]] : null;
  };
  const direct = onCell === null ? null : swapJoker(onCell);
  if (direct) return direct;

  for (let i = 0; i <= set.length; i++) {
    const merged = [...set.slice(0, i), ...ids, ...set.slice(i)];
    if (fits(merged)) consider(i, [merged]);
  }
  if (best) return best;

  for (let j = 0; j < set.length; j++) {
    const swapped = swapJoker(j);
    if (swapped) consider(j, swapped);
  }
  if (best) return best;

  for (let i = 1; i < set.length; i++) {
    const left = set.slice(0, i);
    const right = set.slice(i);
    if (valid([...left, ...ids]) && valid(right)) consider(i, [[...left, ...ids], right]);
    if (valid(left) && valid([...ids, ...right])) consider(i, [left, [...ids, ...right]]);
  }
  if (best || onCell === null || onCell === 0) return best;

  for (let i = 1; i < set.length; i++) {
    if (Math.abs(i - pointer) <= 1 && valid(set.slice(0, i)) && valid(set.slice(i))) consider(i, [set.slice(0, i), ids, set.slice(i)]);
  }
  return best;
}

function toBlocks(row: Cells): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < row.length; ) {
    if (row[i] === null) {
      i++;
      continue;
    }
    let e = i;
    while (e < row.length && row[e] !== null) e++;
    blocks.push({ cells: row.slice(i, e) as number[], want: i });
    i = e;
  }
  return blocks;
}

function spread(blocks: Block[], anchor: number, cols: number): number[] | null {
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
  return pos[0] < 0 ? null : pos;
}

export function planRow(row: Cells, c: number, ids: number[], tiles: Tile[], { frozen }: DropOptions = {}): RowPlan | null {
  const cols = row.length;
  const k = ids.length;
  const start = Math.max(0, Math.min(c, cols - k));
  const blocks = toBlocks(row);
  const end = (b: Block) => b.want + b.cells.length;
  const locked = (cells: number[]) => !!frozen && cells.some(frozen);
  const fitsTogether = (a: Block, b: Block) => !locked(a.cells) && !locked(b.cells) && couldBeSet([...a.cells, ...b.cells], tiles);

  const under = blocks.findIndex((b) => c >= b.want && c < end(b));
  const near = blocks.map((_, i) => i).filter((i) => i !== under && blocks[i].want <= start + k && end(blocks[i]) >= start);
  let anchor = -1;
  for (const t of under >= 0 ? [under, ...near] : near) {
    const set = blocks[t];
    if (locked(ids) || locked(set.cells)) continue;
    const pointer = Math.max(0, Math.min(c - set.want, set.cells.length));
    const parts = joinSet(set.cells, ids, pointer, t === under ? c - set.want : null, tiles);
    if (!parts) continue;
    const prepended = parts.length === 1 && parts[0][0] === ids[0];
    let want = prepended ? Math.min(set.want, start) : set.want;
    const next = parts.map((cells) => {
      const block: Block = { cells, want };
      want += cells.length + 1;
      return block;
    });
    blocks.splice(t, 1, ...next);
    anchor = t;
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

  const dropped = new Set(ids);
  const evicted: number[][] = [];
  for (;;) {
    const pos = spread(blocks, anchor, cols);
    if (pos) {
      const out: Cells = Array<number | null>(cols).fill(null);
      blocks.forEach((b, i) => b.cells.forEach((id, j) => (out[pos[i] + j] = id)));
      return { row: out, evicted };
    }
    const movable = blocks.map((_, i) => i).filter((i) => i !== anchor && !blocks[i].cells.some((id) => dropped.has(id)));
    if (!movable.length) return null;
    const far = movable.reduce((a, b) => (Math.abs(b - anchor) > Math.abs(a - anchor) ? b : a));
    evicted.push(blocks[far].cells);
    blocks.splice(far, 1);
    if (far < anchor) anchor--;
  }
}

function shelve(grid: Grid, from: number, set: number[]): boolean {
  const rows = grid
    .map((_, r) => r)
    .filter((r) => r !== from)
    .sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || b - a);
  for (const r of rows) {
    const row = grid[r];
    for (let p = 0; p + set.length <= row.length; p++) {
      if (row.slice(Math.max(0, p - 1), p + set.length + 1).every((v) => v === null)) {
        set.forEach((id, i) => (row[p + i] = id));
        return true;
      }
    }
  }
  return false;
}

export function planBoard(grid: Grid, r: number, c: number, ids: number[], tiles: Tile[], options?: DropOptions): Grid | null {
  const plan = planRow(grid[r], c, ids, tiles, options);
  if (!plan) return null;
  const next = grid.map((row) => row.slice());
  next[r] = plan.row;
  return plan.evicted.every((set) => shelve(next, r, set)) ? next : null;
}

export function dropOnBoard(grid: Grid, r: number, c: number, ids: number[], tiles: Tile[], options?: DropOptions): Grid | null {
  const planned = planBoard(grid, r, c, ids, tiles, options);
  if (planned) return planned;
  const next = grid.map((row) => row.slice());
  return insertGroup(next[r], c, ids) ? next : null;
}
