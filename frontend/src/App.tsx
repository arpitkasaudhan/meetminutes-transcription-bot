import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Session, SessionStatus, TranscriptChunk } from './types';
import SubmitForm from './components/SubmitForm';
import SessionView from './components/SessionView';
import LiveTranscript from './components/LiveTranscript';
import './styles.css';

// In Docker (production): nginx proxies /sessions and /socket.io/ from the same origin
// In local dev: use VITE_BACKEND_URL (defaults to localhost:3000)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('session-status', (data: { sessionId: string; status: SessionStatus }) => {
      setSession((prev) => (prev?.id === data.sessionId ? { ...prev, status: data.status } : prev));
    });

    socket.on('transcript-chunk', (data: TranscriptChunk) => {
      setTranscript((prev) => [...prev, data]);
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleSubmit = async (meetUrl: string, botDisplayName: string) => {
    setError(null);
    setSubmitting(true);
    setTranscript([]);
    setSession(null);

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
      socketRef.current?.emit('join-session', newSession.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewSession = () => {
    setSession(null);
    setTranscript([]);
    setError(null);
  };

  const isActive = session && session.status !== 'DONE' && session.status !== 'FAILED';

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="currentColor"/>
              </svg>
            </div>
            <span className="logo-text">MeetMinutes</span>
          </div>
          <div className="header-badge">AI Powered</div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1 className="hero-title">
          Live Meeting <span className="gradient-text">Transcription</span>
        </h1>
        <p className="hero-sub">
          Drop a Google Meet link. Our bot joins, listens, and streams the transcript to you in real time.
        </p>
      </section>

      {/* Main Content */}
      <main className="main">
        {error && (
          <div className="error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
          </div>
        )}

        <SubmitForm
          onSubmit={handleSubmit}
          loading={submitting}
          disabled={!!isActive}
        />

        {session && (
          <>
            <SessionView
              session={session}
              onNewSession={handleNewSession}
            />
            <LiveTranscript
              chunks={transcript}
              sessionId={session.id}
              sessionDone={session.status === 'DONE'}
            />
          </>
        )}

        {!session && !submitting && (
          <div className="how-it-works">
            <h3 className="how-title">How it works</h3>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div>
                  <div className="step-label">Paste your Meet link</div>
                  <div className="step-desc">Any active Google Meet URL</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="step">
                <div className="step-num">2</div>
                <div>
                  <div className="step-label">Bot joins automatically</div>
                  <div className="step-desc">Admit it from your Meet</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="step">
                <div className="step-num">3</div>
                <div>
                  <div className="step-label">Read live transcript</div>
                  <div className="step-desc">Words appear as you speak</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Built with NestJS · Playwright · Groq Whisper · React
      </footer>
    </div>
  );
}
