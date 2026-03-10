import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

async function loadAppModule() {
  return import(`./app.js?case=${Math.random()}`);
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'https://example.test/',
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;

  return dom;
}

function teardownDom(dom) {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.Event;
  delete globalThis.HTMLElement;
  delete globalThis.Node;
}

test('renders read-only mode when the backend is not configured', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'), {
      isApiConfigured: () => false,
      getApiBaseUrl: () => '',
    });

    assert.match(document.querySelector('#backendBadge').textContent, /Read-only mode/);
    assert.equal(document.querySelector('#submitButton').disabled, true);
    assert.match(document.querySelector('#deployMessage').textContent, /VITE_API_BASE_URL/);
  } finally {
    teardownDom(dom);
  }
});

test('updates preset options when the output format changes', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'));

    const formatSelect = document.querySelector('#outputFormat');
    formatSelect.value = 'mp4';
    formatSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const presetValues = Array.from(document.querySelectorAll('#qualityPreset option')).map((option) => option.value);
    assert.deepEqual(presetValues, ['mp4-360p', 'mp4-720p']);
    assert.match(document.querySelector('#presetHint').textContent, /review/i);
  } finally {
    teardownDom(dom);
  }
});

test('shows inline URL validation feedback before submit', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'));

    const input = document.querySelector('#sourceUrl');
    input.value = 'https://youtube.com/watch?v=abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    assert.match(document.querySelector('#urlHint').textContent, /does not support YouTube/i);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
  } finally {
    teardownDom(dom);
  }
});

test('shows completion state and download link after a successful submission', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    const createJobCalls = [];

    initApp(document.querySelector('#app'), {
      isApiConfigured: () => true,
      getApiBaseUrl: () => 'https://api.example.com',
      createJob: async (payload) => {
        createJobCalls.push(payload);
        return { jobId: 'job_123', status: 'queued' };
      },
      fetchJob: async () => ({
        jobId: 'job_123',
        status: 'completed',
        progress: 100,
        outputFormat: 'mp3',
        qualityPreset: 'mp3-128k',
        downloadUrl: 'https://download.example.com/out.mp3',
      }),
    });

    const input = document.querySelector('#sourceUrl');
    input.value = 'https://media.example.com/sample.mp4';
    document.querySelector('#jobForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(createJobCalls, [{
      sourceUrl: 'https://media.example.com/sample.mp4',
      outputFormat: 'mp3',
      qualityPreset: 'mp3-128k',
    }]);
    assert.match(document.querySelector('#jobStatus').textContent, /Ready to download/);
    assert.equal(document.querySelector('#downloadLink').classList.contains('is-hidden'), false);
    assert.equal(document.querySelector('#jobId').textContent, 'job_123');
  } finally {
    teardownDom(dom);
  }
});
