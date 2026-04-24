import { Controller, Post, Get, Body, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    @InjectQueue('bot-queue') private readonly botQueue: Queue,
  ) {}

  @Post()
  async create(@Body() dto: CreateSessionDto) {
    const session = this.sessionsService.create(dto.meetUrl, dto.botDisplayName);

    await this.botQueue.add(
      'join-meeting',
      {
        sessionId: session.id,
        meetUrl: session.meetUrl,
        botDisplayName: session.botDisplayName,
      },
      {
        attempts: 3,         // 1 initial + 2 retries as required
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return session;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findById(id);
  }

  @Get(':id/transcript')
  downloadTranscript(@Param('id') id: string, @Res() res: Response) {
    const text = this.sessionsService.getTranscript(id);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${id.slice(0, 8)}.txt"`);
    res.send(text);
  }
}
