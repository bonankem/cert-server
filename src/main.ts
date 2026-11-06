import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  // Signatures are sent as data URLs; everything else is tiny.
  app.useBodyParser('json', { limit: '2mb' });
  app.use(helmet());
  app.use(cookieParser());

  if (config.get('TRUST_PROXY', { infer: true })) app.set('trust proxy', 1);

  const corsOrigin = config.get('CORS_ORIGIN', { infer: true });
  if (corsOrigin) app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // …and reject requests that send them
      transform: true, // apply DTO defaults and type conversion
    }),
  );

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

await bootstrap();
