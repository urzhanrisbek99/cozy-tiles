import { useCallback, useEffect, useRef, useState } from 'react';
import type { Grid } from '@core/rules';
import type { ChatMessage, RoomView } from '@core/types';
import { call, socket } from '@/shared/api/socket';
import { playerId, saveRoom, savedRoom } from '@/shared/lib/prefs';

const CHAT_LIMIT = 80;
const SECRET = playerId();

interface Options {
  name: string;
  avatar: number;
  notify: (text: string) => void;
  onChat: (message: ChatMessage) => void;
}

export function useRoomSession(options: Options) {
  const [view, setView] = useState<RoomView | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let build: string | null = null;
    const onBuild = (next: string) => {
      if (build !== null && build !== next) window.location.reload();
      build = next;
    };
    const onConnect = async () => {
      setConnected(true);
      const code = savedRoom();
      if (!code) return;
      const { name, avatar } = latest.current;
      const ack = await call('room:join', { code, name, avatar, playerId: SECRET });
      if (ack.ok) return;
      saveRoom(null);
      setView(null);
    };
    const onDisconnect = () => setConnected(false);
    const onState = (next: RoomView) => {
      setView(next);
      setDeadline(next.turnEndsIn === null ? null : Date.now() + next.turnEndsIn);
    };
    const onDraft = (draft: Grid) =>
      setView((v) => (v && v.phase === 'playing' && v.turnPlayerId !== v.you ? { ...v, draft } : v));
    const onHistory = (history: ChatMessage[]) => setMessages(history);
    const onChat = (message: ChatMessage) => {
      setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message].slice(-CHAT_LIMIT)));
      latest.current.onChat(message);
    };

    socket.on('build', onBuild);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('draft', onDraft);
    socket.on('chat:history', onHistory);
    socket.on('chat', onChat);
    if (socket.connected) void onConnect();
    return () => {
      socket.off('build', onBuild);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('draft', onDraft);
      socket.off('chat:history', onHistory);
      socket.off('chat', onChat);
    };
  }, []);

  const enter = useCallback(async (event: 'room:create' | 'room:join', code?: string) => {
    const { name, avatar, notify } = latest.current;
    if (!name.trim()) {
      notify('Сначала напиши своё имя');
      return;
    }
    const ack = await call(event, { code, name, avatar, playerId: SECRET });
    if (ack.ok && ack.code) saveRoom(ack.code);
    else notify(ack.error ?? 'Не получилось');
  }, []);

  const create = useCallback(() => enter('room:create'), [enter]);
  const join = useCallback((code: string) => enter('room:join', code), [enter]);

  const leave = useCallback(async () => {
    await call('room:leave');
    saveRoom(null);
    setView(null);
    setMessages([]);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const sendChat = useCallback(async (text: string) => {
    const ack = await call('chat:send', text);
    if (!ack.ok) latest.current.notify(ack.error ?? 'Сообщение не отправилось');
    return ack.ok;
  }, []);

  useEffect(() => {
    if (!view?.code) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', view.code);
    window.history.replaceState(null, '', url);
  }, [view?.code]);

  return { view, deadline, connected, messages, create, join, leave, sendChat };
}
