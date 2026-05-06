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
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Start a transcription session</h2>
      <div className="form-row">
        <div className="field">
          <label>Google Meet URL</label>
          <input
            type="url"
            placeholder="https://meet.google.com/xxx-yyyy-zzz"
            value={meetUrl}
            onChange={(e) => setMeetUrl(e.target.value)}
            required
            disabled={isDisabled}
          />
        </div>
        <div className="field">
          <label>Bot display name</label>
          <input
            type="text"
            placeholder="MeetMinutes Bot"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            maxLength={60}
            disabled={isDisabled}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button type="submit" disabled={isDisabled} className="launch-btn" style={{ width: 'auto', padding: '12px 32px' }}>
          {loading ? '⏳  Launching bot...' : '🚀  Launch Bot'}
        </button>
      </div>

      {disabled && !loading && (
        <p className="form-hint">A session is already active. Wait for it to finish or click "New Session".</p>
      )}
    </form>
  );
}
