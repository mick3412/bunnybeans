import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductRepository } from '../infrastructure/product.repository';

interface CreateProductInput {
  sku: string;
  name: string;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

interface UpdateProductInput {
  sku?: string;
  name?: string;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

function toProductResponse(p: {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  tags: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const tags = Array.isArray(p.tags)
    ? (p.tags as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    brandId: p.brandId,
    tags,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProductService {
  constructor(private readonly repo: ProductRepository) {}

  async listProducts(filter?: {
    search?: string;
    sku?: string;
    categoryId?: string;
    brandId?: string;
    tag?: string;
  }) {
    const rows = await this.repo.findAll(filter);
    return rows.map(toProductResponse);
  }

  async getProduct(id: string) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return toProductResponse(product);
  }

  async createProduct(input: CreateProductInput) {
    const p = await this.repo.create(input);
    return toProductResponse(p);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    await this.getProduct(id);
    const p = await this.repo.update(id, input);
    return toProductResponse(p);
  }

  async deleteProduct(id: string) {
    await this.getProduct(id);
    await this.repo.delete(id);
    return { success: true };
  }
}
