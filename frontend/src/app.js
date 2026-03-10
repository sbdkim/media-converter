import {
  createJob,
  fetchJob,
  getApiBaseUrl,
  getApiMode,
  isApiConfigured,
} from './lib/api.js';
import { getStatusLabel, normalizeJobResponse, shouldContinuePolling } from './lib/jobState.js';
import { getPresetOptions, validateSourceUrl } from './lib/validation.js';

const PRESET_DETAILS = {
  'mp3-128k': 'Balanced audio export for voice notes, previews, and lightweight delivery.',
  'mp3-320k': 'Higher bitrate audio for final listening copies and archive handoff.',
  'mp4-360p': 'Compact review preset for quick checks and low-bandwidth sharing.',
  'mp4-720p': 'Standard video output for internal review and general playback.',
};

const STATUS_DETAILS = {
  queued: 'Request accepted and waiting for backend execution.',
  validating: 'Source and preset checks are running before conversion starts.',
  processing: 'Conversion is in progress. Leave this tab open for live updates.',
  completed: 'Output is ready. Download it or start another conversion.',
  failed: 'The job stopped before completion. Review the error and retry.',
  expired: 'The temporary download has expired. Submit again if you still need the file.',
  idle: 'Drop or paste a direct media file URL to start a new conversion.',
};

const THEME_STORAGE_KEY = 'media-converter-theme';

function renderApp() {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-block">
          <p class="product-kicker">Media Converter</p>
          <h1>Convert direct media URLs with fixed presets.</h1>
          <p class="brand-copy">Built for quick internal conversions without custom encode setup.</p>
        </div>
        <div class="env-panel">
          <div class="env-actions">
            <span id="backendBadge" class="env-badge">Checking runtime</span>
            <button id="themeToggle" class="theme-toggle" type="button">Light mode</button>
          </div>
          <p id="deployMessage" class="env-copy" aria-live="polite"></p>
        </div>
      </header>

      <main class="workspace">
        <section class="stage">
          <section class="composer">
            <div class="section-head">
              <div>
                <p class="section-label">Submit</p>
                <h2>Create conversion job</h2>
              </div>
              <button id="resetButton" class="secondary-button" type="button">Clear</button>
            </div>

            <form id="jobForm" class="job-form">
              <label class="field field-source" for="sourceUrl">
                <span>Source URL</span>
                <div id="dropZone" class="dropzone">
                  <input
                    id="sourceUrl"
                    name="sourceUrl"
                    type="url"
                    placeholder="https://media.example.com/video.mp4"
                    autocomplete="off"
                    required
                  />
                  <button id="pasteButton" class="ghost-button" type="button">Paste</button>
                </div>
                <span id="urlHint" class="field-hint" aria-live="polite">
                  Direct .mp4, .mov, .webm, .mp3, .wav, .m4a, .aac, or .ogg file URL.
                </span>
              </label>

              <div class="control-strip">
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
                </label>
              </div>

              <div class="preset-note">
                <p class="section-label">Preset note</p>
                <p id="presetHint" class="preset-copy"></p>
              </div>

              <div class="action-row">
                <button id="submitButton" class="primary-button" type="submit">Start conversion</button>
                <p id="statusMessage" class="status-message" aria-live="polite"></p>
              </div>

              <p id="errorMessage" class="error-message" aria-live="assertive"></p>
            </form>
          </section>

          <section class="status-dock">
            <div class="status-summary">
              <div class="status-heading">
                <div>
                  <p class="section-label">Current job</p>
                  <h2 id="jobStatus">Waiting for submission</h2>
                </div>
                <span id="jobStatePill" class="state-chip">Idle</span>
              </div>
              <p id="jobDetail" class="status-copy">${STATUS_DETAILS.idle}</p>
            </div>

            <div class="progress-panel">
              <div class="progress-meta">
                <span>Progress</span>
                <strong id="jobProgress">0%</strong>
              </div>
              <div class="progress-track" aria-hidden="true">
                <div id="progressFill" class="progress-fill"></div>
              </div>
            </div>

            <dl class="job-facts">
              <div>
                <dt>Preset</dt>
                <dd id="jobPreset">-</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd id="jobFormat">-</dd>
              </div>
              <div>
                <dt>Job ID</dt>
                <dd id="jobId">-</dd>
              </div>
              <div>
                <dt>Source host</dt>
                <dd id="jobSourceHost">-</dd>
              </div>
            </dl>

            <div class="next-step">
              <p class="section-label">Next step</p>
              <p id="nextStepCopy" class="status-copy">Submit a direct source URL to create a job.</p>
            </div>

            <a id="downloadLink" class="download-link is-hidden" href="" target="_blank" rel="noreferrer">Download output</a>
          </section>
        </section>

        <section class="support-strip">
          <div class="support-card">
            <p class="section-label">Allowed use</p>
            <ul class="support-list">
              <li>Use only media you host or are authorized to process.</li>
              <li>Paste a direct file URL, not a watch page or playlist page.</li>
              <li>Fixed presets only. No custom encode settings in this UI.</li>
            </ul>
          </div>
          <div class="support-card">
            <p class="section-label">Workflow</p>
            <ul class="support-list">
              <li>Paste or drop a URL into the source field.</li>
              <li>Pick output and preset, then submit.</li>
              <li>Wait for completion, then download or clear for the next file.</li>
            </ul>
          </div>
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
    lastSubmittedUrl: '',
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
    getApiMode,
    isApiConfigured,
    ...overrides,
  };

  const form = root.querySelector('#jobForm');
  const sourceUrlInput = root.querySelector('#sourceUrl');
  const outputFormatSelect = root.querySelector('#outputFormat');
  const qualityPresetSelect = root.querySelector('#qualityPreset');
  const submitButton = root.querySelector('#submitButton');
  const resetButton = root.querySelector('#resetButton');
  const pasteButton = root.querySelector('#pasteButton');
  const dropZone = root.querySelector('#dropZone');
  const backendBadge = root.querySelector('#backendBadge');
  const themeToggle = root.querySelector('#themeToggle');
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
  const jobSourceHost = root.querySelector('#jobSourceHost');
  const nextStepCopy = root.querySelector('#nextStepCopy');
  const downloadLink = root.querySelector('#downloadLink');
  const progressFill = root.querySelector('#progressFill');
  const jobStatePill = root.querySelector('#jobStatePill');
  const stage = root.querySelector('.stage');

  function getPreferredTheme() {
    const storedTheme = window.localStorage?.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  }

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

  function getSourceHostLabel(sourceUrl) {
    if (!sourceUrl) {
      return '-';
    }

    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return '-';
    }
  }

  function setUrlHint(message, type = 'neutral') {
    urlHint.textContent = message;
    urlHint.dataset.state = type;
    sourceUrlInput.dataset.state = type;
    dropZone.dataset.state = type;
    sourceUrlInput.setAttribute('aria-invalid', type === 'error' ? 'true' : 'false');
  }

  function validateUrlField() {
    const value = sourceUrlInput.value.trim();

    if (!value) {
      setUrlHint('Direct .mp4, .mov, .webm, .mp3, .wav, .m4a, .aac, or .ogg file URL.', 'neutral');
      return { valid: false, empty: true };
    }

    const validation = validateSourceUrl(value);
    if (!validation.valid) {
      setUrlHint(validation.error, 'error');
      return validation;
    }

    setUrlHint('Source looks valid. Submit to queue the conversion.', 'success');
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
    const mode = deps.getApiMode ? deps.getApiMode() : (deps.isApiConfigured() ? 'configured' : 'unconfigured');
    const apiBaseUrl = deps.getApiBaseUrl ? deps.getApiBaseUrl() : '';

    if (mode === 'configured') {
      backendBadge.textContent = 'Configured backend';
      backendBadge.dataset.state = 'ready';
      deployMessage.textContent = `Live API target: ${apiBaseUrl}`;
    } else if (mode === 'local-fallback') {
      backendBadge.textContent = 'Local fallback';
      backendBadge.dataset.state = 'local';
      deployMessage.textContent = `Using localhost fallback ${apiBaseUrl}. Useful for local testing only.`;
    } else {
      backendBadge.textContent = 'Read-only';
      backendBadge.dataset.state = 'offline';
      deployMessage.textContent = 'No API origin is configured for this build. Set VITE_API_BASE_URL to enable submissions.';
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
    jobSourceHost.textContent = getSourceHostLabel(state.lastSubmittedUrl);
    jobDetail.textContent = STATUS_DETAILS[currentStatus] || STATUS_DETAILS.idle;
    jobStatePill.textContent = chipLabel;
    jobStatePill.dataset.state = currentStatus;
    stage.dataset.status = currentStatus;
    progressFill.style.width = `${state.lastJob.progress}%`;

    if (currentStatus === 'completed') {
      nextStepCopy.textContent = 'Download the file now, or clear the form to process another source.';
    } else if (currentStatus === 'failed' || currentStatus === 'expired') {
      nextStepCopy.textContent = 'Review the source URL and submit a fresh job when ready.';
    } else if (currentStatus === 'processing' || currentStatus === 'queued' || currentStatus === 'validating') {
      nextStepCopy.textContent = 'Wait for the backend to finish processing. The status block will keep updating.';
    } else {
      nextStepCopy.textContent = 'Submit a direct source URL to create a job.';
    }

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
    state.lastSubmittedUrl = '';
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
      : 'This build is read-only until an API origin is configured.');
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
      setMessage('Polling stopped. The last known job state is still shown.');
    }
  }

  function applySourceUrl(value) {
    sourceUrlInput.value = value.trim();
    validateUrlField();
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

    state.lastSubmittedUrl = validation.normalizedUrl;
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
        : 'This build is read-only until an API origin is configured.');
    }
  });

  sourceUrlInput.addEventListener('blur', () => {
    validateUrlField();
  });

  dropZone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dropZone.dataset.state = 'drag';
  });

  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.dataset.state = 'drag';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.dataset.state = sourceUrlInput.dataset.state || 'neutral';
  });

  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    const droppedUrl = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain') || '';
    if (droppedUrl) {
      applySourceUrl(droppedUrl);
    }
    dropZone.dataset.state = sourceUrlInput.dataset.state || 'neutral';
  });

  pasteButton.addEventListener('click', async () => {
    if (!navigator.clipboard?.readText) {
      setMessage('Clipboard paste is not available in this browser context.');
      return;
    }

    try {
      applySourceUrl(await navigator.clipboard.readText());
      setMessage('Pasted clipboard text into the source field.');
    } catch {
      setMessage('Clipboard access was blocked. Paste the URL manually instead.');
    }
  });

  themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
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
    setUrlHint('Direct .mp4, .mov, .webm, .mp3, .wav, .m4a, .aac, or .ogg file URL.', 'neutral');
    resetJobState();
    sourceUrlInput.focus();
  });

  updatePresetOptions();
  applyTheme(getPreferredTheme());
  setUrlHint('Direct .mp4, .mov, .webm, .mp3, .wav, .m4a, .aac, or .ogg file URL.', 'neutral');
  syncDeploymentState();
  resetJobState();

  return {
    destroy() {
      window.clearTimeout(state.pollTimer);
    },
  };
}
