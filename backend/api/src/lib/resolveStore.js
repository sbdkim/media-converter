import { randomUUID } from 'node:crypto';

export function createInMemoryResolveStore({ ttlMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const entries = new Map();

  function prune() {
    const current = now();
    for (const [token, entry] of entries.entries()) {
      if (entry.expiresAt <= current) {
        entries.delete(token);
      }
    }
  }

  return {
    async create(payload) {
      prune();
      const token = `resolve_${randomUUID()}`;
      entries.set(token, {
        token,
        payload,
        expiresAt: now() + ttlMs,
      });
      return token;
    },
    async get(token) {
      prune();
      const entry = entries.get(token);
      return entry ? entry.payload : null;
    },
    async consume(token) {
      prune();
      const entry = entries.get(token);
      if (!entry) {
        return null;
      }
      entries.delete(token);
      return entry.payload;
    },
  };
}
