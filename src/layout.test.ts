import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTiles } from '../shared/rules';
import { arrange, continuesSet, dropOnBoard, insertGroup, type Cells } from './layout';

const tiles = createTiles(2);
const id = (color: number, num: number, copy = 0) => copy * 52 + color * 13 + (num - 1);
const row = (...cells: Cells): Cells => [...cells, ...Array<null>(16 - cells.length).fill(null)];

test('dropping a duplicate into a run splits it into two runs', () => {
  const r = row(null, id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11));
  assert.equal(dropOnBoard(r, 3, [id(0, 9, 1)], tiles), true);
  assert.deepEqual(r.slice(0, 9), [null, id(0, 7), id(0, 8), id(0, 9, 1), null, id(0, 9), id(0, 10), id(0, 11), null]);
});

test('the split can also fall before the dropped tile', () => {
  const r = row(id(0, 5), id(0, 6), id(0, 7), id(0, 8), id(0, 9));
  assert.equal(dropOnBoard(r, 3, [id(0, 7, 1)], tiles), true);
  assert.deepEqual(r.slice(0, 7), [id(0, 5), id(0, 6), id(0, 7), null, id(0, 7, 1), id(0, 8), id(0, 9)]);
});

test('a tile that extends the set is inserted without a split', () => {
  const r = row(id(0, 7), id(0, 9), id(0, 10));
  assert.equal(dropOnBoard(r, 1, [id(0, 8)], tiles), true);
  assert.deepEqual(r.slice(0, 5), [id(0, 7), id(0, 8), id(0, 9), id(0, 10), null]);
});

const run = () => row(null, null, id(0, 7), id(0, 8), id(0, 9), id(0, 10));
const drop = (r: Cells, c: number, ...ids: number[]) => {
  assert.equal(dropOnBoard(r, c, ids, tiles), true);
  return r;
};

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
  const r = row(id(0, 7), id(0, 8), id(0, 9), null, id(1, 1), id(1, 2), id(1, 3));
  drop(r, 3, id(0, 10));
  assert.deepEqual(r.slice(0, 9), [id(0, 7), id(0, 8), id(0, 9), id(0, 10), null, id(1, 1), id(1, 2), id(1, 3), null]);
});

test('a tile dropped between two halves joins them', () => {
  const r = row(null, id(0, 7), null, id(0, 9));
  drop(r, 2, id(0, 8));
  assert.deepEqual(r.slice(0, 5), [null, id(0, 7), id(0, 8), id(0, 9), null]);
});

test('a set can be built one tile at a time', () => {
  const r = row(null, null, null, id(2, 5));
  drop(r, 4, id(1, 5));
  drop(r, 3, id(0, 5));
  assert.deepEqual(r.slice(2, 7), [null, id(0, 5), id(2, 5), id(1, 5), null]);
  drop(r, 6, id(3, 9));
  assert.deepEqual(r.slice(2, 9), [id(0, 5), id(2, 5), id(1, 5), null, id(3, 9), null, null]);
});

test('sets never end up touching when the row is tight', () => {
  const r: Cells = [id(0, 1), id(0, 2), id(0, 3), null, id(1, 5), id(1, 6), id(1, 7), null];
  drop(r, 3, id(0, 4));
  assert.deepEqual(r, [id(0, 1), id(0, 2), id(0, 3), id(0, 4), null, id(1, 5), id(1, 6), id(1, 7)]);
});

test('insertGroup keeps a group together when the row is tight on the right', () => {
  const r: Cells = [null, null, 1, 2, 3];
  assert.equal(insertGroup(r, 3, [8, 9]), true);
  assert.deepEqual(r, [1, 8, 9, 2, 3]);
  assert.equal(insertGroup([1, 2, 3], 0, [9]), false);
});

test('hold-select only continues along a real combination', () => {
  const t = (color: number, num: number) => tiles[id(color, num)];
  assert.equal(continuesSet([t(0, 7)], t(0, 8)), true);
  assert.equal(continuesSet([t(0, 7), t(0, 8)], t(0, 9)), true);
  assert.equal(continuesSet([t(0, 8)], t(0, 7)), false);
  assert.equal(continuesSet([t(0, 7)], t(1, 7)), true);
  assert.equal(continuesSet([t(0, 7)], t(1, 8)), false);
  assert.equal(continuesSet([t(0, 7)], t(0, 9)), false);
});

test('sorting only groups real sets of three or more', () => {
  const ids = [id(0, 1), id(0, 2), id(0, 3), id(0, 2, 1), id(1, 6), id(2, 10), id(3, 12), id(0, 12), id(2, 12)];
  const runs = arrange(ids, tiles, 'run');
  assert.deepEqual(runs.sets, [
    [id(0, 1), id(0, 2), id(0, 3)],
    [id(0, 12), id(2, 12), id(3, 12)],
  ]);
  assert.deepEqual(runs.rest, [id(0, 2, 1), id(1, 6), id(2, 10)]);
});

const JOKER = 104;
const six = () => row(id(0, 6), id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11));

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
  assert.deepEqual(drop(six(), 3, id(2, 2)).slice(0, 10), [id(0, 6), id(0, 7), id(0, 8), null, id(2, 2), null, id(0, 9), id(0, 10), id(0, 11), null]);
});

test('a misfit dropped on the edge of a run does not split it', () => {
  assert.deepEqual(drop(six(), 0, id(2, 2)).slice(0, 9), [id(2, 2), null, id(0, 6), id(0, 7), id(0, 8), id(0, 9), id(0, 10), id(0, 11), null]);
});
