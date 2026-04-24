import React, { useEffect, useRef } from 'react';
import { TranscriptChunk } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

interface Props {
  chunks: TranscriptChunk[];
  sessionId: string;
  sessionDone: boolean;
}

export default function LiveTranscript({ chunks, sessionId, sessionDone }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    window.open(`${BACKEND_URL}/sessions/${sessionId}/transcript`, '_blank');
  };

  // Auto-scroll to the latest text
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Live Transcript</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={styles.count}>{chunks.length} chunk{chunks.length !== 1 ? 's' : ''}</span>
          {sessionDone && chunks.length > 0 && (
            <button onClick={handleDownload} style={styles.dlBtn}>
              Download .txt
            </button>
          )}
        </div>
      </div>

      <div style={styles.scroll}>
        {chunks.length === 0 ? (
          <p style={styles.empty}>Waiting for speech…</p>
        ) : (
          chunks.map((chunk, i) => (
            <div key={i} style={styles.chunk}>
              <span style={styles.ts}>{new Date(chunk.timestamp).toLocaleTimeString()}</span>
              <span style={styles.text}>{chunk.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid #2a2a2a',
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
  },
  count: {
    fontSize: 12,
    color: '#555',
  },
  scroll: {
    overflowY: 'auto',
    maxHeight: 420,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  empty: {
    color: '#444',
    fontSize: 14,
    margin: 0,
    fontStyle: 'italic',
  },
  chunk: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    lineHeight: 1.5,
  },
  ts: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'monospace',
    flexShrink: 0,
    paddingTop: 2,
  },
  text: {
    fontSize: 14,
    color: '#e8e8e8',
  },
  dlBtn: {
    background: '#1e3a6e',
    color: '#93c5fd',
    border: '1px solid #2563eb',
    borderRadius: 5,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
};
