import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { throwBadRequest, throwNotFound } from '../../../shared/utils/throw-exceptions';

export interface HeldCartItemInput {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface HoldCartInput {
  storeId: string;
  items: HeldCartItemInput[];
}

export interface HeldCartDto {
  id: string;
  storeId: string;
  items: HeldCartItemInput[];
  subtotal: number;
  total: number;
  heldAt: string;
}

export interface RetrieveHeldCartResult {
  items: HeldCartItemInput[];
  subtotal: number;
  total: number;
}

@Injectable()
export class PosHeldCartsService {
  constructor(private readonly prisma: PrismaService) {}

  async holdCart(input: HoldCartInput): Promise<HeldCartDto> {
    const { storeId, items } = input;
    if (!storeId?.trim()) {
      throwBadRequest('POS_HELD_CART_STORE_REQUIRED', 'storeId is required');
    }
    if (!items?.length) {
      throwBadRequest('POS_HELD_CART_ITEMS_EMPTY', 'items must not be empty');
    }

    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const total = subtotal; // 掛單不套促銷，以原始小計為 total

    const created = await this.prisma.posHeldCart.create({
      data: {
        storeId: storeId.trim(),
        itemsJson: JSON.stringify(
          items.map((i) => ({
            productId: i.productId,
            name: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
          })),
        ),
        subtotal,
        total,
      },
    });

    const parsed = JSON.parse(created.itemsJson) as HeldCartItemInput[];
    return {
      id: created.id,
      storeId: created.storeId,
      items: parsed,
      subtotal: Number(created.subtotal),
      total: Number(created.total),
      heldAt: created.heldAt.toISOString(),
    };
  }

  async listHeldCarts(storeId: string): Promise<HeldCartDto[]> {
    if (!storeId?.trim()) {
      return [];
    }

    const rows = await this.prisma.posHeldCart.findMany({
      where: { storeId: storeId.trim() },
      orderBy: { heldAt: 'desc' },
    });

    return rows.map((r) => {
      const parsed = JSON.parse(r.itemsJson) as HeldCartItemInput[];
      return {
        id: r.id,
        storeId: r.storeId,
        items: parsed,
        subtotal: Number(r.subtotal),
        total: Number(r.total),
        heldAt: r.heldAt.toISOString(),
      };
    });
  }

  async retrieveAndDelete(id: string): Promise<RetrieveHeldCartResult> {
    const row = await this.prisma.posHeldCart.findUnique({
      where: { id },
    });
    if (!row) {
      throwNotFound('POS_HELD_CART_NOT_FOUND', 'Held cart not found');
    }

    const items = JSON.parse(row.itemsJson) as HeldCartItemInput[];
    const subtotal = Number(row.subtotal);
    const total = Number(row.total);

    await this.prisma.posHeldCart.delete({
      where: { id },
    });

    return { items, subtotal, total };
  }
}
