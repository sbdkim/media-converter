import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createInMemoryJobStore } from '../src/store/inMemoryJobStore.js';

test('POST /api/jobs accepts a valid allowed media URL', async () => {
  const store = createInMemoryJobStore();
  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: ['media.example.com'],
      maxSourceSizeMb: 250,
    },
    jobStore: store,
    inspector: {
      async inspect() {
        return { contentType: 'video/mp4', contentLength: 1024 };
      },
    },
    queue: {
      async enqueue() {
        return { taskId: 'task_1' };
      },
    },
    now: () => '2026-03-09T00:00:00.000Z',
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

test('POST /api/jobs rejects blocked hosts', async () => {
  const app = await createApp({
    config: {
      frontendOrigin: '*',
      allowedSourceDomains: [],
      maxSourceSizeMb: 250,
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/jobs',
    payload: {
      sourceUrl: 'https://youtube.com/watch?v=abc',
      outputFormat: 'mp3',
      qualityPreset: 'mp3-128k',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().errorCode, 'BLOCKED_HOST');
  await app.close();
});

test('GET /api/jobs/:jobId returns stored job state', async () => {
  const store = createInMemoryJobStore();
  await store.create({
    jobId: 'job_123',
    status: 'completed',
    progress: 100,
    outputFormat: 'mp3',
    qualityPreset: 'mp3-320k',
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
  assert.equal(response.json().downloadUrl, 'https://signed.example.com/file.mp3');
  await app.close();
});

