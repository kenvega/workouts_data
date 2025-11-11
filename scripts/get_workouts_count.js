import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
// https://api.hevyapp.com/docs/#/Workouts/get_v1_workouts_count

const apiKey = process.env.HEVY_API_KEY;
if (!apiKey) {
  console.error('Missing HEVY_API_KEY in .env');
  process.exit(1);
}

const endpoint = 'https://api.hevyapp.com/v1/workouts/count';
const outDir = path.join(process.cwd(), '.metrics');
const outFile = path.join(outDir, 'workouts_count.txt');

(async () => {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} ${response.statusText} ${body ? `- ${body}` : ''}`);
    }

    const data = await response.json();
    const count = Number(data.workout_count);

    if (!Number.isFinite(count)) {
      throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
    }

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outFile, `${count}`, 'utf8');

    console.log(`Saved workout_count=${count} to ${outFile}`);
  } catch (error) {
    console.error('Error fetching workouts count:', error);
    process.exit(1);
  }
})();

// fetch(endpoint, {
//   method: 'GET',
//   headers: {
//     accept: 'application/json',
//     'api-key': apiKey,
//   },
// })
//   .then((response) => response.json())
//   .then((data) => {
//     console.log(data);
//     console.log(data.workout_count);
//   })
//   .catch((error) => {
//     console.error('Error fetching workouts count:', error);
//   });