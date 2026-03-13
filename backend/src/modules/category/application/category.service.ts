import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoryRepository } from '../infrastructure/category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  listCategories() {
    return this.repo.findAll();
  }

  async createCategory(input: { code: string; name: string }) {
    const code = input.code?.trim();
    const name = input.name?.trim();
    if (!code) {
      throw new BadRequestException({
        message: 'code is required',
        code: 'CATEGORY_CODE_REQUIRED',
      });
    }
    if (!name) {
      throw new BadRequestException({
        message: 'name is required',
        code: 'CATEGORY_NAME_REQUIRED',
      });
    }
    try {
      return await this.repo.create({ code, name });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Category code already exists',
          code: 'CATEGORY_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async updateCategory(
    id: string,
    input: { code?: string; name?: string },
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    const data: { code?: string; name?: string } = {};
    if (input.code !== undefined) {
      const c = input.code.trim();
      if (!c) {
        throw new BadRequestException({
          message: 'code cannot be empty',
          code: 'CATEGORY_CODE_REQUIRED',
        });
      }
      data.code = c;
    }
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throw new BadRequestException({
          message: 'name cannot be empty',
          code: 'CATEGORY_NAME_REQUIRED',
        });
      }
      data.name = n;
    }
    if (!Object.keys(data).length) {
      return existing;
    }
    try {
      return await this.repo.update(id, data);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Category code already exists',
          code: 'CATEGORY_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }
}
