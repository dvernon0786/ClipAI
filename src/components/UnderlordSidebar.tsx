'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Zap, RotateCcw, ThumbsUp, ThumbsDown, ChevronDown, Bot } from 'lucide-react';
import type { UnderlordMessage, UnderlordAction, ProjectState } from '@/lib/types';
import { generateId } from '@/lib/utils';

interface Props {
  project: ProjectState;
  model: string;
  onApplyActions: (actions: UnderlordAction[]) => void;
}

const STARTER_PROMPTS = [
  'Polish this for YouTube',
  'Find 3 viral clips for Instagram Reels',
  'Remove all filler words and tighten pacing',
  'Create a 2-minute highlight reel',
  'Write a hook for this video',
  'Suggest cuts to improve flow',
];

export default function UnderlordSidebar({ project, model, onApplyActions }: Props) {
  const [messages, setMessages] = useState<UnderlordMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [showBriefInput, setShowBriefInput] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: UnderlordMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const conversationHistory = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'underlord',
          transcript: project.rawTranscript || '',
          messages: conversationHistory,
          model,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const assistantMsg: UnderlordMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.content,
        actions: data.actions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${String(err)}. Check your API key and try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, model, project.rawTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const applyAction = (msgId: string, action: UnderlordAction, idx: number) => {
    onApplyActions([action]);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const actions = [...(m.actions || [])];
        actions[idx] = { ...actions[idx], applied: true };
        return { ...m, actions };
      })
    );
  };

  const clearHistory = () => setMessages([]);

  const hasTranscript = !!project.rawTranscript;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-7 h-7 rounded"
            style={{ background: 'var(--accent-glow)', border: '1px solid rgba(232,255,71,0.2)' }}
          >
            <Bot size={14} color="var(--accent)" />
          </div>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Underlord
          </span>
          <span className="badge badge-accent" style={{ fontSize: '10px' }}>β</span>
        </div>
        <button className="btn-icon" onClick={clearHistory} data-tip="Clear history">
          <RotateCcw size={13} />
        </button>
      </div>

      {/* No transcript warning */}
      {!hasTranscript && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded text-xs"
          style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.2)', color: 'var(--warn)' }}
        >
          Load a transcript first for best results. Underlord works best when it can read your video content.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="animate-fade-in">
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Your AI co-editor. Ask anything — edit, restructure, generate clips, improve pacing.
            </p>
            <div className="space-y-1.5">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="w-full text-left px-3 py-2 rounded text-xs transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`animate-fade-in ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div
                className="px-3 py-2 rounded-lg text-xs max-w-[85%]"
                style={{ background: 'var(--surface-3)', color: 'var(--text)' }}
              >
                {msg.content}
              </div>
            ) : (
              <div>
                <div
                  className="px-3 py-2.5 rounded-lg text-xs leading-relaxed"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>

                {/* Actions */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {msg.actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyAction(msg.id, action, idx)}
                        disabled={action.applied}
                        className="w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-all"
                        style={{
                          background: action.applied
                            ? 'rgba(42,255,143,0.05)'
                            : 'var(--accent-glow)',
                          border: `1px solid ${action.applied ? 'rgba(42,255,143,0.2)' : 'rgba(232,255,71,0.25)'}`,
                          color: action.applied ? 'var(--success)' : 'var(--accent)',
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <Zap size={11} />
                          {action.label}
                        </span>
                        <span style={{ color: action.applied ? 'var(--success)' : 'var(--accent-dim)' }}>
                          {action.applied ? '✓ Applied' : 'Apply'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Feedback */}
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <button className="btn-icon" style={{ padding: '3px' }}>
                    <ThumbsUp size={11} />
                  </button>
                  <button className="btn-icon" style={{ padding: '3px' }}>
                    <ThumbsDown size={11} />
                  </button>
                  <span className="text-xs" style={{ color: 'var(--muted-2)', fontSize: '10px' }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg animate-fade-in" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Project brief toggle */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowBriefInput(!showBriefInput)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs transition-colors"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span>Project brief (optional context)</span>
          <ChevronDown
            size={12}
            style={{ transform: showBriefInput ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
          />
        </button>
        {showBriefInput && (
          <div className="px-3 pb-2 animate-fade-in">
            <textarea
              className="input text-xs"
              rows={2}
              placeholder="e.g. YouTube tutorial for developers, fast-paced, keep under 10 mins…"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="input flex-1 text-xs"
            rows={2}
            placeholder="Ask Underlord anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ resize: 'none', minHeight: 'unset' }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => send(brief ? `Context: ${brief}\n\n${input}` : input)}
            disabled={!input.trim() || loading}
            style={{ padding: '8px' }}
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--muted-2)' }}>
          ↵ send · ⇧↵ newline
        </p>
      </div>
    </div>
  );
}
