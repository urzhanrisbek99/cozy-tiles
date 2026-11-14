import { useSyncExternalStore } from 'react';

const PHONE_WIDTH = 520;
const SHORT_HEIGHT = 500;
const SIDEWAYS_WIDTH = 600;
const TILT = 6;

export type Screen = 'desktop' | 'portrait' | 'landscape';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

let flipped = false;
const watchers = new Set<() => void>();

const installed = () =>
  window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isSideways = () => installed() && window.innerHeight > window.innerWidth && window.innerWidth <= SIDEWAYS_WIDTH;

function landscapeTurn() {
  const legacy = (window as Window & { orientation?: number }).orientation;
  const angle = typeof legacy === 'number' ? legacy : (window.screen.orientation?.angle ?? 0);
  if (angle === 90) return 1;
  if (angle === -90 || angle === 270) return -1;
  return 0;
}

export function viewportSize(): Size {
  const { innerWidth: width, innerHeight: height } = window;
  return isSideways() ? { width: height, height: width } : { width, height };
}

export function screenMode(): Screen {
  const { width, height } = viewportSize();
  if (height <= SHORT_HEIGHT && width > height) return 'landscape';
  return width <= PHONE_WIDTH ? 'portrait' : 'desktop';
}

export function toLocal(x: number, y: number): Point {
  if (!isSideways()) return { x, y };
  return flipped ? { x: window.innerHeight - y, y: x } : { x: y, y: window.innerWidth - x };
}

export function toClient(x: number, y: number): Point {
  if (!isSideways()) return { x, y };
  return flipped ? { x: y, y: window.innerHeight - x } : { x: window.innerWidth - y, y: x };
}

export function localRect(el: Element): Box {
  const { left, top, right, bottom, width, height } = el.getBoundingClientRect();
  if (!isSideways()) return { left, top, right, bottom, width, height };
  if (flipped) {
    const edge = window.innerHeight;
    return { left: edge - bottom, top: left, right: edge - top, bottom: right, width: height, height: width };
  }
  const edge = window.innerWidth;
  return { left: top, top: edge - right, right: bottom, bottom: edge - left, width: height, height: width };
}

function sync() {
  const turn = landscapeTurn();
  if (turn !== 0) flipped = turn < 0;
  const mode = screenMode();
  const sideways = isSideways();
  const root = document.documentElement.classList;
  root.toggle('sideways', sideways);
  root.toggle('flipped', sideways && flipped);
  root.toggle('phone-landscape', mode === 'landscape');
  root.toggle('phone-portrait', mode === 'portrait');
  watchers.forEach((notify) => notify());
}

function watch(notify: () => void) {
  watchers.add(notify);
  return () => {
    watchers.delete(notify);
  };
}

export const useSideways = () => useSyncExternalStore(watch, isSideways);

function onMotion(event: DeviceMotionEvent) {
  const pull = event.accelerationIncludingGravity;
  if (!pull || pull.x === null || pull.y === null || landscapeTurn() !== 0) return;
  if (Math.abs(pull.x) < TILT || Math.abs(pull.x) < Math.abs(pull.y)) return;
  const next = pull.x > 0;
  if (next === flipped) return;
  flipped = next;
  if (isSideways()) window.dispatchEvent(new Event('resize'));
}

function followTilt() {
  if (!installed() || typeof DeviceMotionEvent === 'undefined') return;
  const listen = () => window.addEventListener('devicemotion', onMotion);
  const ask = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (typeof ask !== 'function') {
    listen();
    return;
  }
  const onTap = () => {
    if (!isSideways()) return;
    window.removeEventListener('click', onTap);
    ask.call(DeviceMotionEvent).then((answer) => answer === 'granted' && listen(), () => undefined);
  };
  window.addEventListener('click', onTap);
}

export function watchScreen() {
  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  window.visualViewport?.addEventListener('resize', sync);
  followTilt();
}
