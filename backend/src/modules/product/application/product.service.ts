import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductRepository } from '../infrastructure/product.repository';

interface CreateProductInput {
  sku: string;
  name: string;
}

interface UpdateProductInput {
  sku?: string;
  name?: string;
}

@Injectable()
export class ProductService {
  constructor(private readonly repo: ProductRepository) {}

  listProducts(filter?: { search?: string; sku?: string; categoryId?: string }) {
    return this.repo.findAll(filter);
  }

  async getProduct(id: string) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  createProduct(input: CreateProductInput) {
    return this.repo.create(input);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    await this.getProduct(id);
    return this.repo.update(id, input);
  }

  async deleteProduct(id: string) {
    await this.getProduct(id);
    await this.repo.delete(id);
    return { success: true };
  }
}

