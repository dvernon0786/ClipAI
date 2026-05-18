'use client';
import { useState } from 'react';
import type { Caption } from '@/lib/types';

export type CaptionStyle = {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  background: string;
  textShadow: string;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  letterSpacing: string;
  padding: string;
  borderRadius: string;
  wordsPerLine: 2 | 3 | 4 | 6;
  position: 'bottom' | 'top' | 'center';
};

export const CAPTION_PRESETS: CaptionStyle[] = [
  {
    id: 'classic-white',
    name: 'Classic White',
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    background: 'rgba(0,0,0,0.75)',
    textShadow: 'none',
    textTransform: 'none',
    letterSpacing: '0',
    padding: '6px 14px',
    borderRadius: '4px',
    wordsPerLine: 6,
    position: 'bottom',
  },
  {
    id: 'impact-yellow',
    name: 'Impact Yellow',
    fontFamily: '"Impact", "Arial Narrow", sans-serif',
    fontSize: 26,
    fontWeight: '900',
    color: '#FFE600',
    background: 'transparent',
    textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '4px 8px',
    borderRadius: '0',
    wordsPerLine: 3,
    position: 'bottom',
  },
  {
    id: 'bold-two-words',
    name: 'Bold Two Words',
    fontFamily: '"Syne", sans-serif',
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    background: 'rgba(0,0,0,0.85)',
    textShadow: 'none',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    padding: '8px 18px',
    borderRadius: '6px',
    wordsPerLine: 2,
    position: 'center',
  },
  {
    id: 'karaoke-green',
    name: 'Karaoke Green',
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 20,
    fontWeight: '700',
    color: '#2aff8f',
    background: 'rgba(0,0,0,0.8)',
    textShadow: '0 0 12px rgba(42,255,143,0.4)',
    textTransform: 'none',
    letterSpacing: '0.5px',
    padding: '6px 16px',
    borderRadius: '100px',
    wordsPerLine: 4,
    position: 'bottom',
  },
  {
    id: 'modern-yellow-wave',
    name: 'Modern Yellow Wave',
    fontFamily: '"Syne", sans-serif',
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    background: '#e8ff47',
    textShadow: 'none',
    textTransform: 'none',
    letterSpacing: '0',
    padding: '5px 14px',
    borderRadius: '4px',
    wordsPerLine: 4,
    position: 'bottom',
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    fontFamily: '"DM Mono", monospace',
    fontSize: 16,
    fontWeight: '400',
    color: '#f0f0f0',
    background: 'rgba(10,10,11,0.9)',
    textShadow: 'none',
    textTransform: 'none',
    letterSpacing: '0.5px',
    padding: '8px 16px',
    borderRadius: '3px',
    wordsPerLine: 6,
    position: 'bottom',
  },
  {
    id: 'large-bold-white',
    name: 'Large Bold White',
    fontFamily: '"Syne", sans-serif',
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    background: 'transparent',
    textShadow: '2px 2px 8px rgba(0,0,0,0.9), -1px -1px 6px rgba(0,0,0,0.9)',
    textTransform: 'none',
    letterSpacing: '-0.5px',
    padding: '4px 8px',
    borderRadius: '0',
    wordsPerLine: 4,
    position: 'bottom',
  },
  {
    id: 'bold-italic-red',
    name: 'Bold Italic Red',
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 22,
    fontWeight: '700',
    color: '#ff5f57',
    background: 'rgba(0,0,0,0.75)',
    textShadow: 'none',
    textTransform: 'none',
    letterSpacing: '0',
    padding: '6px 14px',
    borderRadius: '4px',
    wordsPerLine: 4,
    position: 'bottom',
  },
];

interface Props {
  captions: Caption[];
  selectedStyleId: string;
  onStyleChange: (styleId: string) => void;
}

export default function CaptionStylePanel({ captions, selectedStyleId, onStyleChange }: Props) {
  const [customising, setCustomising] = useState(false);
  const selected = CAPTION_PRESETS.find((p) => p.id === selectedStyleId) || CAPTION_PRESETS[0];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Caption Style</h3>
        <span className="badge badge-muted">{captions.length} captions</span>
      </div>

      {captions.length === 0 && (
        <div className="px-3 py-2 rounded text-xs" style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.2)', color: 'var(--warn)' }}>
          Generate captions first using the AI Tools panel.
        </div>
      )}

      {/* Preview */}
      <div
        className="relative rounded overflow-hidden flex items-end justify-center"
        style={{ height: 80, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '1px solid var(--border)' }}
      >
        <div style={{ marginBottom: selected.position === 'bottom' ? 8 : selected.position === 'top' ? 'auto' : 'auto', marginTop: selected.position === 'top' ? 8 : 'auto', position: selected.position === 'center' ? 'absolute' : 'relative', top: selected.position === 'center' ? '50%' : 'auto', transform: selected.position === 'center' ? 'translateY(-50%)' : 'none' }}>
          <span
            style={{
              fontFamily: selected.fontFamily,
              fontSize: `${Math.round(selected.fontSize * 0.65)}px`,
              fontWeight: selected.fontWeight,
              color: selected.color,
              background: selected.background,
              textShadow: selected.textShadow,
              textTransform: selected.textTransform,
              letterSpacing: selected.letterSpacing,
              padding: selected.padding,
              borderRadius: selected.borderRadius,
              display: 'inline-block',
            }}
          >
            {selected.textTransform === 'uppercase' ? 'PREVIEW TEXT HERE' : 'Preview text here'}
          </span>
        </div>
      </div>

      {/* Style grid */}
      <div className="grid grid-cols-2 gap-2">
        {CAPTION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onStyleChange(preset.id)}
            className="relative rounded overflow-hidden transition-all"
            style={{
              height: 52,
              background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)',
              border: `2px solid ${selectedStyleId === preset.id ? 'var(--accent)' : 'var(--border)'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: preset.fontFamily,
                fontSize: `${Math.round(preset.fontSize * 0.45)}px`,
                fontWeight: preset.fontWeight,
                color: preset.color,
                background: preset.background,
                textShadow: preset.textShadow,
                textTransform: preset.textTransform,
                letterSpacing: preset.letterSpacing,
                padding: '1px 5px',
                borderRadius: preset.borderRadius,
                whiteSpace: 'nowrap',
              }}
            >
              {preset.textTransform === 'uppercase' ? preset.name.toUpperCase() : preset.name}
            </span>
            {selectedStyleId === preset.id && (
              <div
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: 'var(--accent)' }}
              >
                <span style={{ fontSize: 9, color: '#000', fontWeight: 700 }}>✓</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Position selector */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>Position</label>
        <div className="flex gap-2">
          {(['bottom', 'center', 'top'] as const).map((pos) => (
            <button
              key={pos}
              className="btn btn-ghost btn-sm flex-1 capitalize"
              style={{
                borderColor: selected.position === pos ? 'var(--accent)' : 'var(--border)',
                color: selected.position === pos ? 'var(--accent)' : 'var(--muted)',
              }}
              onClick={() => {
                // Update position of current preset (custom override)
                const idx = CAPTION_PRESETS.findIndex((p) => p.id === selectedStyleId);
                if (idx >= 0) CAPTION_PRESETS[idx].position = pos;
                onStyleChange(selectedStyleId); // trigger re-render
              }}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Words per line */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>
          Words per line: <span style={{ color: 'var(--accent)' }}>{selected.wordsPerLine}</span>
        </label>
        <input
          type="range"
          min={1}
          max={8}
          value={selected.wordsPerLine}
          onChange={(e) => {
            const idx = CAPTION_PRESETS.findIndex((p) => p.id === selectedStyleId);
            if (idx >= 0) (CAPTION_PRESETS[idx].wordsPerLine as number) = Number(e.target.value);
            onStyleChange(selectedStyleId);
          }}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      <p className="text-xs" style={{ color: 'var(--muted-2)' }}>
        Style is applied to the caption overlay in real-time. Burn-in on export via FFmpeg worker.
      </p>
    </div>
  );
}

// Helper: get overlay styles for the video overlay component
export function getCaptionOverlayStyle(style: CaptionStyle): React.CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    background: style.background,
    textShadow: style.textShadow,
    textTransform: style.textTransform,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
    borderRadius: style.borderRadius,
    maxWidth: '80%',
    textAlign: 'center',
    display: 'inline-block',
  };
}
