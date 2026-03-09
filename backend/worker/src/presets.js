export const PRESET_MAP = {
  'mp3-128k': {
    outputExtension: 'mp3',
    args: ['-vn', '-b:a', '128k'],
  },
  'mp3-320k': {
    outputExtension: 'mp3',
    args: ['-vn', '-b:a', '320k'],
  },
  'mp4-360p': {
    outputExtension: 'mp4',
    args: ['-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'],
  },
  'mp4-720p': {
    outputExtension: 'mp4',
    args: ['-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k'],
  },
};

export function getPreset(name) {
  return PRESET_MAP[name];
}

