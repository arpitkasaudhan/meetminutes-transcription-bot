import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export type SessionStatus = 'QUEUED' | 'JOINING' | 'RECORDING' | 'DONE' | 'FAILED';

export interface Session {
  id: string;
  meetUrl: string;
  botDisplayName: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SessionsService {
  private readonly sessions = new Map<string, Session>();
  private readonly transcripts = new Map<string, string[]>();

  create(meetUrl: string, botDisplayName: string): Session {
    const id = uuidv4();
    const now = new Date().toISOString();
    const session: Session = {
      id,
      meetUrl,
      botDisplayName,
      status: 'QUEUED',
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    this.transcripts.set(id, []);
    return session;
  }

  appendTranscript(id: string, text: string): void {
    const lines = this.transcripts.get(id);
    if (lines) lines.push(text);
  }

  getTranscript(id: string): string {
    this.findById(id); // throws if not found
    return (this.transcripts.get(id) ?? []).join('\n');
  }

  findById(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  updateStatus(id: string, status: SessionStatus): Session {
    const session = this.sessions.get(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    session.status = status;
    session.updatedAt = new Date().toISOString();
    return session;
  }
}
