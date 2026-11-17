// audio.js — all sound is synthesised with WebAudio: no audio files, no
// network. Engine hum, police siren, gunshots, pickups, explosions and a
// light synth bass loop for the radio. Everything is behind a mute toggle
// and only starts after the first user gesture.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Call once from a user gesture (Enter / click on the title screen).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }

  // --- one-shot effects ---------------------------------------------------

  blip(freq = 660, dur = 0.09, type = 'square', vol = 0.16) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pickup() { this.blip(880, 0.08); setTimeout(() => this.blip(1320, 0.1), 70); }
  cash() { this.blip(990, 0.07); setTimeout(() => this.blip(1320, 0.12), 80); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.2), i * 110)); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 100)); }
  fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'sawtooth', 0.12), i * 130)); }
  punch() { this.noiseBurst(0.08, 0.25, 900); }
  hurt() { this.blip(180, 0.18, 'sawtooth', 0.2); }

  gunshot() {
    if (!this.ctx || this.muted) return;
    this.noiseBurst(0.12, 0.4, 2400);
    this.blip(140, 0.1, 'square', 0.25);
  }

  explosion() {
    if (!this.ctx || this.muted) return;
    this.noiseBurst(0.7, 0.55, 500);
    this.blip(60, 0.6, 'sine', 0.5);
  }

  noiseBurst(dur, vol, cutoff) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  // --- continuous sounds --------------------------------------------------

  // Engine hum follows the player's speed (0..1). Call every frame.
  engine(speedNorm, driving) {
    if (!this.ctx || this.muted) return;
    if (!driving) {
      if (this.engineOsc) { this.engineGain.gain.value = 0; }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      this.engineOsc.connect(f).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.05, t, 0.1);
  }

  // Two-tone police siren while any wanted level is active.
  siren(on) {
    if (!this.ctx || this.muted) return;
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.sirenOsc.frequency.value = 700;
      setInterval(() => {
        if (!this.sirenOsc || !this.sirenGain) return;
        const target = this.sirenOsc.frequency.value > 800 ? 700 : 950;
        this.sirenOsc.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      }, 420);
    }
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
  }

  // --- radio: a slow sun-soaked bass loop ---------------------------------
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // A minor-key bass walk, one note per beat, with a soft pad on top.
    const bass = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn) return;
      const step = this.musicStep++ % 8;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = bass[step];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.6);
      if (step % 4 === 0) {
        const p = this.ctx.createOscillator();
        const pg = this.ctx.createGain();
        p.type = 'sine';
        p.frequency.value = bass[step] * 4;
        pg.gain.setValueAtTime(0.0001, t);
        pg.gain.exponentialRampToValueAtTime(0.03, t + 0.1);
        pg.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        p.connect(pg).connect(this.master);
        p.start(t);
        p.stop(t + 1.2);
      }
    }, 300);
  }
}
