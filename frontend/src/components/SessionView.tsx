import React from 'react';
import { Session, SessionStatus } from '../types';

interface Props {
  session: Session;
}

const STATUS_META: Record<SessionStatus, { label: string; color: string; dot: string }> = {
  QUEUED:    { label: 'Queued',    color: '#a16207', dot: '#facc15' },
  JOINING:   { label: 'Joining',   color: '#1d4ed8', dot: '#60a5fa' },
  RECORDING: { label: 'Recording', color: '#166534', dot: '#4ade80' },
  DONE:      { label: 'Done',      color: '#374151', dot: '#9ca3af' },
  FAILED:    { label: 'Failed',    color: '#7f1d1d', dot: '#f87171' },
};

export default function SessionView({ session }: Props) {
  const meta = STATUS_META[session.status];

  return (
    <div style={styles.card}>
      <div style={styles.row}>
        <span style={{ ...styles.badge, background: meta.color + '22', border: `1px solid ${meta.color}66` }}>
          <span style={{ ...styles.dot, background: meta.dot, ...(session.status === 'RECORDING' ? styles.pulse : {}) }} />
          {meta.label}
        </span>
        <span style={styles.sessionId}>Session {session.id.slice(0, 8)}…</span>
      </div>

      <div style={styles.details}>
        <div style={styles.detail}>
          <span style={styles.detailKey}>Meet URL</span>
          <a href={session.meetUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
            {session.meetUrl}
          </a>
        </div>
        <div style={styles.detail}>
          <span style={styles.detailKey}>Bot Name</span>
          <span style={styles.detailVal}>{session.botDisplayName}</span>
        </div>
        <div style={styles.detail}>
          <span style={styles.detailKey}>Started</span>
          <span style={styles.detailVal}>{new Date(session.createdAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: '#e8e8e8',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  pulse: {
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  sessionId: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'monospace',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderTop: '1px solid #222',
    paddingTop: 12,
  },
  detail: {
    display: 'flex',
    gap: 12,
    fontSize: 13,
  },
  detailKey: {
    color: '#666',
    width: 80,
    flexShrink: 0,
  },
  detailVal: {
    color: '#ccc',
  },
  link: {
    color: '#60a5fa',
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
};
