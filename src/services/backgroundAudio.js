/**
 * Background Audio Service
 *
 * Uses the HTML <audio> element (NOT Web Audio API) to keep audio alive
 * when the app is in the background on iOS. The <audio> element has
 * special privileges on iOS — it can continue playing when the screen
 * is locked or the app is backgrounded, unlike Web Audio API which
 * gets suspended.
 *
 * Strategy:
 * 1. On first user tap, start playing a silent audio loop via <audio>
 * 2. This keeps the audio session alive in the background
 * 3. When an alarm fires, swap the silent audio for a loud alarm WAV
 * 4. Use Media Session API to show alarm info on lock screen
 * 5. Media Session actions (pause/stop) = Snooze/Dismiss
 *
 * The alarm WAV files are generated programmatically using
 * OfflineAudioContext — no external audio files needed.
 */

// ============================================
// AUDIO ELEMENT SETUP
// ============================================

let audioElement = null;
let isKeepAliveRunning = false;
let isAlarmRinging = false;
let alarmCallback = null; // Called when user dismisses/snoozes via lock screen

// Generate a short silent WAV file as a data URL
function generateSilentWavDataUrl() {
  const sampleRate = 8000;
  const duration = 2; // 2 seconds of silence
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * 2; // 16-bit PCM
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  // All samples are 0 (silence) — ArrayBuffer is zero-initialized

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

// ============================================
// ALARM WAV GENERATION (via OfflineAudioContext)
// ============================================

// Pre-generated alarm blob URLs
const alarmBlobUrls = {};

/**
 * Generate an alarm sound as a WAV blob URL using OfflineAudioContext.
 * This renders the audio offline (not played), producing a WAV file
 * that can be used with the <audio> element for background playback.
 */
async function generateAlarmWav(type = 'default') {
  if (alarmBlobUrls[type]) return alarmBlobUrls[type];

  const sampleRate = 44100;
  const duration = 4; // 4-second pattern (will loop)
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  if (!OfflineCtx) {
    console.warn('[BackgroundAudio] OfflineAudioContext not available');
    return null;
  }

  const offline = new OfflineCtx(1, sampleRate * duration, sampleRate);

  // Build the alarm pattern based on type
  switch (type) {
    case 'gentle': {
      // Soft ascending chimes: C5, E5, G5 repeated
      const notes = [523, 659, 784, 523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = offline.createOscillator();
        const gain = offline.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = i * 0.5;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
        gain.gain.linearRampToValueAtTime(0, start + 0.4);
        osc.connect(gain);
        gain.connect(offline.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
      break;
    }
    case 'alarm': {
      // Two-tone siren: alternating 800Hz and 1000Hz
      for (let i = 0; i < 10; i++) {
        const osc = offline.createOscillator();
        const gain = offline.createGain();
        osc.type = 'square';
        osc.frequency.value = i % 2 === 0 ? 800 : 1000;
        const start = i * 0.35;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
        gain.gain.setValueAtTime(0.4, start + 0.28);
        gain.gain.linearRampToValueAtTime(0, start + 0.33);
        osc.connect(gain);
        gain.connect(offline.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      }
      break;
    }
    case 'urgent': {
      // Rapid high beeping
      for (let i = 0; i < 20; i++) {
        const osc = offline.createOscillator();
        const gain = offline.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 1200;
        const start = i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
        gain.gain.setValueAtTime(0.4, start + 0.08);
        gain.gain.linearRampToValueAtTime(0, start + 0.12);
        osc.connect(gain);
        gain.connect(offline.destination);
        osc.start(start);
        osc.stop(start + 0.15);
      }
      break;
    }
    default: {
      // Default: iPhone-style tri-tone repeated
      const tones = [
        { freq: 880, start: 0 },
        { freq: 1047, start: 0.25 },
        { freq: 880, start: 0.5 },
        { freq: 0, start: 0.75 }, // silence gap
        { freq: 880, start: 1.5 },
        { freq: 1047, start: 1.75 },
        { freq: 880, start: 2.0 },
        { freq: 0, start: 2.25 },
        { freq: 880, start: 3.0 },
        { freq: 1047, start: 3.25 },
        { freq: 880, start: 3.5 },
      ];
      tones.forEach(({ freq, start }) => {
        if (freq === 0) return;
        const osc = offline.createOscillator();
        const gain = offline.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.5, start + 0.02);
        gain.gain.setValueAtTime(0.5, start + 0.12);
        gain.gain.linearRampToValueAtTime(0, start + 0.2);
        osc.connect(gain);
        gain.connect(offline.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
      break;
    }
  }

  try {
    const renderedBuffer = await offline.startRendering();
    const blob = audioBufferToWavBlob(renderedBuffer);
    const url = URL.createObjectURL(blob);
    alarmBlobUrls[type] = url;
    console.log(`[BackgroundAudio] Generated ${type} alarm WAV`);
    return url;
  } catch (e) {
    console.error('[BackgroundAudio] Failed to generate alarm WAV:', e);
    return null;
  }
};

// ============================================
// WAV ENCODING
// ============================================

function audioBufferToWavBlob(audioBuffer) {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const dataSize = samples.length * 2; // 16-bit
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ============================================
// KEEPALIVE (silent background audio loop)
// ============================================

/**
 * Start the silent audio keepalive loop.
 * MUST be called from a user gesture (tap/click) on iOS.
 * This keeps the audio session alive when the app is backgrounded.
 */
export async function startKeepAlive() {
  if (isKeepAliveRunning) return;

  try {
    // Create audio element if needed
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.id = 'background-audio-keepalive';
      audioElement.loop = true;
      audioElement.volume = 0.01; // Nearly silent for keepalive
      // Prevent iOS from pausing on route change
      audioElement.setAttribute('playsinline', '');
      audioElement.setAttribute('webkit-playsinline', '');
    }

    // Set to silent WAV
    const silentUrl = generateSilentWavDataUrl();
    audioElement.src = silentUrl;
    audioElement.volume = 0.01;

    await audioElement.play();
    isKeepAliveRunning = true;
    console.log('[BackgroundAudio] Keepalive started — audio session active');

    // Pre-generate alarm WAVs in background
    ['default', 'gentle', 'alarm', 'urgent'].forEach(type => {
      generateAlarmWav(type).catch(() => {});
    });

    // Set up Media Session (lock screen controls)
    setupMediaSession();

  } catch (e) {
    console.warn('[BackgroundAudio] Keepalive start failed:', e);
    // On some browsers, autoplay is blocked — we'll retry on next interaction
    isKeepAliveRunning = false;
  }
}

// ============================================
// ALARM PLAYBACK (via <audio> element)
// ============================================

/**
 * Start playing an alarm sound via the <audio> element.
 * This can persist in the background on iOS because it uses
 * the HTML audio element (not Web Audio API).
 *
 * @param {'default'|'gentle'|'alarm'|'urgent'} type - Alarm sound type
 * @param {number} volume - Volume 0-100
 * @param {Function} onAction - Callback when user acts via lock screen (snooze/dismiss)
 */
export async function startAlarm(type = 'default', volume = 70, onAction = null) {
  alarmCallback = onAction;

  // Generate alarm WAV if not cached
  const alarmUrl = await generateAlarmWav(type);
  if (!alarmUrl) {
    console.warn('[BackgroundAudio] No alarm URL — falling back to Web Audio');
    return false;
  }

  // Create audio element if needed
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.setAttribute('playsinline', '');
    audioElement.setAttribute('webkit-playsinline', '');
  }

  // Switch from silent keepalive to alarm sound
  audioElement.src = alarmUrl;
  audioElement.loop = true;
  audioElement.volume = Math.min(1, volume / 100);

  try {
    await audioElement.play();
    isAlarmRinging = true;
    console.log(`[BackgroundAudio] Alarm ringing: ${type} at volume ${volume}`);

    // Update lock screen to show alarm info
    updateMediaSessionForAlarm(type);

    return true;
  } catch (e) {
    console.warn('[BackgroundAudio] Alarm play failed:', e);
    return false;
  }
}

/**
 * Stop the alarm and return to silent keepalive
 */
export function stopAlarmAudio() {
  if (!audioElement) return;

  isAlarmRinging = false;
  alarmCallback = null;

  // Switch back to silent keepalive
  const silentUrl = generateSilentWavDataUrl();
  audioElement.src = silentUrl;
  audioElement.loop = true;
  audioElement.volume = 0.01;
  audioElement.play().catch(() => {});

  // Reset media session
  setupMediaSession();

  console.log('[BackgroundAudio] Alarm stopped, keepalive resumed');
}

/**
 * Check if alarm is currently ringing
 */
export function isAlarmActive() {
  return isAlarmRinging;
}

/**
 * Check if keepalive is running
 */
export function isKeepAliveActive() {
  return isKeepAliveRunning;
}

// ============================================
// MEDIA SESSION API (lock screen controls)
// ============================================

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Goal Planner',
    artist: 'Background Active',
    album: 'Notifications Enabled',
  });

  // Clear actions for keepalive mode
  try {
    navigator.mediaSession.setActionHandler('play', () => {
      if (audioElement) audioElement.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      // Don't actually pause — keep the session alive
      // Instead, if alarm is ringing, treat as snooze
      if (isAlarmRinging && alarmCallback) {
        alarmCallback('snooze');
        stopAlarmAudio();
      }
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      if (isAlarmRinging && alarmCallback) {
        alarmCallback('dismiss');
        stopAlarmAudio();
      }
    });
    // Previous/next = snooze/dismiss shortcuts
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (isAlarmRinging && alarmCallback) {
        alarmCallback('snooze');
        stopAlarmAudio();
      }
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (isAlarmRinging && alarmCallback) {
        alarmCallback('dismiss');
        stopAlarmAudio();
      }
    });
  } catch (e) {
    // Some handlers may not be supported
  }
}

function updateMediaSessionForAlarm(type) {
  if (!('mediaSession' in navigator)) return;

  const typeNames = {
    default: 'Alarm',
    gentle: 'Gentle Reminder',
    alarm: 'Alarm Clock',
    urgent: 'URGENT Alert',
  };

  navigator.mediaSession.metadata = new MediaMetadata({
    title: typeNames[type] || 'Alarm',
    artist: 'Goal Planner',
    album: 'Tap to Snooze / Dismiss',
  });

  navigator.mediaSession.playbackState = 'playing';
}

// ============================================
// EXPORTS
// ============================================

export default {
  startKeepAlive,
  startAlarm,
  stopAlarmAudio,
  isAlarmActive,
  isKeepAliveActive,
};
