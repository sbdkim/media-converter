const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();
const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = configuredApiBaseUrl || (isLocalhost ? 'http://localhost:8080' : '');

export function getApiMode() {
  if (configuredApiBaseUrl) {
    return 'configured';
  }

  if (isLocalhost) {
    return 'local-fallback';
  }

  return 'unconfigured';
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function isApiConfigured() {
  return API_BASE_URL.length > 0;
}

async function request(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('Backend API is not configured for this deployment yet.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response) {
    throw new Error('No response from the backend API.');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.errorMessage || payload?.message || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

export function createJob(input) {
  return request('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchJob(jobId) {
  return request(`/api/jobs/${jobId}`, {
    method: 'GET',
  });
}
