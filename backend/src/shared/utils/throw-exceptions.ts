import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

/**
 * 錯誤工廠：對齊 backend-error-format { code, message }。
 * 供 controller / service 統一拋出可識別錯誤。
 */
export function throwBadRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

export function throwNotFound(code: string, message: string): never {
  throw new NotFoundException({ code, message });
}

export function throwConflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}
