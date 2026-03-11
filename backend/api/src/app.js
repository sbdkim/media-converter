import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';
import { createYtDlpEngine } from './lib/extractorEngine.js';
import { createExtractorRegistry } from './lib/extractorRegistry.js';
import { createInlineJobRunner } from './lib/inlineJobRunner.js';
import { createJobQueue } from './lib/jobQueue.js';
import { isValidPreset } from './lib/presets.js';
import { createRemoteMediaInspector } from './lib/remoteMediaInspector.js';
import { createInMemoryResolveStore } from './lib/resolveStore.js';
import { getOutputBySelection } from './lib/outputOptions.js';
import { createSourceResolver } from './lib/sourceResolver.js';
import { parseAndValidateSourceUrl } from './lib/urlPolicy.js';
import { createInMemoryJobStore } from './store/inMemoryJobStore.js';

export async function createApp(overrides = {}) {
  const config = overrides.config || getConfig();
  const app = Fastify({ logger: false });
  const jobStore = overrides.jobStore || createInMemoryJobStore();
  const inspector = overrides.inspector || createRemoteMediaInspector({ maxSourceSizeMb: config.maxSourceSizeMb });
  const resolveStore = overrides.resolveStore || createInMemoryResolveStore();
  const extractorEngine = overrides.extractorEngine || createYtDlpEngine();
  const extractorRegistry = overrides.extractorRegistry || createExtractorRegistry({ engine: extractorEngine });
  const sourceResolver = overrides.sourceResolver || createSourceResolver({ inspector, extractorRegistry });
  const now = overrides.now || (() => new Date().toISOString());
  const clock = overrides.clock || (() => new Date(now()));
  const jobRunner = overrides.jobRunner || createInlineJobRunner({
    jobStore,
    extractorRegistry,
    now: clock,
  });
  const queue = overrides.queue || createJobQueue({ jobRunner });

  await app.register(cors, {
    origin: config.frontendOrigin,
  });

  await app.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({ ok: true }));

  app.post('/api/resolve', async (request, reply) => {
    const { sourceUrl } = request.body || {};
    if (!sourceUrl) {
      return reply.code(400).send({
        errorCode: 'INVALID_REQUEST',
        errorMessage: 'sourceUrl is required.',
      });
    }

    const urlCheck = parseAndValidateSourceUrl(sourceUrl, config.allowedSourceDomains);
    if (!urlCheck.ok) {
      return reply.code(400).send(urlCheck);
    }

    try {
      const resolved = await sourceResolver.resolve(urlCheck);
      const resolveToken = await resolveStore.create(resolved);

      return reply.send({
        platform: resolved.platform,
        sourceType: resolved.sourceType,
        canonicalUrl: resolved.canonicalUrl,
        title: resolved.title,
        thumbnailUrl: resolved.thumbnailUrl,
        durationSeconds: resolved.durationSeconds,
        audioOnlySupported: resolved.audioOnlySupported,
        videoSupported: resolved.videoSupported,
        availableOutputs: resolved.availableOutputs,
        defaultOutput: resolved.defaultOutput,
        resolveToken,
      });
    } catch (error) {
      return reply.code(400).send({
        errorCode: error.errorCode || 'SOURCE_REJECTED',
        errorMessage: error.message || 'The source media could not be resolved.',
      });
    }
  });

  app.post('/api/jobs', async (request, reply) => {
    const { sourceUrl, resolveToken, outputFormat, qualityPreset } = request.body || {};

    if ((!sourceUrl && !resolveToken) || !outputFormat || !qualityPreset) {
      return reply.code(400).send({
        errorCode: 'INVALID_REQUEST',
        errorMessage: 'resolveToken or sourceUrl, plus outputFormat and qualityPreset, are required.',
      });
    }

    if (!['mp3', 'mp4'].includes(outputFormat) || !isValidPreset(outputFormat, qualityPreset)) {
      return reply.code(400).send({
        errorCode: 'INVALID_PRESET',
        errorMessage: 'The selected preset is not valid for the requested output format.',
      });
    }

    try {
      let resolved;
      let urlCheck;
      if (resolveToken) {
        resolved = await resolveStore.consume(resolveToken);
        if (!resolved) {
          return reply.code(400).send({
            errorCode: 'RESOLVE_TOKEN_EXPIRED',
            errorMessage: 'Resolve details expired. Resolve the source again before submitting.',
          });
        }
      } else {
        urlCheck = parseAndValidateSourceUrl(sourceUrl, config.allowedSourceDomains);
        if (!urlCheck.ok) {
          return reply.code(400).send(urlCheck);
        }
        resolved = await sourceResolver.resolve(urlCheck);
      }

      const selectedOutput = getOutputBySelection(resolved.availableOutputs, outputFormat, qualityPreset);
      if (!selectedOutput) {
        return reply.code(400).send({
          errorCode: 'INVALID_OUTPUT_SELECTION',
          errorMessage: 'The selected output is not available for this source.',
        });
      }

      const jobId = `job_${randomUUID()}`;
      const timestamp = now();

      const job = {
        jobId,
        sourceUrl: resolved.canonicalUrl,
        sourceDomain: new URL(resolved.canonicalUrl).hostname.toLowerCase(),
        sourceType: resolved.sourceType,
        platform: resolved.platform,
        title: resolved.title,
        thumbnailUrl: resolved.thumbnailUrl,
        outputFormat,
        qualityPreset,
        selectedOutput,
        resolvedSource: resolved.sourceRef,
        status: 'queued',
        progress: 0,
        storagePath: '',
        downloadExpiresAt: '',
        errorCode: '',
        errorMessage: '',
        createdAt: timestamp,
        updatedAt: timestamp,
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
      platform: job.platform,
      sourceType: job.sourceType,
      title: job.title,
      thumbnailUrl: job.thumbnailUrl,
      selectedOutput: job.selectedOutput,
      outputFormat: job.outputFormat,
      qualityPreset: job.qualityPreset,
      downloadUrl: job.downloadUrl,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
    });
  });

  return app;
}
