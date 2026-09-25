/**
 * Generates the in-app notification chime.
 *
 * Browsers ignore a custom `sound` on system notifications, so this asset is
 * played by the page itself when a push arrives while the app is open — the
 * one case where a branded tone is actually possible. System notifications
 * still use the OS default tone (see `silent: false` in public/sw.js).
 *
 * Run with:
 *   npx tsx scripts/generate-notification-sound.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "sounds");
const OUT_FILE = path.join(OUT_DIR, "notification.wav");

const SAMPLE_RATE = 22050;
/** Two rising bell notes — C6 then G6 — reads as "something arrived". */
const NOTES = [
  { freq: 1046.5, start: 0.0, dur: 0.34 },
  { freq: 1568.0, start: 0.1, dur: 0.5 },
];
const TOTAL_SECONDS = 0.72;
const PEAK = 0.28; // headroom: a chime, not an alarm

/** A soft bell: fundamental plus a quiet octave, with an exponential decay. */
function sample(time: number): number {
  let value = 0;
  for (const note of NOTES) {
    const t = time - note.start;
    if (t < 0 || t > note.dur) continue;
    const decay = Math.exp(-5.5 * (t / note.dur));
    // 4ms attack ramp avoids a click at note onset.
    const attack = Math.min(1, t / 0.004);
    value +=
      decay *
      attack *
      (Math.sin(2 * Math.PI * note.freq * t) +
        0.32 * Math.sin(2 * Math.PI * note.freq * 2 * t) +
        0.12 * Math.sin(2 * Math.PI * note.freq * 3 * t));
  }
  return value / NOTES.length;
}

function writeWav() {
  const frames = Math.floor(SAMPLE_RATE * TOTAL_SECONDS);
  const data = Buffer.alloc(frames * 2);

  for (let i = 0; i < frames; i += 1) {
    const t = i / SAMPLE_RATE;
    const value = Math.max(-1, Math.min(1, sample(t) * PEAK));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, Buffer.concat([header, data]));
  console.log(`Wrote ${OUT_FILE} (${(36 + data.length) / 1024 | 0} KB, ${TOTAL_SECONDS}s)`);
}

writeWav();
