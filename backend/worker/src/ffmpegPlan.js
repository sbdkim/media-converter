import { getPreset } from './presets.js';

export function buildFfmpegArgs({ inputPath, outputPath, qualityPreset }) {
  const preset = getPreset(qualityPreset);
  if (!preset) {
    throw new Error(`Unsupported preset: ${qualityPreset}`);
  }

  return ['-y', '-i', inputPath, ...preset.args, outputPath];
}

