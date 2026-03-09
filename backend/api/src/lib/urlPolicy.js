const BLOCKED_HOST_PATTERNS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)vimeo\.com$/i,
  /(^|\.)dailymotion\.com$/i,
];

export function parseAndValidateSourceUrl(sourceUrl, allowedDomains) {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return { ok: false, errorCode: 'INVALID_URL', errorMessage: 'A valid source URL is required.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, errorCode: 'INVALID_PROTOCOL', errorMessage: 'Only http and https URLs are supported.' };
  }

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    return {
      ok: false,
      errorCode: 'BLOCKED_HOST',
      errorMessage: 'This service does not support third-party platform extraction URLs.',
    };
  }

  if (allowedDomains.length > 0 && !allowedDomains.includes(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      errorCode: 'DOMAIN_NOT_ALLOWED',
      errorMessage: 'The source domain is not on the allowed list.',
    };
  }

  return { ok: true, normalizedUrl: parsed.toString(), sourceDomain: parsed.hostname.toLowerCase() };
}

