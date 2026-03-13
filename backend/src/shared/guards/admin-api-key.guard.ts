import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const HEADER_KEYS = ['x-admin-key', 'x-api-key'];

/**
 * 若環境變數 ADMIN_API_KEY 未設定：不擋（與 Phase A 相容，CI／E2E 不需帶 key）。
 * 若已設定：POST/PATCH/DELETE 等受保護路由須帶相同值於 X-Admin-Key 或 X-Api-Key。
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY')?.trim();
    if (!expected) return true;

    const req = context.switchToHttp().getRequest<Request>();
    let provided: string | undefined;
    for (const h of HEADER_KEYS) {
      const v = req.headers[h];
      if (typeof v === 'string' && v.trim()) {
        provided = v.trim();
        break;
      }
    }
    if (!provided && req.headers.authorization?.startsWith('Bearer ')) {
      provided = req.headers.authorization.slice(7).trim();
    }
    if (provided !== expected) {
      throw new UnauthorizedException({
        message: 'Admin API key required or invalid',
        code: 'ADMIN_API_KEY_REQUIRED',
      });
    }
    return true;
  }
}
