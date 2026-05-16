export interface TranscriptWord {
  word: string;
  start: number; // seconds
  end: number;
  confidence?: number;
  deleted?: boolean;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words?: TranscriptWord[];
  speaker?: string;
}

export interface Caption {
  id: string;
  time: number;
  endTime: number;
  text: string;
}

export interface CutRegion {
  id: string;
  start: number;
  end: number;
  reason?: string;
}

export interface Clip {
  id: string;
  title: string;
  start: number;
  end: number;
  platform?: string;
  captions?: Caption[];
}

export interface AudioPatch {
  id: string;
  start: number;
  end: number;
  audioUrl: string; // ElevenLabs output
  originalText: string;
  newText: string;
}

export interface ProjectState {
  videoFile: File | null;
  videoUrl: string | null;
  videoDuration: number;
  transcript: TranscriptSegment[];
  rawTranscript: string;
  cuts: CutRegion[];
  captions: Caption[];
  clips: Clip[];
  audioPatches: AudioPatch[];
  highlights: HighlightRegion[];
}

export interface HighlightRegion {
  id: string;
  start: number;
  end: number;
  label: string;
  color: string;
}

export interface UnderlordMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: UnderlordAction[];
  timestamp: Date;
}

export interface UnderlordAction {
  type:
    | 'add_cuts'
    | 'remove_cuts'
    | 'add_captions'
    | 'add_clips'
    | 'add_highlights'
    | 'rewrite_transcript'
    | 'suggest';
  payload: unknown;
  label: string;
  applied?: boolean;
}

export interface AIToolResult {
  tool: string;
  content: string;
  structured?: unknown;
  timestamp: Date;
}

export type ExportFormat = 'mp4' | 'webm';
export type ExportResolution = '720p' | '1080p' | '4k';

export interface ExportJob {
  videoUrl: string;
  cuts: CutRegion[];
  captions: Caption[];
  audioPatches: AudioPatch[];
  resolution: ExportResolution;
  format: ExportFormat;
}
