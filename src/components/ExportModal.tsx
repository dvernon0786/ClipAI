'use client';
import { useState } from 'react';
import { X, Download, Loader } from 'lucide-react';
import type { ProjectState, ExportFormat, ExportResolution } from '@/lib/types';

interface Props {
  project: ProjectState;
  onClose: () => void;
}

export default function ExportModal({ project, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [burnCaptions, setBurnCaptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  const workerUrl = process.env.NEXT_PUBLIC_FFMPEG_WORKER_URL || '';

  const handleExport = async () => {
    if (!project.videoFile) {
      setError('No video loaded.');
      return;
    }
    if (!workerUrl) {
      setError('NEXT_PUBLIC_FFMPEG_WORKER_URL is not set. Deploy the FFmpeg worker first.');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Uploading video to export worker…');

    try {
      // Upload video file to worker
      const formData = new FormData();
      formData.append('video', project.videoFile);
      formData.append('cuts', JSON.stringify(project.cuts));
      formData.append('captions', JSON.stringify(burnCaptions ? project.captions : []));
      formData.append('format', format);
      formData.append('resolution', resolution);

      setProgress('Processing cuts and captions…');

      const res = await fetch(`${workerUrl}/export`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }

      const data = await res.json();
      setDownloadUrl(data.downloadUrl);
      setProgress('Done!');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const exportCutList = () => {
    const lines = project.cuts.map(
      (c) => `[${formatTime(c.start)} → ${formatTime(c.end)}] ${c.reason || 'Cut'}`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cut_list.txt';
    a.click();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="panel p-5 w-[420px] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Export Video</h3>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-3 gap-2 mb-4 p-3 rounded"
          style={{ background: 'var(--surface-2)' }}
        >
          <div className="text-center">
            <div className="font-mono text-lg" style={{ color: 'var(--accent)' }}>{project.cuts.length}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>cuts</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-lg" style={{ color: 'var(--accent)' }}>{project.captions.length}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>captions</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-lg" style={{ color: 'var(--accent)' }}>{project.audioPatches.length}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>patches</div>
          </div>
        </div>

        {/* Format */}
        <div className="mb-3">
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>Format</label>
          <div className="flex gap-2">
            {(['mp4', 'webm'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className="btn btn-ghost btn-sm flex-1"
                style={{ borderColor: format === f ? 'var(--accent)' : 'var(--border)', color: format === f ? 'var(--accent)' : 'var(--muted)' }}
              >
                .{f}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="mb-3">
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>Resolution</label>
          <div className="flex gap-2">
            {(['720p', '1080p', '4k'] as ExportResolution[]).map((r) => (
              <button
                key={r}
                onClick={() => setResolution(r)}
                className="btn btn-ghost btn-sm flex-1"
                style={{ borderColor: resolution === r ? 'var(--accent)' : 'var(--border)', color: resolution === r ? 'var(--accent)' : 'var(--muted)' }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Burn captions */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={burnCaptions}
            onChange={(e) => setBurnCaptions(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Burn captions into video</span>
        </label>

        {/* Worker URL warning */}
        {!workerUrl && (
          <div
            className="mb-3 px-3 py-2 rounded text-xs"
            style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.2)', color: 'var(--warn)' }}
          >
            FFmpeg worker not configured. Set NEXT_PUBLIC_FFMPEG_WORKER_URL in your environment. You can still export a cut list.
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {progress && !error && (
          <div className="mb-3 px-3 py-2 rounded text-xs" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            {progress}
          </div>
        )}

        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="btn btn-primary w-full justify-center mb-3"
          >
            <Download size={13} /> Download Exported Video
          </a>
        )}

        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm flex-1"
            onClick={exportCutList}
            disabled={project.cuts.length === 0}
          >
            Export Cut List (.txt)
          </button>
          {workerUrl && (
            <button
              className="btn btn-primary flex-1 justify-center"
              onClick={handleExport}
              disabled={loading || !project.videoFile}
            >
              {loading ? <><Loader size={13} className="animate-spin" /> Processing…</> : <><Download size={13} /> Export</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
