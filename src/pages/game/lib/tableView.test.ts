import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_COLS, BOARD_ROWS, emptyGrid, type Grid } from '@core/rules';
import { chooseView, spareSets } from './tableView';

const PORTRAIT = { width: 358, height: 330 };
const LANDSCAPE = { width: 560, height: 262 };

let nextId = 0;
function put(board: Grid, r: number, c: number, length = 1) {
  for (let i = 0; i < length; i++) board[r][c + i] = nextId++;
}

test('an empty table starts at the largest tile, centred', () => {
  const view = chooseView(PORTRAIT, emptyGrid());
  assert.deepEqual(view, { zoom: 36, cols: 9, rows: 6, col0: 7, row0: 1 });
  const wide = chooseView(LANDSCAPE, emptyGrid());
  assert.equal(wide.zoom, 36);
  assert.equal(wide.cols, 14);
});

test('tiles in the corners of the view do not change the zoom or move the view', () => {
  const board = emptyGrid();
  const start = chooseView(PORTRAIT, board);
  put(board, start.row0, start.col0);
  put(board, start.row0, start.col0 + start.cols - 1);
  put(board, start.row0 + start.rows - 1, start.col0);
  put(board, start.row0 + start.rows - 1, start.col0 + start.cols - 1);
  assert.deepEqual(chooseView(PORTRAIT, board, start.zoom), start);
});

test('sets along the edges keep the zoom while two more sets still fit', () => {
  const board = emptyGrid();
  const start = chooseView(PORTRAIT, board);
  for (let r = start.row0; r < start.row0 + start.rows - 1; r++) {
    put(board, r, start.col0, 4);
    put(board, r, start.col0 + 5, 4);
  }
  assert.equal(spareSets(board, start), 2);
  assert.deepEqual(chooseView(PORTRAIT, board, start.zoom), start);
});

test('the view zooms out one step when no room is left for two more sets', () => {
  const board = emptyGrid();
  const start = chooseView(PORTRAIT, board);
  for (let r = start.row0; r < start.row0 + start.rows; r++) {
    put(board, r, start.col0, 4);
    put(board, r, start.col0 + 5, 4);
  }
  assert.equal(spareSets(board, start), 0);
  const next = chooseView(PORTRAIT, board, start.zoom);
  assert.equal(next.zoom, 31);
  assert.ok(next.cols > start.cols);
});

test('a run across the whole width zooms out even with empty rows around it', () => {
  const board = emptyGrid();
  const start = chooseView(PORTRAIT, board);
  put(board, start.row0 + 2, start.col0, start.cols);
  assert.ok(chooseView(PORTRAIT, board, start.zoom).zoom < start.zoom);
});

test('a tile another player put outside the view brings it into the view', () => {
  const board = emptyGrid();
  put(board, 0, 2);
  const view = chooseView(PORTRAIT, board, 36);
  assert.ok(view.col0 <= 2 && view.row0 === 0);
});

test('zooming back in waits until there is clearly more room', () => {
  const board = emptyGrid();
  const start = chooseView(PORTRAIT, board);
  for (let r = start.row0; r < start.row0 + start.rows - 1; r++) {
    put(board, r, start.col0, 4);
    put(board, r, start.col0 + 5, 4);
  }
  assert.equal(chooseView(PORTRAIT, board, 31).zoom, 31);
  assert.equal(chooseView(PORTRAIT, board, 36).zoom, 36);
});

test('a full table shows the whole board', () => {
  const board = emptyGrid();
  for (let r = 0; r < BOARD_ROWS; r++) put(board, r, 0, BOARD_COLS);
  const view = chooseView(PORTRAIT, board);
  assert.equal(view.cols, BOARD_COLS);
  assert.equal(view.rows, BOARD_ROWS);
});
