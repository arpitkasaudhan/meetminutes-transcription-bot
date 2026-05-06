import React, { useEffect, useRef } from 'react';
import { TranscriptChunk } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

interface Props {
  chunks: TranscriptChunk[];
  sessionId: string;
  sessionDone: boolean;
}

export default function LiveTranscript({ chunks, sessionId, sessionDone }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  const handleDownload = () => {
    window.open(`${BACKEND_URL}/sessions/${sessionId}/transcript`, '_blank');
  };

  return (
    <div className="transcript-card">
      <div className="transcript-header">
        <div className="transcript-title">
          {chunks.length > 0 && <span className="live-dot" />}
          Live Transcript
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="transcript-count">
            {chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'}
          </span>
          {sessionDone && chunks.length > 0 && (
            <button className="dl-btn" onClick={handleDownload}>
              ↓ Download
            </button>
          )}
        </div>
      </div>

      <div className="transcript-body">
        {chunks.length === 0 ? (
          <div className="transcript-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto', display: 'block', opacity: 0.3 }}>
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" fill="currentColor"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
            </svg>
            <p>Waiting for speech…</p>
            <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text3)' }}>
              Transcript will appear here as you speak
            </p>
          </div>
        ) : (
          chunks.map((chunk, i) => (
            <div key={i} className="chunk">
              <span className="chunk-time">
                {new Date(chunk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="chunk-text">{chunk.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
