'use client';
import { useState, useRef, useEffect } from 'react';
import { Monitor, Camera, Circle, Square, Download, Trash2, Play, Mic, MicOff } from 'lucide-react';

type RecordMode = 'screen' | 'camera' | 'both';

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  mode: RecordMode;
  name: string;
  createdAt: Date;
}

interface Props {
  onUseRecording: (file: File) => void;
}

export default function ScreenRecorder({ onUseRecording }: Props) {
  const [mode, setMode] = useState<RecordMode>('screen');
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [error, setError] = useState('');
  const [previewRecording, setPreviewRecording] = useState<Recording | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopStreams();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopStreams = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
  };

  const getStream = async (): Promise<MediaStream> => {
    const audioConstraints = audioEnabled
      ? { audio: { echoCancellation: true, noiseSuppression: true } }
      : { audio: false };

    if (mode === 'camera') {
      return navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        ...audioConstraints,
      });
    }

    if (mode === 'screen') {
      const screenStream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c: MediaStreamConstraints & { video?: boolean | MediaTrackConstraints }) => Promise<MediaStream>;
      }).getDisplayMedia({
        video: { frameRate: 30 },
        audio: audioEnabled,
      });

      // Overlay mic audio if enabled
      if (audioEnabled) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          micStream.getAudioTracks().forEach((t) => {
            ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
          });
          screenStream.getAudioTracks().forEach((t) => {
            ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
          });
          return new MediaStream([...screenStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        } catch {
          return screenStream;
        }
      }

      return screenStream;
    }

    // Both: PiP — screen + camera overlay
    const [screenStream, camStream] = await Promise.all([
      (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c: object) => Promise<MediaStream>;
      }).getDisplayMedia({ video: { frameRate: 30 }, audio: false }),
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: audioEnabled }),
    ]);

    // Composite via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    const screenVid = document.createElement('video');
    screenVid.srcObject = screenStream;
    screenVid.muted = true;
    await screenVid.play();

    const camVid = document.createElement('video');
    camVid.srcObject = camStream;
    camVid.muted = true;
    await camVid.play();

    const draw = () => {
      ctx.drawImage(screenVid, 0, 0, 1920, 1080);
      // Camera bubble bottom-right
      ctx.save();
      ctx.beginPath();
      ctx.arc(1920 - 180, 1080 - 120, 110, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(camVid, 1920 - 290, 1080 - 230, 220, 220);
      ctx.restore();
      requestAnimationFrame(draw);
    };
    draw();

    const composed = canvas.captureStream(30);
    if (audioEnabled) {
      camStream.getAudioTracks().forEach((t) => composed.addTrack(t));
    }

    return composed;
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await getStream();
      streamRef.current = stream;

      // Live preview
      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        livePreviewRef.current.muted = true;
        await livePreviewRef.current.play().catch(() => {});
      }
      setIsPreviewing(true);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const rec: Recording = {
          id: Date.now().toString(),
          blob,
          url,
          duration,
          mode,
          name: `${mode}-${new Date().toLocaleTimeString()}.webm`,
          createdAt: new Date(),
        };
        setRecordings((prev) => [rec, ...prev]);
        stopStreams();
        setIsPreviewing(false);
      };

      recorder.start(1000); // collect in 1s chunks
      mediaRecorderRef.current = recorder;

      startTimeRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      setIsRecording(true);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Permission denied. Allow screen/camera access and try again.');
      } else {
        setError(msg);
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setElapsed(0);
  };

  const useRecording = (rec: Recording) => {
    const file = new File([rec.blob], rec.name, { type: rec.blob.type });
    onUseRecording(file);
  };

  const deleteRecording = (id: string) => {
    setRecordings((prev) => {
      const r = prev.find((r) => r.id === id);
      if (r) URL.revokeObjectURL(r.url);
      return prev.filter((r) => r.id !== id);
    });
    if (previewRecording?.id === id) setPreviewRecording(null);
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const MODE_OPTIONS: { id: RecordMode; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: 'screen', icon: <Monitor size={13} />, label: 'Screen', desc: 'Capture your display' },
    { id: 'camera', icon: <Camera size={13} />, label: 'Camera', desc: 'Webcam only' },
    { id: 'both', icon: <><Monitor size={11} /><Camera size={11} /></>, label: 'Screen + Cam', desc: 'PiP overlay' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Monitor size={15} style={{ color: 'var(--accent)' }} />
        <h3 className="font-display font-semibold text-sm">Screen Recorder</h3>
      </div>

      {/* Live preview */}
      {isPreviewing && (
        <div className="relative rounded overflow-hidden animate-fade-in" style={{ border: '1px solid var(--border)' }}>
          <video ref={livePreviewRef} className="w-full" style={{ maxHeight: 140, background: '#000' }} />
          {isRecording && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <span className="animate-pulse-slow" style={{ color: 'var(--danger)', fontSize: 10 }}>●</span>
              <span className="font-mono text-xs text-white">{formatElapsed(elapsed)}</span>
            </div>
          )}
        </div>
      )}

      {/* Mode selector */}
      {!isRecording && (
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: 'var(--muted)' }}>Record source</label>
          <div className="grid grid-cols-3 gap-1.5">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="flex flex-col items-center gap-1 p-2.5 rounded text-xs transition-all"
                style={{
                  background: mode === m.id ? 'var(--accent-glow)' : 'var(--surface-2)',
                  border: `1px solid ${mode === m.id ? 'rgba(232,255,71,0.3)' : 'var(--border)'}`,
                  color: mode === m.id ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                <span className="flex gap-0.5">{m.icon}</span>
                <span className="font-medium">{m.label}</span>
                <span style={{ fontSize: '9px', color: 'var(--muted-2)' }}>{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio toggle */}
      {!isRecording && (
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="btn-icon"
            style={{ color: audioEnabled ? 'var(--accent)' : 'var(--muted)' }}
          >
            {audioEnabled ? <Mic size={13} /> : <MicOff size={13} />}
          </button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {audioEnabled ? 'Mic + system audio' : 'No audio'}
          </span>
        </label>
      )}

      {error && (
        <div className="px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Record / Stop button */}
      {!isRecording ? (
        <button className="btn btn-primary w-full justify-center" onClick={startRecording}>
          <Circle size={13} fill="currentColor" /> Start Recording
        </button>
      ) : (
        <button
          className="btn w-full justify-center"
          onClick={stopRecording}
          style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
        >
          <Square size={13} fill="currentColor" /> Stop Recording
        </button>
      )}

      {/* Recordings list */}
      {recordings.length > 0 && (
        <div className="space-y-2 mt-2">
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Recordings ({recordings.length})</p>
          {recordings.map((rec) => (
            <div key={rec.id} className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {previewRecording?.id === rec.id && (
                <video
                  ref={previewVideoRef}
                  src={rec.url}
                  controls
                  className="w-full"
                  style={{ maxHeight: 120, background: '#000' }}
                />
              )}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: 'var(--surface-2)' }}
              >
                <div>
                  <p className="text-xs font-medium truncate" style={{ maxWidth: 140 }}>{rec.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {formatElapsed(Math.round(rec.duration))} · {rec.mode}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-icon"
                    onClick={() => setPreviewRecording(previewRecording?.id === rec.id ? null : rec)}
                    data-tip="Preview"
                  >
                    <Play size={11} />
                  </button>
                  <a
                    href={rec.url}
                    download={rec.name}
                    className="btn-icon"
                    data-tip="Download"
                  >
                    <Download size={11} />
                  </a>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => useRecording(rec)}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    Edit this
                  </button>
                  <button className="btn-icon" onClick={() => deleteRecording(rec.id)} data-tip="Delete">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
