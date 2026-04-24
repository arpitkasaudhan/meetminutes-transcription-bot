import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Whisper hallucinations for silence — filter these out
const SILENCE_PHRASES = new Set([
  'thank you.',
  'thanks for watching.',
  'you',
  '.',
  '',
  'you.',
  'bye.',
]);

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly groq: Groq;

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async transcribe(base64AudioChunk: string): Promise<string | null> {
    const buffer = Buffer.from(base64AudioChunk, 'base64');

    // Skip chunks that are too small to contain real speech
    if (buffer.length < 1000) return null;

    const tmpFile = path.join(os.tmpdir(), `chunk-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`);

    try {
      fs.writeFileSync(tmpFile, buffer);

      const result = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: 'whisper-large-v3-turbo',
        response_format: 'json',
        language: 'en',
      });

      const text = result.text?.trim() ?? '';

      if (SILENCE_PHRASES.has(text.toLowerCase())) return null;

      return text || null;
    } catch (err) {
      this.logger.error(`Groq transcription error: ${err.message}`);
      return null;
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }
}
