import { useCallback, useState } from 'react';
import type { Mood } from './audio/engine';

export interface Prefs {
  name: string;
  avatar: number;
  theme: Mood;
  music: boolean;
  volume: number;
  sfx: boolean;
}

const KEY = 'cozy-tiles:prefs';
const DEFAULTS: Prefs = { name: '', avatar: 0, theme: 'rain', music: true, volume: 0.55, sfx: true };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(() => read(KEY, DEFAULTS));
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      write(KEY, next);
      return next;
    });
  }, []);
  return [prefs, update] as const;
}

export function playerId(): string {
  try {
    const existing = localStorage.getItem('cozy-tiles:pid');
    if (existing) return existing;
    const id = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('');
    localStorage.setItem('cozy-tiles:pid', id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}

export function savedRoom(): string | null {
  try {
    return sessionStorage.getItem('cozy-tiles:room');
  } catch {
    return null;
  }
}

export function saveRoom(code: string | null) {
  try {
    if (code) sessionStorage.setItem('cozy-tiles:room', code);
    else sessionStorage.removeItem('cozy-tiles:room');
  } catch {
  }
}
