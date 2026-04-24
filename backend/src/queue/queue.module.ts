import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BotProcessor } from './bot.processor';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'bot-queue' }),
    SessionsModule,
  ],
  providers: [BotProcessor],
})
export class QueueModule {}
