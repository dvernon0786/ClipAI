import { NextRequest, NextResponse } from 'next/server';

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, prompt, imageUrl, duration, ratio } = body;

    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'RUNWAY_API_KEY not set' }, { status: 500 });

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    };

    if (mode === 'generateVideo') {
      // Text-to-video with Gen-3 Alpha Turbo
      const res = await fetch(`${RUNWAY_BASE}/text_to_video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          promptText: prompt,
          model: 'gen3a_turbo',
          duration: duration || 5,
          ratio: ratio || '1280:720',
          watermark: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.error || 'Generation failed' }, { status: res.status });

      const taskId = data.id;

      // Poll for completion
      let taskStatus = 'PENDING';
      let attempts = 0;
      let outputUrl = null;

      while (['PENDING', 'RUNNING'].includes(taskStatus) && attempts < 40) {
        await new Promise((r) => setTimeout(r, 5000));
        const pollRes = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, { headers });
        const pollData = await pollRes.json();
        taskStatus = pollData.status;

        if (taskStatus === 'SUCCEEDED') {
          outputUrl = pollData.output?.[0];
        } else if (taskStatus === 'FAILED') {
          return NextResponse.json({ error: 'Generation task failed', details: pollData.failure }, { status: 500 });
        }
        attempts++;
      }

      if (!outputUrl) return NextResponse.json({ error: 'Timed out waiting for video' }, { status: 504 });

      return NextResponse.json({ videoUrl: outputUrl, taskId });
    }

    if (mode === 'imageToVideo') {
      if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });

      const res = await fetch(`${RUNWAY_BASE}/image_to_video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          promptImage: imageUrl,
          promptText: prompt || '',
          model: 'gen3a_turbo',
          duration: duration || 5,
          ratio: ratio || '1280:720',
        }),
      });

      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.error || 'Generation failed' }, { status: res.status });

      return NextResponse.json({ taskId: data.id, status: 'started' });
    }

    if (mode === 'pollTask') {
      const { taskId } = body;
      const res = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, { headers });
      const data = await res.json();
      return NextResponse.json({
        status: data.status,
        videoUrl: data.output?.[0] || null,
        progress: data.progress || 0,
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err) {
    console.error('Video gen route error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
