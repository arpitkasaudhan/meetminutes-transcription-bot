import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { SessionsService } from '../sessions/sessions.service';

@Processor('bot-queue', { concurrency: 5 })
export class BotProcessor extends WorkerHost {
  private readonly logger = new Logger(BotProcessor.name);

  constructor(private readonly sessionsService: SessionsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { sessionId, meetUrl, botDisplayName } = job.data;
    this.logger.log(`[Job ${job.id}] Starting bot for session ${sessionId}`);

    this.sessionsService.updateStatus(sessionId, 'JOINING');

    return new Promise((resolve, reject) => {
      // __dirname = dist/queue → go up one level to dist/, then into dist/bot/
      const botScript = path.join(__dirname, '..', 'bot', 'bot.js');
      const backendWsUrl = process.env.BACKEND_WS_URL || 'http://localhost:3000';

      const child: ChildProcess = spawn('node', [botScript], {
        env: {
          ...process.env,
          SESSION_ID: sessionId,
          MEET_URL: meetUrl,
          BOT_DISPLAY_NAME: botDisplayName,
          BACKEND_WS_URL: backendWsUrl,
        },
        stdio: 'pipe',
      });

      child.stdout?.on('data', (d) => this.logger.log(`[Bot] ${d.toString().trim()}`));
      child.stderr?.on('data', (d) => this.logger.error(`[Bot ERR] ${d.toString().trim()}`));

      child.on('close', (code) => {
        if (code === 0) {
          this.sessionsService.updateStatus(sessionId, 'DONE');
          resolve();
        } else {
          this.sessionsService.updateStatus(sessionId, 'FAILED');
          reject(new Error(`Bot process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        this.sessionsService.updateStatus(sessionId, 'FAILED');
        reject(err);
      });
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`[Job ${job.id}] Failed after ${job.attemptsMade} attempt(s): ${err.message}`);
    // After all retries are exhausted, mark session as FAILED
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      try {
        this.sessionsService.updateStatus(job.data.sessionId, 'FAILED');
      } catch {}
    }
  }
}
