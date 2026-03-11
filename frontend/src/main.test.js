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

function createResolvedPayload() {
  return {
    platform: 'youtube',
    sourceType: 'resolved-page',
    canonicalUrl: 'https://youtube.com/watch?v=abc',
    title: 'Example title',
    thumbnailUrl: 'https://img.example.com/thumb.jpg',
    durationSeconds: 123,
    audioOnlySupported: true,
    videoSupported: true,
    resolveToken: 'resolve_123',
    availableOutputs: [
      {
        id: 'audio-mp3',
        outputFormat: 'mp3',
        qualityPreset: 'mp3-128k',
        label: 'Audio MP3',
        description: 'Balanced audio export.',
      },
      {
        id: 'video-mp4',
        outputFormat: 'mp4',
        qualityPreset: 'mp4-720p',
        label: 'Video MP4',
        description: 'Standard MP4 output.',
      },
    ],
    defaultOutput: {
      id: 'video-mp4',
      outputFormat: 'mp4',
      qualityPreset: 'mp4-720p',
      label: 'Video MP4',
      description: 'Standard MP4 output.',
    },
  };
}

test('renders read-only mode when the backend is not configured', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'), {
      isApiConfigured: () => false,
      getApiMode: () => 'unconfigured',
      getApiBaseUrl: () => '',
    });

    assert.match(document.querySelector('#backendBadge').textContent, /Read-only/);
    assert.equal(document.querySelector('#resolveButton').disabled, true);
    assert.match(document.querySelector('#deployMessage').textContent, /VITE_API_BASE_URL/);
  } finally {
    teardownDom(dom);
  }
});

test('shows inline URL validation feedback before resolve', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'));

    const input = document.querySelector('#sourceUrl');
    input.value = 'https://facebook.com/watch?v=abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    assert.match(document.querySelector('#urlHint').textContent, /not supported yet/i);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
  } finally {
    teardownDom(dom);
  }
});

test('toggles between dark and light themes', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'));

    const toggle = document.querySelector('#themeToggle');
    assert.equal(document.documentElement.dataset.theme, 'dark');
    toggle.dispatchEvent(new Event('click', { bubbles: true }));
    assert.equal(document.documentElement.dataset.theme, 'light');
    assert.equal(window.localStorage.getItem('media-converter-theme'), 'light');
  } finally {
    teardownDom(dom);
  }
});

test('resolves a supported page URL and populates output choices', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'), {
      isApiConfigured: () => true,
      getApiMode: () => 'configured',
      getApiBaseUrl: () => 'https://api.example.com',
      resolveSource: async () => createResolvedPayload(),
    });

    const input = document.querySelector('#sourceUrl');
    input.value = 'https://youtube.com/watch?v=abc';
    document.querySelector('#resolveButton').dispatchEvent(new Event('click', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(document.querySelector('#resolvedPanel').classList.contains('is-hidden'), false);
    assert.equal(document.querySelector('#resolvedTitle').textContent, 'Example title');
    assert.equal(document.querySelector('#outputFormat').value, 'mp4');
    assert.equal(document.querySelector('#qualityPreset').value, 'mp4-720p');
    assert.equal(document.querySelector('#submitButton').disabled, false);
  } finally {
    teardownDom(dom);
  }
});

test('surfaces a missing resolve route with a deployment-focused message', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'), {
      isApiConfigured: () => true,
      getApiMode: () => 'configured',
      getApiBaseUrl: () => 'https://api.example.com',
      resolveSource: async () => {
        throw Object.assign(new Error('Not found'), { status: 404 });
      },
    });

    const input = document.querySelector('#sourceUrl');
    input.value = 'https://youtube.com/watch?v=abc';
    document.querySelector('#resolveButton').dispatchEvent(new Event('click', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(document.querySelector('#errorMessage').textContent, /does not have \/api\/resolve yet/i);
    assert.match(document.querySelector('#statusMessage').textContent, /resolve failed/i);
  } finally {
    teardownDom(dom);
  }
});

test('accepts a dropped URL into the source field and clears resolved state', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    initApp(document.querySelector('#app'));

    const dropZone = document.querySelector('#dropZone');
    const event = new Event('drop', { bubbles: true });
    event.preventDefault = () => {};
    event.dataTransfer = {
      getData(type) {
        return type === 'text/plain' ? 'https://media.example.com/drop.mp4' : '';
      },
    };

    dropZone.dispatchEvent(event);

    assert.equal(document.querySelector('#sourceUrl').value, 'https://media.example.com/drop.mp4');
    assert.equal(document.querySelector('#resolvedPanel').classList.contains('is-hidden'), true);
  } finally {
    teardownDom(dom);
  }
});

test('creates a job from a resolved token and shows download state after completion', async () => {
  const dom = setupDom();
  try {
    const { initApp } = await loadAppModule();
    const createJobCalls = [];

    initApp(document.querySelector('#app'), {
      isApiConfigured: () => true,
      getApiMode: () => 'configured',
      getApiBaseUrl: () => 'https://api.example.com',
      resolveSource: async () => createResolvedPayload(),
      createJob: async (payload) => {
        createJobCalls.push(payload);
        return { jobId: 'job_123', status: 'queued' };
      },
      fetchJob: async () => ({
        jobId: 'job_123',
        status: 'completed',
        progress: 100,
        platform: 'youtube',
        outputFormat: 'mp4',
        qualityPreset: 'mp4-720p',
        downloadUrl: 'https://download.example.com/out.mp4',
      }),
    });

    const input = document.querySelector('#sourceUrl');
    input.value = 'https://youtube.com/watch?v=abc';
    document.querySelector('#resolveButton').dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector('#jobForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(createJobCalls, [{
      resolveToken: 'resolve_123',
      outputFormat: 'mp4',
      qualityPreset: 'mp4-720p',
    }]);
    assert.match(document.querySelector('#jobStatus').textContent, /Ready to download/);
    assert.equal(document.querySelector('#downloadLink').classList.contains('is-hidden'), false);
    assert.equal(document.querySelector('#jobPlatform').textContent, 'youtube');
  } finally {
    teardownDom(dom);
  }
});
