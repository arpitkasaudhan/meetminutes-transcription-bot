import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
// .env lives at repo root (one level above backend/)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function fixRedis() {
  try {
    const Redis = require('ioredis');
    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 3,
    });
    await client.config('SET', 'stop-writes-on-bgsave-error', 'no');
    await client.config('SET', 'save', '');
    await client.quit();
    console.log('Redis: disk-write errors disabled');
  } catch {}
}

async function bootstrap() {
  await fixRedis();

  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: '*', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend running on port ${port}`);
}
bootstrap();
