const TERMINAL_STATES = new Set(['completed', 'failed', 'expired']);

export function getStatusLabel(status) {
  switch (status) {
    case 'queued':
      return 'Queued for conversion';
    case 'validating':
      return 'Validating source';
    case 'processing':
      return 'Processing media';
    case 'completed':
      return 'Ready to download';
    case 'failed':
      return 'Conversion failed';
    case 'expired':
      return 'Download expired';
    default:
      return 'Waiting for job status';
  }
}

export function shouldContinuePolling(status) {
  return !TERMINAL_STATES.has(status);
}

export function normalizeJobResponse(job) {
  return {
    jobId: job.jobId,
    status: job.status,
    progress: Number.isFinite(job.progress) ? job.progress : 0,
    outputFormat: job.outputFormat,
    qualityPreset: job.qualityPreset,
    downloadUrl: job.downloadUrl || '',
    errorCode: job.errorCode || '',
    errorMessage: job.errorMessage || '',
  };
}

