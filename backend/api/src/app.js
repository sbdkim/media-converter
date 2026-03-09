import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';
import { createJobQueue } from './lib/jobQueue.js';
import { isValidPreset } from './lib/presets.js';
import { createRemoteMediaInspector } from './lib/remoteMediaInspector.js';
import { parseAndValidateSourceUrl } from './lib/urlPolicy.js';
import { createInMemoryJobStore } from './store/inMemoryJobStore.js';

export async function createApp(overrides = {}) {
  const config = overrides.config || getConfig();
  const app = Fastify({ logger: false });
  const jobStore = overrides.jobStore || createInMemoryJobStore();
  const queue = overrides.queue || createJobQueue();
  const inspector = overrides.inspector || createRemoteMediaInspector({ maxSourceSizeMb: config.maxSourceSizeMb });
  const now = overrides.now || (() => new Date().toISOString());

  await app.register(cors, {
    origin: config.frontendOrigin,
  });

  await app.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({ ok: true }));

  app.post('/api/jobs', async (request, reply) => {
    const { sourceUrl, outputFormat, qualityPreset } = request.body || {};

    if (!sourceUrl || !outputFormat || !qualityPreset) {
      return reply.code(400).send({
        errorCode: 'INVALID_REQUEST',
        errorMessage: 'sourceUrl, outputFormat, and qualityPreset are required.',
      });
    }

    if (!['mp3', 'mp4'].includes(outputFormat) || !isValidPreset(outputFormat, qualityPreset)) {
      return reply.code(400).send({
        errorCode: 'INVALID_PRESET',
        errorMessage: 'The selected preset is not valid for the requested output format.',
      });
    }

    const urlCheck = parseAndValidateSourceUrl(sourceUrl, config.allowedSourceDomains);
    if (!urlCheck.ok) {
      return reply.code(400).send(urlCheck);
    }

    try {
      const inspection = await inspector.inspect(urlCheck.normalizedUrl);
      const jobId = `job_${randomUUID()}`;
      const timestamp = now();

      const job = {
        jobId,
        sourceUrl: urlCheck.normalizedUrl,
        sourceDomain: urlCheck.sourceDomain,
        outputFormat,
        qualityPreset,
        status: 'queued',
        progress: 0,
        storagePath: '',
        downloadExpiresAt: '',
        errorCode: '',
        errorMessage: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        inspection,
      };

      await jobStore.create(job);
      await queue.enqueue(job);

      return reply.code(202).send({
        jobId,
        status: 'queued',
      });
    } catch (error) {
      return reply.code(400).send({
        errorCode: error.errorCode || 'SOURCE_REJECTED',
        errorMessage: error.message || 'The source media could not be validated.',
      });
    }
  });

  app.get('/api/jobs/:jobId', async (request, reply) => {
    const job = await jobStore.get(request.params.jobId);

    if (!job) {
      return reply.code(404).send({
        errorCode: 'JOB_NOT_FOUND',
        errorMessage: 'No job was found for the given identifier.',
      });
    }

    return reply.send({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      outputFormat: job.outputFormat,
      qualityPreset: job.qualityPreset,
      downloadUrl: job.downloadUrl,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
    });
  });

  return app;
}

