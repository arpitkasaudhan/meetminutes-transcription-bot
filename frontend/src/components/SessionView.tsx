import React from 'react';
import { Session, SessionStatus } from '../types';

interface Props {
  session: Session;
  onNewSession: () => void;
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; bg: string; dotColor: string; pulse: boolean }> = {
  QUEUED:    { label: 'Queued',    bg: 'rgba(245,158,11,0.1)',  dotColor: '#f59e0b', pulse: false },
  JOINING:   { label: 'Joining…',  bg: 'rgba(59,130,246,0.1)', dotColor: '#60a5fa', pulse: true  },
  RECORDING: { label: 'Recording', bg: 'rgba(16,185,129,0.1)', dotColor: '#10b981', pulse: true  },
  DONE:      { label: 'Done',      bg: 'rgba(75,85,99,0.15)',  dotColor: '#6b7280', pulse: false },
  FAILED:    { label: 'Failed',    bg: 'rgba(239,68,68,0.1)',  dotColor: '#ef4444', pulse: false },
};

export default function SessionView({ session, onNewSession }: Props) {
  const cfg = STATUS_CONFIG[session.status];
  const isDone = session.status === 'DONE' || session.status === 'FAILED';

  return (
    <div className="session-card">
      <div className="session-top">
        <div
          className="status-badge"
          style={{ background: cfg.bg, border: `1px solid ${cfg.dotColor}44` }}
        >
          <span
            className={`status-dot${cfg.pulse ? ' pulse' : ''}`}
            style={{ background: cfg.dotColor }}
          />
          <span style={{ color: cfg.dotColor }}>{cfg.label}</span>
        </div>

        {isDone && (
          <button className="new-btn" onClick={onNewSession}>
            + New Session
          </button>
        )}
      </div>

      <div className="session-meta">
        <div className="meta-item">
          <span className="meta-label">Session ID</span>
          <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {session.id.slice(0, 8)}…
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Meet URL</span>
          <span className="meta-value">
            <a href={session.meetUrl} target="_blank" rel="noopener noreferrer">
              {session.meetUrl.replace('https://meet.google.com/', '')}
            </a>
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Bot name</span>
          <span className="meta-value">{session.botDisplayName}</span>
        </div>
      </div>
    </div>
  );
}
