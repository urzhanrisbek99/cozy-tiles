import { io } from 'socket.io-client';
import type { Ack } from '../shared/types';

export const socket = io({ transports: ['websocket', 'polling'] });

export function call(event: string, payload?: unknown): Promise<Ack> {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload ?? null, (err: Error | null, ack?: Ack) => {
      resolve(err || !ack ? { ok: false, error: 'Нет связи с сервером' } : ack);
    });
  });
}
