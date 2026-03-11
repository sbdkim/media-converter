import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildFfmpegArgs } from './ffmpegPlan.js';
import { getPreset } from './presets.js';

export async function processJob(job, dependencies) {
  const {
    downloader,
    storage,
    signer,
    runCommand,
    clock = () => new Date(),
    ttlMinutes = 30,
  } = dependencies;

  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'authorized-media-'));

  try {
    const preset = getPreset(job.qualityPreset);
    if (!preset) {
      throw Object.assign(new Error('Unsupported quality preset.'), { errorCode: 'INVALID_PRESET' });
    }

    const inputPath = path.join(tempDirectory, `input-${randomUUID()}`);
    const outputPath = path.join(tempDirectory, `output.${preset.outputExtension}`);

    await downloader.download(job, inputPath);
    await runCommand('ffmpeg', buildFfmpegArgs({
      inputPath,
      outputPath,
      qualityPreset: job.qualityPreset,
    }));

    const storagePath = `outputs/${job.jobId}/result.${preset.outputExtension}`;
    await storage.upload(outputPath, storagePath);

    const downloadExpiresAt = new Date(clock().getTime() + ttlMinutes * 60 * 1000).toISOString();
    const downloadUrl = await signer.sign(storagePath, downloadExpiresAt);

    return {
      status: 'completed',
      progress: 100,
      storagePath,
      downloadUrl,
      downloadExpiresAt,
      errorCode: '',
      errorMessage: '',
    };
  } catch (error) {
    return {
      status: 'failed',
      progress: 100,
      errorCode: error.errorCode || 'PROCESSING_FAILED',
      errorMessage: error.message || 'Media processing failed.',
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
