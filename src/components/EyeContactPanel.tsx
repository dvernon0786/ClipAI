'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Play, Square, Download, AlertCircle, Loader } from 'lucide-react';

interface Props {
  videoUrl: string | null;
  videoFile: File | null;
}

// Iris landmark indices in MediaPipe Face Mesh
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_EYE_CENTER = 468;
const RIGHT_EYE_CENTER = 473;

type Status = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error';

export default function EyeContactPanel({ videoUrl, videoFile }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [enabled, setEnabled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [mpLoaded, setMpLoaded] = useState(false);
  const [intensity, setIntensity] = useState(0.6); // 0-1 correction strength

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const animRef = useRef<number>(0);
  const lastLandmarksRef = useRef<Landmark[] | null>(null);

  // Load MediaPipe lazily
  const loadMediaPipe = useCallback(async () => {
    if (mpLoaded) return true;
    setStatus('loading');
    try {
      // @ts-expect-error — mediapipe loaded via CDN script tag
      if (typeof window.FaceMesh === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      }
      // @ts-expect-error
      const fm = new window.FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // needed for iris
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      fm.onResults((results: FaceMeshResults) => {
        if (results.multiFaceLandmarks?.[0]) {
          lastLandmarksRef.current = results.multiFaceLandmarks[0];
        } else {
          lastLandmarksRef.current = null;
        }
      });
      await fm.initialize();
      faceMeshRef.current = fm;
      setMpLoaded(true);
      setStatus('ready');
      return true;
    } catch (e) {
      setErrorMsg('Failed to load MediaPipe. Check your internet connection.');
      setStatus('error');
      return false;
    }
  }, [mpLoaded]);

  // Real-time eye contact overlay on live video
  useEffect(() => {
    if (!enabled || !videoUrl || !overlayRef.current || !videoRef.current) return;

    let running = true;

    const runLoop = async () => {
      const ok = await loadMediaPipe();
      if (!ok || !running) return;

      const video = videoRef.current!;
      const overlay = overlayRef.current!;
      const ctx = overlay.getContext('2d')!;

      const draw = async () => {
        if (!running || !faceMeshRef.current) return;
        overlay.width = video.videoWidth || 640;
        overlay.height = video.videoHeight || 360;

        if (!video.paused && !video.ended && video.readyState >= 2) {
          await faceMeshRef.current.send({ image: video });
          applyEyeContactOverlay(ctx, overlay, lastLandmarksRef.current, intensity);
        }
        animRef.current = requestAnimationFrame(draw);
      };
      draw();
    };

    runLoop();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [enabled, videoUrl, intensity, loadMediaPipe]);

  // Offline processing: render corrected video to canvas + capture
  const processVideo = async () => {
    if (!videoFile || !videoUrl) return;
    const ok = await loadMediaPipe();
    if (!ok) return;

    setStatus('processing');
    setProgress(0);

    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    await new Promise<void>((res) => { video.onloadedmetadata = () => res(); });
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;

    const chunks: Blob[] = [];
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finished = new Promise<void>((res) => { rec.onstop = () => res(); });
    rec.start();

    const duration = video.duration;
    const fps = 30;
    const totalFrames = Math.floor(duration * fps);
    let frame = 0;

    const processFrame = async () => {
      if (video.ended || frame >= totalFrames) {
        rec.stop();
        return;
      }
      ctx.drawImage(video, 0, 0);
      if (faceMeshRef.current) {
        await faceMeshRef.current.send({ image: canvas });
        applyEyeContactOverlay(ctx, canvas, lastLandmarksRef.current, intensity);
      }
      frame++;
      setProgress(Math.round((frame / totalFrames) * 100));
      video.currentTime = frame / fps;
      setTimeout(processFrame, 1000 / fps);
    };

    video.onseeked = processFrame;
    processFrame();

    await finished;
    const blob = new Blob(chunks, { type: 'video/webm' });
    setOutputUrl(URL.createObjectURL(blob));
    setStatus('done');
    video.remove();
  };

  if (!videoUrl) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="font-display font-semibold text-sm">Eye Contact</h3>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Load a video first to use Eye Contact correction.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="font-display font-semibold text-sm">Eye Contact</h3>
          <span className="badge badge-muted">MediaPipe</span>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className="btn btn-ghost btn-sm"
          style={{ color: enabled ? 'var(--accent)' : 'var(--muted)', borderColor: enabled ? 'var(--accent)' : 'var(--border)' }}
        >
          {enabled ? <><Eye size={11} /> Live On</> : <><EyeOff size={11} /> Off</>}
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Redirects gaze to the camera using AI iris tracking. Best for straight-to-camera monologues. Avoid using on interview shots.
      </p>

      {/* Live preview with overlay */}
      <div className="relative rounded overflow-hidden" style={{ border: '1px solid var(--border)', background: '#000' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full"
          style={{ maxHeight: 150, display: 'block' }}
          controls
        />
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            opacity: enabled ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        />
        {enabled && status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-2 text-xs text-white">
              <Loader size={12} className="animate-spin" /> Loading AI model…
            </div>
          </div>
        )}
      </div>

      {/* Intensity slider */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>
          Correction intensity: <span style={{ color: 'var(--accent)' }}>{Math.round(intensity * 100)}%</span>
        </label>
        <input
          type="range" min={0} max={1} step={0.05}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
        <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--muted-2)' }}>
          <span>Subtle</span><span>Full</span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', color: 'var(--danger)' }}>
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {status === 'processing' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
            <span>Processing frames…</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--surface-3)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-2)' }}>This may take a few minutes for long videos.</p>
        </div>
      )}

      {status === 'done' && outputUrl && (
        <a href={outputUrl} download="eye_contact_corrected.webm" className="btn btn-primary w-full justify-center">
          <Download size={13} /> Download Corrected Video
        </a>
      )}

      <div className="flex gap-2">
        {status !== 'processing' && (
          <button
            className="btn btn-ghost btn-sm flex-1"
            onClick={() => { loadMediaPipe(); setEnabled(true); }}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? <><Loader size={11} className="animate-spin" /> Loading…</> : <><Eye size={11} /> Enable Live Preview</>}
          </button>
        )}
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={processVideo}
          disabled={status === 'processing' || status === 'loading'}
        >
          {status === 'processing' ? <><Loader size={11} className="animate-spin" /> Processing…</> : <><Play size={11} /> Process & Export</>}
        </button>
      </div>

      <div className="px-3 py-2 rounded text-xs space-y-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--muted)', fontWeight: 500 }}>Tips</p>
        <p style={{ color: 'var(--muted-2)' }}>✓ Works best on front-facing, well-lit shots</p>
        <p style={{ color: 'var(--muted-2)' }}>✗ Avoid on side-profile or interview shots</p>
        <p style={{ color: 'var(--muted-2)' }}>Processing is CPU-heavy — short clips recommended</p>
      </div>
    </div>
  );
}

// --- MediaPipe iris correction drawing ---

interface Landmark { x: number; y: number; z: number; }
interface FaceMeshResults {
  multiFaceLandmarks?: Landmark[][];
}
interface FaceMesh {
  setOptions(opts: object): void;
  onResults(cb: (r: FaceMeshResults) => void): void;
  initialize(): Promise<void>;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
}

function applyEyeContactOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  landmarks: Landmark[] | null,
  intensity: number,
) {
  if (!landmarks || landmarks.length < 478) return;

  const W = canvas.width;
  const H = canvas.height;

  // Calculate current iris centres
  const leftIris = landmarks[LEFT_EYE_CENTER];
  const rightIris = landmarks[RIGHT_EYE_CENTER];

  // Target: centre of the canvas horizontally, same vertical position
  const targetX = 0.5; // normalised
  const leftTargetX = targetX - (rightIris.x - leftIris.x) / 2;
  const rightTargetX = targetX + (rightIris.x - leftIris.x) / 2;

  // Blend toward target based on intensity
  const lx = lerp(leftIris.x, leftTargetX, intensity);
  const rx = lerp(rightIris.x, rightTargetX, intensity);

  // Draw correction blobs over each iris
  const irisRadius = Math.abs(landmarks[LEFT_IRIS[1]].x - landmarks[LEFT_IRIS[3]].x) * W * 0.5;

  [
    { orig: leftIris, corrX: lx },
    { orig: rightIris, corrX: rx },
  ].forEach(({ orig, corrX }) => {
    const origPx = { x: orig.x * W, y: orig.y * H };
    const corrPx = { x: corrX * W, y: orig.y * H };

    if (Math.abs(origPx.x - corrPx.x) < 1) return; // no correction needed

    // Sample pixel colour at iris centre
    const sample = ctx.getImageData(Math.round(origPx.x), Math.round(origPx.y), 1, 1).data;
    const irisColor = `rgba(${sample[0]},${sample[1]},${sample[2]},0.95)`;

    // Erase original iris position with skin-tone patch
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const eraseGrad = ctx.createRadialGradient(origPx.x, origPx.y, 0, origPx.x, origPx.y, irisRadius * 1.2);
    const skinSample = ctx.getImageData(Math.round(origPx.x), Math.round(origPx.y - irisRadius * 2), 1, 1).data;
    eraseGrad.addColorStop(0, `rgba(${skinSample[0]},${skinSample[1]},${skinSample[2]},0.6)`);
    eraseGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eraseGrad;
    ctx.beginPath();
    ctx.arc(origPx.x, origPx.y, irisRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Draw iris at corrected position
    const irisGrad = ctx.createRadialGradient(corrPx.x, corrPx.y, 0, corrPx.x, corrPx.y, irisRadius);
    irisGrad.addColorStop(0, irisColor);
    irisGrad.addColorStop(0.7, irisColor);
    irisGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(corrPx.x, corrPx.y, irisRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
