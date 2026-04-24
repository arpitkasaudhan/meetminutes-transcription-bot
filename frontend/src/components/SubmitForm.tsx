import React, { useState } from 'react';

interface Props {
  onSubmit: (meetUrl: string, botDisplayName: string) => void;
  loading: boolean;
  disabled: boolean;
}

export default function SubmitForm({ onSubmit, loading, disabled }: Props) {
  const [meetUrl, setMeetUrl] = useState('');
  const [botName, setBotName] = useState('MeetMinutes Bot');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetUrl.trim()) return;
    onSubmit(meetUrl.trim(), botName.trim() || 'MeetMinutes Bot');
  };

  const isDisabled = disabled || loading;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.heading}>Start a Transcription Session</h2>

      <div style={styles.field}>
        <label style={styles.label}>Google Meet URL</label>
        <input
          type="url"
          placeholder="https://meet.google.com/xxx-yyyy-zzz"
          value={meetUrl}
          onChange={(e) => setMeetUrl(e.target.value)}
          required
          disabled={isDisabled}
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Bot Display Name</label>
        <input
          type="text"
          placeholder="MeetMinutes Bot"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          maxLength={60}
          disabled={isDisabled}
          style={styles.input}
        />
      </div>

      <button type="submit" disabled={isDisabled} style={{
        ...styles.button,
        ...(isDisabled ? styles.buttonDisabled : {}),
      }}>
        {loading ? 'Launching bot...' : 'Launch Bot'}
      </button>

      {disabled && !loading && (
        <p style={styles.hint}>A session is already active. Wait for it to finish before starting a new one.</p>
      )}
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  heading: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#aaa',
    fontWeight: 500,
  },
  input: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 14,
    color: '#e8e8e8',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  button: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    alignSelf: 'flex-start',
  },
  buttonDisabled: {
    background: '#1e3a6e',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: '#666',
  },
};
