import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parseJson(stdout, fallbackCode) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw Object.assign(new Error('Extractor returned invalid metadata.'), {
      errorCode: fallbackCode,
    });
  }
}

export function createYtDlpEngine({ binary = 'yt-dlp', exec = execFileAsync } = {}) {
  return {
    async resolve(url) {
      try {
        const { stdout } = await exec(binary, [
          '--dump-single-json',
          '--no-playlist',
          url,
        ]);
        return parseJson(stdout, 'EXTRACTION_FAILED');
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw Object.assign(new Error('yt-dlp is not installed on the server.'), {
            errorCode: 'EXTRACTOR_UNAVAILABLE',
          });
        }

        throw Object.assign(new Error(error.stderr || error.message || 'Unable to extract page metadata.'), {
          errorCode: error.errorCode || 'EXTRACTION_FAILED',
        });
      }
    },
    async download(url, destinationPath, formatSelector) {
      try {
        await exec(binary, [
          '--no-playlist',
          '-f',
          formatSelector,
          '-o',
          destinationPath,
          url,
        ]);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw Object.assign(new Error('yt-dlp is not installed on the server.'), {
            errorCode: 'EXTRACTOR_UNAVAILABLE',
          });
        }

        throw Object.assign(new Error(error.stderr || error.message || 'Unable to download extracted media.'), {
          errorCode: error.errorCode || 'EXTRACTION_DOWNLOAD_FAILED',
        });
      }
    },
  };
}
