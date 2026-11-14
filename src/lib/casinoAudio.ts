type CasinoCue = 'roulette' | 'coinflip' | 'dice' | 'win' | 'loss';

let audioContext: AudioContext | null = null;

function context() {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext) audioContext = new AudioContextConstructor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency = frequency) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.012, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.015);
}

export function playCasinoCue(cue: CasinoCue, volume = 0.35) {
  const ctx = context();
  const level = Math.max(0, Math.min(1, volume));
  if (!ctx || level === 0) return;
  const now = ctx.currentTime + 0.015;
  const v = level * 0.12;

  if (cue === 'roulette') {
    for (let i = 0; i < 22; i++) {
      const progress = i / 21;
      tone(ctx, 1500 - progress * 850, now + i * (0.045 + progress * 0.025), 0.035, v * (1 - progress * 0.45), 'square', 700 - progress * 260);
    }
    tone(ctx, 420, now + 1.45, 0.22, v * 0.8, 'triangle', 180);
    return;
  }
  if (cue === 'coinflip') {
    [1450, 980, 1320, 870, 1160, 760].forEach((frequency, index) => {
      tone(ctx, frequency, now + index * 0.12, 0.085, v * 0.85, 'triangle', frequency * 0.72);
    });
    return;
  }
  if (cue === 'dice') {
    [880, 620, 1040, 520].forEach((frequency, index) => {
      tone(ctx, frequency, now + index * 0.1, 0.075, v * 0.75, 'square', frequency * 0.55);
    });
    return;
  }
  if (cue === 'win') {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      tone(ctx, frequency, now + index * 0.105, 0.32, v, 'sine', frequency * 1.015);
    });
    return;
  }
  [392, 311, 233].forEach((frequency, index) => {
    tone(ctx, frequency, now + index * 0.14, 0.24, v * 0.75, 'triangle', frequency * 0.82);
  });
}

let ambienceGain: GainNode | null = null;
let ambienceNodes: OscillatorNode[] = [];
let ambienceStopTimer: number | null = null;

export function setCasinoAmbience(enabled: boolean, volume = 0.35) {
  if (!enabled && !ambienceGain) return;
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  const target = Math.max(0, Math.min(1, volume));
  if (ambienceStopTimer !== null) {
    window.clearTimeout(ambienceStopTimer);
    ambienceStopTimer = null;
  }
  if (enabled) {
    if (!ambienceGain) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      ambienceGain = ctx.createGain();
      ambienceGain.gain.value = 0.0001;
      filter.connect(ambienceGain);
      ambienceGain.connect(ctx.destination);
      [55,82.41,110,164.81].forEach((frequency,index) => {
        const oscillator = ctx.createOscillator();
        const voiceGain = ctx.createGain();
        oscillator.type = index===3 ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        voiceGain.gain.value = index===0 ? 0.42 : index===1 ? 0.22 : index===2 ? 0.16 : 0.08;
        oscillator.connect(voiceGain);
        voiceGain.connect(filter);
        oscillator.start();
        ambienceNodes.push(oscillator);
      });
    }
    ambienceGain.gain.cancelScheduledValues(now);
    ambienceGain.gain.setTargetAtTime(target * 0.035, now, 0.9);
  } else if (ambienceGain) {
    const oldGain = ambienceGain;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setTargetAtTime(0.0001, now, 0.35);
    ambienceStopTimer = window.setTimeout(() => {
      if (ambienceGain !== oldGain) return;
      ambienceNodes.forEach(node => { try { node.stop(); } catch { /* already stopped */ } });
      ambienceNodes = [];
      ambienceGain = null;
      ambienceStopTimer = null;
    }, 1400);
  }
}
