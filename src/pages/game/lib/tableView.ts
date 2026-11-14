import { BOARD_COLS, BOARD_ROWS, type Grid } from '@core/rules';

export const TILE_RATIO = 1.3;
export const GAP = 3;

const ZOOM = [36, 31, 27, 23, 20, 17, 14, 12, 10, 8];
const SPARE_SETS = 2;
const SPARE_SETS_TO_ZOOM_IN = 5;

export interface TableView {
  zoom: number;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

interface Space {
  width: number;
  height: number;
}

function holdsEverything(board: Grid, view: TableView) {
  return board.every((row, r) => {
    const inRows = r >= view.row0 && r < view.row0 + view.rows;
    return row.every((v, c) => v === null || (inRows && c >= view.col0 && c < view.col0 + view.cols));
  });
}

export function spareSets(board: Grid, view: TableView) {
  const end = view.col0 + view.cols;
  let sets = 0;
  for (let r = view.row0; r < view.row0 + view.rows; r++) {
    const row = board[r];
    if (view.cols < BOARD_COLS && row.slice(view.col0, end).every((v) => v !== null)) return 0;
    let c = view.col0;
    while (c < end) {
      if (row[c] !== null) {
        c++;
        continue;
      }
      let stop = c;
      while (stop < end && row[stop] === null) stop++;
      const free = stop - c - (c > view.col0 ? 1 : 0) - (stop < end ? 1 : 0);
      sets += Math.max(0, Math.floor((free + 1) / 4));
      c = stop;
    }
  }
  return sets;
}

export function chooseView(space: Space, board: Grid, shownZoom?: number): TableView {
  const count = (room: number, cell: number, total: number) => Math.max(1, Math.min(total, Math.floor((room + GAP) / (cell + GAP))));
  let view: TableView = { zoom: ZOOM[0], col0: 0, row0: 0, cols: BOARD_COLS, rows: BOARD_ROWS };
  for (const zoom of ZOOM) {
    const cols = count(space.width, zoom, BOARD_COLS);
    const rows = count(space.height, zoom * TILE_RATIO, BOARD_ROWS);
    view = { zoom, cols, rows, col0: Math.floor((BOARD_COLS - cols) / 2), row0: Math.floor((BOARD_ROWS - rows) / 2) };
    if (cols === BOARD_COLS && rows === BOARD_ROWS) break;
    const needed = shownZoom !== undefined && zoom > shownZoom ? SPARE_SETS_TO_ZOOM_IN : SPARE_SETS;
    if (holdsEverything(board, view) && spareSets(board, view) >= needed) break;
  }
  return view;
}
