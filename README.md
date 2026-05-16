# ClipAI

An AI-powered video editor that runs in the browser. Drop in a video, let Underlord (your AI co-editor) analyse and edit it, then export a clean cut with burned-in captions.

All video data stays in your browser. API keys live server-side. No subscription — bring your own keys.

---

## Features

### Underlord — AI co-editor
Chat with an AI assistant that reads your transcript and returns actionable edits. Ask it to "remove filler words", "find 3 viral clips for Instagram", or "polish this for YouTube". It returns structured actions (cuts, captions, clips, highlights) you can apply with one click.

### 14 AI tools
One-shot tools organised into five groups:

| Group | Tools |
|---|---|
| Analyse | Summarize, Key Moments, Edit for Clarity, Filler Words |
| Edit | Suggest Cuts, Create Clips, Chapter Markers |
| Captions | Generate Captions (auto-applied to player) |
| Publish | Title & Description, Show Notes, Hashtags & SEO, Translate |
| Create | Script from Prompt, Project Brief |

### Transcript editor
- **Live transcription** via Web Speech API (Chrome / Edge) — records as video plays
- **Paste any transcript** — supports `MM:SS text` timestamp format for sync
- Click any segment to jump the video to that point
- Mark segments as cuts directly from the transcript

### Studio Sound
Upload audio or video and run Dolby.io noise reduction, echo removal, and loudness normalisation. Download the enhanced audio as MP3.

### Regenerate Speech
Fix mis-spoken words without re-recording. Type the replacement text, pick a voice, and ElevenLabs generates a matching audio patch. Supports voice cloning from a 30-second sample.

### Generate Video
Text-to-video via Runway Gen-3 Alpha Turbo. Generate B-roll, intros, or illustrative footage. Supports 16:9, 9:16, and 1:1 aspect ratios at 5 or 10 seconds.

### Export
Send cuts and captions to the FFmpeg worker microservice:
- Apply cuts to produce a clean edit
- Burn captions into the video (SRT)
- Choose MP4 or WebM at 720p, 1080p, or 4K
- Export a cut list as `.txt` without needing the worker

---

## Architecture

```
Browser (Next.js client)
  └── VideoEditor (state + video player)
        ├── UnderlordSidebar  →  POST /api/ai        (OpenRouter)
        ├── AIToolsPanel      →  POST /api/ai        (OpenRouter)
        ├── TranscriptEditor  →  Web Speech API      (browser-native)
        ├── StudioSoundPanel  →  POST /api/audio     (Dolby.io)
        ├── RegeneratePanel   →  POST /api/tts       (ElevenLabs)
        ├── VideoGenPanel     →  POST /api/video-gen (Runway)
        └── ExportModal       →  POST <worker>/export (FFmpeg)

Next.js API routes (Vercel serverless)
  ├── /api/ai         → OpenRouter (BYOK) — Underlord chat + 14 tools
  ├── /api/audio      → Dolby.io Media Enhance
  ├── /api/tts        → ElevenLabs TTS + Voice Clone
  └── /api/video-gen  → Runway Gen-3 Alpha Turbo

FFmpeg worker (Railway / Fly.io)
  └── Express + fluent-ffmpeg
        └── POST /export → apply cuts + burn captions → serve MP4/WebM
```

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/dvernon0786/ClipAI.git
cd ClipAI
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your keys:

```env
OPENROUTER_API_KEY=sk-or-...
ELEVENLABS_API_KEY=...
DOLBY_API_KEY=...
DOLBY_API_SECRET=...
RUNWAY_API_KEY=...
FFMPEG_WORKER_URL=https://your-worker.railway.app
NEXT_PUBLIC_FFMPEG_WORKER_URL=https://your-worker.railway.app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Only `OPENROUTER_API_KEY` is required to use core features. The others gate their respective panels.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API keys

| Service | Free tier | Get key |
|---|---|---|
| [OpenRouter](https://openrouter.ai) | Free models available (Gemini Flash, Llama 3.1) | openrouter.ai/keys |
| [ElevenLabs](https://elevenlabs.io) | 10,000 chars/month | elevenlabs.io |
| [Dolby.io](https://dolby.io) | 1,000 minutes/month | dolby.io |
| [Runway](https://runwayml.com) | Pay per second generated | app.runwayml.com |

---

## Model picker

The model picker in the top bar selects which OpenRouter model backs Underlord and all AI tools:

| Model | Cost |
|---|---|
| Gemini 2.0 Flash | Free |
| Llama 3.1 8B | Free |
| Gemini Flash 1.5 8B | Free |
| Claude Sonnet 4.5 | Paid |
| GPT-4o Mini | Paid |

Free models work well for most tasks. Switch to Claude Sonnet for complex editing judgements.

---

## Deploy to Vercel

```bash
npx vercel deploy
```

Add all environment variables from `.env.local` in the Vercel dashboard under **Settings → Environment Variables**. Do not commit `.env.local`.

---

## Deploy the FFmpeg worker

The worker is a separate Express service with FFmpeg installed. Vercel functions time out at 60 seconds — the worker handles longer exports on Railway or Fly.io.

### Railway (recommended)

1. Create a new Railway project
2. Connect the `/worker` subdirectory, or push it as its own repo
3. Railway detects the `Dockerfile` automatically
4. Set the env var `WORKER_BASE_URL=https://<your-service>.railway.app`
5. Copy the public URL to Vercel as `FFMPEG_WORKER_URL` and `NEXT_PUBLIC_FFMPEG_WORKER_URL`

### Fly.io

```bash
cd worker
fly launch
fly secrets set WORKER_BASE_URL=https://<app>.fly.dev
fly deploy
```

### Local worker (development)

```bash
cd worker
npm install
npm run dev    # runs on port 4000
```

Set `FFMPEG_WORKER_URL=http://localhost:4000` and `NEXT_PUBLIC_FFMPEG_WORKER_URL=http://localhost:4000` in `.env.local`.

Requires FFmpeg installed locally: `brew install ffmpeg` / `apt install ffmpeg`.

---

## Transcript formats

The transcript editor accepts any of these timestamp formats at line starts:

```
0:00 Welcome to this tutorial
[1:23] The first main point
(01:23:45) Hour-long video format
```

Lines without timestamps get evenly spaced timing. Use Web Speech API (Chrome/Edge only) to generate timestamps automatically while the video plays.

Export captions as `.SRT` or `.VTT` from the AI Tools → Captions panel.

---

## Project structure

```
src/
  app/
    api/
      ai/route.ts         # Underlord chat + 14 AI tools (OpenRouter)
      audio/route.ts      # Dolby.io audio enhancement
      tts/route.ts        # ElevenLabs voices, clone, TTS
      video-gen/route.ts  # Runway Gen-3 text-to-video
    globals.css           # Design tokens + utility classes
    layout.tsx            # Root layout, Google Fonts
    page.tsx              # Entry point → <VideoEditor />
  components/
    VideoEditor.tsx       # App shell, all state, video player
    UnderlordSidebar.tsx  # AI co-editor chat
    AIToolsPanel.tsx      # 14 discrete AI tools
    TranscriptEditor.tsx  # Live transcription + paste + edit
    ExportModal.tsx       # FFmpeg export UI
    StudioSoundPanel.tsx  # Dolby.io audio panel
    RegeneratePanel.tsx   # ElevenLabs TTS + voice clone
    VideoGenPanel.tsx     # Runway video generation
  lib/
    types.ts              # Shared TypeScript interfaces
    utils.ts              # formatTime, generateId, captionsToSRT/VTT
worker/
  index.js               # Express + fluent-ffmpeg export endpoint
  Dockerfile             # node:20-slim + ffmpeg
```

---

## Tech stack

- **Next.js 16** — App Router, Turbopack, Vercel serverless functions
- **React 19** — concurrent features, client components
- **TypeScript 5** — strict mode
- **Tailwind CSS 3** — layout and spacing
- **lucide-react** — icons
- **fluent-ffmpeg** — FFmpeg bindings (worker only)

---

## Roadmap

- [ ] Project save/load (localStorage or IndexedDB)
- [ ] AI Avatars (HeyGen integration)
- [ ] Lip sync on translation
- [ ] Eye contact correction (MediaPipe WASM)
- [ ] Green screen / background removal
- [ ] Docker Compose for one-command local setup
- [ ] Automatic multicam switching

---

## License

MIT
