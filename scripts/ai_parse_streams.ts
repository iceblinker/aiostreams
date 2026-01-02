import { Cache, createLogger, Env } from '../packages/core/src/index.js';
import { ParsedStream } from '../packages/core/src/db/schemas.js';

const logger = createLogger('ai-parser');

async function main() {
  logger.info('Starting AI Stream Parsing script...');

  const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
  const MODEL = 'llama3.1'; // Use a capable model

  // Initialize the streams cache
  // Note: We access the 'streams' cache instance used by the core application
  const streamsCache = Cache.getInstance<string, ParsedStream[]>('streams');

  logger.info('Connecting to cache...');
  await streamsCache.waitUntilReady();

  logger.info('Fetching keys...');
  const keys = await streamsCache.keys('*');
  logger.info(`Found ${keys.length} cached stream keys.`);

  let totalUpdated = 0;

  for (const key of keys) {
    const streams = await streamsCache.get(key);
    if (!streams || streams.length === 0) continue;

    let updated = false;
    const updatedStreams = await Promise.all(
      streams.map(async (stream) => {
        // Condition to trigger AI parsing:
        // 1. Resolution is 'unknown' AND
        // 2. Filename exists
        if (
          stream.parsedFile?.resolution === 'unknown' &&
          stream.filename &&
          stream.filename.length > 5 && // basic sanity check
          !stream.filename.includes('Parsed by AI') // avoid loop
        ) {
          logger.info(`Parsing stream: ${stream.filename}`);

          try {
            const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: MODEL,
                prompt: `Identify the resolution (e.g. 4k, 1080p, 720p, 480p) from this filename. Return ONLY the resolution string, nothing else. If unknown, return "unknown".
Filename: ${stream.filename}`,
                stream: false,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const resolution = data.response.trim().toLowerCase();

              if (resolution !== 'unknown' && resolution.length < 10) {
                 // Valid resolution update
                 logger.info(`AI identified resolution: ${resolution}`);
                 if (stream.parsedFile) {
                    stream.parsedFile.resolution = resolution;
                 } else {
                    stream.parsedFile = { resolution } as any; // Partial initialization if missing
                 }
                 // Add a marker to filename or elsewhere to avoid re-parsing if we can't rely on resolution change
                 // But we check resolution === 'unknown', so if we change it, it won't be unknown anymore.
                 
                 updated = true;
                 totalUpdated++;
              }
            } else {
               logger.error(`Ollama error: ${response.statusText}`);
            }
          } catch (error) {
            logger.error(`Failed to connect to Ollama: ${error}`);
          }
        }
        return stream;
      })
    );

    if (updated) {
        // Determine TTL - we can't easily get the original TTL without extra calls,
        // but for now we can default to a reasonable value or try to read it.
        // Cache.update() keeps the TTL!
        await streamsCache.update(key, updatedStreams);
    }
  }

  logger.info(`Finished. Updated ${totalUpdated} streams.`);
  process.exit(0);
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
