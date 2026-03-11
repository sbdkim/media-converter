import {
  createJob,
  fetchJob,
  getApiBaseUrl,
  getApiMode,
  isApiConfigured,
  resolveSource,
} from './lib/api.js';
import { getStatusLabel, normalizeJobResponse, shouldContinuePolling } from './lib/jobState.js';
import { validateSourceUrl } from './lib/validation.js';

const STATUS_DETAILS = {
  queued: 'Request accepted and waiting for backend execution.',
  processing: 'Conversion is in progress. Leave this tab open for live updates.',
  completed: 'Output is ready. Download it or start another conversion.',
  failed: 'The job stopped before completion. Review the error and retry.',
  expired: 'The temporary download has expired. Submit again if you still need the file.',
  idle: 'Paste a public YouTube, Instagram, or direct media URL to begin.',
};

const THEME_STORAGE_KEY = 'media-converter-theme';

function formatDuration(durationSeconds) {
  if (!durationSeconds) {
    return 'Unknown';
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderApp() {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-block">
          <p class="product-kicker">Media Converter</p>
          <h1>Resolve public page URLs into downloadable media.</h1>
          <p class="brand-copy">Supports YouTube, Instagram, and direct file links with a resolve-first workflow.</p>
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
                <p class="section-label">Resolve</p>
                <h2>Create extraction job</h2>
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
                    placeholder="https://youtube.com/watch?v=... or https://instagram.com/reel/..."
                    autocomplete="off"
                    required
                  />
                  <button id="pasteButton" class="ghost-button" type="button">Paste</button>
                </div>
                <span id="urlHint" class="field-hint" aria-live="polite">
                  Public YouTube, Instagram, or direct media URL.
                </span>
              </label>

              <div class="resolve-row">
                <button id="resolveButton" class="secondary-button" type="button">Resolve source</button>
                <p id="statusMessage" class="status-message" aria-live="polite"></p>
              </div>

              <section id="resolvedPanel" class="resolved-panel is-hidden">
                <div class="resolved-meta">
                  <div>
                    <p class="section-label">Resolved media</p>
                    <h3 id="resolvedTitle">Waiting for source</h3>
                    <p id="resolvedPlatform" class="status-copy"></p>
                  </div>
                  <img id="resolvedThumbnail" class="thumbnail is-hidden" alt="Resolved media preview" />
                </div>
                <dl class="resolved-facts">
                  <div><dt>Type</dt><dd id="resolvedType">-</dd></div>
                  <div><dt>Duration</dt><dd id="resolvedDuration">-</dd></div>
                  <div><dt>Audio</dt><dd id="resolvedAudio">-</dd></div>
                  <div><dt>Video</dt><dd id="resolvedVideo">-</dd></div>
                </dl>
              </section>

              <div class="control-strip">
                <label class="field" for="outputFormat">
                  <span>Output</span>
                  <select id="outputFormat" name="outputFormat" disabled></select>
                </label>

                <label class="field" for="qualityPreset">
                  <span>Preset</span>
                  <select id="qualityPreset" name="qualityPreset" disabled></select>
                </label>
              </div>

              <div class="preset-note">
                <p class="section-label">Preset note</p>
                <p id="presetHint" class="preset-copy">Resolve a source first to see the available output choices.</p>
              </div>

              <div class="action-row">
                <button id="submitButton" class="primary-button" type="submit" disabled>Create job</button>
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
              <div><dt>Platform</dt><dd id="jobPlatform">-</dd></div>
              <div><dt>Preset</dt><dd id="jobPreset">-</dd></div>
              <div><dt>Output</dt><dd id="jobFormat">-</dd></div>
              <div><dt>Job ID</dt><dd id="jobId">-</dd></div>
            </dl>

            <div class="next-step">
              <p class="section-label">Next step</p>
              <p id="nextStepCopy" class="status-copy">Resolve a source URL, choose an output, then create a job.</p>
            </div>

            <a id="downloadLink" class="download-link is-hidden" href="" target="_blank" rel="noreferrer">Download output</a>
          </section>
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
    isSubmitting: false,
    isResolving: false,
    pollTimer: null,
    resolved: null,
    outputFormat: '',
    qualityPreset: '',
    lastJob: {
      jobId: '',
      status: '',
      progress: 0,
      platform: '',
      outputFormat: '',
      qualityPreset: '',
      downloadUrl: '',
    },
  };

  const deps = {
    createJob,
    fetchJob,
    getApiBaseUrl,
    getApiMode,
    isApiConfigured,
    resolveSource,
    ...overrides,
  };

  const form = root.querySelector('#jobForm');
  const sourceUrlInput = root.querySelector('#sourceUrl');
  const outputFormatSelect = root.querySelector('#outputFormat');
  const qualityPresetSelect = root.querySelector('#qualityPreset');
  const submitButton = root.querySelector('#submitButton');
  const resolveButton = root.querySelector('#resolveButton');
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
  const resolvedPanel = root.querySelector('#resolvedPanel');
  const resolvedTitle = root.querySelector('#resolvedTitle');
  const resolvedPlatform = root.querySelector('#resolvedPlatform');
  const resolvedType = root.querySelector('#resolvedType');
  const resolvedDuration = root.querySelector('#resolvedDuration');
  const resolvedAudio = root.querySelector('#resolvedAudio');
  const resolvedVideo = root.querySelector('#resolvedVideo');
  const resolvedThumbnail = root.querySelector('#resolvedThumbnail');
  const jobStatus = root.querySelector('#jobStatus');
  const jobProgress = root.querySelector('#jobProgress');
  const jobPlatform = root.querySelector('#jobPlatform');
  const jobPreset = root.querySelector('#jobPreset');
  const jobId = root.querySelector('#jobId');
  const jobFormat = root.querySelector('#jobFormat');
  const jobDetail = root.querySelector('#jobDetail');
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

  function clearResolvedState() {
    state.resolved = null;
    state.outputFormat = '';
    state.qualityPreset = '';
    resolvedPanel.classList.add('is-hidden');
    resolvedTitle.textContent = 'Waiting for source';
    resolvedPlatform.textContent = '';
    resolvedType.textContent = '-';
    resolvedDuration.textContent = '-';
    resolvedAudio.textContent = '-';
    resolvedVideo.textContent = '-';
    resolvedThumbnail.src = '';
    resolvedThumbnail.classList.add('is-hidden');
    outputFormatSelect.innerHTML = '';
    qualityPresetSelect.innerHTML = '';
    outputFormatSelect.disabled = true;
    qualityPresetSelect.disabled = true;
    submitButton.disabled = true;
    presetHint.textContent = 'Resolve a source first to see the available output choices.';
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
      setUrlHint('Public YouTube, Instagram, or direct media URL.', 'neutral');
      return { valid: false, empty: true };
    }

    const validation = validateSourceUrl(value);
    if (!validation.valid) {
      setUrlHint(validation.error, 'error');
      return validation;
    }

    setUrlHint('URL looks valid. Resolve it to preview available outputs.', 'success');
    return validation;
  }

  function refreshPresetChoices() {
    if (!state.resolved) {
      return;
    }

    const outputs = state.resolved.availableOutputs.filter((option) => option.outputFormat === state.outputFormat);
    qualityPresetSelect.innerHTML = outputs
      .map((option) => `<option value="${option.qualityPreset}">${option.label}</option>`)
      .join('');
    state.qualityPreset = outputs[0]?.qualityPreset || '';
    qualityPresetSelect.value = state.qualityPreset;
    presetHint.textContent = outputs[0]?.description || 'Choose a resolved output.';
    submitButton.disabled = !deps.isApiConfigured() || !state.resolved || !state.qualityPreset;
  }

  function applyResolvedSource(payload) {
    state.resolved = payload;
    resolvedPanel.classList.remove('is-hidden');
    resolvedTitle.textContent = payload.title;
    resolvedPlatform.textContent = payload.platform;
    resolvedType.textContent = payload.sourceType === 'direct' ? 'Direct file' : 'Resolved page';
    resolvedDuration.textContent = formatDuration(payload.durationSeconds);
    resolvedAudio.textContent = payload.audioOnlySupported ? 'Yes' : 'No';
    resolvedVideo.textContent = payload.videoSupported ? 'Yes' : 'No';

    if (payload.thumbnailUrl) {
      resolvedThumbnail.src = payload.thumbnailUrl;
      resolvedThumbnail.classList.remove('is-hidden');
    } else {
      resolvedThumbnail.src = '';
      resolvedThumbnail.classList.add('is-hidden');
    }

    const outputFormats = [...new Set(payload.availableOutputs.map((option) => option.outputFormat))];
    outputFormatSelect.innerHTML = outputFormats
      .map((option) => `<option value="${option}">${option.toUpperCase()}</option>`)
      .join('');
    state.outputFormat = payload.defaultOutput?.outputFormat || outputFormats[0] || '';
    outputFormatSelect.value = state.outputFormat;
    outputFormatSelect.disabled = false;
    qualityPresetSelect.disabled = false;
    refreshPresetChoices();
  }

  function updateSubmitState() {
    const hasBackend = deps.isApiConfigured();
    resolveButton.disabled = state.isResolving || !hasBackend;
    resolveButton.textContent = state.isResolving ? 'Resolving...' : 'Resolve source';
    submitButton.disabled = state.isSubmitting || !hasBackend || !state.resolved || !state.qualityPreset;
    submitButton.textContent = state.isSubmitting ? 'Submitting...' : 'Create job';
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
    jobPlatform.textContent = state.lastJob.platform || '-';
    jobPreset.textContent = state.lastJob.qualityPreset || '-';
    jobFormat.textContent = state.lastJob.outputFormat ? state.lastJob.outputFormat.toUpperCase() : '-';
    jobId.textContent = state.lastJob.jobId || '-';
    jobDetail.textContent = STATUS_DETAILS[currentStatus] || STATUS_DETAILS.idle;
    jobStatePill.textContent = chipLabel;
    jobStatePill.dataset.state = currentStatus;
    stage.dataset.status = currentStatus;
    progressFill.style.width = `${state.lastJob.progress}%`;

    if (currentStatus === 'completed') {
      nextStepCopy.textContent = 'Download the file now, or clear the form to process another source.';
    } else if (currentStatus === 'failed' || currentStatus === 'expired') {
      nextStepCopy.textContent = 'Resolve the source again or choose a different output and retry.';
    } else if (currentStatus === 'processing' || currentStatus === 'queued') {
      nextStepCopy.textContent = 'Wait for the backend to finish processing. The status block will keep updating.';
    } else {
      nextStepCopy.textContent = 'Resolve a source URL, choose an output, then create a job.';
    }

    if (state.lastJob.downloadUrl) {
      downloadLink.href = state.lastJob.downloadUrl;
      downloadLink.classList.remove('is-hidden');
    } else {
      downloadLink.href = '';
      downloadLink.classList.add('is-hidden');
    }
  }

  async function pollJob(jobIdentifier) {
    try {
      const job = normalizeJobResponse(await deps.fetchJob(jobIdentifier));
      syncProgress(job);
      setMessage(getStatusLabel(job.status));

      if (job.errorMessage) {
        setError(job.errorMessage);
      } else {
        clearError();
      }

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

  function resetJobState() {
    window.clearTimeout(state.pollTimer);
    state.pollTimer = null;
    syncProgress({
      jobId: '',
      status: '',
      progress: 0,
      platform: '',
      outputFormat: '',
      qualityPreset: '',
      downloadUrl: '',
    });
    clearError();
    setMessage(deps.isApiConfigured()
      ? 'Resolve a source URL to inspect available outputs.'
      : 'This build is read-only until an API origin is configured.');
  }

  async function handleResolve() {
    clearError();
    const validation = validateUrlField();
    if (!validation.valid) {
      setError(validation.error || 'Enter a valid source URL.');
      return;
    }

    state.isResolving = true;
    updateSubmitState();
    setMessage('Resolving source...');

    try {
      const resolved = await deps.resolveSource(validation.normalizedUrl);
      applyResolvedSource(resolved);
      setMessage('Source resolved. Choose an output and create the job.');
    } catch (error) {
      clearResolvedState();
      setError(error instanceof Error ? error.message : 'Unable to resolve that source URL.');
      setMessage('Resolve failed.');
    } finally {
      state.isResolving = false;
      updateSubmitState();
    }
  }

  function applySourceUrl(value) {
    sourceUrlInput.value = value.trim();
    validateUrlField();
    clearResolvedState();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();
    window.clearTimeout(state.pollTimer);

    if (!state.resolved) {
      setError('Resolve the source URL before creating a job.');
      return;
    }

    state.isSubmitting = true;
    updateSubmitState();
    setMessage('Submitting job...');

    try {
      const job = await deps.createJob({
        resolveToken: state.resolved.resolveToken,
        outputFormat: state.outputFormat,
        qualityPreset: state.qualityPreset,
      });

      syncProgress({
        jobId: job.jobId,
        status: job.status,
        progress: 0,
        platform: state.resolved.platform,
        outputFormat: state.outputFormat,
        qualityPreset: state.qualityPreset,
        downloadUrl: '',
      });

      setMessage('Job accepted. Polling for updates.');
      await pollJob(job.jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create the extraction job.');
      setMessage('Submission failed.');
    } finally {
      state.isSubmitting = false;
      updateSubmitState();
    }
  });

  resolveButton.addEventListener('click', () => {
    void handleResolve();
  });

  sourceUrlInput.addEventListener('input', () => {
    validateUrlField();
    clearResolvedState();
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
    refreshPresetChoices();
  });

  qualityPresetSelect.addEventListener('change', () => {
    state.qualityPreset = qualityPresetSelect.value;
    const option = state.resolved?.availableOutputs.find((entry) =>
      entry.outputFormat === state.outputFormat && entry.qualityPreset === state.qualityPreset);
    presetHint.textContent = option?.description || 'Choose a resolved output.';
  });

  resetButton.addEventListener('click', () => {
    form.reset();
    clearResolvedState();
    resetJobState();
    setUrlHint('Public YouTube, Instagram, or direct media URL.', 'neutral');
    sourceUrlInput.focus();
  });

  applyTheme(getPreferredTheme());
  clearResolvedState();
  setUrlHint('Public YouTube, Instagram, or direct media URL.', 'neutral');
  syncDeploymentState();
  resetJobState();

  return {
    destroy() {
      window.clearTimeout(state.pollTimer);
    },
  };
}
