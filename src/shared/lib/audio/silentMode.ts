interface AudioSession {
  type: string;
}

const isAppleTouch = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

function silentWav() {
  const rate = 8000;
  const samples = rate / 2;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

let keeper: HTMLAudioElement | null = null;

export function playThroughSilentSwitch() {
  const session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
      return;
    } catch {
      keeper = null;
    }
  }
  if (!isAppleTouch()) return;
  if (!keeper) {
    keeper = new Audio(silentWav());
    keeper.loop = true;
    keeper.setAttribute('playsinline', '');
  }
  if (keeper.paused) void keeper.play().catch(() => {});
}
