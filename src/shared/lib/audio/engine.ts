import { playThroughSilentSwitch } from './silentMode';

const TRACKS = ['/music/poor-but-happy.mp3', '/music/happy-but-a-little-off.mp3', '/music/puppy-love.mp3', '/music/new-shoes.mp3'];
const FADE_IN_S = 0.8;
const FADE_OUT_MS = 500;
const SFX_LEVEL = 0.6;

const mtof = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function shuffled<T>(items: T[]): T[] {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export class CozyAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private player: HTMLAudioElement | null = null;
  private queue: string[] = [];
  private current = '';
  private failures = 0;
  private wanted = false;
  private pauseTimer: number | null = null;
  private volume = 0.6;
  sfxEnabled = true;

  get isPlaying() {
    return this.wanted;
  }

  start() {
    const ctx = this.ensure();
    if (!ctx) return;
    playThroughSilentSwitch();
    void ctx.resume();
    this.wanted = true;
    if (this.pauseTimer !== null) {
      window.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(this.volume, ctx.currentTime, FADE_IN_S / 3);
    const player = this.ensurePlayer(ctx);
    if (!player.src) this.playNext();
    else if (player.paused) void player.play().catch(() => {});
  }

  stop() {
    const ctx = this.ctx;
    if (!ctx || !this.wanted) return;
    this.wanted = false;
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT_MS / 4000);
    this.pauseTimer = window.setTimeout(() => {
      this.pauseTimer = null;
      this.player?.pause();
      this.music.gain.cancelScheduledValues(0);
      this.music.gain.value = 0;
    }, FADE_OUT_MS);
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.ctx && this.wanted) this.music.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.15);
  }

  wake() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
    if (this.wanted && this.player?.paused && this.player.src) void this.player.play().catch(() => {});
  }

  tock() {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.06);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.12);
    this.noiseHit(t, 'highpass', 2500, 0.05, 0.025);
  }

  turn() {
    this.melody([72, 79, 84], 0.12, 0.1);
  }

  pick(step: number) {
    this.melody([79 + Math.min(step, 8) * 2], 0, 0.06, 'sine');
  }

  pop() {
    this.melody([88, 91], 0.06, 0.05, 'sine');
  }

  oops() {
    this.melody([64, 60], 0.12, 0.05, 'sine');
  }

  clock(urgent: boolean) {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(urgent ? 1320 : 990, t);
    osc.frequency.exponentialRampToValueAtTime(urgent ? 990 : 740, t + 0.05);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(urgent ? 0.22 : 0.15, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  celebrate(winner: boolean) {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    if (!winner) {
      this.melody([72, 76, 79, 84], 0.12, 0.07);
      return;
    }
    this.melody([72, 76, 79, 84, 79, 84, 88, 91, 96], 0.12, 0.09);
    const t0 = ctx.currentTime + 0.05;
    for (const at of [0.15, 0.7, 1.3, 1.9, 2.6, 3.3]) {
      this.noiseHit(t0 + at, 'bandpass', 700 + Math.random() * 900, 0.3, 0.4);
      this.noiseHit(t0 + at + 0.08, 'highpass', 5000, 0.08, 0.6);
    }
  }

  private playNext() {
    const player = this.player;
    if (!player) return;
    if (!this.queue.length) this.queue = shuffled(TRACKS.filter((track) => track !== this.current || TRACKS.length === 1));
    this.current = this.queue.shift()!;
    player.src = this.current;
    if (this.wanted) void player.play().catch(() => {});
  }

  private ensurePlayer(ctx: AudioContext) {
    if (this.player) return this.player;
    const player = new Audio();
    player.preload = 'auto';
    player.setAttribute('playsinline', '');
    player.addEventListener('ended', () => this.playNext());
    player.addEventListener('playing', () => {
      this.failures = 0;
    });
    player.addEventListener('error', () => {
      if (++this.failures < TRACKS.length) this.playNext();
    });
    ctx.createMediaElementSource(player).connect(this.music);
    this.player = player;
    return player;
  }

  private melody(notes: number[], gap: number, level: number, type: OscillatorType = 'triangle') {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    notes.forEach((midi, i) => {
      const t = t0 + i * gap;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = mtof(midi);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 1);
    });
  }

  private noiseHit(t: number, type: BiquadFilterType, frequency: number, level: number, duration: number) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.sfxBus);
    source.start(t, Math.random() * 1.5, duration + 0.02);
  }

  private sfxCtx() {
    if (!this.sfxEnabled) return null;
    const ctx = this.ensure();
    if (!ctx) return null;
    if (ctx.state !== 'running') {
      playThroughSilentSwitch();
      void ctx.resume();
    }
    return ctx;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.ctx = ctx;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.connect(limiter).connect(ctx.destination);

    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_LEVEL;
    this.sfxBus.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    return ctx;
  }
}

export const audio = new CozyAudio();
