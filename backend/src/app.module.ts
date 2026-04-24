import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SessionsModule } from './sessions/sessions.module';
import { GatewayModule } from './gateway/gateway.module';
import { QueueModule } from './queue/queue.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    SessionsModule,
    GatewayModule,
    QueueModule,
    TranscriptionModule,
    HealthModule,
  ],
})
export class AppModule {}
