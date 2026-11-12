import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  RACK_START,
  createTiles,
  emptyGrid,
  rackValue,
  sanitizeGrid,
  shuffle,
  validateTurn,
  type Grid,
  type Tile,
} from '../shared/rules';
import type { GameResult, Phase, RoomView } from '../shared/types';

const OFFLINE_GRACE_MS = 30_000;
const LOBBY_GRACE_MS = 20_000;

export interface Player {
  id: string;
  name: string;
  avatar: number;
  socketId: string | null;
  left: boolean;
  offlineSince: number | null;
  rack: number[];
  melded: boolean;
  score: number;
}

export class RoomError extends Error {}

export class Room {
  players: Player[] = [];
  phase: Phase = 'lobby';
  hostId = '';
  tiles: Tile[] = [];
  pool: number[] = [];
  board: Grid = emptyGrid();
  draft: Grid | null = null;
  turn = 0;
  turnId = 0;
  turnSeconds = 90;
  deadline: number | null = null;
  passStreak = 0;
  result: GameResult | null = null;
  last = '';
  lastSeen = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly code: string,
    private readonly publish: (room: Room) => void,
  ) {}

  get current(): Player | undefined {
    return this.phase === 'playing' ? this.players[this.turn] : undefined;
  }

  get active(): Player[] {
    return this.players.filter((p) => !p.left);
  }

  find(id: string) {
    return this.players.find((p) => p.id === id);
  }

  join(id: string, name: string, avatar: number, socketId: string) {
    let player = this.find(id);
    if (player && player.left) throw new RoomError('Ты уже покинул(а) эту партию — дождись следующей');
    if (!player) {
      if (this.phase !== 'lobby') throw new RoomError('Игра уже идёт — дождись следующей партии');
      if (this.players.length >= MAX_PLAYERS) throw new RoomError('Комната заполнена (максимум 5)');
      player = { id, name, avatar, socketId, left: false, offlineSince: null, rack: [], melded: false, score: 0 };
      this.players.push(player);
    }
    if (this.phase === 'lobby') {
      player.name = name;
      player.avatar = avatar;
    }
    player.socketId = socketId;
    player.offlineSince = null;
    if (!this.hostId || !this.find(this.hostId)) this.hostId = player.id;
    this.touch();
  }

  disconnect(socketId: string) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return;
    player.socketId = null;
    player.offlineSince = Date.now();
    if (this.phase === 'lobby') {
      setTimeout(() => {
        if (this.phase === 'lobby' && player.socketId === null && this.players.includes(player)) this.remove(player.id);
      }, LOBBY_GRACE_MS);
      this.touch();
      return;
    }
    this.arm();
    this.touch();
  }

  leave(id: string) {
    const player = this.find(id);
    if (!player) return;
    if (this.phase === 'lobby') {
      this.remove(id);
      return;
    }
    player.left = true;
    player.socketId = null;
    this.reassignHost();
    if (this.phase === 'playing') {
      this.last = `${player.name} уходит из игры`;
      const alive = this.active;
      if (alive.length === 1) {
        this.finish(alive[0], 'alone');
        return;
      }
      if (this.current?.id === id) {
        this.draft = null;
        this.advance();
        return;
      }
    }
    this.touch();
  }

  start(byId: string, turnSeconds: number) {
    if (byId !== this.hostId) throw new RoomError('Начать игру может только хозяин комнаты');
    if (this.phase === 'playing') throw new RoomError('Игра уже идёт');
    if (this.players.length < MIN_PLAYERS) throw new RoomError('Нужно хотя бы 2 игрока');
    this.turnSeconds = [0, 60, 90, 120, 180].includes(turnSeconds) ? turnSeconds : 90;
    this.tiles = createTiles(this.players.length);
    this.pool = shuffle(this.tiles.map((t) => t.id));
    for (const p of this.players) {
      p.rack = this.pool.splice(0, RACK_START);
      p.melded = false;
    }
    this.board = emptyGrid();
    this.passStreak = 0;
    this.result = null;
    this.phase = 'playing';
    this.turn = Math.floor(Math.random() * this.players.length);
    this.last = `Первым ходит ${this.players[this.turn].name}`;
    this.beginTurn();
  }

  setDraft(byId: string, raw: unknown): Grid | null {
    if (this.current?.id !== byId) return null;
    const grid = sanitizeGrid(raw, this.tiles.length);
    if (!grid) return null;
    this.draft = grid;
    this.lastSeen = Date.now();
    return grid;
  }

  endTurn(byId: string, raw: unknown) {
    const player = this.current;
    if (!player || player.id !== byId) throw new RoomError('Сейчас не твой ход');
    const after = sanitizeGrid(raw, this.tiles.length);
    if (!after) throw new RoomError('Странное поле — попробуй сбросить ход');
    const check = validateTurn({
      before: this.board,
      after,
      rack: player.rack,
      tiles: this.tiles,
      melded: player.melded,
    });
    if (!check.ok) throw new RoomError(check.error);
    const played = new Set(check.played);
    player.rack = player.rack.filter((id) => !played.has(id));
    player.melded = true;
    this.board = after;
    this.draft = null;
    this.passStreak = 0;
    this.last = `${player.name} выкладывает ${plural(played.size, 'плитку', 'плитки', 'плиток')}`;
    if (player.rack.length === 0) {
      this.finish(player, 'out');
      return;
    }
    this.advance();
  }

  draw(byId: string) {
    const player = this.current;
    if (!player || player.id !== byId) throw new RoomError('Сейчас не твой ход');
    this.drawFor(player, false);
    this.advance();
  }

  again(byId: string) {
    if (byId !== this.hostId) throw new RoomError('Только хозяин комнаты может начать заново');
    if (this.phase !== 'ended') return;
    this.players = this.players.filter((p) => !p.left && p.socketId !== null);
    this.reassignHost();
    this.phase = 'lobby';
    this.result = null;
    this.board = emptyGrid();
    this.last = '';
    this.touch();
  }

  view(forId: string): RoomView {
    const me = this.find(forId);
    return {
      code: this.code,
      phase: this.phase,
      you: forId,
      hostId: this.hostId,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        online: p.socketId !== null,
        left: p.left,
        count: p.rack.length,
        melded: p.melded,
        score: p.score,
      })),
      turnPlayerId: this.current?.id ?? null,
      turnId: this.turnId,
      turnEndsIn: this.deadline === null ? null : Math.max(0, this.deadline - Date.now()),
      turnSeconds: this.turnSeconds,
      board: this.board,
      draft: this.draft,
      pool: this.pool.length,
      tiles: this.tiles,
      rack: me?.rack ?? [],
      melded: me?.melded ?? false,
      result: this.result,
      last: this.last,
    };
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
  }

  private remove(id: string) {
    this.players = this.players.filter((p) => p.id !== id);
    this.reassignHost();
    this.touch();
  }

  private reassignHost() {
    const host = this.find(this.hostId);
    if (host && !host.left) return;
    this.hostId = this.active.find((p) => p.socketId !== null)?.id ?? this.active[0]?.id ?? '';
  }

  private drawFor(player: Player, timedOut: boolean) {
    this.draft = null;
    const id = this.pool.pop();
    const why = timedOut ? ' (время вышло)' : '';
    if (id === undefined) {
      this.passStreak++;
      this.last = `${player.name} пропускает ход${why}`;
    } else {
      player.rack.push(id);
      this.passStreak = 0;
      this.last = `${player.name} берёт плитку${why}`;
    }
  }

  private advance() {
    const alive = this.active;
    if (this.pool.length === 0 && this.passStreak >= alive.length) {
      const best = alive.reduce((a, b) => (rackValue(b.rack, this.tiles) < rackValue(a.rack, this.tiles) ? b : a));
      this.finish(best, 'stalemate');
      return;
    }
    let next = this.turn;
    do next = (next + 1) % this.players.length;
    while (this.players[next].left);
    this.turn = next;
    this.beginTurn();
  }

  private beginTurn() {
    this.turnId++;
    this.draft = null;
    this.deadline = this.turnSeconds > 0 ? Date.now() + this.turnSeconds * 1000 : null;
    this.arm();
    this.touch();
  }

  private arm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const player = this.current;
    if (!player) return;
    let at = this.deadline ?? Infinity;
    if (player.socketId === null) at = Math.min(at, (player.offlineSince ?? Date.now()) + OFFLINE_GRACE_MS);
    if (!Number.isFinite(at)) return;
    const turnId = this.turnId;
    this.timer = setTimeout(() => {
      if (this.turnId !== turnId || this.current !== player) return;
      this.drawFor(player, true);
      this.advance();
    }, Math.max(0, at - Date.now()));
  }

  private finish(winner: Player, reason: GameResult['reason']) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.phase = 'ended';
    this.deadline = null;
    this.draft = null;
    const losers = this.players.filter((p) => p !== winner);
    let pot = 0;
    const rows = losers.map((p) => {
      const value = rackValue(p.rack, this.tiles);
      pot += value;
      p.score -= value;
      return { id: p.id, name: p.name, avatar: p.avatar, value, delta: -value, score: p.score };
    });
    winner.score += pot;
    const winnerValue = rackValue(winner.rack, this.tiles);
    this.result = {
      winnerId: winner.id,
      reason,
      ranks: [
        { id: winner.id, name: winner.name, avatar: winner.avatar, value: winnerValue, delta: pot, score: winner.score },
        ...rows.sort((a, b) => a.value - b.value),
      ],
    };
    this.last = `${winner.name} побеждает!`;
    this.touch();
  }

  private touch() {
    this.lastSeen = Date.now();
    this.publish(this);
  }
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}
