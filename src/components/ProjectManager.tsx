'use client';
import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Clock, Plus, X } from 'lucide-react';
import type { ProjectState } from '@/lib/types';
import { formatTime } from '@/lib/utils';

const STORAGE_KEY = 'clipai_projects';
const MAX_PROJECTS = 20;

interface SavedProject {
  id: string;
  name: string;
  savedAt: string; // ISO
  duration: number;
  cutCount: number;
  captionCount: number;
  clipCount: number;
  // serialisable state (no File object)
  state: Omit<ProjectState, 'videoFile' | 'videoUrl'> & {
    videoFileName: string | null;
  };
}

function loadIndex(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveIndex(projects: SavedProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
}

interface Props {
  project: ProjectState;
  onLoad: (state: Omit<ProjectState, 'videoFile' | 'videoUrl'>) => void;
  onClose: () => void;
}

export default function ProjectManager({ project, onLoad, onClose }: Props) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [saveName, setSaveName] = useState('');
  const [tab, setTab] = useState<'save' | 'load'>('save');

  useEffect(() => {
    setProjects(loadIndex());
    // Default save name from video filename
    if (project.videoFile) {
      setSaveName(project.videoFile.name.replace(/\.[^.]+$/, ''));
    }
  }, [project.videoFile]);

  const handleSave = () => {
    const name = saveName.trim() || `Project ${new Date().toLocaleString()}`;
    const entry: SavedProject = {
      id: Date.now().toString(),
      name,
      savedAt: new Date().toISOString(),
      duration: project.videoDuration,
      cutCount: project.cuts.length,
      captionCount: project.captions.length,
      clipCount: project.clips.length,
      state: {
        videoDuration: project.videoDuration,
        transcript: project.transcript,
        rawTranscript: project.rawTranscript,
        cuts: project.cuts,
        captions: project.captions,
        clips: project.clips,
        audioPatches: project.audioPatches,
        highlights: project.highlights,
        videoFileName: project.videoFile?.name || null,
      },
    };
    const updated = [entry, ...projects];
    setProjects(updated);
    saveIndex(updated);
    setSaveName('');
    setTab('load');
  };

  const handleLoad = (p: SavedProject) => {
    const { videoFileName, ...rest } = p.state;
    onLoad(rest);
    onClose();
    if (videoFileName) {
      alert(`Project loaded. Re-open the video file "${videoFileName}" to restore playback (video files can't be stored in the browser).`);
    }
  };

  const handleDelete = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveIndex(updated);
  };

  const handleClearAll = () => {
    if (!confirm('Delete all saved projects?')) return;
    setProjects([]);
    saveIndex([]);
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="panel animate-fade-in"
        style={{ width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-display font-semibold">Projects</h3>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['save', 'load'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-xs font-medium transition-colors capitalize"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {t === 'save' ? 'Save Current' : `Saved Projects (${projects.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'save' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--muted)' }}>Project name</label>
                <input
                  className="input"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My podcast episode 12…"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
              </div>

              {/* Summary of what will be saved */}
              <div className="rounded p-3 space-y-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Will be saved</p>
                {[
                  ['Transcript', project.rawTranscript ? `${project.transcript.length} segments` : 'empty'],
                  ['Cuts', `${project.cuts.length} regions`],
                  ['Captions', `${project.captions.length} entries`],
                  ['Clips', `${project.clips.length} clips`],
                  ['Highlights', `${project.highlights.length} regions`],
                  ['Video file', project.videoFile?.name || 'none (re-open manually)'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{val}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs" style={{ color: 'var(--muted-2)' }}>
                Note: the video file itself can't be stored in the browser. You'll be reminded to re-open it when loading.
              </p>

              <button
                className="btn btn-primary w-full justify-center"
                onClick={handleSave}
                disabled={!project.rawTranscript && !project.cuts.length && !project.captions.length}
              >
                <Save size={13} /> Save Project
              </button>
            </div>
          )}

          {tab === 'load' && (
            <div>
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen size={24} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
                  <p className="text-sm font-medium">No saved projects yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Save your current work using the Save tab.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.length > 1 && (
                    <div className="flex justify-end mb-2">
                      <button className="btn btn-ghost btn-sm" onClick={handleClearAll}>
                        <Trash2 size={11} /> Clear all
                      </button>
                    </div>
                  )}
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="rounded p-3 cursor-pointer transition-all group"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      onClick={() => handleLoad(p)}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                              <Clock size={10} /> {relativeTime(p.savedAt)}
                            </span>
                            {p.duration > 0 && (
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                                {formatTime(p.duration).split('.')[0]}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            {p.cutCount > 0 && <span className="badge badge-danger">{p.cutCount} cuts</span>}
                            {p.captionCount > 0 && <span className="badge badge-accent">{p.captionCount} captions</span>}
                            {p.clipCount > 0 && <span className="badge badge-muted">{p.clipCount} clips</span>}
                          </div>
                        </div>
                        <button
                          className="btn-icon opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
