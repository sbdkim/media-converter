export const PRESETS = {
  mp3: new Set(['mp3-128k', 'mp3-320k']),
  mp4: new Set(['mp4-360p', 'mp4-720p']),
};

export function isValidPreset(outputFormat, qualityPreset) {
  return PRESETS[outputFormat]?.has(qualityPreset) || false;
}

