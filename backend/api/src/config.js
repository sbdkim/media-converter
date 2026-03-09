function splitCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    frontendOrigin: env.FRONTEND_ORIGIN || '*',
    allowedSourceDomains: splitCsv(env.ALLOWED_SOURCE_DOMAINS),
    maxSourceSizeMb: Number(env.MAX_SOURCE_SIZE_MB || 250),
    signedUrlTtlMinutes: Number(env.SIGNED_URL_TTL_MINUTES || 30),
    useInMemoryStore: env.USE_IN_MEMORY_STORE !== 'false',
  };
}

