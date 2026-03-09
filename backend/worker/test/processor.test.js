import test from 'node:test';
import assert from 'node:assert/strict';
import { processJob } from '../src/processor.js';

test('processJob returns completed result when dependencies succeed', async () => {
  const uploaded = [];
  const result = await processJob(
    {
      jobId: 'job_123',
      sourceUrl: 'https://media.example.com/demo.mp4',
      qualityPreset: 'mp3-128k',
    },
    {
      downloader: {
        async download() {
          return;
        },
      },
      storage: {
        async upload(_, storagePath) {
          uploaded.push(storagePath);
        },
      },
      signer: {
        async sign(storagePath) {
          return `https://signed.example.com/${storagePath}`;
        },
      },
      runCommand: async () => {},
      clock: () => new Date('2026-03-09T00:00:00.000Z'),
      ttlMinutes: 30,
    },
  );

  assert.equal(result.status, 'completed');
  assert.equal(uploaded[0], 'outputs/job_123/result.mp3');
});

test('processJob returns failed result when ffmpeg errors', async () => {
  const result = await processJob(
    {
      jobId: 'job_999',
      sourceUrl: 'https://media.example.com/demo.mp4',
      qualityPreset: 'mp4-720p',
    },
    {
      downloader: {
        async download() {
          return;
        },
      },
      storage: {
        async upload() {
          return;
        },
      },
      signer: {
        async sign() {
          return '';
        },
      },
      runCommand: async () => {
        throw new Error('ffmpeg failed');
      },
    },
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'PROCESSING_FAILED');
});

