import { createJob, fetchJob, getApiBaseUrl, isApiConfigured } from './lib/api.js';
import { getStatusLabel, normalizeJobResponse, shouldContinuePolling } from './lib/jobState.js';
import { getPresetOptions, validateSourceUrl } from './lib/validation.js';

const PRESET_DETAILS = {
  'mp3-128k': 'Balanced audio preset for quick voice or reference exports.',
  'mp3-320k': 'Higher bitrate audio preset for final listening copies.',
  'mp4-360p': 'Smaller video preset for review and low-bandwidth sharing.',
  'mp4-720p': 'Sharper video preset for standard playback and review.',
};

const STATUS_DETAILS = {
  queued: 'Request accepted. The backend has not started processing yet.',
  validating: 'Checking the source URL and preset before conversion begins.',
  processing: 'Conversion is running. Keep this tab open if you want live updates.',
  completed: 'Output is ready. Use the download action below.',
  failed: 'The job stopped before completion. Review the error and submit again.',
  expired: 'The download window closed. Submit a new conversion if you still need the file.',
  idle: 'Submit a direct media URL to create a new conversion job.',
};

function renderApp() {
  return `
    <div class="app-shell">
      <header class="utility-bar">
        <div>
          <p class="product-name">Media Converter</p>
          <p class="product-meta">Authorized direct media only</p>
        </div>
        <div class="utility-status">
          <span id="backendBadge" class="backend-badge">Checking backend</span>
          <p id="deployMessage" class="deploy-message" aria-live="polite"></p>
        </div>
      </header>

      <main class="workspace">
        <section class="panel panel-main">
          <div class="panel-heading">
            <div>
              <h1>Create conversion job</h1>
              <p class="panel-copy">Paste a direct file URL, choose the output, and submit.</p>
            </div>
            <button id="resetButton" class="secondary-button" type="button">New job</button>
          </div>

          <form id="jobForm" class="job-form">
            <label class="field" for="sourceUrl">
              <span>Source URL</span>
              <input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://media.example.com/video.mp4" autocomplete="off" required />
              <span id="urlHint" class="field-hint" aria-live="polite">Direct .mp4, .mov, .mp3, .wav, .m4a, .aac, .ogg, or .webm file URL.</span>
            </label>

            <div class="field-row">
              <label class="field" for="outputFormat">
                <span>Output</span>
                <select id="outputFormat" name="outputFormat">
                  <option value="mp3">MP3</option>
                  <option value="mp4">MP4</option>
                </select>
              </label>

              <label class="field" for="qualityPreset">
                <span>Preset</span>
                <select id="qualityPreset" name="qualityPreset"></select>
                <span id="presetHint" class="field-hint"></span>
              </label>
            </div>

            <div class="form-actions">
              <button id="submitButton" class="primary-button" type="submit">Start conversion</button>
              <p id="statusMessage" class="status-message" aria-live="polite"></p>
            </div>

            <p id="errorMessage" class="error-message" aria-live="assertive"></p>
          </form>
        </section>

        <section class="panel panel-status">
          <div class="panel-heading panel-heading-compact">
            <div>
              <h2>Job state</h2>
              <p id="jobDetail" class="panel-copy">Submit a direct media URL to create a new conversion job.</p>
            </div>
            <span id="jobStatePill" class="state-chip">Idle</span>
          </div>

          <div class="progress-block">
            <div class="progress-head">
              <span>Progress</span>
              <strong id="jobProgress">0%</strong>
            </div>
            <div class="progress-track" aria-hidden="true">
              <div id="progressFill" class="progress-fill"></div>
            </div>
          </div>

          <dl class="status-grid">
            <div>
              <dt>State</dt>
              <dd id="jobStatus">Waiting for submission</dd>
            </div>
            <div>
              <dt>Preset</dt>
              <dd id="jobPreset">-</dd>
            </div>
            <div>
              <dt>Job ID</dt>
              <dd id="jobId">-</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd id="jobFormat">-</dd>
            </div>
          </dl>

          <a id="downloadLink" class="download-link is-hidden" href="" target="_blank" rel="noreferrer">Download output</a>
        </section>

        <section class="panel panel-support">
          <h2>Requirements</h2>
          <ul class="support-list">
            <li>Use only media you host or have permission to process.</li>
            <li>Paste a direct file URL, not a watch page or playlist URL.</li>
            <li>Supported sources include common audio and video file extensions.</li>
            <li>GitHub Pages stays read-only until <code>VITE_API_BASE_URL</code> is configured.</li>
          </ul>
        </section>
      </main>
    </div>
  `;
}

export function initApp(root = document.querySelector('#app'), overrides = {}) {
  if (!root) {
    return null;
  }

  root.innerHTML = renderApp();

  const state = {
    outputFormat: 'mp3',
    qualityPreset: 'mp3-128k',
    isSubmitting: false,
    pollTimer: null,
    lastJob: {
      jobId: '',
      status: '',
      progress: 0,
      outputFormat: '',
      qualityPreset: '',
      downloadUrl: '',
      errorMessage: '',
    },
  };

  const deps = {
    createJob,
    fetchJob,
    getApiBaseUrl,
    isApiConfigured,
    ...overrides,
  };

  const form = root.querySelector('#jobForm');
  const sourceUrlInput = root.querySelector('#sourceUrl');
  const outputFormatSelect = root.querySelector('#outputFormat');
  const qualityPresetSelect = root.querySelector('#qualityPreset');
  const submitButton = root.querySelector('#submitButton');
  const resetButton = root.querySelector('#resetButton');
  const backendBadge = root.querySelector('#backendBadge');
  const deployMessage = root.querySelector('#deployMessage');
  const urlHint = root.querySelector('#urlHint');
  const presetHint = root.querySelector('#presetHint');
  const statusMessage = root.querySelector('#statusMessage');
  const errorMessage = root.querySelector('#errorMessage');
  const jobStatus = root.querySelector('#jobStatus');
  const jobProgress = root.querySelector('#jobProgress');
  const jobPreset = root.querySelector('#jobPreset');
  const jobId = root.querySelector('#jobId');
  const jobFormat = root.querySelector('#jobFormat');
  const jobDetail = root.querySelector('#jobDetail');
  const downloadLink = root.querySelector('#downloadLink');
  const progressFill = root.querySelector('#progressFill');
  const jobStatePill = root.querySelector('#jobStatePill');

  function setMessage(message) {
    statusMessage.textContent = message;
  }

  function setError(message) {
    errorMessage.textContent = message;
  }

  function clearError() {
    errorMessage.textContent = '';
  }

  function getPresetDescription(presetValue) {
    return PRESET_DETAILS[presetValue] || 'Fixed preset selected for backend-safe conversion.';
  }

  function setUrlHint(message, type = 'neutral') {
    urlHint.textContent = message;
    urlHint.dataset.state = type;
    sourceUrlInput.dataset.state = type;
    sourceUrlInput.setAttribute('aria-invalid', type === 'error' ? 'true' : 'false');
  }

  function validateUrlField() {
    const value = sourceUrlInput.value.trim();

    if (!value) {
      setUrlHint('Direct .mp4, .mov, .mp3, .wav, .m4a, .aac, .ogg, or .webm file URL.', 'neutral');
      return { valid: false, empty: true };
    }

    const validation = validateSourceUrl(value);
    if (!validation.valid) {
      setUrlHint(validation.error, 'error');
      return validation;
    }

    setUrlHint('Source looks valid. Submission will use the normalized URL.', 'success');
    return validation;
  }

  function updatePresetOptions() {
    const options = getPresetOptions(state.outputFormat);
    qualityPresetSelect.innerHTML = options
      .map((option) => `<option value="${option.value}">${option.label}</option>`)
      .join('');
    state.qualityPreset = options[0].value;
    qualityPresetSelect.value = state.qualityPreset;
    presetHint.textContent = getPresetDescription(state.qualityPreset);
  }

  function updateSubmitState() {
    const hasBackend = deps.isApiConfigured();
    submitButton.disabled = state.isSubmitting || !hasBackend;
    submitButton.textContent = state.isSubmitting ? 'Submitting...' : (hasBackend ? 'Start conversion' : 'Backend not configured');
  }

  function syncDeploymentState() {
    if (deps.isApiConfigured()) {
      backendBadge.textContent = 'Backend connected';
      backendBadge.dataset.state = 'ready';
      deployMessage.textContent = `API ${deps.getApiBaseUrl()}`;
    } else {
      backendBadge.textContent = 'Read-only mode';
      backendBadge.dataset.state = 'offline';
      deployMessage.textContent = 'Set VITE_API_BASE_URL for the frontend build to enable submissions.';
    }
    updateSubmitState();
  }

  function syncProgress(job) {
    state.lastJob = { ...state.lastJob, ...job };
    const currentStatus = state.lastJob.status || 'idle';
    const label = currentStatus === 'idle' ? 'Waiting for submission' : getStatusLabel(currentStatus);
    const chipLabel = currentStatus === 'idle' ? 'Idle' : label;

    jobStatus.textContent = label;
    jobProgress.textContent = `${state.lastJob.progress}%`;
    jobPreset.textContent = state.lastJob.qualityPreset || '-';
    jobId.textContent = state.lastJob.jobId || '-';
    jobFormat.textContent = state.lastJob.outputFormat ? state.lastJob.outputFormat.toUpperCase() : '-';
    jobDetail.textContent = STATUS_DETAILS[currentStatus] || STATUS_DETAILS.idle;
    jobStatePill.textContent = chipLabel;
    jobStatePill.dataset.state = currentStatus;
    progressFill.style.width = `${state.lastJob.progress}%`;

    if (state.lastJob.downloadUrl) {
      downloadLink.href = state.lastJob.downloadUrl;
      downloadLink.classList.remove('is-hidden');
    } else {
      downloadLink.href = '';
      downloadLink.classList.add('is-hidden');
    }
  }

  function setSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;
    updateSubmitState();
  }

  function resetJobState() {
    window.clearTimeout(state.pollTimer);
    state.pollTimer = null;
    state.lastJob = {
      jobId: '',
      status: '',
      progress: 0,
      outputFormat: '',
      qualityPreset: '',
      downloadUrl: '',
      errorMessage: '',
    };
    syncProgress(state.lastJob);
    clearError();
    setMessage(deps.isApiConfigured()
      ? 'Ready for a direct media URL from an authorized domain.'
      : 'The frontend is available, but submissions stay disabled until the backend is configured.');
  }

  async function pollJob(jobIdentifier) {
    try {
      const job = normalizeJobResponse(await deps.fetchJob(jobIdentifier));
      syncProgress(job);

      if (job.errorMessage) {
        setError(job.errorMessage);
      } else {
        clearError();
      }

      setMessage(getStatusLabel(job.status));

      if (shouldContinuePolling(job.status)) {
        state.pollTimer = window.setTimeout(() => {
          void pollJob(jobIdentifier);
        }, 2000);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to refresh job status.');
      setMessage('Last known job state is still shown below.');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    window.clearTimeout(state.pollTimer);
    clearError();

    if (!deps.isApiConfigured()) {
      setError('Backend API is not configured for this deployment yet.');
      setMessage('Set VITE_API_BASE_URL for the frontend build before testing live submissions.');
      return;
    }

    const validation = validateUrlField();
    if (!validation.valid) {
      setError(validation.error || 'Paste a direct media URL to begin.');
      setMessage('Waiting for a valid source URL.');
      return;
    }

    setSubmitting(true);
    setMessage('Submitting job...');

    try {
      const job = await deps.createJob({
        sourceUrl: validation.normalizedUrl,
        outputFormat: state.outputFormat,
        qualityPreset: state.qualityPreset,
      });

      syncProgress({
        jobId: job.jobId,
        status: job.status,
        progress: 0,
        outputFormat: state.outputFormat,
        qualityPreset: state.qualityPreset,
        downloadUrl: '',
      });

      setMessage('Job accepted. Polling for updates.');
      await pollJob(job.jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create the conversion job.');
      setMessage('Submission failed before processing started.');
    } finally {
      setSubmitting(false);
    }
  });

  sourceUrlInput.addEventListener('input', () => {
    validateUrlField();
    if (!errorMessage.textContent) {
      setMessage(deps.isApiConfigured()
        ? 'Ready for a direct media URL from an authorized domain.'
        : 'The frontend is available, but submissions stay disabled until the backend is configured.');
    }
  });

  sourceUrlInput.addEventListener('blur', () => {
    validateUrlField();
  });

  outputFormatSelect.addEventListener('change', () => {
    state.outputFormat = outputFormatSelect.value;
    updatePresetOptions();
  });

  qualityPresetSelect.addEventListener('change', () => {
    state.qualityPreset = qualityPresetSelect.value;
    presetHint.textContent = getPresetDescription(state.qualityPreset);
  });

  resetButton.addEventListener('click', () => {
    form.reset();
    state.outputFormat = 'mp3';
    outputFormatSelect.value = 'mp3';
    updatePresetOptions();
    setUrlHint('Direct .mp4, .mov, .mp3, .wav, .m4a, .aac, .ogg, or .webm file URL.', 'neutral');
    resetJobState();
    sourceUrlInput.focus();
  });

  updatePresetOptions();
  setUrlHint('Direct .mp4, .mov, .mp3, .wav, .m4a, .aac, .ogg, or .webm file URL.', 'neutral');
  syncDeploymentState();
  resetJobState();

  return {
    destroy() {
      window.clearTimeout(state.pollTimer);
    },
  };
}
