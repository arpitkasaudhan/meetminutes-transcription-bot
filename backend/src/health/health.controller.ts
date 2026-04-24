import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('health')
export class HealthController {
  constructor(@InjectQueue('bot-queue') private readonly botQueue: Queue) {}

  @Get()
  async check() {
    const counts = await this.botQueue.getJobCounts('active', 'waiting', 'failed');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: counts,
    };
  }
}
