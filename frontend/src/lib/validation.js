const UNSUPPORTED_HOST_PATTERNS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)vimeo\.com$/i,
  /(^|\.)dailymotion\.com$/i,
];
const MEDIA_EXTENSIONS = /\.(mp4|mov|m4v|webm|mp3|wav|m4a|aac|ogg)$/i;

export function validateSourceUrl(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, error: 'Paste a direct media URL to begin.' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Enter a valid http or https URL.' };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, error: 'Only http and https URLs are supported.' };
  }

  if (UNSUPPORTED_HOST_PATTERNS.some((pattern) => pattern.test(parsedUrl.hostname))) {
    return {
      valid: false,
      error: 'This source platform is not supported yet. Try YouTube, Instagram, or a direct media URL.',
    };
  }

  const isKnownExtractorSource =
    /(^|\.)youtube\.com$/i.test(parsedUrl.hostname) ||
    /(^|\.)youtu\.be$/i.test(parsedUrl.hostname) ||
    /(^|\.)instagram\.com$/i.test(parsedUrl.hostname);

  if (!isKnownExtractorSource && !MEDIA_EXTENSIONS.test(parsedUrl.pathname)) {
    return { valid: false, error: 'Paste a direct media file URL or a supported YouTube/Instagram page URL.' };
  }

  return { valid: true, normalizedUrl: parsedUrl.toString() };
}

export function getPresetOptions(outputFormat) {
  if (outputFormat === 'mp3') {
    return [
      { value: 'mp3-128k', label: 'MP3 128 kbps' },
      { value: 'mp3-320k', label: 'MP3 320 kbps' },
    ];
  }

  return [
    { value: 'mp4-360p', label: 'MP4 360p' },
    { value: 'mp4-720p', label: 'MP4 720p' },
  ];
}
