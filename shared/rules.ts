export const COLORS = 4;
export const MAX_NUM = 13;
export const RACK_START = 14;
export const INITIAL_MELD = 30;
export const JOKER_PENALTY = 30;
export const BOARD_ROWS = 8;
export const BOARD_COLS = 24;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

export interface Tile {
  id: number;
  color: number;
  num: number;
  joker: boolean;
}

export type Grid = (number | null)[][];

export function createTiles(playerCount: number): Tile[] {
  const big = playerCount > 4;
  const copies = big ? 3 : 2;
  const jokers = big ? 4 : 2;
  const tiles: Tile[] = [];
  let id = 0;
  for (let k = 0; k < copies; k++) {
    for (let color = 0; color < COLORS; color++) {
      for (let num = 1; num <= MAX_NUM; num++) tiles.push({ id: id++, color, num, joker: false });
    }
  }
  for (let j = 0; j < jokers; j++) tiles.push({ id: id++, color: j % 2 === 0 ? 0 : 3, num: 0, joker: true });
  return tiles;
}

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function emptyGrid(rows = BOARD_ROWS, cols = BOARD_COLS): Grid {
  return Array.from({ length: rows }, () => Array<number | null>(cols).fill(null));
}

export function segments(grid: Grid): number[][] {
  const out: number[][] = [];
  for (const row of grid) {
    let cur: number[] = [];
    for (const cell of row) {
      if (cell === null) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push(cell);
    }
    if (cur.length) out.push(cur);
  }
  return out;
}

function groupValue(tiles: Tile[]): number | null {
  if (tiles.length > COLORS) return null;
  const real = tiles.filter((t) => !t.joker);
  if (real.length === 0) return null;
  const num = real[0].num;
  if (real.some((t) => t.num !== num)) return null;
  if (new Set(real.map((t) => t.color)).size !== real.length) return null;
  return num * tiles.length;
}

function runValue(tiles: Tile[]): number | null {
  if (tiles.length > MAX_NUM) return null;
  const real = tiles.filter((t) => !t.joker);
  if (real.length === 0) {
    const lo = MAX_NUM - tiles.length + 1;
    return ((lo + MAX_NUM) * tiles.length) / 2;
  }
  if (real.some((t) => t.color !== real[0].color)) return null;
  for (const dir of [1, -1]) {
    let start: number | null = null;
    let ok = true;
    tiles.forEach((t, i) => {
      if (t.joker) return;
      const s = t.num - dir * i;
      if (start === null) start = s;
      else if (start !== s) ok = false;
    });
    if (!ok || start === null) continue;
    const end: number = start + dir * (tiles.length - 1);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    if (lo < 1 || hi > MAX_NUM) continue;
    return ((lo + hi) * tiles.length) / 2;
  }
  return null;
}

export function setValue(tiles: Tile[]): number | null {
  if (tiles.length < 3) return null;
  const g = groupValue(tiles);
  const r = runValue(tiles);
  if (g === null && r === null) return null;
  return Math.max(g ?? 0, r ?? 0);
}

export function rackValue(ids: number[], tiles: Tile[]): number {
  return ids.reduce((sum, id) => sum + (tiles[id].joker ? JOKER_PENALTY : tiles[id].num), 0);
}

export function gridIds(grid: Grid): number[] {
  const ids: number[] = [];
  for (const row of grid) for (const cell of row) if (cell !== null) ids.push(cell);
  return ids;
}

export function sanitizeGrid(raw: unknown, tileCount: number): Grid | null {
  if (!Array.isArray(raw) || raw.length !== BOARD_ROWS) return null;
  const grid: Grid = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== BOARD_COLS) return null;
    const clean: (number | null)[] = [];
    for (const cell of row) {
      if (cell === null) clean.push(null);
      else if (Number.isInteger(cell) && cell >= 0 && cell < tileCount) clean.push(cell);
      else return null;
    }
    grid.push(clean);
  }
  return grid;
}

export type TurnCheck = { ok: true; played: number[] } | { ok: false; error: string };

export function validateTurn(input: {
  before: Grid;
  after: Grid;
  rack: number[];
  tiles: Tile[];
  melded: boolean;
}): TurnCheck {
  const { before, after, rack, tiles, melded } = input;
  const afterIds = gridIds(after);
  const afterSet = new Set(afterIds);
  if (afterSet.size !== afterIds.length) return { ok: false, error: 'Одна плитка лежит на столе дважды' };

  const beforeIds = gridIds(before);
  if (beforeIds.some((id) => !afterSet.has(id))) {
    return { ok: false, error: 'Плитки со стола нельзя забирать в руку' };
  }
  const beforeSet = new Set(beforeIds);
  const rackSet = new Set(rack);
  const played = afterIds.filter((id) => !beforeSet.has(id));
  if (played.some((id) => !rackSet.has(id))) return { ok: false, error: 'Этой плитки нет у тебя в руке' };
  if (played.length === 0) return { ok: false, error: 'Выложи хотя бы одну плитку или возьми из мешочка' };

  const afterSegments = segments(after);
  for (const seg of afterSegments) {
    if (setValue(seg.map((id) => tiles[id])) === null) {
      return { ok: false, error: 'На столе есть неправильные комбинации' };
    }
  }

  if (!melded) {
    const keys = new Set(afterSegments.map((s) => s.join(',')));
    if (segments(before).some((s) => !keys.has(s.join(',')))) {
      return { ok: false, error: 'До первого выхода нельзя менять комбинации на столе' };
    }
    const playedSet = new Set(played);
    const value = afterSegments
      .filter((s) => s.every((id) => playedSet.has(id)))
      .reduce((sum, s) => sum + (setValue(s.map((id) => tiles[id])) ?? 0), 0);
    if (value < INITIAL_MELD) {
      return { ok: false, error: `Первый выход — минимум ${INITIAL_MELD} очков из своих плиток (сейчас ${value})` };
    }
  }

  return { ok: true, played };
}
