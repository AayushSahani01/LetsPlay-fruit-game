let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  return ctx;
}

export async function unlockAudio(): Promise<void> {
  const audio = getCtx();
  if (audio && audio.state === "suspended") await audio.resume();
}

function tone(freq: number, duration: number, type: OscillatorType, gain = 0.06, enabled = true): void {
  if (!enabled) return;
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export function sfxSwap(on: boolean): void {
  tone(420, 0.08, "triangle", 0.04, on);
}

export function sfxMatch(combo: number, on: boolean): void {
  tone(520 + combo * 80, 0.12, "sine", 0.07, on);
}

export function sfxInvalid(on: boolean): void {
  tone(180, 0.12, "sawtooth", 0.03, on);
}

export function sfxWin(on: boolean): void {
  tone(523, 0.12, "sine", 0.06, on);
  setTimeout(() => tone(659, 0.12, "sine", 0.06, on), 90);
  setTimeout(() => tone(784, 0.22, "sine", 0.07, on), 180);
}

export function sfxLose(on: boolean): void {
  tone(300, 0.16, "triangle", 0.05, on);
  setTimeout(() => tone(220, 0.22, "triangle", 0.05, on), 140);
}
