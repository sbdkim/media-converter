import { describe, expect, it } from 'vitest';
import { getPresetOptions, validateSourceUrl } from './validation.js';

describe('validateSourceUrl', () => {
  it('accepts direct media URLs', () => {
    expect(validateSourceUrl('https://media.example.com/demo.mp4')).toEqual({
      valid: true,
      normalizedUrl: 'https://media.example.com/demo.mp4',
    });
  });

  it('rejects third-party watch page hosts', () => {
    expect(validateSourceUrl('https://www.youtube.com/watch?v=abc').valid).toBe(false);
  });

  it('rejects non-media paths', () => {
    expect(validateSourceUrl('https://media.example.com/watch').error).toContain('direct media file');
  });
});

describe('getPresetOptions', () => {
  it('returns audio presets for mp3', () => {
    expect(getPresetOptions('mp3').map((option) => option.value)).toEqual(['mp3-128k', 'mp3-320k']);
  });

  it('returns video presets for mp4', () => {
    expect(getPresetOptions('mp4').map((option) => option.value)).toEqual(['mp4-360p', 'mp4-720p']);
  });
});

