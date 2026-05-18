# ClipAI — Claude Code Guide

## Project overview

ClipAI is a browser-based AI video editor built with **Next.js 16 / React 19 / TypeScript / Tailwind CSS**. It runs entirely in the browser for video playback and transcript editing; server-side API routes proxy requests to external AI services. A separate Express microservice (`/worker`) handles FFmpeg processing for video export.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 3, lucide-react |
| Fonts | Syne (display), DM Sans (body), DM Mono (mono) — loaded via `<link>` at runtime |
| AI gateway | OpenRouter (`/api/ai`) |
| TTS / voice clone | ElevenLabs (`/api/tts`) |
| Audio enhancement | Dolby.io (`/api/audio`) |
| AI video generation | Runway Gen-3 (`/api/video-gen`) |
| Waveform | wavesurfer.js v7 (dynamic import, no SSR) |
| Eye contact AI | MediaPipe Face Mesh (CDN script, no install) |
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
      video-gen/route.ts   # Runway Gen-3 — text-to-video, image-to-video, poll
    globals.css            # Design tokens, utility classes, animations
    layout.tsx             # Root layout — Google Fonts via <link> (runtime only)
    page.tsx               # Renders <VideoEditor />
  components/
    VideoEditor.tsx        # App shell — all state, video player, layout
    UnderlordSidebar.tsx   # AI co-editor chat (OpenRouter)
    AIToolsPanel.tsx       # 14 one-shot AI tools in collapsible groups
    TranscriptEditor.tsx   # Live transcription (Web Speech API) + paste + edit
    ExportModal.tsx        # FFmpeg worker integration — cuts + caption burn-in
    StudioSoundPanel.tsx   # Dolby.io audio upload + enhancement
    RegeneratePanel.tsx    # ElevenLabs TTS + voice cloning
    VideoGenPanel.tsx      # Runway Gen-3 text-to-video UI
    ProjectManager.tsx     # localStorage save/load for named projects (up to 20)
    WaveformTimeline.tsx   # wavesurfer.js waveform + cut/clip/highlight overlays
    ScreenRecorder.tsx     # Screen/camera/PiP recording with load-to-editor
    CaptionStylePanel.tsx  # 8 caption presets + position + words-per-line
    EyeContactPanel.tsx    # MediaPipe iris correction — live overlay + WebM export
  lib/
    types.ts               # All shared TypeScript interfaces
    utils.ts               # formatTime, generateId, captionsToSRT/VTT, downloadFile, chunkText
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

## Component reference

### VideoEditor.tsx
The root shell component. Owns all `ProjectState`, playback state, and UI visibility flags. Renders the full layout: top bar, video player, controls bar, waveform timeline, bottom list panel, 9-tab right panel rail. Mounts all other components.

- `loadVideo(file)` — creates an object URL and sets both `project.videoFile` and `videoRef.current.src`
- `seek(time)` / `skip(delta)` — control playback position
- `toggleRecording()` — starts/stops Web Speech API live transcription
- `applyActions(actions)` — processes `UnderlordAction[]` from Underlord chat and updates project state
- `handleToolResult(result, structured)` — auto-applies structured JSON from AI tools (captions, cuts, clips)
- Right panel tabs: `underlord | tools | transcript | captions | studio | regenerate | videogen | record | eyecontact`

### UnderlordSidebar.tsx
Chat with an AI co-editor persona. Sends conversation history + transcript to `/api/ai` with `mode: "underlord"`. Parses `<actions>...</actions>` blocks from responses into `UnderlordAction[]` and shows one-click "Apply" buttons. Includes 6 starter prompts and an optional project brief field.

### AIToolsPanel.tsx
14 discrete AI tools in 5 collapsible groups: Analyse, Edit, Captions, Publish, Create. Each tool calls `/api/ai` with `mode: "tool"` and the tool ID. Tools that return structured JSON (captions, suggestCuts, createClips) auto-apply via `onToolResult`. Caption export to `.srt`/`.vtt` is available after generating.

**Tool IDs:** `summarize`, `keyMoments`, `editForClarity`, `fillerWords`, `suggestCuts`, `createClips`, `chapterMarkers`, `captions`, `titleDescription`, `showNotes`, `hashtagsKeywords`, `translation`, `scriptFromPrompt`, `projectBrief`

### TranscriptEditor.tsx
Three views: read-only segment list, raw text edit mode, paste mode. Clicking a segment seeks the video. The scissors icon on each segment marks it as a cut. Live transcription uses the Web Speech API (Chrome/Edge only) — starts video playback and appends timestamped lines to `rawTranscript`. Imports `Scissors` from lucide-react.

### ProjectManager.tsx
Modal with "Save Current" and "Saved Projects" tabs. Saves up to 20 projects in `localStorage` under key `clipai_projects`. Stores all `ProjectState` fields except `videoFile`/`videoUrl` (binary files can't be serialised). On load, prompts user to re-open the video file. Shows relative timestamps, cut/caption/clip counts.

### WaveformTimeline.tsx
Dynamically imports `wavesurfer.js` (avoids SSR issues) and renders the audio track waveform. Overlays:
- Red semi-transparent boxes for cut regions
- Accent-coloured bottom bars for clips
- Coloured top strips for highlights

Zoom control (10–300 px/sec). Playhead syncs from parent with a 0.5 s drift threshold to avoid feedback loops. Uses WaveSurfer v7 `interaction` event for click-to-seek (not `seek` — that event does not exist in v7). Falls back to `FallbackTimeline` (simple click-to-seek bar) when audio can't be decoded.

### ScreenRecorder.tsx
Three recording modes:
- **Screen** — `getDisplayMedia` + optional mic overlay
- **Camera** — `getUserMedia` webcam
- **Both** — canvas compositing: screen full-frame, camera as circular PiP bottom-right

Records as WebM (VP9/Opus preferred). Recordings list with preview, download, delete, and "Edit this" button that converts the `Blob` to a `File` and calls `onUseRecording` to load into the editor.

### CaptionStylePanel.tsx
8 caption presets exported as `CAPTION_PRESETS: CaptionStyle[]`. Position and words-per-line controls mutate the selected preset in-place and trigger a re-render via `onStyleChange(selectedStyleId)`. Exports `getCaptionOverlayStyle(style): React.CSSProperties` used by `VideoEditor` to render the live overlay `<span>`.

**Presets:** Classic White, Impact Yellow, Bold Two Words, Karaoke Green, Modern Yellow Wave, Typewriter, Large Bold White, Bold Italic Red

### EyeContactPanel.tsx
Loads MediaPipe Face Mesh from CDN at runtime via `loadScript()`. Two modes:
1. **Live overlay** — runs `FaceMesh.send()` per animation frame, draws iris correction blobs on a canvas overlaid on the video
2. **Process & Export** — renders each frame to an off-screen canvas via `MediaRecorder`, outputs WebM

Intensity slider (0–100%) controls the lerp weight for iris-to-centre correction. Uses iris landmark indices 468–477 (requires `refineLandmarks: true`).

### ExportModal.tsx
Sends `multipart/form-data` POST to `NEXT_PUBLIC_FFMPEG_WORKER_URL/export` with the video file, cuts JSON, captions JSON, format, and resolution. Also exports a plain-text cut list without the worker. Worker URL must be set in env vars for full video export.

### StudioSoundPanel.tsx
Converts uploaded audio/video to base64 and POSTs to `/api/audio`. Polls the Dolby.io job until `status === "Success"`, then returns a presigned download URL for the enhanced audio.

### RegeneratePanel.tsx
Lists ElevenLabs voices on mount. Generates replacement audio for a corrected text string. Voice cloning section uploads an audio sample (30 s–3 min recommended). Generated audio previews via `new Audio(dataUrl).play()`.

### VideoGenPanel.tsx
Text-to-video via Runway Gen-3 Alpha Turbo. Polls the task every 4 s until `SUCCEEDED`. Supports 5 s/10 s duration and three aspect ratios (16:9, 9:16, 1:1). Generated clips render inline.

## API route conventions

All four routes are Next.js App Router route handlers (`export async function POST`). They read env vars server-side — API keys are **never** sent to the client.

### /api/ai — mode dispatch
- `mode: "underlord"` — full chat; system prompt includes transcript. Returns `{ content, actions }` where `actions` is parsed from `<actions>...</actions>` tags
- `mode: "tool", tool: string` — runs one of 14 tool prompts against the transcript. Returns `{ content, structured }` where `structured` is extracted JSON

### /api/audio
- `mode: "enhance"` — uploads audio to Dolby, starts enhancement job (noise reduction + loudness + dynamics), polls to completion, returns presigned download URL

### /api/tts
- `mode: "listVoices"` — returns ElevenLabs voice list
- `mode: "cloneVoice"` — creates a new voice from a base64 audio sample
- `mode: "regenerate"` — generates TTS with `eleven_multilingual_v2`, returns base64 MP3

### /api/video-gen
- `mode: "generateVideo"` — starts Runway text-to-video, polls until `SUCCEEDED`, returns `videoUrl`
- `mode: "imageToVideo"` — starts image-to-video task, returns `taskId`
- `mode: "pollTask"` — polls task by ID, returns `{ status, videoUrl, progress }`

## Design system

All colors and typography are CSS custom properties defined in `globals.css`.

**Background scale:** `--bg` → `--surface` → `--surface-2` → `--surface-3` (darkest to lightest)

**Key tokens:**
- `--accent` (#e8ff47) — chartreuse yellow, primary interactive color
- `--accent-glow` — rgba(232,255,71,0.12), active-state backgrounds
- `--border` / `--border-bright` — separator colors
- `--danger` / `--success` / `--warn` / `--blue` — semantic colors
- `--font-display` (Syne) / `--font-body` (DM Sans) / `--font-mono` (DM Mono)

Tailwind is used for layout (flex, grid, sizing, spacing). Component-level styles use inline `style` props with CSS variables. Do not use Tailwind color utilities — always use CSS variables.

**Button classes:** `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.btn-icon`
**Badge classes:** `.badge`, `.badge-accent`, `.badge-muted`, `.badge-success`, `.badge-danger`
**Layout:** `.panel` (surface background + border + border-radius)

## lib/types.ts — key interfaces

| Type | Purpose |
|---|---|
| `TranscriptSegment` | `{ id, text, start, end, words?, speaker? }` — times in seconds |
| `Caption` | `{ id, time, endTime, text }` — times in seconds |
| `CutRegion` | `{ id, start, end, reason? }` — times in seconds |
| `Clip` | `{ id, title, start, end, platform?, captions? }` |
| `HighlightRegion` | `{ id, start, end, label, color }` |
| `AudioPatch` | `{ id, start, end, audioUrl, originalText, newText }` |
| `UnderlordAction` | `{ type, payload, label, applied? }` |
| `AIToolResult` | `{ tool, content, structured?, timestamp }` |
| `ExportFormat` | `'mp4' \| 'webm'` |
| `ExportResolution` | `'720p' \| '1080p' \| '4k'` |

**UnderlordAction types:** `add_cuts`, `remove_cuts`, `add_captions`, `add_clips`, `add_highlights`, `rewrite_transcript`, `suggest`

## lib/utils.ts — key functions

| Function | Description |
|---|---|
| `formatTime(seconds)` | `MM:SS.cs` or `H:MM:SS`. Use `.split('.')[0]` to drop centiseconds for display |
| `parseTimestamp(ts)` | Parses `HH:MM:SS`, `MM:SS`, or bare seconds string |
| `generateId()` | 8-char random base36 string |
| `captionsToSRT(captions)` | Converts caption array to SRT string |
| `captionsToVTT(captions)` | Converts caption array to WebVTT string |
| `downloadFile(content, filename, mimeType)` | Triggers browser download via object URL |
| `chunkText(text, maxChars)` | Splits long text for API chunking (default 12,000 chars) |

## Environment variables

Set in `.env.local` for local dev; in Vercel dashboard for production.

| Variable | Used by |
|---|---|
| `OPENROUTER_API_KEY` | `/api/ai` |
| `ELEVENLABS_API_KEY` | `/api/tts` |
| `DOLBY_API_KEY` | `/api/audio` |
| `DOLBY_API_SECRET` | `/api/audio` |
| `RUNWAY_API_KEY` | `/api/video-gen` |
| `NEXT_PUBLIC_FFMPEG_WORKER_URL` | `ExportModal.tsx` (client-side) |
| `NEXT_PUBLIC_APP_URL` | `/api/ai` (OpenRouter Referer header) |

## Common commands

```bash
npm run dev      # Start dev server on localhost:3000 (Turbopack)
npm run build    # Production build (TypeScript check + compile)
npm run start    # Start production server
npm run lint     # ESLint

# Worker (from /worker directory)
npm start        # Production
npm run dev      # nodemon watch mode
docker build -t clipai-worker .  # Build container
```

## FFmpeg worker

The worker (`/worker/index.js`) is a stateless Express app. Accepts `multipart/form-data` POST to `/export`.

| Field | Type | Description |
|---|---|---|
| `video` | File | Video file (up to 2 GB) |
| `cuts` | JSON string | Array of `{ start, end }` in seconds |
| `captions` | JSON string | Array of `{ time, endTime, text }` for SRT burn-in |
| `format` | string | `mp4` or `webm` |
| `resolution` | string | `720p`, `1080p`, or `4k` |

Cut processing builds a `select` filter from inverted cut regions, uses `setpts=N/FRAME_RATE/TB` to fix timestamps after removal. Output files served from `/files/:filename`, auto-deleted after 1 hour. Set `WORKER_BASE_URL` on the worker host so download URLs resolve correctly.

## Known TypeScript notes

- `SpeechRecognition` / `webkitSpeechRecognition` accessed via `(window as any)` in `VideoEditor.tsx` — type availability varies across TS lib versions, keep the `any` cast
- Web Speech API is Chrome/Edge only
- `wavesurfer.js` imported as `WaveSurferType` to use real v7 types — do not replace with a stub interface
- WaveSurfer v7 uses the `interaction` event for user-initiated seek; `seek` does not exist in v7
- MediaPipe Face Mesh loaded via CDN `<script>` injection, not npm; `window.FaceMesh` accessed with `@ts-expect-error`
- `next.config.js` sets `optimizeFonts: false` so Google Fonts `<link>` tags load at runtime, avoiding a `fonts.googleapis.com` fetch during `next build`
