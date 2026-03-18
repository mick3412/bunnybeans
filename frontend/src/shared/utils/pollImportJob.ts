import type { ImportJobDto } from '../../modules/admin/adminApi';

export async function pollImportJob(params: {
  jobId: string;
  getImportJob: (id: string) => Promise<ImportJobDto | { statusCode: number; message?: string; code?: string }>;
  onStatus: (job: ImportJobDto) => void;
  onError: (message: string) => void;
  intervalMs?: number;
  maxTries?: number;
}): Promise<void> {
  const intervalMs = params.intervalMs ?? 500;
  const maxTries = params.maxTries ?? 120;
  for (let i = 0; i < maxTries; i++) {
    const j = await params.getImportJob(params.jobId);
    if (j && typeof j === 'object' && 'statusCode' in j) {
      params.onError((j as { message?: string }).message ?? 'job error');
      return;
    }
    const job = j as ImportJobDto;
    params.onStatus(job);
    if (job.status === 'done') return;
    if (job.status === 'failed') {
      params.onError(job.error ?? 'job failed');
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  params.onError('輪詢逾時');
}

