import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyGrid } from '../core/rules';
import { Room } from './room';

function startedRoom() {
  const room = new Room('TEST', () => {});
  const host = room.join('secret-key-a', 'A', 0, 'socket-a');
  room.join('secret-key-b', 'B', 1, 'socket-b');
  room.start(host.id, 0);
  const player = room.current!;
  player.rack = [9, 10, 11, 0];
  return { room, player };
}

test('a valid draft is committed when the turn timer runs out', () => {
  const { room, player } = startedRoom();
  const draft = emptyGrid();
  draft[0].splice(0, 3, 9, 10, 11);
  assert.ok(room.setDraft(player.id, draft));
  room.expire(player);
  assert.deepEqual(room.board[0].slice(0, 3), [9, 10, 11]);
  assert.deepEqual(player.rack, [0]);
  assert.equal(player.melded, true);
  assert.notEqual(room.current, player);
  room.dispose();
});

test('an invalid draft is discarded and a tile is drawn instead', () => {
  const { room, player } = startedRoom();
  const draft = emptyGrid();
  draft[0].splice(0, 2, 9, 10);
  assert.ok(room.setDraft(player.id, draft));
  room.expire(player);
  assert.deepEqual(room.board, emptyGrid());
  assert.equal(player.rack.length, 5);
  assert.equal(player.melded, false);
  assert.notEqual(room.current, player);
  room.dispose();
});
