import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TranscriptionService } from '../transcription/transcription.service';
import { SessionsService, SessionStatus } from '../sessions/sessions.service';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class TranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly sessionsService: SessionsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Frontend subscribes to a session room to receive live updates. */
  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() sessionId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`session:${sessionId}`);
    this.logger.log(`Client ${client.id} joined room session:${sessionId}`);

    try {
      const session = this.sessionsService.findById(sessionId);
      client.emit('session-status', { sessionId, status: session.status });
    } catch {
      client.emit('error', { message: `Session ${sessionId} not found` });
    }
  }

  /**
   * Bot sends raw audio chunks (base64-encoded WebM/Opus).
   * We forward each chunk to Groq Whisper and push the text to the frontend.
   */
  @SubscribeMessage('audio-chunk')
  async handleAudioChunk(
    @MessageBody() data: { sessionId: string; chunk: string },
  ) {
    const { sessionId, chunk } = data;

    const text = await this.transcriptionService.transcribe(chunk);

    if (text) {
      this.logger.log(`[${sessionId}] Transcribed: "${text.slice(0, 60)}..."`);
      // Persist for later download
      try { this.sessionsService.appendTranscript(sessionId, text); } catch {}
      this.server.to(`session:${sessionId}`).emit('transcript-chunk', {
        sessionId,
        text,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** Bot notifies lifecycle changes (JOINING → RECORDING → DONE/FAILED). */
  @SubscribeMessage('bot-status')
  handleBotStatus(
    @MessageBody() data: { sessionId: string; status: SessionStatus },
  ) {
    const { sessionId, status } = data;

    try {
      this.sessionsService.updateStatus(sessionId, status);
    } catch {}

    this.server.to(`session:${sessionId}`).emit('session-status', { sessionId, status });
    this.logger.log(`[${sessionId}] Status → ${status}`);
  }

  /** Called by the BullMQ processor to broadcast status changes. */
  broadcastStatus(sessionId: string, status: SessionStatus) {
    this.server.to(`session:${sessionId}`).emit('session-status', { sessionId, status });
  }
}
