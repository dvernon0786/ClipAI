'use client';
import { useState } from 'react';
import {
  Scissors, Lightbulb, Type, Hash, BookOpen, Film, Languages,
  MicVocal, Wand2, Layers, FileText, AlignLeft, ChevronDown, ChevronRight
} from 'lucide-react';
import type { AIToolResult, ProjectState } from '@/lib/types';
import { generateId, downloadFile, captionsToSRT, captionsToVTT } from '@/lib/utils';

interface Props {
  project: ProjectState;
  model: string;
  onToolResult: (result: AIToolResult, structured: unknown) => void;
}

type ToolGroup = {
  label: string;
  tools: Tool[];
};

type Tool = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  hasExtra?: boolean;
  extraPlaceholder?: string;
};

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: 'Analyse',
    tools: [
      { id: 'summarize', label: 'Summarize', icon: <AlignLeft size={13} />, description: '3–5 sentence TL;DR' },
      { id: 'keyMoments', label: 'Key Moments', icon: <Lightbulb size={13} />, description: '4–6 timestamped highlights' },
      { id: 'editForClarity', label: 'Edit for Clarity', icon: <Wand2 size={13} />, description: 'Pacing + clarity analysis' },
      { id: 'fillerWords', label: 'Filler Words', icon: <MicVocal size={13} />, description: 'Detect ums, uhs, dead phrases' },
    ],
  },
  {
    label: 'Edit',
    tools: [
      { id: 'suggestCuts', label: 'Suggest Cuts', icon: <Scissors size={13} />, description: 'Find what to remove' },
      { id: 'createClips', label: 'Create Clips', icon: <Film size={13} />, description: 'Find viral social clips', hasExtra: true, extraPlaceholder: 'How many clips? (default 3)' },
      { id: 'chapterMarkers', label: 'Chapter Markers', icon: <Layers size={13} />, description: 'YouTube chapter list' },
    ],
  },
  {
    label: 'Captions',
    tools: [
      { id: 'captions', label: 'Generate Captions', icon: <Type size={13} />, description: 'Timed caption objects' },
    ],
  },
  {
    label: 'Publish',
    tools: [
      { id: 'titleDescription', label: 'Title & Description', icon: <FileText size={13} />, description: '3 titles + YouTube desc' },
      { id: 'showNotes', label: 'Show Notes', icon: <BookOpen size={13} />, description: 'Podcast-style notes' },
      { id: 'hashtagsKeywords', label: 'Hashtags & SEO', icon: <Hash size={13} />, description: '10 hashtags + 8 keywords' },
      { id: 'translation', label: 'Translate', icon: <Languages size={13} />, description: 'Translate transcript', hasExtra: true, extraPlaceholder: 'Target language (e.g. Spanish)' },
    ],
  },
  {
    label: 'Create',
    tools: [
      { id: 'scriptFromPrompt', label: 'Script from Prompt', icon: <FileText size={13} />, description: 'Generate a video script', hasExtra: true, extraPlaceholder: 'Describe the video you want to make…' },
      { id: 'projectBrief', label: 'Project Brief', icon: <Layers size={13} />, description: 'Full editing plan', hasExtra: true, extraPlaceholder: 'Goal: e.g. Polish for YouTube' },
    ],
  },
];

export default function AIToolsPanel({ project, model, onToolResult }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AIToolResult>>({});
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Analyse: true, Edit: true, Captions: true, Publish: false, Create: false,
  });

  const runTool = async (toolId: string) => {
    if (!project.rawTranscript && toolId !== 'scriptFromPrompt') {
      alert('Please load a transcript first.');
      return;
    }
    setLoading(toolId);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'tool',
          tool: toolId,
          transcript: project.rawTranscript,
          extra: extras[toolId] || '',
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      const result: AIToolResult = {
        tool: toolId,
        content: data.content,
        structured: data.structured,
        timestamp: new Date(),
      };
      setResults((prev) => ({ ...prev, [toolId]: result }));
      setExpanded(toolId);
      onToolResult(result, data.structured);
    } catch (err) {
      alert(`Tool error: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const exportCaptions = (format: 'srt' | 'vtt') => {
    if (!project.captions.length) return;
    const content = format === 'srt' ? captionsToSRT(project.captions) : captionsToVTT(project.captions);
    downloadFile(content, `captions.${format}`, 'text/plain');
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--surface)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="font-display font-semibold text-sm">AI Tools</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Powered by {model.split('/').pop()}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {TOOL_GROUPS.map((group) => (
          <div key={group.label} style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: '10px',
              }}
            >
              {group.label}
              {openGroups[group.label] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>

            {openGroups[group.label] && (
              <div className="px-2 pb-2 space-y-1">
                {group.tools.map((tool) => (
                  <div key={tool.id}>
                    {/* Extra input */}
                    {tool.hasExtra && (
                      <input
                        className="input mb-1"
                        style={{ fontSize: '11px', padding: '5px 10px' }}
                        placeholder={tool.extraPlaceholder}
                        value={extras[tool.id] || ''}
                        onChange={(e) => setExtras((prev) => ({ ...prev, [tool.id]: e.target.value }))}
                      />
                    )}

                    <button
                      onClick={() => runTool(tool.id)}
                      disabled={loading === tool.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-left transition-all"
                      style={{
                        background: results[tool.id] ? 'rgba(232,255,71,0.04)' : 'var(--surface-2)',
                        border: `1px solid ${results[tool.id] ? 'rgba(232,255,71,0.15)' : 'var(--border)'}`,
                        color: 'var(--text)',
                        opacity: loading && loading !== tool.id ? 0.5 : 1,
                      }}
                    >
                      <span style={{ color: results[tool.id] ? 'var(--accent)' : 'var(--muted)' }}>
                        {loading === tool.id ? (
                          <div className="animate-spin" style={{ width: 13, height: 13, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                        ) : tool.icon}
                      </span>
                      <span className="flex-1">
                        <span className="font-medium">{tool.label}</span>
                        <span className="block" style={{ color: 'var(--muted)', fontSize: '10px' }}>{tool.description}</span>
                      </span>
                      {results[tool.id] && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setExpanded(expanded === tool.id ? null : tool.id); }}
                          style={{ color: 'var(--accent)', fontSize: '10px' }}
                        >
                          {expanded === tool.id ? '▲' : '▼'}
                        </span>
                      )}
                    </button>

                    {/* Result */}
                    {expanded === tool.id && results[tool.id] && (
                      <div
                        className="mt-1 p-3 rounded text-xs animate-fade-in"
                        style={{
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          maxHeight: '240px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                        }}
                      >
                        {results[tool.id].content.replace(/```json\n?/g, '').replace(/```/g, '').trim()}

                        {/* Caption export buttons */}
                        {tool.id === 'captions' && project.captions.length > 0 && (
                          <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => exportCaptions('srt')}>Export .SRT</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => exportCaptions('vtt')}>Export .VTT</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
