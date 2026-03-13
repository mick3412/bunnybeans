import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const traceIdHeader = 'x-trace-id';

export interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
  code?: string;
  traceId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId =
      (request.headers[traceIdHeader] as string) ??
      (request as Request & { traceId?: string }).traceId;

    let statusCode: number;
    let message: string;
    let error: string;
    let code: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const body = payload as Record<string, unknown>;
        message = (body.message as string) ?? exception.message;
        error = (body.error as string) ?? 'Http Exception';
        code = body.code as string | undefined;
      } else {
        message = exception.message;
        error = 'Http Exception';
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      traceId,
    };
    if (code) body.code = code;

    response.status(statusCode).json(body);
  }
}
