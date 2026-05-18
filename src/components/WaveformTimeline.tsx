'use client';
import { useEffect, useRef, useState } from 'react';
import WaveSurferType from 'wavesurfer.js';
import { ZoomIn, ZoomOut, LayoutList } from 'lucide-react';
import type { CutRegion, HighlightRegion, Clip } from '@/lib/types';
import { formatTime } from '@/lib/utils';

interface Props {
  videoUrl: string | null;
  currentTime: number;
  duration: number;
  cuts: CutRegion[];
  highlights: HighlightRegion[];
  clips: Clip[];
  onSeek: (t: number) => void;
}

export default function WaveformTimeline({ videoUrl, currentTime, duration, cuts, highlights, clips, onSeek }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurferType | null>(null);
  const [zoom, setZoom] = useState(50);
  const [wsReady, setWsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSeeking = useRef(false);

  // Dynamically load wavesurfer
  useEffect(() => {
    if (!videoUrl || !containerRef.current) return;

    let destroyed = false;
    setLoading(true);
    setError('');
    setWsReady(false);

    const init = async () => {
      try {
        const WaveSurferModule = await import('wavesurfer.js');
        const WaveSurfer = WaveSurferModule.default;
        if (destroyed) return;

        // Destroy previous instance
        if (wsRef.current) {
          wsRef.current.destroy();
          wsRef.current = null;
        }

        const ws = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: 'var(--border-bright)',
          progressColor: 'var(--accent)',
          cursorColor: 'var(--accent)',
          cursorWidth: 2,
          height: 64,
          normalize: true,
          minPxPerSec: zoom,
          interact: true,
          hideScrollbar: false,
          fillParent: true,
        });

        // Load from URL — WaveSurfer decodes audio track
        ws.load(videoUrl);

        ws.on('ready', () => {
          if (destroyed) return;
          setWsReady(true);
          setLoading(false);
        });

        ws.on('error', (e) => {
          if (destroyed) return;
          console.warn('WaveSurfer error:', e);
          setLoading(false);
          setError('Waveform unavailable for this file type.');
        });

        // WaveSurfer v7: 'interaction' fires when user clicks the waveform
        ws.on('interaction', (newTime: number) => {
          if (isSeeking.current) return;
          onSeek(newTime);
        });

        wsRef.current = ws;
      } catch (e) {
        if (!destroyed) {
          setLoading(false);
          setError('Could not load waveform library.');
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // Sync playhead from parent
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !wsReady || !duration) return;
    const progress = currentTime / duration;
    const wsProgress = ws.getCurrentTime() / (ws.getDuration() || duration);
    // Only seek if drift > 0.5s to avoid feedback loops
    if (Math.abs(currentTime - ws.getCurrentTime()) > 0.5) {
      isSeeking.current = true;
      ws.seekTo(Math.max(0, Math.min(1, progress)));
      setTimeout(() => { isSeeking.current = false; }, 100);
    }
  }, [currentTime, duration, wsReady]);

  // Zoom
  useEffect(() => {
    if (wsRef.current && wsReady) {
      wsRef.current.zoom(zoom);
    }
  }, [zoom, wsReady]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1">
          <LayoutList size={12} style={{ color: 'var(--muted)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Timeline</span>
          {cuts.length > 0 && (
            <span className="badge badge-danger ml-1">{cuts.length} cuts</span>
          )}
          {clips.length > 0 && (
            <span className="badge badge-accent ml-1">{clips.length} clips</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-icon" onClick={() => setZoom((z) => Math.max(10, z - 20))} data-tip="Zoom out">
            <ZoomOut size={12} />
          </button>
          <span className="text-xs font-mono" style={{ color: 'var(--muted)', minWidth: '36px', textAlign: 'center' }}>
            {zoom}px
          </span>
          <button className="btn-icon" onClick={() => setZoom((z) => Math.min(300, z + 20))} data-tip="Zoom in">
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* Waveform container */}
      <div style={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden' }}>
        {/* Loading / error */}
        {loading && (
          <div
            className="flex items-center justify-center"
            style={{ height: 64, background: 'var(--surface-2)' }}
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <div className="animate-spin" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
              Decoding audio…
            </div>
          </div>
        )}

        {error && !loading && (
          <div
            className="flex items-center justify-center"
            style={{ height: 64 }}
          >
            {/* Fallback: simple progress bar timeline */}
            <FallbackTimeline
              currentTime={currentTime}
              duration={duration}
              cuts={cuts}
              clips={clips}
              highlights={highlights}
              onSeek={onSeek}
            />
          </div>
        )}

        {/* WaveSurfer target */}
        {!error && (
          <div
            ref={containerRef}
            style={{
              minHeight: 64,
              opacity: loading ? 0 : 1,
              transition: 'opacity 0.3s',
            }}
          />
        )}

        {/* Cut overlays — rendered on top of waveform */}
        {wsReady && duration > 0 && cuts.map((cut) => (
          <div
            key={cut.id}
            title={cut.reason || 'Cut'}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(cut.start / duration) * 100}%`,
              width: `${((cut.end - cut.start) / duration) * 100}%`,
              background: 'rgba(255,95,87,0.18)',
              borderLeft: '2px solid var(--danger)',
              borderRight: '2px solid var(--danger)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        ))}

        {/* Clip overlays */}
        {wsReady && duration > 0 && clips.map((clip) => (
          <div
            key={clip.id}
            title={clip.title}
            style={{
              position: 'absolute',
              bottom: 0,
              height: '6px',
              left: `${(clip.start / duration) * 100}%`,
              width: `${((clip.end - clip.start) / duration) * 100}%`,
              background: 'var(--accent)',
              borderRadius: '2px 2px 0 0',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        ))}

        {/* Highlight overlays */}
        {wsReady && duration > 0 && highlights.map((h) => (
          <div
            key={h.id}
            title={h.label}
            style={{
              position: 'absolute',
              top: 0,
              height: '4px',
              left: `${(h.start / duration) * 100}%`,
              width: `${((h.end - h.start) / duration) * 100}%`,
              background: h.color || 'var(--blue)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        ))}
      </div>

      {/* Time ruler */}
      <div
        style={{
          position: 'relative',
          height: 18,
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {duration > 0 && Array.from({ length: Math.ceil(duration / 10) + 1 }, (_, i) => i * 10)
          .filter((t) => t <= duration)
          .map((t) => (
            <div
              key={t}
              style={{
                position: 'absolute',
                left: `${(t / duration) * 100}%`,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '3px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--muted-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatTime(t).split('.')[0]}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// Simple CSS progress-bar fallback when WaveSurfer can't decode the audio
function FallbackTimeline({ currentTime, duration, cuts, clips, highlights, onSeek }: Omit<Props, 'videoUrl'>) {
  return (
    <div
      className="w-full cursor-pointer"
      style={{ height: 64, background: 'var(--surface-2)', position: 'relative' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - rect.left) / rect.width) * duration);
      }}
    >
      {/* Background grid lines */}
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${i * 10}%`, width: 1,
          background: 'var(--border)', opacity: 0.4,
        }} />
      ))}

      {/* Cuts */}
      {cuts.map((c) => (
        <div key={c.id} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${(c.start / duration) * 100}%`,
          width: `${((c.end - c.start) / duration) * 100}%`,
          background: 'rgba(255,95,87,0.2)',
          border: '1px solid var(--danger)',
        }} />
      ))}

      {/* Clip bars */}
      {clips.map((c) => (
        <div key={c.id} style={{
          position: 'absolute', bottom: 0, height: 6,
          left: `${(c.start / duration) * 100}%`,
          width: `${((c.end - c.start) / duration) * 100}%`,
          background: 'var(--accent)',
        }} />
      ))}

      {/* Playhead */}
      {duration > 0 && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, width: 2,
          left: `${(currentTime / duration) * 100}%`,
          background: 'var(--accent)',
        }} />
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Click to seek</span>
      </div>
    </div>
  );
}


