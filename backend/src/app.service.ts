import { Injectable } from '@nestjs/common';
import { PrismaService } from './shared/database/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    const gitSha =
      process.env.GIT_SHA?.trim() ||
      process.env.GITHUB_SHA?.trim() ||
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      null;
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      db: { ok: dbOk },
      gitSha: gitSha || undefined,
    };
  }
}

