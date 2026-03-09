import Fastify from 'fastify';
import cors from '@fastify/cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { processJob } from './processor.js';

const execFileAsync = promisify(execFile);
const app = Fastify({ logger: false });

await app.register(cors, { origin: true });

app.get('/health', async () => ({ ok: true }));

app.post('/tasks/process', async (request, reply) => {
  const job = request.body;

  if (!job?.jobId || !job?.sourceUrl || !job?.qualityPreset) {
    return reply.code(400).send({
      errorCode: 'INVALID_REQUEST',
      errorMessage: 'jobId, sourceUrl, and qualityPreset are required.',
    });
  }

  const result = await processJob(job, {
    downloader: {
      async download(sourceUrl, destinationPath) {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          throw new Error('Failed to download source media.');
        }
        const arrayBuffer = await response.arrayBuffer();
        await writeFile(destinationPath, Buffer.from(arrayBuffer));
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
  });

  return reply.send(result);
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  console.error(error);
  process.exit(1);
});

