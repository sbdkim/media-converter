import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createInMemoryJobStore } from '../src/store/inMemoryJobStore.js';

function createResolvedFixture(overrides = {}) {
  return {
    sourceType: 'resolved-page',
    platform: 'youtube',
    canonicalUrl: 'https://youtube.com/watch?v=abc',
    title: 'Example title',
    thumbnailUrl: 'https://img.example.com/thumb.jpg',
    durationSeconds: 123,
    audioOnlySupported: true,
    videoSupported: true,
    availableOutputs: [
      {
        id: 'audio-mp3',
        outputFormat: 'mp3',
        qualityPreset: 'mp3-128k',
        label: 'Audio MP3',
        description: 'Balanced audio export.',
        extractorFormat: 'bestaudio/best',
      },
      {
        id: 'video-mp4',
        outputFormat: 'mp4',
        qualityPreset: 'mp4-720p',
        label: 'Video MP4',
        description: 'Standard MP4 output.',
        extractorFormat: 'bestvideo+bestaudio/best',
      },
    ],
    defaultOutput: {
      id: 'video-mp4',
      outputFormat: 'mp4',
      qualityPreset: 'mp4-720p',
      label: 'Video MP4',
      description: 'Standard MP4 output.',
      extractorFormat: 'bestvideo+bestaudio/best',
    },
    sourceRef: {
      platform: 'youtube',
      extractorUrl: 'https://youtube.com/watch?v=abc',
      mediaKind: 'video',
    },
    ...overrides,
  };
}

test('POST /api/resolve returns metadata and output choices for page URLs', async () => {
  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: [],
      maxSourceSizeMb: 250,
    },
    sourceResolver: {
      async resolve() {
        return createResolvedFixture();
      },
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/resolve',
    payload: {
      sourceUrl: 'https://youtube.com/watch?v=abc',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().platform, 'youtube');
  assert.equal(response.json().availableOutputs.length, 2);
  assert.match(response.json().resolveToken, /^resolve_/);
  await app.close();
});

test('POST /api/resolve rejects unsupported platforms', async () => {
  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: [],
      maxSourceSizeMb: 250,
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/resolve',
    payload: {
      sourceUrl: 'https://facebook.com/video.php?v=1',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().errorCode, 'UNSUPPORTED_PLATFORM');
  await app.close();
});

test('POST /api/jobs accepts a resolved token', async () => {
  const store = createInMemoryJobStore();
  const jobRunnerCalls = [];
  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: [],
      maxSourceSizeMb: 250,
    },
    jobStore: store,
    sourceResolver: {
      async resolve() {
        return createResolvedFixture();
      },
    },
    jobRunner: {
      async start(job) {
        jobRunnerCalls.push(job);
        return { taskId: 'inline_1' };
      },
    },
    now: () => '2026-03-11T00:00:00.000Z',
  });

  const resolveResponse = await app.inject({
    method: 'POST',
    url: '/api/resolve',
    payload: { sourceUrl: 'https://youtube.com/watch?v=abc' },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/jobs',
    payload: {
      resolveToken: resolveResponse.json().resolveToken,
      outputFormat: 'mp4',
      qualityPreset: 'mp4-720p',
    },
  });

  assert.equal(response.statusCode, 202);
  assert.equal(jobRunnerCalls[0].sourceType, 'resolved-page');
  assert.equal(jobRunnerCalls[0].platform, 'youtube');
  assert.equal(jobRunnerCalls[0].selectedOutput.outputFormat, 'mp4');
  await app.close();
});

test('POST /api/jobs still accepts direct media URLs as a fallback path', async () => {
  const store = createInMemoryJobStore();
  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: ['media.example.com'],
      maxSourceSizeMb: 250,
    },
    jobStore: store,
    inspector: {
      async inspect(url) {
        return { contentType: 'video/mp4', contentLength: 1024, finalUrl: url };
      },
    },
    jobRunner: {
      async start() {
        return { taskId: 'inline_direct' };
      },
    },
    now: () => '2026-03-11T00:00:00.000Z',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/jobs',
    payload: {
      sourceUrl: 'https://media.example.com/demo.mp4',
      outputFormat: 'mp3',
      qualityPreset: 'mp3-128k',
    },
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().status, 'queued');
  await app.close();
});

test('GET /api/jobs/:jobId returns enriched job state', async () => {
  const store = createInMemoryJobStore();
  await store.create({
    jobId: 'job_123',
    status: 'completed',
    progress: 100,
    platform: 'youtube',
    sourceType: 'resolved-page',
    title: 'Example title',
    thumbnailUrl: 'https://img.example.com/thumb.jpg',
    selectedOutput: {
      id: 'audio-mp3',
      outputFormat: 'mp3',
      qualityPreset: 'mp3-128k',
    },
    outputFormat: 'mp3',
    qualityPreset: 'mp3-128k',
    downloadUrl: 'https://signed.example.com/file.mp3',
    errorCode: '',
    errorMessage: '',
  });

  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: [],
      maxSourceSizeMb: 250,
    },
    jobStore: store,
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/jobs/job_123',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().platform, 'youtube');
  assert.equal(response.json().selectedOutput.outputFormat, 'mp3');
  await app.close();
});
