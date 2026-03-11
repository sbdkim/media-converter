import { createAvailableOutputs, getDefaultOutput } from './outputOptions.js';

const MEDIA_EXTENSIONS = /\.(mp4|mov|m4v|webm|mp3|wav|m4a|aac|ogg)$/i;

function getDirectMediaTitle(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  return segments.at(-1) || 'Direct media file';
}

export function createSourceResolver({ inspector, extractorRegistry }) {
  return {
    async resolve(parsedSource) {
      if (parsedSource.sourceType === 'direct') {
        const inspection = await inspector.inspect(parsedSource.normalizedUrl);
        const availableOutputs = createAvailableOutputs({
          audioOnlySupported: true,
          videoSupported: true,
        });

        return {
          sourceType: 'direct',
          platform: 'direct',
          canonicalUrl: inspection.finalUrl || parsedSource.normalizedUrl,
          title: getDirectMediaTitle(new URL(parsedSource.normalizedUrl)),
          thumbnailUrl: '',
          durationSeconds: 0,
          audioOnlySupported: true,
          videoSupported: true,
          availableOutputs,
          defaultOutput: getDefaultOutput(availableOutputs),
          sourceRef: {
            platform: 'direct',
            sourceUrl: parsedSource.normalizedUrl,
          },
        };
      }

      if (parsedSource.sourceType === 'page') {
        const adapter = extractorRegistry.getAdapter(new URL(parsedSource.normalizedUrl));
        if (!adapter) {
          throw Object.assign(new Error('This platform is not supported yet.'), {
            errorCode: 'UNSUPPORTED_PLATFORM',
          });
        }

        return {
          sourceType: 'resolved-page',
          ...(await adapter.resolve(new URL(parsedSource.normalizedUrl))),
        };
      }

      throw Object.assign(new Error('Unsupported source type.'), {
        errorCode: 'UNSUPPORTED_SOURCE_TYPE',
      });
    },
    isDirectMediaUrl(url) {
      return MEDIA_EXTENSIONS.test(url.pathname);
    },
  };
}
