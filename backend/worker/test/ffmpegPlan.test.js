import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFfmpegArgs } from '../src/ffmpegPlan.js';

test('buildFfmpegArgs builds mp3 args', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/output.mp3',
    qualityPreset: 'mp3-128k',
  });

  assert.deepEqual(args, ['-y', '-i', '/tmp/input.mp4', '-vn', '-b:a', '128k', '/tmp/output.mp3']);
});

test('buildFfmpegArgs builds mp4 args', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/output.mp4',
    qualityPreset: 'mp4-720p',
  });

  assert.equal(args.includes('scale=-2:720'), true);
});

