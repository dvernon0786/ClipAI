const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Temp storage
const UPLOAD_DIR = '/tmp/clipai_uploads';
const OUTPUT_DIR = '/tmp/clipai_outputs';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB limit

// Serve output files
app.use('/files', express.static(OUTPUT_DIR));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/export', upload.single('video'), async (req, res) => {
  const videoPath = req.file?.path;
  if (!videoPath) return res.status(400).json({ error: 'No video file uploaded' });

  const cuts = JSON.parse(req.body.cuts || '[]');
  const captions = JSON.parse(req.body.captions || '[]');
  const format = req.body.format || 'mp4';
  const resolution = req.body.resolution || '1080p';

  const outputId = uuidv4();
  const outputFilename = `export_${outputId}.${format}`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  const resolutionMap = {
    '720p': '1280:720',
    '1080p': '1920:1080',
    '4k': '3840:2160',
  };
  const scaleFilter = resolutionMap[resolution] || '1920:1080';

  try {
    // Build FFmpeg filter complex for cuts
    let filterArgs = [];
    let command = ffmpeg(videoPath);

    if (cuts.length > 0) {
      // Build select filter to remove cut regions
      const duration = await getVideoDuration(videoPath);
      const keepSegments = buildKeepSegments(cuts, duration);

      if (keepSegments.length > 0) {
        const selectExpr = keepSegments
          .map((s) => `between(t,${s.start},${s.end})`)
          .join('+');

        filterArgs.push(`[0:v]select='${selectExpr}',setpts=N/FRAME_RATE/TB[v]`);
        filterArgs.push(`[0:a]aselect='${selectExpr}',asetpts=N/SR/TB[a]`);
      }
    }

    // Add subtitle filter for caption burn-in
    let captionFile = null;
    if (captions.length > 0) {
      captionFile = path.join(UPLOAD_DIR, `${outputId}.srt`);
      const srtContent = captions
        .map((c, i) => {
          const fmtTime = (s) => {
            const h = Math.floor(s / 3600).toString().padStart(2, '0');
            const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
            const sec = Math.floor(s % 60).toString().padStart(2, '0');
            const ms = Math.floor((s % 1) * 1000).toString().padStart(3, '0');
            return `${h}:${m}:${sec},${ms}`;
          };
          return `${i + 1}\n${fmtTime(c.time)} --> ${fmtTime(c.endTime || c.time + 3)}\n${c.text}\n`;
        })
        .join('\n');
      fs.writeFileSync(captionFile, srtContent);
    }

    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(videoPath);

      // Scale filter
      const videoFilter = `scale=${scaleFilter}:force_original_aspect_ratio=decrease,pad=${scaleFilter}:(ow-iw)/2:(oh-ih)/2`;

      if (filterArgs.length > 0) {
        cmd = cmd.complexFilter(filterArgs).map('[v]').map('[a]');
      }

      if (captionFile) {
        cmd = cmd.videoFilter(`subtitles=${captionFile.replace(/\\/g, '/')},${videoFilter}`);
      } else {
        cmd = cmd.videoFilter(videoFilter);
      }

      cmd
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-movflags +faststart', '-preset fast', '-crf 22'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Cleanup input
    fs.unlinkSync(videoPath);
    if (captionFile) fs.unlinkSync(captionFile);

    // Schedule output cleanup after 1 hour
    setTimeout(() => {
      try { fs.unlinkSync(outputPath); } catch {}
    }, 3600 * 1000);

    const baseUrl = process.env.WORKER_BASE_URL || `http://localhost:${PORT}`;
    res.json({
      downloadUrl: `${baseUrl}/files/${outputFilename}`,
      filename: outputFilename,
    });
  } catch (err) {
    console.error('Export error:', err);
    try { fs.unlinkSync(videoPath); } catch {}
    res.status(500).json({ error: String(err) });
  }
});

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function buildKeepSegments(cuts, totalDuration) {
  // Sort cuts by start time
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;

  for (const cut of sorted) {
    if (cut.start > cursor) {
      segments.push({ start: cursor, end: cut.start });
    }
    cursor = Math.max(cursor, cut.end);
  }

  if (cursor < totalDuration) {
    segments.push({ start: cursor, end: totalDuration });
  }

  return segments;
}

app.listen(PORT, () => {
  console.log(`ClipAI FFmpeg worker running on port ${PORT}`);
});
