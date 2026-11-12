import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { Room, RoomError } from './room';
import type { Ack, ChatMessage } from '../shared/types';

const PORT = Number(process.env.PORT) || 3001;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const REACTIONS = new Set(['🐾', '❤️', '😹', '☕', '👏', '😴']);
const ROOM_TTL_MS = 30 * 60_000;

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });
const rooms = new Map<string, Room>();

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const buildId = () => {
  try {
    return String(fs.statSync(path.join(dist, 'index.html')).mtimeMs);
  } catch {
    return 'dev';
  }
};

app.get('/healthz', (_req, res) => {
  res.send('ok');
});

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

function publish(room: Room) {
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit('state', room.view(p.id));
  }
}

function publishChat(room: Room, message: ChatMessage) {
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit('chat', message);
  }
}

function newCode() {
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

interface Identity {
  playerId: string;
  name: string;
  avatar: number;
}

function identity(raw: unknown): Identity | null {
  if (!raw || typeof raw !== 'object') return null;
  const { playerId, name, avatar } = raw as Record<string, unknown>;
  if (typeof playerId !== 'string' || playerId.length < 8 || playerId.length > 64) return null;
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 16) : '';
  return {
    playerId,
    name: cleanName || 'Котик',
    avatar: Number.isInteger(avatar) && (avatar as number) >= 0 && (avatar as number) < 6 ? (avatar as number) : 0,
  };
}

type Reply = (ack: Ack) => void;

function guard(reply: unknown, fn: () => Ack | void) {
  const send: Reply = typeof reply === 'function' ? (reply as Reply) : () => {};
  try {
    send(fn() ?? { ok: true });
  } catch (err) {
    if (err instanceof RoomError) send({ ok: false, error: err.message });
    else {
      console.error(err);
      send({ ok: false, error: 'Что-то пошло не так' });
    }
  }
}

function enter(socket: Socket, room: Room, who: Identity) {
  const prev = socket.data.room as Room | undefined;
  if (prev && prev !== room) prev.disconnect(socket.id);
  room.join(who.playerId, who.name, who.avatar, socket.id);
  socket.data.room = room;
  socket.data.playerId = who.playerId;
  socket.emit('chat:history', room.chat);
}

io.on('connection', (socket) => {
  socket.emit('build', buildId());

  const ctx = () => {
    const room = socket.data.room as Room | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!room || !playerId || !rooms.has(room.code)) throw new RoomError('Ты не в комнате');
    return { room, playerId };
  };

  socket.on('room:create', (raw, reply) =>
    guard(reply, () => {
      const who = identity(raw);
      if (!who) throw new RoomError('Неверные данные');
      const room = new Room(newCode(), publish, publishChat);
      rooms.set(room.code, room);
      enter(socket, room, who);
      return { ok: true, code: room.code };
    }),
  );

  socket.on('room:join', (raw, reply) =>
    guard(reply, () => {
      const who = identity(raw);
      const code = String((raw as { code?: unknown })?.code ?? '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!who) throw new RoomError('Неверные данные');
      if (!room) throw new RoomError('Комната не найдена');
      enter(socket, room, who);
      return { ok: true, code };
    }),
  );

  socket.on('room:leave', (_raw, reply) =>
    guard(reply, () => {
      const { room, playerId } = ctx();
      socket.data.room = undefined;
      room.leave(playerId);
    }),
  );

  socket.on('game:start', (raw, reply) =>
    guard(reply, () => {
      const { room, playerId } = ctx();
      room.start(playerId, Number((raw as { turnSeconds?: unknown })?.turnSeconds));
    }),
  );

  socket.on('game:again', (_raw, reply) =>
    guard(reply, () => {
      const { room, playerId } = ctx();
      room.again(playerId);
    }),
  );

  socket.on('turn:draft', (grid) => {
    const room = socket.data.room as Room | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!room || !playerId) return;
    const draft = room.setDraft(playerId, grid);
    if (!draft) return;
    for (const p of room.players) {
      if (p.socketId && p.id !== playerId) io.to(p.socketId).emit('draft', draft);
    }
  });

  socket.on('turn:end', (grid, reply) =>
    guard(reply, () => {
      const { room, playerId } = ctx();
      room.endTurn(playerId, grid);
    }),
  );

  socket.on('turn:draw', (_raw, reply) =>
    guard(reply, () => {
      const { room, playerId } = ctx();
      room.draw(playerId);
    }),
  );

  socket.on('chat:send', (text, reply) =>
    guard(reply, () => {
      const { room, playerId } = ctx();
      room.say(playerId, text);
    }),
  );

  socket.on('react', (emoji) => {
    const room = socket.data.room as Room | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!room || !playerId || typeof emoji !== 'string' || !REACTIONS.has(emoji)) return;
    for (const p of room.players) if (p.socketId) io.to(p.socketId).emit('reaction', { playerId, emoji });
  });

  socket.on('disconnect', () => {
    const room = socket.data.room as Room | undefined;
    room?.disconnect(socket.id);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const empty = room.players.every((p) => p.socketId === null);
    if (empty && now - room.lastSeen > ROOM_TTL_MS) {
      room.dispose();
      rooms.delete(code);
    }
  }
}, 60_000).unref();

http.listen(PORT, () => console.log(`Cozy Tiles server on http://localhost:${PORT}`));
