import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, text, voiceId, audioBase64, voiceName } = body;

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 });

    // List available voices
    if (mode === 'listVoices') {
      const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
        headers: { 'xi-api-key': apiKey },
      });
      const data = await res.json();
      return NextResponse.json({ voices: data.voices || [] });
    }

    // Clone a voice from audio sample
    if (mode === 'cloneVoice') {
      if (!audioBase64 || !voiceName) {
        return NextResponse.json({ error: 'audioBase64 and voiceName required' }, { status: 400 });
      }

      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('description', 'Cloned voice from ClipAI');
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      formData.append('files', blob, 'voice_sample.mp3');

      const res = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.detail?.message || 'Clone failed' }, { status: res.status });
      return NextResponse.json({ voiceId: data.voice_id, name: voiceName });
    }

    // Generate speech (Regenerate)
    if (mode === 'regenerate') {
      if (!text || !voiceId) {
        return NextResponse.json({ error: 'text and voiceId required' }, { status: 400 });
      }

      const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: err.detail?.message || 'TTS failed' }, { status: res.status });
      }

      const audioBuffer = await res.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      return NextResponse.json({ audioBase64: base64Audio, mimeType: 'audio/mpeg' });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err) {
    console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
