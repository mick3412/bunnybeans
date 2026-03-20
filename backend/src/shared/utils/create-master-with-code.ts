import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveCode } from './canonical-code';

export interface CreateMasterWithCodeOptions<TExtra, TResult = unknown> {
  /** Resolve code from input; name required. */
  name: string;
  code?: string;
  /** Fetch existing codes for deduplication. */
  findExistingCodes: () => Promise<string[]>;
  /** Create entity with resolved code. */
  create: (data: { code: string; name: string } & TExtra) => Promise<TResult>;
  /** Extra fields to pass to create (e.g. merchantId for ProductTag). */
  extra?: TExtra;
  conflictCode: string;
  conflictMessage: string;
  nameRequiredCode?: string;
  codeInvalidCode?: string;
}

/**
 * 共用邏輯：resolveCode + create + P2002 衝突處理。
 * Category / Brand / ProductTag create 呼叫此函數。
 */
export async function createMasterWithCode<TExtra extends Record<string, unknown>, TResult>(
  options: CreateMasterWithCodeOptions<TExtra, TResult>,
): Promise<TResult> {
  const name = options.name?.trim();
  if (!name) {
    throw new BadRequestException({
      message: 'name is required',
      code: options.nameRequiredCode ?? 'NAME_REQUIRED',
    });
  }
  let code: string;
  try {
    const existing = await options.findExistingCodes();
    const resolved = resolveCode(options.code, name, existing);
    code = resolved.code;
  } catch (e) {
    if ((e as Error).message === 'CODE_INVALID') {
      throw new BadRequestException({
        message: 'code must match a-z0-9- (lowercase, no leading/trailing dash)',
        code: options.codeInvalidCode ?? 'CODE_INVALID',
      });
    }
    throw e;
  }
  try {
    const data = { code, name, ...(options.extra ?? {}) } as { code: string; name: string } & TExtra;
    return await options.create(data);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException({
        message: options.conflictMessage,
        code: options.conflictCode,
      });
    }
    throw e;
  }
}
