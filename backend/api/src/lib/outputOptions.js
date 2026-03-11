const SMART_OUTPUTS = [
  {
    id: 'audio-mp3',
    outputFormat: 'mp3',
    qualityPreset: 'mp3-128k',
    label: 'Audio MP3',
    description: 'Balanced audio export for music, podcasts, and voice.',
    requires: 'audio',
    extractorFormat: 'bestaudio/best',
  },
  {
    id: 'video-mp4',
    outputFormat: 'mp4',
    qualityPreset: 'mp4-720p',
    label: 'Video MP4',
    description: 'Standard MP4 output for download and playback.',
    requires: 'video',
    extractorFormat: 'bestvideo+bestaudio/best',
  },
];

export function createAvailableOutputs({ audioOnlySupported, videoSupported }) {
  return SMART_OUTPUTS.filter((option) => {
    if (option.requires === 'audio') {
      return audioOnlySupported;
    }
    return videoSupported;
  });
}

export function getDefaultOutput(availableOutputs) {
  return availableOutputs.find((option) => option.outputFormat === 'mp4') || availableOutputs[0] || null;
}

export function getOutputBySelection(availableOutputs, outputFormat, qualityPreset) {
  return availableOutputs.find((option) =>
    option.outputFormat === outputFormat && option.qualityPreset === qualityPreset);
}
