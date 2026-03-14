import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ProductService } from '../../product/application/product.service';
import { InventoryService } from '../../inventory/application/inventory.service';

export type ImportJobKind = 'products_csv' | 'inventory_csv';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly inventoryService: InventoryService,
  ) {}

  async createJob(kind: ImportJobKind, file: Buffer): Promise<{ jobId: string }> {
    const job = await this.prisma.bulkImportJob.create({
      data: {
        kind,
        status: 'pending',
      },
    });
    setImmediate(() => this.runJob(job.id, kind, file).catch(() => {}));
    return { jobId: job.id };
  }

  private async runJob(id: string, kind: ImportJobKind, file: Buffer) {
    await this.prisma.bulkImportJob.update({
      where: { id },
      data: { status: 'running' },
    });
    try {
      let result: object;
      if (kind === 'products_csv') {
        result = await this.productService.importFromCsvBuffer(file);
      } else {
        result = await this.inventoryService.importEventsFromCsvBuffer(file);
      }
      await this.prisma.bulkImportJob.update({
        where: { id },
        data: {
          status: 'done',
          resultJson: JSON.stringify(result),
        },
      });
    } catch (e) {
      await this.prisma.bulkImportJob.update({
        where: { id },
        data: {
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }

  async getJob(id: string) {
    const job = await this.prisma.bulkImportJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException({
        message: 'job not found',
        code: 'IMPORT_JOB_NOT_FOUND',
      });
    }
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      result:
        job.resultJson != null
          ? (JSON.parse(job.resultJson) as object)
          : null,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
