export type Mood = 'rain' | 'night' | 'autumn' | 'sakura';

interface Chord {
  bass: number;
  notes: number[];
}

interface MoodSpec {
  bpm: number;
  progressions: Chord[][];
  rain: number;
  brightness: number;
}

const ch = (bass: number, ...notes: number[]): Chord => ({ bass, notes });

const PROGRESSIONS = {
  warm: [ch(41, 53, 57, 60, 64), ch(40, 52, 55, 59, 62), ch(38, 50, 53, 57, 60), ch(36, 48, 52, 55, 59)],
  jazzy: [ch(38, 50, 53, 57, 60, 64), ch(43, 53, 57, 59, 64), ch(36, 52, 55, 59, 62), ch(45, 55, 60, 64, 67)],
  dusk: [ch(39, 51, 55, 58, 62), ch(38, 50, 53, 57, 60), ch(36, 48, 51, 55, 58), ch(34, 46, 50, 53, 57)],
  bloom: [ch(43, 55, 59, 62, 66), ch(42, 54, 57, 61, 64), ch(40, 52, 55, 59, 62), ch(45, 55, 57, 62, 64)],
};

const MOODS: Record<Mood, MoodSpec> = {
  rain: { bpm: 72, progressions: [PROGRESSIONS.warm, PROGRESSIONS.jazzy], rain: 0.5, brightness: 1500 },
  night: { bpm: 64, progressions: [PROGRESSIONS.dusk, PROGRESSIONS.warm], rain: 0, brightness: 1100 },
  autumn: { bpm: 78, progressions: [PROGRESSIONS.jazzy, PROGRESSIONS.bloom], rain: 0, brightness: 1700 },
  sakura: { bpm: 70, progressions: [PROGRESSIONS.bloom, PROGRESSIONS.warm], rain: 0, brightness: 1900 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const WORKER_SRC =
  "let t=null;onmessage=e=>{clearInterval(t);if(e.data==='start')t=setInterval(()=>postMessage(0),25)}";

export class CozyAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private keys!: GainNode;
  private keysFilter!: BiquadFilterNode;
  private echoSend!: GainNode;
  private sfxBus!: GainNode;
  private rainGain!: GainNode;
  private noise!: AudioBuffer;
  private worker: Worker | null = null;
  private playing = false;
  private stopTimer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private loops = 0;
  private progIndex = 0;
  private mood: MoodSpec = MOODS.rain;
  private pendingMood: MoodSpec | null = null;
  private volume = 0.6;
  sfxEnabled = true;

  get isPlaying() {
    return this.playing;
  }

  start() {
    const ctx = this.ensure();
    if (!ctx) return;
    void ctx.resume();
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.8);
    if (this.playing) return;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.15;
    this.step = 0;
    this.bar = 0;
    this.loops = 0;
    if (!this.worker) {
      this.worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
      this.worker.onmessage = () => this.tick();
    }
    this.worker.postMessage('start');
  }

  stop() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    this.stopTimer = window.setTimeout(() => {
      this.playing = false;
      this.worker?.postMessage('stop');
      this.stopTimer = null;
    }, 1200);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.playing) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.15);
  }

  setMood(name: Mood) {
    const spec = MOODS[name];
    if (this.playing) this.pendingMood = spec;
    else {
      this.mood = spec;
      this.progIndex = 0;
    }
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.rainGain.gain.setTargetAtTime(spec.rain, t, 1.5);
      this.keysFilter.frequency.setTargetAtTime(spec.brightness, t, 1.5);
    }
  }

  tock() {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(480, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.12);
    this.noiseHit(t, 'highpass', 2500, 0.05, 0.025, this.sfxBus);
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

  clock(urgent: boolean) {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(urgent ? 1320 : 990, t);
    o.frequency.exponentialRampToValueAtTime(urgent ? 990 : 740, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(urgent ? 0.22 : 0.15, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.16);
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
      const t = t0 + at;
      this.noiseHit(t, 'bandpass', 700 + Math.random() * 900, 0.3, 0.4, this.sfxBus);
      this.noiseHit(t + 0.08, 'highpass', 5000, 0.08, 0.6, this.sfxBus);
    }
  }

  oops() {
    this.melody([64, 60], 0.12, 0.05, 'sine');
  }

  private melody(notes: number[], gap: number, vol: number, type: OscillatorType = 'triangle') {
    const ctx = this.sfxCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    notes.forEach((m, i) => {
      const t = t0 + i * gap;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 1);
    });
  }

  private sfxCtx() {
    if (!this.sfxEnabled) return null;
    const ctx = this.ensure();
    if (!ctx) return null;
    if (ctx.state !== 'running') void ctx.resume();
    return ctx;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3400;
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(tone).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);

    const wow = ctx.createDelay(0.05);
    wow.delayTime.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.45;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.0016;
    lfo.connect(lfoDepth).connect(wow.delayTime);
    lfo.start();

    this.keysFilter = ctx.createBiquadFilter();
    this.keysFilter.type = 'lowpass';
    this.keysFilter.frequency.value = this.mood.brightness;
    this.keysFilter.Q.value = 0.4;
    this.keys = ctx.createGain();
    this.keys.connect(this.keysFilter).connect(wow).connect(this.music);

    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 1800;
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.45;
    this.echoSend.connect(echo);
    echo.connect(echoTone).connect(feedback).connect(echo);
    echoTone.connect(this.music);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.startCrackle(ctx);
    this.startRain(ctx);
    return ctx;
  }

  private startCrackle(ctx: AudioContext) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      let v = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.00045) v += (Math.random() * 2 - 1) * 0.7;
      d[i] = v;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(this.music);
    src.start();
  }

  private startRain(ctx: AudioContext) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      d[i] = last * 3.2 + (Math.random() < 0.0008 ? (Math.random() - 0.5) * 0.3 : 0);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 250;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = this.mood.rain;
    src.connect(hp).connect(lp).connect(this.rainGain).connect(this.music);
    src.start();
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.schedule(this.step, this.nextTime);
      this.nextTime += 60 / this.mood.bpm / 4;
      this.step++;
      if (this.step === 16) {
        this.step = 0;
        this.bar++;
        if (this.bar === 4) {
          this.bar = 0;
          this.loops++;
          if (this.pendingMood) {
            this.mood = this.pendingMood;
            this.pendingMood = null;
            this.progIndex = 0;
            this.loops = 0;
          } else if (this.loops >= 2) {
            this.loops = 0;
            this.progIndex = (this.progIndex + 1) % this.mood.progressions.length;
          }
        }
      }
    }
  }

  private schedule(s: number, t: number) {
    const sd = 60 / this.mood.bpm / 4;
    const swing = s % 4 === 2 ? sd * 0.3 : 0;
    const chord = this.mood.progressions[this.progIndex][this.bar];
    const r = Math.random();

    if (s === 0) {
      chord.notes.forEach((m, i) => this.key(m, t + i * 0.02, sd * 15, 1));
      this.bass(chord.bass, t, sd * 8);
    }
    if (s === 10) {
      if (r < 0.45) chord.notes.slice(1).forEach((m, i) => this.key(m, t + swing + i * 0.015, sd * 5, 0.55));
      this.bass(chord.bass + (r > 0.7 ? 7 : 0), t + swing, sd * 4);
    }
    if (s === 0 || s === 10 || (s === 7 && r < 0.35)) this.kick(t + swing);
    if (s === 4 || s === 12) this.noiseHit(t, 'bandpass', 1700, 0.08, 0.2, this.music);
    if (s % 2 === 0 && Math.random() > 0.08) this.noiseHit(t + swing, 'highpass', 6800, s % 4 === 0 ? 0.03 : 0.018, 0.045, this.music);
    if (s % 2 === 0 && s !== 0 && Math.random() < 0.12) this.bell(pick(chord.notes) + 12, t + swing);
  }

  private key(m: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = mtof(m);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = mtof(m + 12);
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.keys);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private bell(m: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g);
    g.connect(this.keys);
    g.connect(this.echoSend);
    o.start(t);
    o.stop(t + 1.7);
  }

  private bass(m: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(m);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.36);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, vol: number, dur: number, out: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }
}

export const audio = new CozyAudio();
