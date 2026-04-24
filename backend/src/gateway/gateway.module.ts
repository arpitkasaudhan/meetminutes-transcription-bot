import { Module } from '@nestjs/common';
import { TranscriptionGateway } from './transcription.gateway';
import { TranscriptionModule } from '../transcription/transcription.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [TranscriptionModule, SessionsModule],
  providers: [TranscriptionGateway],
  exports: [TranscriptionGateway],
})
export class GatewayModule {}
