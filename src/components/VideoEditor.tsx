'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Play, Pause, Volume2, VolumeX, Maximize2,
  Download, Settings, ChevronDown, Bot, Wrench, FileText,
  AudioWaveform, Mic2, Video, X, Scissors, SkipBack, SkipForward
} from 'lucide-react';
import type { ProjectState, UnderlordAction, AIToolResult, CutRegion, Caption, Clip } from '@/lib/types';
import { generateId, formatTime } from '@/lib/utils';
import UnderlordSidebar from './UnderlordSidebar';
import AIToolsPanel from './AIToolsPanel';
import TranscriptEditor from './TranscriptEditor';
import ExportModal from './ExportModal';
import StudioSoundPanel from './StudioSoundPanel';
import RegeneratePanel from './RegeneratePanel';
import VideoGenPanel from './VideoGenPanel';

const MODELS = [
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', tag: 'free' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', tag: 'free' },
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5', tag: 'paid' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', tag: 'paid' },
  { id: 'google/gemini-flash-1.5-8b', label: 'Gemini Flash 1.5', tag: 'free' },
];

type RightPanel = 'underlord' | 'tools' | 'transcript' | 'studio' | 'regenerate' | 'videogen';
type BottomPanel = 'cuts' | 'captions' | 'clips' | null;

const INITIAL_STATE: ProjectState = {
  videoFile: null,
  videoUrl: null,
  videoDuration: 0,
  transcript: [],
  rawTranscript: '',
  cuts: [],
  captions: [],
  clips: [],
  audioPatches: [],
  highlights: [],
};

export default function VideoEditor() {
  const [project, setProject] = useState<ProjectState>(INITIAL_STATE);
  const [rightPanel, setRightPanel] = useState<RightPanel>('underlord');
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [model, setModel] = useState(MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptAccRef = useRef('');

  // Video event handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onDuration = () => setProject((p) => ({ ...p, videoDuration: v.duration }));
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('loadedmetadata', onDuration);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('loadedmetadata', onDuration);
    };
  }, []);

  const loadVideo = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setProject((p) => ({
      ...p,
      videoFile: file,
      videoUrl: url,
    }));
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) loadVideo(file);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const skip = (delta: number) => {
    seek(Math.max(0, Math.min(project.videoDuration, currentTime + delta)));
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  // Web Speech API
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Web Speech API not supported. Use Chrome or Edge.');
      return;
    }

    videoRef.current?.play();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript;
          const t = videoRef.current?.currentTime || 0;
          const timeStr = formatTime(t).split('.')[0];
          transcriptAccRef.current += `${timeStr} ${text}\n`;
          const raw = transcriptAccRef.current;
          const segs = raw.split('\n').filter(Boolean).map((line, idx) => {
            const match = line.match(/^(\d+:\d+)\s+(.+)/);
            if (match) {
              const parts = match[1].split(':').map(Number);
              const start = parts[0] * 60 + parts[1];
              return { id: generateId(), text: match[2], start, end: start + 5 };
            }
            return { id: generateId(), text: line, start: idx * 5, end: (idx + 1) * 5 };
          });
          setProject((p) => ({ ...p, rawTranscript: raw, transcript: segs }));
        }
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // Apply Underlord actions
  const applyActions = useCallback((actions: UnderlordAction[]) => {
    setProject((prev) => {
      let updated = { ...prev };
      for (const action of actions) {
        if (action.type === 'add_cuts') {
          const payload = action.payload as { cuts: Array<{ start: string; end: string; reason: string }> };
          const newCuts: CutRegion[] = payload.cuts.map((c) => {
            const parseT = (s: string) => { const [m, sec] = s.split(':').map(Number); return m * 60 + sec; };
            return { id: generateId(), start: parseT(c.start), end: parseT(c.end), reason: c.reason };
          });
          updated.cuts = [...updated.cuts, ...newCuts];
        }
        if (action.type === 'add_captions') {
          const payload = action.payload as { captions: Caption[] };
          updated.captions = [...updated.captions, ...payload.captions.map((c) => ({ ...c, id: generateId() }))];
        }
        if (action.type === 'add_clips') {
          const payload = action.payload as { clips: Clip[] };
          updated.clips = [...updated.clips, ...payload.clips.map((c) => ({ ...c, id: generateId() }))];
        }
        if (action.type === 'add_highlights') {
          const payload = action.payload as { highlights: Array<{ start: string; end: string; label: string; color: string }> };
          const parseT = (s: string) => { const [m, sec] = s.split(':').map(Number); return m * 60 + sec; };
          updated.highlights = [
            ...updated.highlights,
            ...payload.highlights.map((h) => ({ id: generateId(), start: parseT(h.start), end: parseT(h.end), label: h.label, color: h.color })),
          ];
        }
      }
      return updated;
    });
  }, []);

  // Handle tool results — auto-apply structured data
  const handleToolResult = useCallback((result: AIToolResult, structured: unknown) => {
    if (!structured) return;
    if (result.tool === 'captions') {
      const arr = Array.isArray(structured) ? structured : null;
      if (arr) setProject((p) => ({ ...p, captions: arr.map((c: Caption) => ({ ...c, id: generateId() })) }));
    }
    if (result.tool === 'suggestCuts') {
      const arr = Array.isArray(structured) ? structured : null;
      if (arr) {
        const parseT = (s: string) => { const parts = s.split(':').map(Number); return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2]; };
        const cuts: CutRegion[] = arr.map((c: { start: string; end: string; reason: string }) => ({ id: generateId(), start: parseT(c.start), end: parseT(c.end), reason: c.reason }));
        setProject((p) => ({ ...p, cuts: [...p.cuts, ...cuts] }));
      }
    }
    if (result.tool === 'createClips') {
      const arr = Array.isArray(structured) ? structured : null;
      if (arr) {
        const parseT = (s: string) => { const parts = s.split(':').map(Number); return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0]; };
        const clips: Clip[] = arr.map((c: { title: string; start: string; end: string; platform: string }) => ({ id: generateId(), title: c.title, start: parseT(c.start), end: parseT(c.end), platform: c.platform }));
        setProject((p) => ({ ...p, clips: [...p.clips, ...clips] }));
      }
    }
  }, []);

  const progressPct = project.videoDuration > 0 ? (currentTime / project.videoDuration) * 100 : 0;

  const RIGHT_PANELS = [
    { id: 'underlord' as RightPanel, icon: <Bot size={14} />, label: 'Underlord' },
    { id: 'tools' as RightPanel, icon: <Wrench size={14} />, label: 'AI Tools' },
    { id: 'transcript' as RightPanel, icon: <FileText size={14} />, label: 'Transcript' },
    { id: 'studio' as RightPanel, icon: <AudioWaveform size={14} />, label: 'Studio Sound' },
    { id: 'regenerate' as RightPanel, icon: <Mic2 size={14} />, label: 'Regenerate' },
    { id: 'videogen' as RightPanel, icon: <Video size={14} />, label: 'Generate' },
  ];

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-body)' }}
    >
      {/* ── Top bar ── */}
      <header
        className="flex items-center justify-between px-5 shrink-0"
        style={{
          height: '52px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="font-display font-bold text-lg tracking-tight"
            style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}
          >
            CLIP<span style={{ color: 'var(--text)' }}>AI</span>
          </div>
          <div
            className="h-5 w-px"
            style={{ background: 'var(--border)' }}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {project.videoFile ? project.videoFile.name : 'No video loaded'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Model picker */}
          <div className="relative">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowModelPicker(!showModelPicker)}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent)', display: 'inline-block' }}
              />
              {MODELS.find((m) => m.id === model)?.label || 'Model'}
              <ChevronDown size={11} />
            </button>
            {showModelPicker && (
              <div
                className="absolute right-0 top-full mt-1 w-52 rounded-lg overflow-hidden animate-fade-in z-50"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left transition-colors"
                    style={{
                      background: model === m.id ? 'var(--accent-glow)' : 'transparent',
                      color: model === m.id ? 'var(--accent)' : 'var(--text)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                    <span className={`badge ${m.tag === 'free' ? 'badge-success' : 'badge-muted'}`}>{m.tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="btn-icon" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={14} />
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowExport(true)}
            disabled={!project.videoFile}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </header>

      {/* ── Settings overlay ── */}
      {showSettings && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowSettings(false)}
        >
          <div className="panel p-5 w-96 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Settings</h3>
              <button className="btn-icon" onClick={() => setShowSettings(false)}><X size={14} /></button>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
              API keys are set as environment variables (never in the browser). See <code className="font-mono">.env.local.example</code>.
            </p>
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted)' }}>FFmpeg Worker URL</label>
                <input className="input text-xs" placeholder="https://your-worker.railway.app" readOnly value={typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FFMPEG_WORKER_URL || '') : ''} />
                <p className="text-xs mt-1" style={{ color: 'var(--muted-2)' }}>Set NEXT_PUBLIC_FFMPEG_WORKER_URL in Vercel env vars.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Video + Timeline + Transcript (transcript as bottom drawer) */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Video area */}
          <div
            className="relative flex-1 flex items-center justify-center min-h-0"
            style={{ background: '#000', maxHeight: '55vh' }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {!project.videoUrl ? (
              <div
                className="flex flex-col items-center gap-4 cursor-pointer select-none"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-bright)'}`,
                  borderRadius: '12px',
                  padding: '40px 60px',
                  background: isDragging ? 'var(--accent-glow)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={28} style={{ color: isDragging ? 'var(--accent)' : 'var(--muted)' }} />
                <div className="text-center">
                  <p className="font-display font-semibold" style={{ color: isDragging ? 'var(--accent)' : 'var(--text)' }}>
                    Drop video here
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    MP4, MOV, MKV, WebM — stays in your browser
                  </p>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="max-w-full max-h-full"
                style={{ maxHeight: '100%' }}
              />
            )}

            {/* Caption overlay */}
            {project.captions.length > 0 && project.videoUrl && (() => {
              const activeCap = project.captions.find((c) => currentTime >= c.time && currentTime <= c.endTime);
              return activeCap ? (
                <div
                  className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none"
                >
                  <div
                    className="px-4 py-1.5 rounded text-sm font-medium"
                    style={{
                      background: 'rgba(0,0,0,0.85)',
                      color: '#fff',
                      maxWidth: '80%',
                      textAlign: 'center',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {activeCap.text}
                  </div>
                </div>
              ) : null;
            })()}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) loadVideo(e.target.files[0]); }}
            />
          </div>

          {/* Controls */}
          <div
            className="shrink-0 px-4 py-2"
            style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
          >
            {/* Progress bar */}
            <div
              className="w-full h-1.5 rounded-full mb-2 cursor-pointer relative"
              style={{ background: 'var(--surface-3)' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                seek(pct * project.videoDuration);
              }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: 'var(--accent)' }}
              />
              {/* Cut regions on progress */}
              {project.cuts.map((cut) => (
                <div
                  key={cut.id}
                  className="absolute h-full top-0"
                  style={{
                    left: `${(cut.start / project.videoDuration) * 100}%`,
                    width: `${((cut.end - cut.start) / project.videoDuration) * 100}%`,
                    background: 'rgba(255,95,87,0.5)',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>

            {/* Buttons row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="btn-icon" onClick={() => skip(-5)}><SkipBack size={14} /></button>
                <button
                  className="btn-icon"
                  style={{ background: 'var(--accent)', color: '#000', borderRadius: '50%', padding: '6px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={togglePlay}
                  disabled={!project.videoUrl}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button className="btn-icon" onClick={() => skip(5)}><SkipForward size={14} /></button>
                <button className="btn-icon" onClick={toggleMute}>
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {formatTime(currentTime).split('.')[0]} / {formatTime(project.videoDuration).split('.')[0]}
                </span>

                {/* Bottom panel tabs */}
                <div className="flex items-center gap-1">
                  {(['cuts', 'captions', 'clips'] as BottomPanel[]).map((panel) => {
                    const count = panel === 'cuts' ? project.cuts.length : panel === 'captions' ? project.captions.length : project.clips.length;
                    return (
                      <button
                        key={panel}
                        onClick={() => setBottomPanel(bottomPanel === panel ? null : panel)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          borderColor: bottomPanel === panel ? 'var(--accent)' : 'var(--border)',
                          color: bottomPanel === panel ? 'var(--accent)' : 'var(--muted)',
                        }}
                      >
                        {panel} {count > 0 && <span className="badge badge-accent" style={{ marginLeft: 3 }}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom list panel */}
          {bottomPanel && (
            <div
              className="shrink-0 overflow-y-auto animate-fade-in"
              style={{
                height: '180px',
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
              }}
            >
              {bottomPanel === 'cuts' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Cuts ({project.cuts.length})</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setProject((p) => ({ ...p, cuts: [] }))}>Clear all</button>
                  </div>
                  {project.cuts.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>No cuts yet. Ask Underlord to suggest cuts, or use the Suggest Cuts tool.</p>}
                  <div className="space-y-1">
                    {project.cuts.map((cut) => (
                      <div key={cut.id} className="flex items-center gap-3 px-3 py-1.5 rounded text-xs" style={{ background: 'var(--surface-2)' }}>
                        <Scissors size={11} style={{ color: 'var(--danger)' }} />
                        <span className="font-mono" style={{ color: 'var(--accent)' }}>{formatTime(cut.start).split('.')[0]} → {formatTime(cut.end).split('.')[0]}</span>
                        <span style={{ color: 'var(--muted)', flex: 1 }}>{cut.reason}</span>
                        <button className="btn-icon" style={{ padding: 2 }} onClick={() => setProject((p) => ({ ...p, cuts: p.cuts.filter((c) => c.id !== cut.id) }))}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bottomPanel === 'captions' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Captions ({project.captions.length})</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setProject((p) => ({ ...p, captions: [] }))}>Clear all</button>
                  </div>
                  {project.captions.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>No captions yet. Use the Generate Captions tool or ask Underlord.</p>}
                  <div className="space-y-1">
                    {project.captions.map((cap) => (
                      <div key={cap.id} className="flex items-center gap-3 px-3 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--surface-2)' }} onClick={() => seek(cap.time)}>
                        <span className="font-mono shrink-0" style={{ color: 'var(--accent)' }}>{formatTime(cap.time).split('.')[0]}</span>
                        <span style={{ flex: 1 }}>{cap.text}</span>
                        <button className="btn-icon" style={{ padding: 2 }} onClick={(e) => { e.stopPropagation(); setProject((p) => ({ ...p, captions: p.captions.filter((c) => c.id !== cap.id) })); }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bottomPanel === 'clips' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Clips ({project.clips.length})</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setProject((p) => ({ ...p, clips: [] }))}>Clear all</button>
                  </div>
                  {project.clips.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>No clips yet. Use "Create Clips" tool or ask Underlord to find viral moments.</p>}
                  <div className="space-y-1">
                    {project.clips.map((clip) => (
                      <div key={clip.id} className="flex items-center gap-3 px-3 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--surface-2)' }} onClick={() => seek(clip.start)}>
                        <span className="font-mono shrink-0" style={{ color: 'var(--accent)' }}>{formatTime(clip.start).split('.')[0]} → {formatTime(clip.end).split('.')[0]}</span>
                        <span style={{ flex: 1 }}>{clip.title}</span>
                        {clip.platform && <span className="badge badge-muted">{clip.platform}</span>}
                        <button className="btn-icon" style={{ padding: 2 }} onClick={(e) => { e.stopPropagation(); setProject((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== clip.id) })); }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div
          className="flex shrink-0"
          style={{ width: '340px', borderLeft: '1px solid var(--border)' }}
        >
          {/* Icon rail */}
          <div
            className="flex flex-col items-center py-3 gap-1"
            style={{ width: '44px', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
          >
            {RIGHT_PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => setRightPanel(p.id)}
                className="btn-icon"
                data-tip={p.label}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: rightPanel === p.id ? 'var(--accent-glow)' : 'transparent',
                  color: rightPanel === p.id ? 'var(--accent)' : 'var(--muted)',
                  border: rightPanel === p.id ? '1px solid rgba(232,255,71,0.2)' : '1px solid transparent',
                }}
              >
                {p.icon}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'underlord' && (
              <UnderlordSidebar project={project} model={model} onApplyActions={applyActions} />
            )}
            {rightPanel === 'tools' && (
              <AIToolsPanel project={project} model={model} onToolResult={handleToolResult} />
            )}
            {rightPanel === 'transcript' && (
              <TranscriptEditor
                segments={project.transcript}
                rawTranscript={project.rawTranscript}
                cuts={project.cuts}
                currentTime={currentTime}
                isRecording={isRecording}
                onTranscriptChange={(raw, segs) => setProject((p) => ({ ...p, rawTranscript: raw, transcript: segs }))}
                onSeek={seek}
                onAddCut={(cut) => setProject((p) => ({ ...p, cuts: [...p.cuts, cut] }))}
                onToggleRecording={toggleRecording}
              />
            )}
            {rightPanel === 'studio' && (
              <div className="overflow-y-auto h-full"><StudioSoundPanel /></div>
            )}
            {rightPanel === 'regenerate' && (
              <div className="overflow-y-auto h-full">
                <RegeneratePanel onPatchReady={(patch) => setProject((p) => ({ ...p, audioPatches: [...p.audioPatches, { id: generateId(), start: 0, end: 0, audioUrl: '', originalText: '', newText: patch.text }] }))} />
              </div>
            )}
            {rightPanel === 'videogen' && (
              <div className="overflow-y-auto h-full"><VideoGenPanel /></div>
            )}
          </div>
        </div>
      </div>

      {showExport && <ExportModal project={project} onClose={() => setShowExport(false)} />}
    </div>
  );
}
