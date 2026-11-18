/**
 * DrowsiGuard — Trained Voice & Acoustic Alert Engine
 * ====================================================
 * High-urgency acoustic alert system combining:
 * 1. Dual-tone resonant warning chirp (880Hz -> 1200Hz) via Web Audio API
 * 2. Natural female warning voice ("Warning! Be alert!") via Web Speech API
 */

export function getTrainedFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Priority list of clear, articulate English female voices across Chrome, Edge, Safari, iOS & Android
  const preferredFemaleSignatures = [
    "Google US English",
    "Microsoft Zira",
    "Microsoft Jenny",
    "Microsoft Aria",
    "Samantha",
    "Victoria",
    "Karen",
    "Moira",
    "Tessa",
    "Fiona",
    "en-US-Neural2-F",
    "en-US-Standard-C",
    "en-US-Standard-E",
  ];

  for (const sig of preferredFemaleSignatures) {
    const match = voices.find(
      (v) => v.name.toLowerCase().includes(sig.toLowerCase()) && v.lang.startsWith("en")
    );
    if (match) return match;
  }

  // Fallback: search for any voice with "female" in its name or metadata
  const femaleVoice = voices.find(
    (v) =>
      (v.name.toLowerCase().includes("female") || (v as any).gender === "female") &&
      v.lang.startsWith("en")
  );
  if (femaleVoice) return femaleVoice;

  // Fallback: any standard US/UK English voice
  const englishVoice = voices.find((v) => v.lang.startsWith("en"));
  return englishVoice || voices[0] || null;
}

/**
 * Play a piercing, rapid dual-tone acoustic chime
 */
export function playAlertChime(audioCtx: AudioContext, volume: number = 0.8) {
  if (volume <= 0) return;
  try {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 alert tone
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.08); // High chirp burst
    osc.frequency.setValueAtTime(960, audioCtx.currentTime + 0.16);

    const targetGain = Math.max(0.005, Math.min(0.4, volume * 0.35));
    gain.gain.setValueAtTime(targetGain, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.28);
  } catch {
    // Autoplay policy fallback
  }
}

/**
 * Speak "Warning! Be alert!" using trained female voice parameters
 */
export function speakAlertVoice(
  text: string = "Warning! Be alert!",
  volume: number = 0.8,
  onEnd?: () => void
): boolean {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    volume <= 0
  ) {
    if (onEnd) onEnd();
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    const femaleVoice = getTrainedFemaleVoice();
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    // Trained acoustic voice profile for maximum clarity & urgency:
    utterance.pitch = 1.18; // Elevated alert pitch, clear & resonant
    utterance.rate = 1.05;  // Authoritative, articulate cadence
    utterance.volume = Math.max(0.05, Math.min(1.0, volume)); // Dynamic volume scaling
    utterance.lang = "en-US";

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (e) {
    console.warn("Speech synthesis unavailable:", e);
    if (onEnd) onEnd();
    return false;
  }
}

/**
 * Cancel and mute all active and queued speech alerts
 */
export function stopAlertVoice() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
