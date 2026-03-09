const SUPPORTED_TYPES = ['audio/', 'video/'];

export function createRemoteMediaInspector({ maxSourceSizeMb }) {
  return {
    async inspect(url) {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      const contentType = response.headers.get('content-type') || '';
      const contentLength = Number(response.headers.get('content-length') || 0);

      if (!response.ok) {
        throw Object.assign(new Error('Unable to inspect the remote media URL.'), {
          errorCode: 'SOURCE_UNREACHABLE',
        });
      }

      if (!SUPPORTED_TYPES.some((type) => contentType.toLowerCase().startsWith(type))) {
        throw Object.assign(new Error('The source URL does not appear to be a direct audio or video file.'), {
          errorCode: 'UNSUPPORTED_MIME',
        });
      }

      if (contentType.toLowerCase().includes('html')) {
        throw Object.assign(new Error('HTML pages are not supported. Paste a direct media file URL.'), {
          errorCode: 'HTML_NOT_SUPPORTED',
        });
      }

      const maxBytes = maxSourceSizeMb * 1024 * 1024;
      if (contentLength && contentLength > maxBytes) {
        throw Object.assign(new Error(`Source file exceeds the ${maxSourceSizeMb} MB limit.`), {
          errorCode: 'SOURCE_TOO_LARGE',
        });
      }

      return {
        contentType,
        contentLength,
        finalUrl: response.url || url,
      };
    },
  };
}

