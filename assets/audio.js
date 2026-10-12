// Simple sound player (Web Audio API). It does not use the Phaser loader, so it cannot make the game hang.
const Sfx = {
  ctx: null, buf: {}, eng: null,
  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || typeof SOUNDS === 'undefined') return;
    this.ctx = new AC();
    Object.entries(SOUNDS).forEach(([k, uri]) => {
      const bin = atob(uri.split(',')[1]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(bytes.buffer, b => { this.buf[k] = b; }, () => console.warn('Failed to decode sound:', k));
    });
    const unlock = () => { if (this.ctx.state === 'suspended') this.ctx.resume(); };
    ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, unlock));
  },
  play(key, vol = 0.5) {
    if (!this.ctx || !this.buf[key]) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = this.buf[key]; g.gain.value = vol;
    s.connect(g).connect(this.ctx.destination); s.start();
  },
  // gunshot: a short burst of filtered noise (generated, no sound file needed)
  shot(vol = 0.35) {
    if (!this.ctx) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * 0.16), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = 2600; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  },
  // police siren: level 0..1 = loudness, 0 / null = off
  siren(level, kind) { // kind: 'police' (fast warble) or 'amb' (slower, lower)
    if (!this.ctx) return;
    if (!level) { if (this.sir) { this.sir.osc.stop(); this.sir.lfo.stop(); this.sir = null; } return; }
    if (!this.sir) {
      const c = this.ctx, osc = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
      osc.type = 'sawtooth'; osc.frequency.value = 850; lfo.frequency.value = 1.3; lg.gain.value = 260; f.type = 'lowpass'; f.frequency.value = 2200;
      lfo.connect(lg).connect(osc.frequency); osc.connect(f).connect(g).connect(c.destination); osc.start(); lfo.start();
      this.sir = { osc, lfo, g };
    }
    if (this.sir.kind !== kind) { this.sir.kind = kind; this.sir.osc.frequency.value = kind === 'amb' ? 700 : 850; this.sir.lfo.frequency.value = kind === 'amb' ? 0.7 : 1.3; }
    this.sir.g.gain.value = 0.07 * level;
  },
  // r = 0..1 (car speed); null = stop the engine
  engineSet(r) {
    if (!this.ctx || !this.buf.engine) return;
    if (r === null) { if (this.eng) { this.eng.src.stop(); this.eng = null; } return; }
    if (!this.eng) {
      const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      src.buffer = this.buf.engine; src.loop = true;
      src.connect(gain).connect(this.ctx.destination); src.start();
      this.eng = { src, gain };
    }
    this.eng.src.playbackRate.value = 0.7 + 0.9 * r;
    this.eng.gain.gain.value = 0.12 + 0.2 * r;
  }
};
