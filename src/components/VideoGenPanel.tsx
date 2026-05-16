'use client';
import { useState } from 'react';
import { Video, Sparkles, Download, Loader, Clock } from 'lucide-react';

interface GeneratedClip { videoUrl: string; prompt: string; timestamp: Date; }

export default function VideoGenPanel() {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState('1280:720');
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const generate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError('');
    setStatus('Sending to Runway…');

    try {
      const res = await fetch('/api/video-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generateVideo', prompt, duration, ratio }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      if (data.videoUrl) {
        setClips((prev) => [{ videoUrl: data.videoUrl, prompt, timestamp: new Date() }, ...prev]);
        setStatus('');
      } else {
        // Poll for task
        setTaskId(data.taskId || '');
        setStatus('Processing… (this may take 1–2 minutes)');
        await pollTask(data.taskId, prompt);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const pollTask = async (id: string, originalPrompt: string) => {
    let attempts = 0;
    while (attempts < 40) {
      await new Promise((r) => setTimeout(r, 4000));
      const res = await fetch('/api/video-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'pollTask', taskId: id }),
      });
      const data = await res.json();

      if (data.status === 'SUCCEEDED' && data.videoUrl) {
        setClips((prev) => [{ videoUrl: data.videoUrl, prompt: originalPrompt, timestamp: new Date() }, ...prev]);
        return;
      }
      if (data.status === 'FAILED') throw new Error('Runway task failed');
      setStatus(`Processing… (${Math.round((data.progress || 0) * 100)}%)`);
      attempts++;
    }
    throw new Error('Timed out waiting for video');
  };

  const RATIO_OPTIONS = [
    { value: '1280:720', label: '16:9 (YouTube)' },
    { value: '720:1280', label: '9:16 (Reels/TikTok)' },
    { value: '1024:1024', label: '1:1 (Square)' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Video size={15} style={{ color: 'var(--accent)' }} />
        <h3 className="font-display font-semibold text-sm">Generate Video</h3>
        <span className="badge badge-muted">Runway Gen-3</span>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Generate B-roll, intros, or illustrative footage from a text prompt.
      </p>

      <textarea
        className="input text-xs"
        rows={3}
        placeholder="e.g. A developer typing on a laptop in a dark room, cinematic, soft blue light…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Duration</label>
          <select className="input text-xs" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Ratio</label>
          <select className="input text-xs" value={ratio} onChange={(e) => setRatio(e.target.value)}>
            {RATIO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {status && !error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded text-xs" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          <Clock size={11} className="animate-spin" /> {status}
        </div>
      )}

      <button className="btn btn-primary w-full justify-center" onClick={generate} disabled={!prompt || loading}>
        {loading ? <><Loader size={13} className="animate-spin" /> Generating…</> : <><Sparkles size={13} /> Generate Video</>}
      </button>

      {/* Generated clips */}
      {clips.length > 0 && (
        <div className="space-y-3 mt-2">
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Generated clips</p>
          {clips.map((clip, i) => (
            <div key={i} className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <video
                src={clip.videoUrl}
                controls
                className="w-full"
                style={{ maxHeight: '160px', background: '#000' }}
              />
              <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'var(--surface-2)' }}>
                <span className="text-xs truncate mr-2" style={{ color: 'var(--muted)' }}>{clip.prompt}</span>
                <a href={clip.videoUrl} download={`clip_${i + 1}.mp4`} className="btn btn-ghost btn-sm shrink-0">
                  <Download size={11} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--muted-2)' }}>Runway charges per second of generated video.</p>
    </div>
  );
}
