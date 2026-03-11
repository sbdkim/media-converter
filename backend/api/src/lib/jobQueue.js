export function createJobQueue({ jobRunner } = {}) {
  return {
    async enqueue(job) {
      if (jobRunner?.start) {
        return jobRunner.start(job);
      }

      return {
        taskId: `task_${job.jobId}`,
      };
    },
  };
}
