import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTiles, emptyGrid } from '@core/rules';
import { planBoard, planRow } from './board';
import type { Cells } from './rack';

const tiles = createTiles(2);
const JOKER = 104;
const id = (color: number, num: number, copy = 0) => copy * 52 + color * 13 + (num - 1);
const row = (...cells: Cells): Cells => [...cells, ...Array<null>(16 - cells.length).fill(null)];
const drop = (r: Cells, c: number, ...ids: number[]) => {
  const plan = planRow(r, c, ids, tiles);
  assert.ok(plan);
  assert.deepEqual(plan.evicted, []);
  return plan.row;
};
const run = () => row(null, null, id(0, 7), id(0, 8), id(0, 9), id(0, 10));
const six = () => row(id(0, 6), id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11));

test('dropping a duplicate into a run splits it into two runs', () => {
  const r = drop(row(null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11)), 3, id(0, 9, 1));
  assert.deepEqual(r.slice(0, 9), [null, id(0, 7), id(0, 8), id(0, 9, 1), null, id(0, 9), id(0, 10), id(0, 11), null]);
});

test('the split can also fall before the dropped tile', () => {
  const r = drop(row(id(0, 5), id(0, 6), id(0, 7), id(0, 8), id(0, 9)), 3, id(0, 7, 1));
  assert.deepEqual(r.slice(0, 7), [id(0, 5), id(0, 6), id(0, 7), null, id(0, 7, 1), id(0, 8), id(0, 9)]);
});

test('a tile that extends the set is inserted without a split', () => {
  const r = drop(row(id(0, 7), id(0, 9), id(0, 10)), 1, id(0, 8));
  assert.deepEqual(r.slice(0, 5), [id(0, 7), id(0, 8), id(0, 9), id(0, 10), null]);
});

test('a tile that continues the run goes to its end wherever it is dropped', () => {
  const want = [null, null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11), null];
  for (const c of [1, 2, 3, 4, 5, 6]) assert.deepEqual(drop(run(), c, id(0, 11)).slice(0, 8), want, `dropped at ${c}`);
});

test('a tile that continues the run at the front is prepended', () => {
  assert.deepEqual(drop(run(), 4, id(0, 6)).slice(0, 7), [null, null, id(0, 6), id(0, 7), id(0, 8), id(0, 9), id(0, 10)]);
  assert.deepEqual(drop(run(), 1, id(0, 6)).slice(0, 7), [null, id(0, 6), id(0, 7), id(0, 8), id(0, 9), id(0, 10), null]);
});

test('a tile that does not fit is kept apart and the run moves away from it', () => {
  const twelve = id(0, 12);
  assert.deepEqual(drop(run(), 2, twelve).slice(0, 9), [null, null, twelve, null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), null]);
  assert.deepEqual(drop(run(), 6, twelve).slice(0, 8), [null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), null, twelve, null]);
  assert.deepEqual(drop(run(), 3, twelve).slice(0, 10), [null, null, null, twelve, null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), null]);
});

test('extending a set keeps the gap to its neighbour', () => {
  const r = drop(row(id(0, 7), id(0, 8), id(0, 9), null, id(1, 1), id(1, 2), id(1, 3)), 3, id(0, 10));
  assert.deepEqual(r.slice(0, 9), [id(0, 7), id(0, 8), id(0, 9), id(0, 10), null, id(1, 1), id(1, 2), id(1, 3), null]);
});

test('a tile dropped between two halves joins them', () => {
  const r = drop(row(null, id(0, 7), null, id(0, 9)), 2, id(0, 8));
  assert.deepEqual(r.slice(0, 5), [null, id(0, 7), id(0, 8), id(0, 9), null]);
});

test('a set can be built one tile at a time', () => {
  let r = drop(row(null, null, null, id(2, 5)), 4, id(1, 5));
  r = drop(r, 3, id(0, 5));
  assert.deepEqual(r.slice(2, 7), [null, id(0, 5), id(2, 5), id(1, 5), null]);
  r = drop(r, 6, id(3, 9));
  assert.deepEqual(r.slice(2, 9), [id(0, 5), id(2, 5), id(1, 5), null, id(3, 9), null, null]);
});

test('the real tile takes the place of a joker and frees it', () => {
  const want = [null, id(0, 9), id(0, 10), id(0, 11), null, JOKER, null];
  for (const c of [1, 2, 3]) {
    assert.deepEqual(drop(row(null, id(0, 9), JOKER, id(0, 11)), c, id(0, 10)).slice(0, 7), want, `dropped at ${c}`);
  }
  assert.equal(tiles[JOKER].joker, true);
});

test('a joker is only swapped out when the tile is dropped on it or cannot be added', () => {
  assert.deepEqual(drop(row(id(0, 9), id(0, 10), JOKER), 2, id(0, 11)).slice(0, 6), [id(0, 9), id(0, 10), id(0, 11), null, JOKER, null]);
  assert.deepEqual(drop(row(id(0, 9), id(0, 10), JOKER), 0, id(0, 11)).slice(0, 6), [id(0, 9), id(0, 10), id(0, 11), JOKER, null, null]);
  assert.deepEqual(drop(row(id(0, 9), JOKER, id(0, 11)), 1, id(1, 4)).slice(0, 6), [null, id(1, 4), null, id(0, 9), JOKER, id(0, 11)]);
});

test('a tile dropped into the middle of a long run splits it', () => {
  assert.deepEqual(drop(six(), 3, id(0, 9, 1)).slice(0, 8), [id(0, 6), id(0, 7), id(0, 8), id(0, 9, 1), null, id(0, 9), id(0, 10), id(0, 11)]);
  assert.deepEqual(drop(six(), 3, id(0, 8, 1)).slice(0, 8), [id(0, 6), id(0, 7), id(0, 8), null, id(0, 8, 1), id(0, 9), id(0, 10), id(0, 11)]);
  const seven = id(0, 7, 1);
  const split = [id(0, 6), id(0, 7), id(0, 8), null, seven, null, id(0, 9), id(0, 10), id(0, 11), null];
  for (const c of [2, 3, 4]) assert.deepEqual(drop(six(), c, seven).slice(0, 10), split, `dropped at ${c}`);
});

test('a misfit dropped on the edge of a run does not split it', () => {
  assert.deepEqual(drop(six(), 0, id(2, 2)).slice(0, 9), [id(2, 2), null, id(0, 6), id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11), null]);
});

test('sets stay one cell apart when the row is exactly full', () => {
  const r: Cells = [id(0, 1), id(0, 2), id(0, 3), null, id(1, 5), id(1, 6), id(1, 7), null];
  assert.deepEqual(drop(r, 3, id(0, 4)), [id(0, 1), id(0, 2), id(0, 3), id(0, 4), null, id(1, 5), id(1, 6), id(1, 7)]);
});

test('a set that no longer fits in the row moves to the next free row', () => {
  const grid = emptyGrid(3, 8);
  grid[0] = [id(0, 1), id(0, 2), id(0, 3), id(0, 4), null, id(1, 5), id(1, 6), id(1, 7)];
  grid[1] = [id(2, 9), id(2, 10), id(2, 11), null, null, null, null, null];
  const next = planBoard(grid, 0, 4, [id(0, 5)], tiles);
  assert.ok(next);
  assert.deepEqual(next[0], [id(0, 1), id(0, 2), id(0, 3), id(0, 4), id(0, 5), null, null, null]);
  assert.deepEqual(next[1], [id(2, 9), id(2, 10), id(2, 11), null, id(1, 5), id(1, 6), id(1, 7), null]);
  assert.deepEqual(next[2], grid[2]);
});

test('a moved set skips rows without room and keeps a gap on both sides', () => {
  const grid = emptyGrid(3, 8);
  grid[0] = [id(0, 1), id(0, 2), id(0, 3), id(0, 4), null, id(1, 5), id(1, 6), id(1, 7)];
  grid[1] = [null, id(2, 9), id(2, 10), id(2, 11), id(2, 12), null, null, null];
  const next = planBoard(grid, 0, 4, [id(0, 5)], tiles);
  assert.ok(next);
  assert.deepEqual(next[1], grid[1]);
  assert.deepEqual(next[2], [id(1, 5), id(1, 6), id(1, 7), null, null, null, null, null]);
});

test('before the first meld a tile never joins a set that is already on the table', () => {
  const frozen = (tile: number) => tile !== id(0, 11);
  const plan = planRow(run(), 6, [id(0, 11)], tiles, { frozen });
  assert.ok(plan);
  assert.deepEqual(plan.row.slice(0, 8), [null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), null, id(0, 11), null]);
});
