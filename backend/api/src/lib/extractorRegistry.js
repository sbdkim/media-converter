import { createAvailableOutputs, getDefaultOutput } from './outputOptions.js';

function normalizeDuration(value) {
  return Number.isFinite(value) ? value : 0;
}

function normalizeThumbnail(value) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((entry) => entry?.url)?.url || '';
  }

  return '';
}

function createAdapter({ platform, hosts, engine, mediaKindFromInfo }) {
  return {
    canHandle(url) {
      return hosts.some((pattern) => pattern.test(url.hostname));
    },
    async resolve(url) {
      const info = await engine.resolve(url.toString());
      const mediaKind = mediaKindFromInfo(info);

      if (info.availability === 'private' || info.is_private) {
        throw Object.assign(new Error('Private or login-required content is not supported.'), {
          errorCode: 'PRIVATE_CONTENT_NOT_SUPPORTED',
        });
      }

      if (mediaKind === 'none') {
        throw Object.assign(new Error('No compatible public media stream was found for this URL.'), {
          errorCode: 'NO_COMPATIBLE_OUTPUT',
        });
      }

      const availableOutputs = createAvailableOutputs({
        audioOnlySupported: mediaKind === 'audio' || mediaKind === 'video',
        videoSupported: mediaKind === 'video',
      });

      return {
        platform,
        canonicalUrl: info.webpage_url || info.original_url || url.toString(),
        title: info.title || 'Untitled media',
        thumbnailUrl: normalizeThumbnail(info.thumbnail || info.thumbnails),
        durationSeconds: normalizeDuration(info.duration),
        audioOnlySupported: mediaKind === 'audio' || mediaKind === 'video',
        videoSupported: mediaKind === 'video',
        availableOutputs,
        defaultOutput: getDefaultOutput(availableOutputs),
        sourceRef: {
          platform,
          extractorUrl: info.webpage_url || info.original_url || url.toString(),
          mediaKind,
        },
      };
    },
    async download(resolvedSource, destinationPath, selectedOutput) {
      await engine.download(
        resolvedSource.extractorUrl,
        destinationPath,
        selectedOutput.extractorFormat,
      );
    },
  };
}

function detectMediaKind(info) {
  if (info._type === 'playlist') {
    return 'none';
  }
  if (info.vcodec && info.vcodec !== 'none') {
    return 'video';
  }
  if (info.acodec && info.acodec !== 'none') {
    return 'audio';
  }
  return 'none';
}

export function createExtractorRegistry({ engine }) {
  const adapters = [
    createAdapter({
      platform: 'youtube',
      hosts: [/(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i],
      engine,
      mediaKindFromInfo: detectMediaKind,
    }),
    createAdapter({
      platform: 'instagram',
      hosts: [/(^|\.)instagram\.com$/i],
      engine,
      mediaKindFromInfo: detectMediaKind,
    }),
  ];

  return {
    getAdapter(url) {
      return adapters.find((adapter) => adapter.canHandle(url)) || null;
    },
    listPlatforms() {
      return adapters.map((adapter) => adapter.platform);
    },
  };
}
