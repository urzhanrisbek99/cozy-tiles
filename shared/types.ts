import type { Grid, Tile } from './rules';

export type Phase = 'lobby' | 'playing' | 'ended';

export interface PlayerView {
  id: string;
  name: string;
  avatar: number;
  online: boolean;
  left: boolean;
  count: number;
  melded: boolean;
  score: number;
}

export interface RankRow {
  id: string;
  name: string;
  avatar: number;
  value: number;
  delta: number;
  score: number;
}

export interface GameResult {
  winnerId: string;
  reason: 'out' | 'stalemate' | 'alone';
  ranks: RankRow[];
}

export interface RoomView {
  code: string;
  phase: Phase;
  you: string;
  hostId: string;
  players: PlayerView[];
  turnPlayerId: string | null;
  turnId: number;
  turnEndsIn: number | null;
  turnSeconds: number;
  board: Grid;
  draft: Grid | null;
  pool: number;
  tiles: Tile[];
  rack: number[];
  melded: boolean;
  result: GameResult | null;
  last: string;
}

export interface Ack {
  ok: boolean;
  error?: string;
  code?: string;
}

export interface ChatMessage {
  id: number;
  playerId: string | null;
  name: string;
  avatar: number;
  text: string;
  at: number;
}

export interface Reaction {
  playerId: string;
  emoji: string;
}
