import { setValue, type Tile } from '@core/rules';

export function continuesSet(picked: Tile[], next: Tile) {
  if (picked.length > 1) return setValue([...picked, next]) !== null;
  const first = picked[0];
  if (first.joker || next.joker) return true;
  return first.color === next.color ? next.num === first.num + 1 : first.num === next.num;
}

export function isSet(ids: number[], tiles: Tile[]) {
  return setValue(ids.map((id) => tiles[id])) !== null;
}

export function couldBeSet(ids: number[], tiles: Tile[]) {
  if (ids.length < 2) return true;
  if (ids.length === 2) return continuesSet([tiles[ids[0]]], tiles[ids[1]]);
  return isSet(ids, tiles);
}
