const PHONE_WIDTH = 520;
const SHORT_HEIGHT = 500;
const SIDEWAYS_WIDTH = 600;

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

const installed = () =>
  window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isSideways = () => installed() && window.innerHeight > window.innerWidth && window.innerWidth <= SIDEWAYS_WIDTH;

export function viewportSize(): Size {
  const { innerWidth: width, innerHeight: height } = window;
  return isSideways() ? { width: height, height: width } : { width, height };
}

export function screenMode(): Screen {
  const { width, height } = viewportSize();
  if (height <= SHORT_HEIGHT && width > height) return 'landscape';
  return width <= PHONE_WIDTH ? 'portrait' : 'desktop';
}

export const toLocal = (x: number, y: number): Point => (isSideways() ? { x: y, y: window.innerWidth - x } : { x, y });

export const toClient = (x: number, y: number): Point => (isSideways() ? { x: window.innerWidth - y, y: x } : { x, y });

export function localRect(el: Element): Box {
  const { left, top, right, bottom, width, height } = el.getBoundingClientRect();
  if (!isSideways()) return { left, top, right, bottom, width, height };
  const edge = window.innerWidth;
  return { left: top, top: edge - right, right: bottom, bottom: edge - left, width: height, height: width };
}

export function watchScreen() {
  const sync = () => {
    const mode = screenMode();
    const root = document.documentElement.classList;
    root.toggle('sideways', isSideways());
    root.toggle('phone-landscape', mode === 'landscape');
    root.toggle('phone-portrait', mode === 'portrait');
  };
  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  window.visualViewport?.addEventListener('resize', sync);
}
