import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatusLabel, normalizeJobResponse, shouldContinuePolling } from './jobState.js';

test('jobState knows which states should continue polling', () => {
  assert.equal(shouldContinuePolling('queued'), true);
  assert.equal(shouldContinuePolling('completed'), false);
  assert.equal(shouldContinuePolling('failed'), false);
});

test('jobState normalizes missing job fields', () => {
  assert.deepEqual(normalizeJobResponse({ jobId: 'a', status: 'processing' }), {
    jobId: 'a',
    status: 'processing',
    progress: 0,
    outputFormat: undefined,
    qualityPreset: undefined,
    downloadUrl: '',
    errorCode: '',
    errorMessage: '',
  });
});

test('jobState returns friendly labels', () => {
  assert.equal(getStatusLabel('expired'), 'Download expired');
});
