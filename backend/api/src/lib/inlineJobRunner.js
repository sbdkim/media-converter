import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { processJob } from '../../../worker/src/processor.js';

const execFileAsync = promisify(execFile);

export function createInlineJobRunner({ jobStore, extractorRegistry, now = () => new Date() }) {
  return {
    async start(job) {
      queueMicrotask(async () => {
        await jobStore.update(job.jobId, {
          status: 'processing',
          progress: 20,
          updatedAt: now().toISOString(),
        });

        const result = await processJob(job, {
          downloader: {
            async download(jobInput, destinationPath) {
              if (jobInput.sourceType === 'resolved-page') {
                const adapter = extractorRegistry.getAdapter(new URL(jobInput.sourceUrl));
                if (!adapter) {
                  throw Object.assign(new Error('This platform is not supported yet.'), {
                    errorCode: 'UNSUPPORTED_PLATFORM',
                  });
                }
                await adapter.download(jobInput.resolvedSource, destinationPath, jobInput.selectedOutput);
                return;
              }

              const response = await fetch(jobInput.sourceUrl);
              if (!response.ok) {
                throw Object.assign(new Error('Failed to download source media.'), {
                  errorCode: 'SOURCE_UNREACHABLE',
                });
              }
              const buffer = Buffer.from(await response.arrayBuffer());
              await writeFile(destinationPath, buffer);
            },
          },
          storage: {
            async upload() {
              return;
            },
          },
          signer: {
            async sign(storagePath) {
              return `https://downloads.example.com/${storagePath}`;
            },
          },
          runCommand: async (command, args) => {
            await execFileAsync(command, args);
          },
          clock: now,
        });

        await jobStore.update(job.jobId, {
          ...result,
          updatedAt: now().toISOString(),
        });
      });

      return { taskId: `inline_${job.jobId}` };
    },
  };
}
