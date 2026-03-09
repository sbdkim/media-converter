import { describe, expect, it } from 'vitest';
import { getStatusLabel, normalizeJobResponse, shouldContinuePolling } from './jobState.js';

describe('jobState', () => {
  it('knows which states should continue polling', () => {
    expect(shouldContinuePolling('queued')).toBe(true);
    expect(shouldContinuePolling('completed')).toBe(false);
    expect(shouldContinuePolling('failed')).toBe(false);
  });

  it('normalizes missing job fields', () => {
    expect(normalizeJobResponse({ jobId: 'a', status: 'processing' })).toEqual({
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

  it('returns friendly labels', () => {
    expect(getStatusLabel('expired')).toBe('Download expired');
  });
});

