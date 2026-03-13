import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ProductRepository } from '../infrastructure/product.repository';

interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

function decToStr(v: Decimal | null | undefined): string | null {
  if (v == null) return null;
  return v.toFixed(2);
}

function toProductResponse(p: {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  specSize: string | null;
  specColor: string | null;
  weightGrams: number | null;
  listPrice: Decimal;
  salePrice: Decimal;
  costPrice: Decimal | null;
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
    description: p.description,
    specSize: p.specSize,
    specColor: p.specColor,
    weightGrams: p.weightGrams,
    listPrice: decToStr(p.listPrice) ?? '0.00',
    salePrice: decToStr(p.salePrice) ?? '0.00',
    costPrice: decToStr(p.costPrice),
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
