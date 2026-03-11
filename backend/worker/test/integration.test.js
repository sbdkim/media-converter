import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { processJob } from '../src/processor.js';

const execFileAsync = promisify(execFile);

async function hasFfmpeg() {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

test('optional ffmpeg integration: converts generated audio to mp3', { skip: !(await hasFfmpeg()) }, async () => {
  const downloads = [];

  const result = await processJob(
    {
      jobId: 'job_integration',
      sourceUrl: 'synthetic://audio',
      qualityPreset: 'mp3-128k',
      },
    {
      downloader: {
        async download(jobInput, destinationPath) {
          assert.equal(jobInput.jobId, 'job_integration');
          await execFileAsync('ffmpeg', [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'sine=frequency=1000:duration=1',
            destinationPath,
          ]);
          downloads.push(destinationPath);
        },
      },
      storage: {
        async upload() {
          return;
        },
      },
      signer: {
        async sign() {
          return 'https://signed.example.com/integration.mp3';
        },
      },
      runCommand: async (command, args) => {
        await execFileAsync(command, args);
      },
    },
  );

  assert.equal(downloads.length, 1);
  assert.equal(result.status, 'completed');
});
