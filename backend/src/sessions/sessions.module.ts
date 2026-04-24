import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'bot-queue' })],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
