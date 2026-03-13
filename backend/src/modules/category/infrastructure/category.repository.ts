import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { code: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  create(data: { code: string; name: string }) {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: { code?: string; name?: string }) {
    return this.prisma.category.update({ where: { id }, data });
  }
}
