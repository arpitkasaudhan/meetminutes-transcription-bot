export type SessionStatus = 'QUEUED' | 'JOINING' | 'RECORDING' | 'DONE' | 'FAILED';

export interface Session {
  id: string;
  meetUrl: string;
  botDisplayName: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptChunk {
  text: string;
  timestamp: string;
}
