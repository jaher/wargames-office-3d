// Realistic live Web Audio API F/A-18E Super Hornet jet engine soundscape
// synchronized to the 6 Blue Angels' live 3D positions, radial Doppler velocity,
// high-G climb throttle, stereo pan across the window, and camera distance.

export class BlueAngelsAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.muted = false;

    this._masterGain = null;
    this._roarGain = null;
    this._roarLp = null;
    this._roarBp = null;
    this._subGain = null;
    this._whineGain = null;
    this._whineOsc1 = null;
    this._whineOsc2 = null;
    this._panner = null;

    // Smoothed telemetry state (prevents any clicks or sudden jumps)
    this._curGain = 0;
    this._curPan = 0;
    this._curDoppler = 1.0;
    this._curBrightness = 0.3;
    this._curAfterburner = 0.0;

    this._bindUnlock();
  }

  _bindUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (!this.enabled || this.muted) return;
      this.ensureStarted();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  ensureStarted() {
    if (this.started || typeof window === 'undefined') return this.started;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Create 4-second looping pink/brown-weighted jet exhaust noise buffer
      const sr = ctx.sampleRate;
      const len = sr * 4;
      const noiseBuf = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const data = noiseBuf.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.095;
          b6 = white * 0.115926;
          data[i] = Math.max(-1, Math.min(1, pink));
        }
      }

      // Layer 1: Primary twin-F414 jet exhaust broadband roar (LP + resonant BP for jet wash!)
      const roarSrc = ctx.createBufferSource();
      roarSrc.buffer = noiseBuf;
      roarSrc.loop = true;

      const roarLp = ctx.createBiquadFilter();
      roarLp.type = 'lowpass';
      roarLp.frequency.value = 520;
      roarLp.Q.value = 0.85;

      const roarBp = ctx.createBiquadFilter();
      roarBp.type = 'peaking';
      roarBp.frequency.value = 440;
      roarBp.Q.value = 1.3;
      roarBp.gain.value = 5.5;

      const roarGain = ctx.createGain();
      roarGain.gain.value = 0.0;

      roarSrc.connect(roarLp);
      roarLp.connect(roarBp);
      roarBp.connect(roarGain);

      // Layer 2: Deep afterburner sub-rumble (felt softly through 16th-floor window glass!)
      const subSrc = ctx.createBufferSource();
      subSrc.buffer = noiseBuf;
      subSrc.loop = true;
      subSrc.playbackRate.value = 0.65;

      const subLp = ctx.createBiquadFilter();
      subLp.type = 'lowpass';
      subLp.frequency.value = 135;
      subLp.Q.value = 1.6;

      const subGain = ctx.createGain();
      subGain.gain.value = 0.0;

      subSrc.connect(subLp);
      subLp.connect(subGain);

      // Layer 3: Subtle Doppler-shifted fighter-jet turbine compressor whine
      const whineOsc1 = ctx.createOscillator();
      whineOsc1.type = 'triangle';
      whineOsc1.frequency.value = 430;

      const whineOsc2 = ctx.createOscillator();
      whineOsc2.type = 'sine';
      whineOsc2.frequency.value = 865;

      const whineBp = ctx.createBiquadFilter();
      whineBp.type = 'bandpass';
      whineBp.frequency.value = 620;
      whineBp.Q.value = 2.4;

      const whineGain = ctx.createGain();
      whineGain.gain.value = 0.0;

      whineOsc1.connect(whineBp);
      whineOsc2.connect(whineBp);
      whineBp.connect(whineGain);

      // Stereo panner & master glass-attenuated output bus
      const panner = typeof ctx.createStereoPanner === 'function'
        ? ctx.createStereoPanner()
        : null;
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.0;

      if (panner) {
        roarGain.connect(panner);
        subGain.connect(panner);
        whineGain.connect(panner);
        panner.connect(masterGain);
      } else {
        roarGain.connect(masterGain);
        subGain.connect(masterGain);
        whineGain.connect(masterGain);
      }
      masterGain.connect(ctx.destination);

      roarSrc.start();
      subSrc.start();
      whineOsc1.start();
      whineOsc2.start();

      this._roarLp = roarLp;
      this._roarBp = roarBp;
      this._roarGain = roarGain;
      this._subGain = subGain;
      this._whineOsc1 = whineOsc1;
      this._whineOsc2 = whineOsc2;
      this._whineGain = whineGain;
      this._panner = panner;
      this._masterGain = masterGain;
      this.started = true;
      return true;
    } catch {
      return false;
    }
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    this.muted = !this.enabled;
    if (this.enabled) {
      this.ensureStarted();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } else if (this.ctx && this._masterGain) {
      this._masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.08);
    }
    return this.enabled;
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  update(metrics, dt) {
    if (!this.enabled || this.muted || !metrics) return;
    if (!this.started) {
      this.ensureStarted();
    }
    if (!this.ctx || this.ctx.state !== 'running' || !this._masterGain) return;

    const k = 1 - Math.exp(-Math.max(0.001, dt) * 6.0);
    this._curGain += (metrics.intensity - this._curGain) * k;
    this._curPan += (metrics.pan - this._curPan) * k;
    this._curDoppler += (metrics.doppler - this._curDoppler) * k;
    this._curBrightness += (metrics.brightness - this._curBrightness) * k;
    this._curAfterburner += (metrics.afterburner - this._curAfterburner) * k;

    const now = this.ctx.currentTime;
    const windowScale = metrics.windowProximity; // ~0.55 at desk, ~1.15 at Skyline View

    // Keep volume tasteful & realistic through closed office window glass (never drowns voice narration!)
    const masterLevel = Math.min(0.30, this._curGain * 0.24 * windowScale);
    this._masterGain.gain.setTargetAtTime(masterLevel, now, 0.06);

    // Broadband exhaust roar opens smoothly during close flybys
    const lpFreq = 260 + this._curBrightness * 920 * this._curDoppler;
    const bpFreq = 320 + this._curBrightness * 420 * this._curDoppler;
    this._roarLp.frequency.setTargetAtTime(Math.max(180, Math.min(2200, lpFreq)), now, 0.05);
    this._roarBp.frequency.setTargetAtTime(Math.max(200, Math.min(1400, bpFreq)), now, 0.05);
    this._roarGain.gain.setTargetAtTime(0.72 + this._curBrightness * 0.45, now, 0.06);

    // Afterburner low-frequency rumble surges on climbs & close passes
    this._subGain.gain.setTargetAtTime(0.45 + this._curAfterburner * 0.75, now, 0.08);

    // Subtle Doppler-shifted fighter turbine whine
    const baseWhine = 420 * this._curDoppler;
    this._whineOsc1.frequency.setTargetAtTime(Math.max(240, Math.min(820, baseWhine)), now, 0.05);
    this._whineOsc2.frequency.setTargetAtTime(Math.max(480, Math.min(1640, baseWhine * 2.02)), now, 0.05);
    this._whineGain.gain.setTargetAtTime(0.018 + this._curBrightness * 0.032, now, 0.06);

    if (this._panner) {
      this._panner.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, this._curPan)), now, 0.05);
    }
  }
}
