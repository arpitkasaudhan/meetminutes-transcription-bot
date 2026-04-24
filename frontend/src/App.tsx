import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Session, SessionStatus, TranscriptChunk } from './types';
import SubmitForm from './components/SubmitForm';
import SessionView from './components/SessionView';
import LiveTranscript from './components/LiveTranscript';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Single socket connection, reused across sessions
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('session-status', (data: { sessionId: string; status: SessionStatus }) => {
      setSession((prev) => (prev?.id === data.sessionId ? { ...prev, status: data.status } : prev));
    });

    socket.on('transcript-chunk', (data: TranscriptChunk) => {
      setTranscript((prev) => [...prev, data]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = async (meetUrl: string, botDisplayName: string) => {
    setError(null);
    setSubmitting(true);
    setTranscript([]);

    try {
      const res = await fetch(`${BACKEND_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetUrl, botDisplayName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }

      const newSession: Session = await res.json();
      setSession(newSession);

      // Subscribe to this session's room for live updates
      socketRef.current?.emit('join-session', newSession.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = session && session.status !== 'DONE' && session.status !== 'FAILED';

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <h1 style={styles.title}>MeetMinutes</h1>
        <p style={styles.subtitle}>Real-time Google Meet transcription bot</p>
      </header>

      <main style={styles.main}>
        <SubmitForm onSubmit={handleSubmit} loading={submitting} disabled={!!isActive} />

        {error && <div style={styles.error}>{error}</div>}

        {session && (
          <>
            <SessionView session={session} />
            <LiveTranscript
            chunks={transcript}
            sessionId={session.id}
            sessionDone={session.status === 'DONE'}
          />
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: '#0f0f0f',
    color: '#e8e8e8',
    minHeight: '100vh',
    margin: 0,
    padding: 0,
  },
  header: {
    borderBottom: '1px solid #2a2a2a',
    padding: '20px 32px',
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#888',
  },
  main: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  error: {
    background: '#2a1010',
    border: '1px solid #5a1a1a',
    color: '#ff7070',
    borderRadius: 6,
    padding: '12px 16px',
    fontSize: 14,
  },
};
