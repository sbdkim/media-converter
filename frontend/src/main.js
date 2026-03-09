import './style.css';
import { createJob, fetchJob, getApiBaseUrl, isApiConfigured } from './lib/api.js';
import { getStatusLabel, normalizeJobResponse, shouldContinuePolling } from './lib/jobState.js';
import { getPresetOptions, validateSourceUrl } from './lib/validation.js';

const state = {
  outputFormat: 'mp3',
  qualityPreset: 'mp3-128k',
  isSubmitting: false,
  pollTimer: null,
};

document.querySelector('#app').innerHTML = `
  <div class="shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Media Converter</p>
        <h1>Convert authorized media URLs into fixed MP3 and MP4 presets.</h1>
        <p class="lede">
          This frontend is designed for GitHub Pages, while the actual validation, transcoding, and
          signed download generation run on serverless infrastructure you control.
        </p>
        <div class="pill-row" aria-label="Product highlights">
          <span>Authorized sources only</span>
          <span>Fixed presets</span>
          <span>Serverless backend ready</span>
        </div>
      </div>
      <aside class="hero-card">
        <p class="card-label">v1 guardrails</p>
        <ul>
          <li>No YouTube or watch-page URLs</li>
          <li>No search integration</li>
          <li>No accounts or browser-side transcoding</li>
        </ul>
      </aside>
    </header>

    <main class="layout">
      <section class="panel input-panel">
        <div class="panel-head">
          <div>
            <p class="card-label">Submit</p>
            <h2>Create a conversion job</h2>
          </div>
          <p class="panel-note">Paste a direct media URL from a domain you control or are authorized to use.</p>
        </div>

        <form id="jobForm" class="job-form">
          <label class="field">
            <span>Source URL</span>
            <input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://media.example.com/video.mp4" required />
          </label>

          <div class="field-grid">
            <label class="field">
              <span>Output format</span>
              <select id="outputFormat" name="outputFormat">
                <option value="mp3">MP3</option>
                <option value="mp4">MP4</option>
              </select>
            </label>

            <label class="field">
              <span>Quality preset</span>
              <select id="qualityPreset" name="qualityPreset"></select>
            </label>
          </div>

          <button id="submitButton" class="submit-button" type="submit">Start authorized conversion</button>
        </form>

        <div class="message-stack">
          <p id="deployMessage" class="deploy-message" aria-live="polite"></p>
          <p id="statusMessage" class="status-message" aria-live="polite"></p>
          <p id="errorMessage" class="error-message" aria-live="assertive"></p>
        </div>
      </section>

      <section class="panel job-panel">
        <div class="panel-head">
          <div>
            <p class="card-label">Progress</p>
            <h2>Job status</h2>
          </div>
          <p class="panel-note">The UI polls the API until the job is complete, failed, or expired.</p>
        </div>

        <div class="status-card">
          <div class="status-row">
            <span>State</span>
            <strong id="jobStatus">Waiting for submission</strong>
          </div>
          <div class="status-row">
            <span>Progress</span>
            <strong id="jobProgress">0%</strong>
          </div>
          <div class="progress-bar" aria-hidden="true">
            <div id="progressFill" class="progress-fill"></div>
          </div>
          <div class="status-row">
            <span>Preset</span>
            <strong id="jobPreset">-</strong>
          </div>
          <div class="status-row">
            <span>Job ID</span>
            <strong id="jobId">-</strong>
          </div>
          <a id="downloadLink" class="download-link is-hidden" href="" target="_blank" rel="noreferrer">Download converted file</a>
        </div>
      </section>

      <section class="panel policy-panel">
        <div class="panel-head">
          <div>
            <p class="card-label">Policy</p>
            <h2>Use only on media you are allowed to process</h2>
          </div>
        </div>
        <p class="policy-copy">
          This prototype accepts only direct media URLs and is meant for public-domain, self-hosted, or otherwise authorized content.
          Do not use it for content that violates platform terms, DRM restrictions, or copyright.
        </p>
      </section>
    </main>
  </div>
`;

const form = document.querySelector('#jobForm');
const sourceUrlInput = document.querySelector('#sourceUrl');
const outputFormatSelect = document.querySelector('#outputFormat');
const qualityPresetSelect = document.querySelector('#qualityPreset');
const submitButton = document.querySelector('#submitButton');
const deployMessage = document.querySelector('#deployMessage');
const statusMessage = document.querySelector('#statusMessage');
const errorMessage = document.querySelector('#errorMessage');
const jobStatus = document.querySelector('#jobStatus');
const jobProgress = document.querySelector('#jobProgress');
const jobPreset = document.querySelector('#jobPreset');
const jobId = document.querySelector('#jobId');
const downloadLink = document.querySelector('#downloadLink');
const progressFill = document.querySelector('#progressFill');

function setMessage(message) {
  statusMessage.textContent = message;
}

function setError(message) {
  errorMessage.textContent = message;
}

function clearError() {
  errorMessage.textContent = '';
}

function updatePresetOptions() {
  const options = getPresetOptions(state.outputFormat);
  qualityPresetSelect.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
  state.qualityPreset = options[0].value;
  qualityPresetSelect.value = state.qualityPreset;
}

function syncDeploymentState() {
  if (isApiConfigured()) {
    deployMessage.textContent = `Backend API: ${getApiBaseUrl()}`;
    return;
  }

  deployMessage.textContent = 'This deployment does not have a backend API configured yet. The UI is live, but job submission is disabled until VITE_API_BASE_URL is set for the frontend build.';
}

function syncProgress(job) {
  jobStatus.textContent = getStatusLabel(job.status);
  jobProgress.textContent = `${job.progress}%`;
  jobPreset.textContent = job.qualityPreset || '-';
  jobId.textContent = job.jobId || '-';
  progressFill.style.width = `${job.progress}%`;

  if (job.downloadUrl) {
    downloadLink.href = job.downloadUrl;
    downloadLink.classList.remove('is-hidden');
  } else {
    downloadLink.href = '';
    downloadLink.classList.add('is-hidden');
  }
}

function setSubmitting(isSubmitting) {
  state.isSubmitting = isSubmitting;
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? 'Submitting...' : 'Start authorized conversion';
}

async function pollJob(jobIdentifier) {
  try {
    const job = normalizeJobResponse(await fetchJob(jobIdentifier));
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
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.clearTimeout(state.pollTimer);
  clearError();

  if (!isApiConfigured()) {
    setError('Backend API is not configured for this deployment yet.');
    setMessage('Set VITE_API_BASE_URL for the frontend build before testing live submissions.');
    return;
  }

  const validation = validateSourceUrl(sourceUrlInput.value);
  if (!validation.valid) {
    setError(validation.error);
    setMessage('Waiting for a valid source URL.');
    return;
  }

  setSubmitting(true);
  setMessage('Submitting job...');

  try {
    const job = await createJob({
      sourceUrl: validation.normalizedUrl,
      outputFormat: state.outputFormat,
      qualityPreset: state.qualityPreset,
    });

    syncProgress({
      jobId: job.jobId,
      status: job.status,
      progress: 0,
      qualityPreset: state.qualityPreset,
      downloadUrl: '',
    });

    setMessage('Job accepted. Polling for status updates...');
    await pollJob(job.jobId);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Unable to create the conversion job.');
  } finally {
    setSubmitting(false);
  }
});

outputFormatSelect.addEventListener('change', () => {
  state.outputFormat = outputFormatSelect.value;
  updatePresetOptions();
});

qualityPresetSelect.addEventListener('change', () => {
  state.qualityPreset = qualityPresetSelect.value;
});

updatePresetOptions();
syncDeploymentState();
syncProgress({
  jobId: '',
  status: '',
  progress: 0,
  qualityPreset: '',
  downloadUrl: '',
});
setMessage(isApiConfigured()
  ? 'Waiting for a direct media URL from an authorized domain.'
  : 'Frontend is live. Configure the backend API to enable submissions.');
