'use client';
import { useState, useEffect } from 'react';
import { Mic2, RefreshCw, Upload, Play, Loader } from 'lucide-react';

interface Voice { voice_id: string; name: string; category: string; }

interface Props {
  onPatchReady: (patch: { audioBase64: string; text: string }) => void;
}

export default function RegeneratePanel({ onPatchReady }: Props) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [audioBase64, setAudioBase64] = useState('');
  const [error, setError] = useState('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    fetchVoices();
  }, []);

  const fetchVoices = async () => {
    setLoadingVoices(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'listVoices' }),
      });
      const data = await res.json();
      setVoices(data.voices || []);
      if (data.voices?.length > 0) setSelectedVoice(data.voices[0].voice_id);
    } catch {
      setError('Could not load voices. Check ElevenLabs API key.');
    } finally {
      setLoadingVoices(false);
    }
  };

  const regenerate = async () => {
    if (!text || !selectedVoice) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'regenerate', text, voiceId: selectedVoice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAudioBase64(data.audioBase64);
      onPatchReady({ audioBase64: data.audioBase64, text });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const cloneVoice = async () => {
    if (!cloneFile || !cloneName) return;
    setCloning(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(cloneFile);
      });

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'cloneVoice', audioBase64: base64, voiceName: cloneName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchVoices();
      setSelectedVoice(data.voiceId);
      setCloneFile(null);
      setCloneName('');
      alert(`Voice "${cloneName}" cloned successfully!`);
    } catch (err) {
      setError(String(err));
    } finally {
      setCloning(false);
    }
  };

  const playAudio = () => {
    if (!audioBase64) return;
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    audio.play();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Mic2 size={15} style={{ color: 'var(--accent)' }} />
        <h3 className="font-display font-semibold text-sm">Regenerate Speech</h3>
        <span className="badge badge-muted">ElevenLabs</span>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Fix mis-spoken words without re-recording. Type the correction and generate replacement audio.
      </p>

      {/* Voice selector */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>Voice</label>
        {loadingVoices ? (
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            <Loader size={11} className="animate-spin inline mr-1" /> Loading voices…
          </div>
        ) : (
          <select
            className="input text-xs"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>{v.name} {v.category === 'cloned' ? '(cloned)' : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Text to regenerate */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>Replacement text</label>
        <textarea
          className="input text-xs"
          rows={3}
          placeholder="Type the words you want to regenerate…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn btn-primary flex-1 justify-center" onClick={regenerate} disabled={!text || !selectedVoice || loading}>
          {loading ? <><Loader size={13} className="animate-spin" /> Generating…</> : <><RefreshCw size={13} /> Regenerate</>}
        </button>
        {audioBase64 && (
          <button className="btn btn-ghost btn-sm" onClick={playAudio}>
            <Play size={12} /> Preview
          </button>
        )}
      </div>

      {/* Voice clone section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>Clone your voice</p>
        <input
          className="input text-xs mb-2"
          placeholder="Voice name"
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
        />
        <label className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer mb-2" style={{ border: '1px dashed var(--border)', background: 'var(--surface-2)' }}>
          <Upload size={12} style={{ color: 'var(--muted)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{cloneFile ? cloneFile.name : 'Upload audio sample (30s–3min recommended)'}</span>
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => setCloneFile(e.target.files?.[0] || null)} />
        </label>
        <button className="btn btn-ghost btn-sm w-full justify-center" onClick={cloneVoice} disabled={!cloneFile || !cloneName || cloning}>
          {cloning ? <><Loader size={12} className="animate-spin" /> Cloning…</> : 'Clone Voice'}
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted-2)' }}>Free tier: 10,000 chars/month via ElevenLabs</p>
    </div>
  );
}
