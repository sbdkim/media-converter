const SUPPORTED_EXTRACTOR_HOST_PATTERNS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)instagram\.com$/i,
];

const BLOCKED_HOST_PATTERNS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)vimeo\.com$/i,
  /(^|\.)dailymotion\.com$/i,
];

const MEDIA_EXTENSIONS = /\.(mp4|mov|m4v|webm|mp3|wav|m4a|aac|ogg)$/i;

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
      errorCode: 'UNSUPPORTED_PLATFORM',
      errorMessage: 'This service does not support that platform yet.',
    };
  }

  const isSupportedExtractorHost = SUPPORTED_EXTRACTOR_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  const isDirectMedia = MEDIA_EXTENSIONS.test(parsed.pathname);

  if (!isSupportedExtractorHost && !isDirectMedia && allowedDomains.length > 0 && !allowedDomains.includes(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      errorCode: 'DOMAIN_NOT_ALLOWED',
      errorMessage: 'The source domain is not on the allowed list.',
    };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    sourceDomain: parsed.hostname.toLowerCase(),
    sourceType: isDirectMedia ? 'direct' : 'page',
  };
}
