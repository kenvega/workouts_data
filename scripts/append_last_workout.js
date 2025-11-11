import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
// https://api.hevyapp.com/docs/#/Workouts/get_v1_workouts

const apiKey = process.env.HEVY_API_KEY;
if (!apiKey) {
  console.error('Missing HEVY_API_KEY in .env');
  process.exit(1);
}

const endpoint = 'https://api.hevyapp.com/v1/workouts?page=1&pageSize=1';
const outDir = path.join(process.cwd(), '.metrics');
const outFile = path.join(outDir, 'workouts_data.txt');

const TZ = 'America/Lima';
const LOCALE = 'en-US';
const dtf = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatLocal(input) {
  const d = input instanceof Date ? input : new Date(input);
  const parts = Object.fromEntries(dtf.formatToParts(d).map(p => [p.type, p.value]));
  const { year, month, day, hour, minute, weekday } = parts;
  return `${year}-${month}-${day} at ${hour}:${minute} - ${weekday}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function fmtWeightKg(n) {
  return Number.isFinite(n) ? `${Number(n).toFixed(2)} kg` : '';
}

function formatWorkout(w) {
  const lines = [];
  lines.push('---'); // separator between appended entries
  lines.push(`title: ${w.title ?? ''}`);
  lines.push(`logged_at: ${formatLocal(new Date())}`);
  lines.push(`start_time: ${formatLocal(w.start_time)}`);
  lines.push(`end_time: ${formatLocal(w.end_time)}`);
  // compute duration from ISO strings; timezone doesn’t matter for the diff
  const durationSec = (new Date(w.end_time) - new Date(w.start_time)) / 1000;
  if (Number.isFinite(durationSec) && durationSec >= 0) {
    lines.push(`duration: ${formatDurationHMS(durationSec)}`);
  }
  lines.push('exercises:');

  for (const ex of w.exercises ?? []) {
    lines.push(`  - name: ${ex.title ?? ''}`);
    if (ex.notes) lines.push(`    notes: ${ex.notes}`);
    lines.push('    sets:');

    for (const set of ex.sets ?? []) {
      const parts = [];

      // weights/reps/RPE (if present)
      if (set.weight_kg != null || set.reps != null) {
        const wr = [
          fmtWeightKg(set.weight_kg),
          Number.isFinite(set.reps) ? `${set.reps} reps` : '',
        ].filter(Boolean).join(' x ');
        if (wr) parts.push(wr);
        if (Number.isFinite(set.rpe)) parts.push(`RPE ${set.rpe}`);
      }

      // distance/duration (if present)
      if (Number.isFinite(set.distance_meters)) parts.push(`${set.distance_meters} m`);
      if (Number.isFinite(set.duration_seconds)) parts.push(formatDuration(set.duration_seconds));

      lines.push(`      - ${parts.length ? parts.join(' | ') : '—'}`);
    }
  }

  lines.push(''); // trailing newline after block
  return lines.join('\n');
}

function formatDurationHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

(async () => {
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ''}`);
    }

    const data = await res.json();
    const workouts = Array.isArray(data.workouts) ? data.workouts : [];
    if (!workouts.length) throw new Error(`No workouts found in response.`);

    const workout = workouts[0]; // endpoint returns 1 workout
    const block = formatWorkout(workout);

    await fs.mkdir(outDir, { recursive: true });
    await fs.appendFile(outFile, block, 'utf8');

    console.log(`Appended workout "${workout.title}" to ${outFile}`);
  } catch (err) {
    console.error('Error appending workout data:', err);
    process.exit(1);
  }
})();
