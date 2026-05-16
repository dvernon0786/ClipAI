'use client';
import { useState } from 'react';
import { AudioWaveform, Upload, Download, Loader } from 'lucide-react';

export default function StudioSoundPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setDownloadUrl('');
      setError('');
    }
  };

  const enhance = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setStatus('Converting audio…');

    try {
      const reader = new FileReader();
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      setStatus('Uploading to Dolby.io…');
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'enhance', audioBase64: base64 }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Enhancement failed');

      setDownloadUrl(data.downloadUrl);
      setStatus('');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AudioWaveform size={15} style={{ color: 'var(--accent)' }} />
        <h3 className="font-display font-semibold text-sm">Studio Sound</h3>
        <span className="badge badge-muted">Dolby.io</span>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Remove background noise, echo, and hiss. Make any recording sound studio-quality.
      </p>

      <label
        className="flex flex-col items-center gap-2 px-4 py-5 rounded cursor-pointer transition-all"
        style={{
          border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`,
          background: file ? 'var(--accent-glow)' : 'var(--surface-2)',
        }}
      >
        <Upload size={18} style={{ color: file ? 'var(--accent)' : 'var(--muted)' }} />
        <span className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          {file ? file.name : 'Upload audio or video file (MP3, MP4, WAV, M4A)'}
        </span>
        <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileChange} />
      </label>

      {error && (
        <div className="px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {status && (
        <div className="px-3 py-2 rounded text-xs" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          <Loader size={11} className="animate-spin inline mr-1.5" />{status}
        </div>
      )}

      {downloadUrl && (
        <a href={downloadUrl} download="enhanced_audio.mp3" className="btn btn-primary w-full justify-center">
          <Download size={13} /> Download Enhanced Audio
        </a>
      )}

      <button
        className="btn btn-primary w-full justify-center"
        onClick={enhance}
        disabled={!file || loading}
      >
        {loading ? <><Loader size={13} className="animate-spin" /> Processing…</> : <>Enhance Audio</>}
      </button>

      <p className="text-xs" style={{ color: 'var(--muted-2)' }}>
        Free tier: 1,000 minutes/month via Dolby.io
      </p>
    </div>
  );
}
