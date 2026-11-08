import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../errors.js';
import { getJob, type JobRow } from '../jobs.js';

export const toJob = (j: JobRow) => ({
  id: j.id,
  type: j.type,
  status: j.status,
  progress: { done: j.progress_done, total: j.progress_total },
  result: j.result ?? null,
  error: j.error,
  createdAt: j.created_at,
  finishedAt: j.finished_at,
});

export async function jobRoutes(app: FastifyInstance) {
  app.get<{ Params: { jobId: string } }>('/jobs/:jobId', async (req) => {
    const jobId = z.string().uuid().parse(req.params.jobId);
    const job = await getJob(jobId);
    if (!job) throw notFound('JOB_NOT_FOUND', 'Job not found');
    return { data: toJob(job) };
  });
}
