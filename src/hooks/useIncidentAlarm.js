import { useEffect, useRef } from 'react';

const ALARM_WINDOW_MS = 90_000; // only sound for incidents <90s old

// Two-tone attention chirp, ~1.2s. Web Audio only — no asset files needed.
const playAlarm = (ctx) => {
  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.connect(gain);
  [0, 0.4, 0.8].forEach((offset, i) => {
    osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t0 + offset);
    gain.gain.setValueAtTime(0.18, t0 + offset);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + offset + 0.35);
  });
  osc.start(t0);
  osc.stop(t0 + 1.2);
};

// Sounds an alarm when a NEW incident appears in `reports`. `enabled` gates
// by role — residents must not hear other people's emergencies.
// AudioContext requires a user gesture, so the first pointer/key press
// unlocks it; nothing plays before that (browser policy, not a bug).
const useIncidentAlarm = (reports, enabled = true) => {
  const ctxRef = useRef(null);
  const knownRef = useRef(null);

  // Gesture-unlock for the AudioContext (autoplay policy).
  useEffect(() => {
    if (!enabled) return undefined;
    const unlock = () => {
      if (!ctxRef.current) {
        try { ctxRef.current = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { ctxRef.current = null; }
      }
      ctxRef.current?.resume?.();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [enabled]);

  // Diff incoming reports — any new id younger than the window = alarm.
  useEffect(() => {
    if (!enabled) { knownRef.current = null; return; }
    const ids = new Set((reports || []).map(r => r.id));
    if (knownRef.current === null) { knownRef.current = ids; return; } // seed on first load

    const fresh = (reports || []).filter(r =>
      !knownRef.current.has(r.id)
      && Date.now() - new Date(r.created_at || 0).getTime() < ALARM_WINDOW_MS
    );
    knownRef.current = ids;

    if (fresh.length && ctxRef.current?.state === 'running') {
      try { playAlarm(ctxRef.current); } catch { /* audio failure is non-fatal */ }
    }
  }, [reports, enabled]);
};

export default useIncidentAlarm;
