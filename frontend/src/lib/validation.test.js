import test from 'node:test';
import assert from 'node:assert/strict';
import { getPresetOptions, validateSourceUrl } from './validation.js';

test('validateSourceUrl accepts direct media URLs', () => {
  assert.deepEqual(validateSourceUrl('https://media.example.com/demo.mp4'), {
    valid: true,
    normalizedUrl: 'https://media.example.com/demo.mp4',
  });
});

test('validateSourceUrl rejects third-party watch page hosts', () => {
  assert.equal(validateSourceUrl('https://www.youtube.com/watch?v=abc').valid, true);
});

test('validateSourceUrl rejects non-media paths', () => {
  assert.match(validateSourceUrl('https://media.example.com/watch').error, /direct media file URL or a supported/i);
});

test('getPresetOptions returns audio presets for mp3', () => {
  assert.deepEqual(getPresetOptions('mp3').map((option) => option.value), ['mp3-128k', 'mp3-320k']);
});

test('getPresetOptions returns video presets for mp4', () => {
  assert.deepEqual(getPresetOptions('mp4').map((option) => option.value), ['mp4-360p', 'mp4-720p']);
});
