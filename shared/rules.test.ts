import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTiles, emptyGrid, setValue, validateTurn, type Tile } from './rules';

const t = (color: number, num: number, id = 0): Tile => ({ id, color, num, joker: false });
const J: Tile = { id: 999, color: 0, num: 0, joker: true };

test('tile set sizes', () => {
  assert.equal(createTiles(4).length, 106);
  assert.equal(createTiles(5).length, 160);
  createTiles(5).forEach((tile, i) => assert.equal(tile.id, i));
});

test('runs', () => {
  assert.equal(setValue([t(0, 4), t(0, 5), t(0, 6)]), 15);
  assert.equal(setValue([t(0, 6), t(0, 5), t(0, 4)]), 15);
  assert.equal(setValue([t(0, 4), J, t(0, 6)]), 15);
  assert.equal(setValue([J, t(0, 12), t(0, 13)]), 36);
  assert.equal(setValue([t(0, 12), t(0, 13), J]), null);
  assert.equal(setValue([t(0, 4), t(1, 5), t(0, 6)]), null);
  assert.equal(setValue([t(0, 4), t(0, 6), t(0, 7)]), null);
  assert.equal(setValue([t(0, 4), t(0, 5)]), null);
});

test('groups', () => {
  assert.equal(setValue([t(0, 7), t(1, 7), t(2, 7)]), 21);
  assert.equal(setValue([t(0, 7), t(1, 7), J, t(3, 7)]), 28);
  assert.equal(setValue([t(0, 7), t(0, 7), t(2, 7)]), null);
  assert.equal(setValue([t(0, 7), t(1, 7), t(2, 7), t(3, 7), J]), null);
});

test('initial meld needs 30 from own tiles', () => {
  const tiles = createTiles(2);
  const before = emptyGrid();
  const low = emptyGrid();
  low[0].splice(0, 3, 0, 1, 2);
  assert.equal(validateTurn({ before, after: low, rack: [0, 1, 2], tiles, melded: false }).ok, false);
  const high = emptyGrid();
  high[0].splice(0, 3, 9, 10, 11);
  assert.deepEqual(validateTurn({ before, after: high, rack: [9, 10, 11], tiles, melded: false }), {
    ok: true,
    played: [9, 10, 11],
  });
});

test('table tiles cannot go back to the rack', () => {
  const tiles = createTiles(2);
  const before = emptyGrid();
  before[0][0] = 0;
  before[0][1] = 1;
  before[0][2] = 2;
  const after = emptyGrid();
  after[0][0] = 0;
  after[0][1] = 1;
  after[1][0] = 3;
  after[1][1] = 4;
  after[1][2] = 5;
  const res = validateTurn({ before, after, rack: [3, 4, 5], tiles, melded: true });
  assert.equal(res.ok, false);
});
