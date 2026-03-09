export function createInMemoryJobStore() {
  const jobs = new Map();

  return {
    async create(job) {
      jobs.set(job.jobId, job);
      return job;
    },
    async get(jobId) {
      return jobs.get(jobId) || null;
    },
    async update(jobId, patch) {
      const existing = jobs.get(jobId);
      if (!existing) {
        return null;
      }
      const updated = { ...existing, ...patch };
      jobs.set(jobId, updated);
      return updated;
    },
  };
}

