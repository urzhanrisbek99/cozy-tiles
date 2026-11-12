import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTiles } from '@core/rules';
import { arrange, insertGroup, type Cells } from './rack';
import { continuesSet } from './sets';

const tiles = createTiles(2);
const id = (color: number, num: number, copy = 0) => copy * 52 + color * 13 + (num - 1);

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
