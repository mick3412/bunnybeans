import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { randomUUID } from 'crypto';

const TRACE_ID_HEADER = 'x-trace-id';

function requestLogger(
  req: { headers: Record<string, string | string[] | undefined>; path: string; method: string; traceId?: string },
  res: { setHeader: (name: string, value: string) => void; statusCode: number; on: (event: string, fn: () => void) => void },
  next: () => void,
) {
  const traceId = (req.headers[TRACE_ID_HEADER] as string) || randomUUID();
  req.traceId = traceId;
  res.setHeader(TRACE_ID_HEADER, traceId);
  const start = Date.now();
  res.on('finish', () => {
    const module = req.path.split('/').filter(Boolean)[0] || 'app';
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        traceId,
        module,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      }),
    );
  });
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? Number(process.env.PORT) : 3003;
  app.enableCors();
  app.use(requestLogger);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
}

bootstrap();


