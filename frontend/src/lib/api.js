const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

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

