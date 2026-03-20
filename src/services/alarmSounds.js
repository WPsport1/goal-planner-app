/**
 * Alarm Sound Synthesizer
 *
 * Generates alarm/notification sounds using Web Audio API.
 * No .mp3 files needed — all sounds are synthesized in real-time.
 * Works on iOS Safari when audio context is unlocked via user gesture.
 */

let audioContext = null;
let isAudioUnlocked = false;

// Get or create the shared AudioContext
function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (iOS requires this after user gesture)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Unlock audio on iOS — must be called from a user gesture (tap/click).
 * Plays a silent buffer to enable future programmatic audio playback.
 */
export function unlockAudio() {
  if (isAudioUnlocked) return;

  try {
    const ctx = getAudioContext();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    isAudioUnlocked = true;
    console.log('[AlarmSounds] Audio unlocked for iOS');
  } catch (e) {
    console.warn('[AlarmSounds] Audio unlock failed:', e);
  }
}

export function isUnlocked() {
  return isAudioUnlocked;
}

// Stop handle for currently playing alarm
let currentAlarm = null;

/**
 * Stop the currently playing alarm sound
 */
export function stopAlarm() {
  if (currentAlarm) {
    currentAlarm.stop();
    currentAlarm = null;
  }
}

/**
 * Play a synthesized alarm sound pattern
 * @param {'default'|'gentle'|'alarm'|'urgent'} type - Sound type
 * @param {number} volume - Volume 0-100
 * @param {boolean} loop - Whether to repeat the pattern
 * @returns {{ stop: Function }} - Handle to stop playback
 */
export function playAlarm(type = 'default', volume = 70, loop = false) {
  stopAlarm(); // Stop any existing alarm

  const ctx = getAudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = volume / 100;
  masterGain.connect(ctx.destination);

  let stopped = false;
  let timeoutIds = [];

  const handle = {
    stop() {
      stopped = true;
      timeoutIds.forEach(clearTimeout);
      timeoutIds = [];
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.disconnect();
    }
  };

  currentAlarm = handle;

  const patterns = {
    default: () => playDefaultPattern(ctx, masterGain, () => stopped),
    gentle: () => playGentlePattern(ctx, masterGain, () => stopped),
    alarm: () => playAlarmPattern(ctx, masterGain, () => stopped),
    urgent: () => playUrgentPattern(ctx, masterGain, () => stopped),
  };

  const playPattern = patterns[type] || patterns.default;

  function runPattern() {
    if (stopped) return;
    const duration = playPattern();
    if (loop && !stopped) {
      const id = setTimeout(runPattern, duration + 500);
      timeoutIds.push(id);
    }
  }

  runPattern();
  return handle;
}

// --- Sound Patterns ---

/** Default: Two pleasant chime tones (like iPhone "Tri-tone") */
function playDefaultPattern(ctx, destination, isStopped) {
  const now = ctx.currentTime;
  const notes = [880, 1047, 880]; // A5, C6, A5
  const noteLen = 0.15;
  const gap = 0.1;

  notes.forEach((freq, i) => {
    if (isStopped()) return;
    const start = now + i * (noteLen + gap);
    playTone(ctx, destination, freq, 'sine', start, noteLen, 0.6);
  });

  return (notes.length * (noteLen + gap)) * 1000;
}

/** Gentle: Soft ascending chime (like a meditation bell) */
function playGentlePattern(ctx, destination, isStopped) {
  const now = ctx.currentTime;
  const notes = [523, 659, 784]; // C5, E5, G5
  const noteLen = 0.3;
  const gap = 0.15;

  notes.forEach((freq, i) => {
    if (isStopped()) return;
    const start = now + i * (noteLen + gap);
    playTone(ctx, destination, freq, 'sine', start, noteLen, 0.4);
  });

  return (notes.length * (noteLen + gap)) * 1000;
}

/** Alarm: Alternating two-tone siren (classic alarm clock) */
function playAlarmPattern(ctx, destination, isStopped) {
  const now = ctx.currentTime;
  const cycles = 4;
  const noteLen = 0.2;

  for (let i = 0; i < cycles * 2; i++) {
    if (isStopped()) return 0;
    const freq = i % 2 === 0 ? 800 : 1000;
    const start = now + i * noteLen;
    playTone(ctx, destination, freq, 'square', start, noteLen * 0.9, 0.5);
  }

  return cycles * 2 * noteLen * 1000;
}

/** Urgent: Rapid high-pitched beeping (emergency-like) */
function playUrgentPattern(ctx, destination, isStopped) {
  const now = ctx.currentTime;
  const beeps = 6;
  const beepLen = 0.1;
  const gap = 0.08;

  for (let i = 0; i < beeps; i++) {
    if (isStopped()) return 0;
    const start = now + i * (beepLen + gap);
    playTone(ctx, destination, 1200, 'sawtooth', start, beepLen, 0.5);
  }

  return beeps * (beepLen + gap) * 1000;
}

/** Helper: Play a single tone */
function playTone(ctx, destination, frequency, waveType, startTime, duration, gain) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = waveType;
  osc.frequency.value = frequency;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export default { unlockAudio, isUnlocked, playAlarm, stopAlarm };
