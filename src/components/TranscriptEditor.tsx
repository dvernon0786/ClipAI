'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, ClipboardPaste, Trash2, Edit3, Scissors } from 'lucide-react';
import type { TranscriptSegment, CutRegion } from '@/lib/types';
import { generateId, formatTime } from '@/lib/utils';

interface Props {
  segments: TranscriptSegment[];
  rawTranscript: string;
  cuts: CutRegion[];
  currentTime: number;
  isRecording: boolean;
  onTranscriptChange: (raw: string, segments: TranscriptSegment[]) => void;
  onSeek: (time: number) => void;
  onAddCut: (cut: CutRegion) => void;
  onToggleRecording: () => void;
}

export default function TranscriptEditor({
  segments, rawTranscript, cuts, currentTime, isRecording,
  onTranscriptChange, onSeek, onAddCut, onToggleRecording,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(rawTranscript);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditText(rawTranscript);
  }, [rawTranscript]);

  const parseRawTranscript = useCallback((text: string): TranscriptSegment[] => {
    if (!text.trim()) return [];

    // Try to parse lines with timestamps like "0:00 text" or "[00:00] text"
    const lines = text.split('\n').filter(Boolean);
    const tsPattern = /^[\[\(]?(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)[\]\)]?\s*/;

    const segs: TranscriptSegment[] = [];

    lines.forEach((line, i) => {
      const match = line.match(tsPattern);
      if (match) {
        const timeStr = match[1];
        const parts = timeStr.split(':').map(Number);
        let t = 0;
        if (parts.length === 3) t = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) t = parts[0] * 60 + parts[1];
        const segText = line.slice(match[0].length);
        segs.push({ id: generateId(), text: segText, start: t, end: t + 5 });
      } else {
        segs.push({ id: generateId(), text: line, start: i * 5, end: (i + 1) * 5 });
      }
    });

    // Fix end times
    for (let i = 0; i < segs.length - 1; i++) {
      if (segs[i].end <= segs[i].start) segs[i].end = segs[i + 1].start;
    }

    return segs;
  }, []);

  const saveEdit = () => {
    const segs = parseRawTranscript(editText);
    onTranscriptChange(editText, segs);
    setEditMode(false);
  };

  const applyPaste = () => {
    const segs = parseRawTranscript(pasteText);
    onTranscriptChange(pasteText, segs);
    setEditText(pasteText);
    setPasteText('');
    setShowPaste(false);
  };

  const isInCut = (start: number, end: number) =>
    cuts.some((c) => c.start <= start && c.end >= end);

  const isCurrentSegment = (seg: TranscriptSegment) =>
    currentTime >= seg.start && currentTime < seg.end;

  const markAsCut = (seg: TranscriptSegment) => {
    onAddCut({ id: generateId(), start: seg.start, end: seg.end, reason: 'Manual cut from transcript' });
  };

  if (editMode) {
    return (
      <div className="flex flex-col h-full p-3 gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Editing transcript</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="input flex-1 font-mono text-xs"
          style={{ resize: 'none', lineHeight: 1.7 }}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="Paste transcript here. Add timestamps like '0:00 Text' for sync."
          autoFocus
        />
      </div>
    );
  }

  if (showPaste) {
    return (
      <div className="flex flex-col h-full p-3 gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Paste transcript</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPaste(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={applyPaste} disabled={!pasteText.trim()}>Apply</button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Paste any transcript. Add timestamps like <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>0:00</code> at line starts for timeline sync.
        </p>
        <textarea
          className="input flex-1 font-mono text-xs"
          style={{ resize: 'none', lineHeight: 1.7 }}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"0:00 Welcome to this tutorial\n0:12 Today we're going to cover...\n1:05 The first step is..."}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          <button
            className={`btn btn-sm ${isRecording ? 'btn-danger' : 'btn-ghost'}`}
            onClick={onToggleRecording}
          >
            {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Live Transcribe</>}
          </button>
          {isRecording && (
            <span className="badge badge-danger animate-pulse-slow">● REC</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-icon" onClick={() => setShowPaste(true)} data-tip="Paste transcript">
            <ClipboardPaste size={13} />
          </button>
          <button className="btn-icon" onClick={() => setEditMode(true)} data-tip="Edit transcript">
            <Edit3 size={13} />
          </button>
          {rawTranscript && (
            <button
              className="btn-icon"
              onClick={() => onTranscriptChange('', [])}
              data-tip="Clear transcript"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!rawTranscript && !isRecording && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-3)' }}
            >
              <Mic size={18} style={{ color: 'var(--muted)' }} />
            </div>
            <div>
              <p className="text-sm font-medium">No transcript yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Use Live Transcribe, paste text, or run Whisper externally and paste the output.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPaste(true)}>
                <ClipboardPaste size={12} /> Paste transcript
              </button>
              <button className="btn btn-primary btn-sm" onClick={onToggleRecording}>
                <Mic size={12} /> Start recording
              </button>
            </div>
          </div>
        )}

        {isRecording && !rawTranscript && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <span className="animate-pulse-slow" style={{ color: 'var(--danger)' }}>●</span>
            Listening… (Chrome/Edge only)
          </div>
        )}

        {segments.length > 0 && (
          <div className="space-y-1">
            {segments.map((seg) => {
              const cut = isInCut(seg.start, seg.end);
              const active = isCurrentSegment(seg);
              return (
                <div
                  key={seg.id}
                  className="group flex gap-2.5 items-start px-2 py-1.5 rounded cursor-pointer transition-all"
                  style={{
                    background: active ? 'var(--accent-glow)' : cut ? 'rgba(255,95,87,0.06)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(232,255,71,0.2)' : cut ? 'rgba(255,95,87,0.1)' : 'transparent'}`,
                  }}
                  onClick={() => onSeek(seg.start)}
                >
                  <span
                    className="shrink-0 font-mono text-xs pt-0.5 select-none"
                    style={{ color: active ? 'var(--accent)' : 'var(--muted-2)', fontSize: '10px', minWidth: '38px' }}
                  >
                    {formatTime(seg.start).split('.')[0]}
                  </span>
                  <span
                    className="flex-1 text-xs leading-relaxed"
                    style={{
                      color: cut ? 'var(--danger)' : active ? 'var(--text)' : 'var(--text)',
                      textDecoration: cut ? 'line-through' : 'none',
                      opacity: cut ? 0.6 : 1,
                    }}
                  >
                    {seg.text}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon shrink-0"
                    style={{ padding: '2px' }}
                    onClick={(e) => { e.stopPropagation(); markAsCut(seg); }}
                    data-tip="Mark as cut"
                  >
                    <Scissors size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {rawTranscript && segments.length === 0 && (
          <pre
            className="text-xs leading-relaxed"
            style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          >
            {rawTranscript}
          </pre>
        )}
      </div>
    </div>
  );
}

