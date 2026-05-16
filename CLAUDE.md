# ClipAI — Claude Code Guide

## Project overview

ClipAI is a browser-based AI video editor built with **Next.js 16 / React 19 / TypeScript / Tailwind CSS**. It runs entirely in the browser for video playback and transcript editing; server-side API routes proxy requests to external AI services. A separate Express microservice (`/worker`) handles FFmpeg processing for video export.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 3, lucide-react |
| Fonts | Syne (display), DM Sans (body), DM Mono (mono) |
| AI gateway | OpenRouter (`/api/ai`) |
| TTS / voice clone | ElevenLabs (`/api/tts`) |
| Audio enhancement | Dolby.io (`/api/audio`) |
| AI video generation | Runway Gen-3 (`/api/video-gen`) |
| FFmpeg processing | Express + fluent-ffmpeg microservice (`/worker`) |
| Hosting | Vercel (Next.js app) + Railway or Fly.io (worker) |

## Directory structure

```
src/
  app/
    api/
      ai/route.ts          # OpenRouter — Underlord chat + 14 discrete tools
      audio/route.ts       # Dolby.io — noise reduction + loudness
      tts/route.ts         # ElevenLabs — list voices, clone voice, regenerate
      video-gen/route.ts   # Runway Gen-3 — text-to-video, image-to-video
    globals.css            # Design tokens, utility classes, animations
    layout.tsx             # Root layout with Google Fonts
    page.tsx               # Renders <VideoEditor />
  components/
    VideoEditor.tsx        # App shell — all state, video player, layout
    UnderlordSidebar.tsx   # AI co-editor chat (OpenRouter streaming)
    AIToolsPanel.tsx       # 14 one-shot AI tools in collapsible groups
    TranscriptEditor.tsx   # Live transcription (Web Speech API) + paste + edit
    ExportModal.tsx        # FFmpeg worker integration — cuts + caption burn-in
    StudioSoundPanel.tsx   # Dolby.io audio upload + enhancement
    RegeneratePanel.tsx    # ElevenLabs TTS + voice cloning
    VideoGenPanel.tsx      # Runway Gen-3 text-to-video UI
  lib/
    types.ts               # All shared TypeScript interfaces
    utils.ts               # formatTime, generateId, captionsToSRT/VTT, downloadFile
worker/
  index.js                 # Express app — /export endpoint using fluent-ffmpeg
  package.json
  Dockerfile               # node:20-slim + ffmpeg
```

## State management

All project state lives in a single `ProjectState` object in `VideoEditor.tsx`. Child components receive slices via props and call handlers to update state. There is no Redux or Zustand — keep it this way.

```ts
interface ProjectState {
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
```

## API route conventions

All four routes are Next.js App Router route handlers (`export async function POST`). They read env vars server-side — API keys are **never** sent to the client. The `/api/ai` route dispatches on a `mode` field: `"underlord"` for chat, `"tool"` for discrete tools.

## Design system

All colors and typography are CSS custom properties defined in `globals.css`. Key tokens:

- `--bg` / `--surface` / `--surface-2` / `--surface-3` — dark backgrounds
- `--accent` (#e8ff47) — chartreuse yellow, primary interactive color
- `--danger` / `--success` / `--warn` — semantic colors
- `--font-display` (Syne) / `--font-body` (DM Sans) / `--font-mono` (DM Mono)

Tailwind is used for layout (flex, grid, sizing, spacing). Component-level styles use inline `style` props referencing CSS variables for theming.

## Environment variables

Set in `.env.local` for local dev; in Vercel dashboard for production.

| Variable | Used by |
|---|---|
| `OPENROUTER_API_KEY` | `/api/ai` |
| `ELEVENLABS_API_KEY` | `/api/tts` |
| `DOLBY_API_KEY` | `/api/audio` |
| `DOLBY_API_SECRET` | `/api/audio` |
| `RUNWAY_API_KEY` | `/api/video-gen` |
| `FFMPEG_WORKER_URL` | `/api/*` (internal, server-side) |
| `NEXT_PUBLIC_FFMPEG_WORKER_URL` | `ExportModal.tsx` (client-side) |
| `NEXT_PUBLIC_APP_URL` | `/api/ai` (OpenRouter Referer header) |

## Common commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build (TypeScript check + compile)
npm run start    # Start production server
npm run lint     # ESLint

# Worker (from /worker directory)
npm start        # Production
npm run dev      # nodemon watch mode
docker build -t clipai-worker .  # Build container
```

## Known TypeScript notes

`SpeechRecognition` and `webkitSpeechRecognition` are browser globals with no standard TS lib type. They are typed as `any` in `VideoEditor.tsx` — do not change this to avoid build failures. The Web Speech API is only available in Chrome and Edge.

## FFmpeg worker

The worker is stateless. It accepts a `multipart/form-data` POST to `/export` with fields:

| Field | Type | Description |
|---|---|---|
| `video` | File | Video file (up to 2 GB) |
| `cuts` | JSON string | Array of `{ start, end }` in seconds |
| `captions` | JSON string | Array of `{ time, endTime, text }` for SRT burn-in |
| `format` | string | `mp4` or `webm` |
| `resolution` | string | `720p`, `1080p`, or `4k` |

Output files are served from `/files/:filename` and auto-deleted after 1 hour. Set `WORKER_BASE_URL` env var on the worker host so download URLs resolve correctly.
