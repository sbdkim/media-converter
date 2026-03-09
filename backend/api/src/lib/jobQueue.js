export function createJobQueue() {
  return {
    async enqueue(job) {
      return {
        taskId: `task_${job.jobId}`,
      };
    },
  };
}

