import { NextRequest, NextResponse } from 'next/server';

const DOLBY_BASE = 'https://api.dolby.com';

async function getDolbyToken(): Promise<string> {
  const key = process.env.DOLBY_API_KEY;
  const secret = process.env.DOLBY_API_SECRET;
  if (!key || !secret) throw new Error('Dolby credentials not set');

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${DOLBY_BASE}/auth/v1/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials&expires_in=1800',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Auth failed');
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, audioBase64, inputUrl } = body;

    if (mode === 'enhance') {
      const token = await getDolbyToken();

      // Upload the audio
      let uploadUrl = inputUrl;

      if (audioBase64 && !inputUrl) {
        // Get upload URL from Dolby
        const uploadRes = await fetch(`${DOLBY_BASE}/media/input`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: 'dlb://in/audio_input.mp3',
          }),
        });

        const uploadData = await uploadRes.json();
        const presignedUrl = uploadData.url;

        // Upload the audio data
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/mpeg' },
          body: audioBuffer,
        });

        uploadUrl = 'dlb://in/audio_input.mp3';
      }

      // Start enhancement job
      const outputDlbUrl = 'dlb://out/audio_enhanced.mp3';
      const jobRes = await fetch(`${DOLBY_BASE}/media/enhance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: uploadUrl,
          output: outputDlbUrl,
          audio: {
            noise: { reduction: { enable: true, amount: 'auto' } },
            loudness: { enable: true, dialog_intelligence: true },
            dynamics: { range_control: { enable: true } },
          },
        }),
      });

      const jobData = await jobRes.json();
      const jobId = jobData.job_id;

      // Poll for completion
      let status = 'Running';
      let attempts = 0;
      while (status === 'Running' && attempts < 30) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`${DOLBY_BASE}/media/enhance?job_id=${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusData = await statusRes.json();
        status = statusData.status;
        attempts++;
      }

      if (status !== 'Success') {
        return NextResponse.json({ error: `Enhancement failed with status: ${status}` }, { status: 500 });
      }

      // Get download URL
      const dlRes = await fetch(`${DOLBY_BASE}/media/output?url=${encodeURIComponent(outputDlbUrl)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dlData = await dlRes.json();

      return NextResponse.json({ downloadUrl: dlData.url, jobId });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err) {
    console.error('Audio route error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
