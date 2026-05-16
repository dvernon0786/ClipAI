import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const TOOL_PROMPTS: Record<string, (transcript: string, extra?: string) => string> = {
  summarize: (t) => `Summarize this video transcript in 3-5 sentences. Be concise and capture the main value.\n\nTranscript:\n${t}`,

  keyMoments: (t) => `Identify 4-6 key moments from this transcript. Return ONLY valid JSON array:
[{"time": "MM:SS", "title": "Short title", "description": "One sentence why this matters"}]

Transcript:\n${t}`,

  suggestCuts: (t) => `Analyze this transcript and suggest cuts to remove. Return ONLY valid JSON array:
[{"start": "MM:SS", "end": "MM:SS", "reason": "Why to cut this (filler/repetition/tangent/dead air)"}]

Focus on: filler words, repeated points, long pauses, off-topic tangents.

Transcript:\n${t}`,

  titleDescription: (t) => `Generate YouTube title and description options. Return ONLY valid JSON:
{
  "titles": ["Title 1", "Title 2", "Title 3"],
  "description": "150-word YouTube description with natural keyword usage",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Transcript:\n${t}`,

  chapterMarkers: (t) => `Generate chapter markers. Return ONLY valid JSON array:
[{"time": "MM:SS", "title": "Chapter title (max 50 chars)"}]

Transcript:\n${t}`,

  hashtagsKeywords: (t) => `Generate social media hashtags and SEO keywords. Return ONLY valid JSON:
{
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8", "#hashtag9", "#hashtag10"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"]
}

Transcript:\n${t}`,

  captions: (t) => `Generate timed captions for this transcript. Return ONLY valid JSON array:
[{"time": 0.0, "endTime": 3.5, "text": "Caption text max 80 chars"}]

Rules: max 80 chars per caption, natural breaks at punctuation, estimate timing from transcript flow.

Transcript:\n${t}`,

  showNotes: (t) => `Write podcast show notes with timestamps. Include: episode summary, key topics with timestamps, notable quotes, resources mentioned. Format in markdown.\n\nTranscript:\n${t}`,

  fillerWords: (t) => `Detect filler words and verbal clutter. Return ONLY valid JSON array:
[{"time": "MM:SS", "word": "um/uh/like/you know/etc", "context": "surrounding words", "severity": "low/medium/high"}]

Transcript:\n${t}`,

  editForClarity: (t) => `Analyze this transcript for pacing and clarity issues. Return ONLY valid JSON:
{
  "issues": [{"time": "MM:SS", "type": "run-on/unclear/slow/repetitive", "suggestion": "How to fix"}],
  "overallPacing": "slow/good/fast",
  "clarityScore": 7,
  "topSuggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Transcript:\n${t}`,

  createClips: (t, extra) => `Find ${extra || '3'} viral-worthy clips for social media. Return ONLY valid JSON array:
[{"title": "Clip title", "start": "MM:SS", "end": "MM:SS", "platform": "instagram/tiktok/youtube", "hook": "Why this will perform well", "duration": 45}]

Criteria: self-contained stories, high-energy moments, quotable insights, emotional peaks.

Transcript:\n${t}`,

  translation: (t, extra) => `Translate this transcript to ${extra || 'Spanish'}. Keep the same format and meaning. Return the translated text only.\n\nTranscript:\n${t}`,

  scriptFromPrompt: (_, extra) => `Write a complete video script based on this brief: ${extra}

Format with:
- Hook (0-15s)
- Main sections with timestamps
- CTA at end
- Speaking notes in [brackets]`,

  projectBrief: (t, extra) => `Create a detailed editing plan for this video. Goal: ${extra || 'Polish for YouTube'}

Return ONLY valid JSON:
{
  "title": "Suggested video title",
  "targetLength": "X:XX",
  "platform": "youtube/instagram/tiktok",
  "tone": "description of tone",
  "steps": [{"order": 1, "action": "What to do", "details": "How to do it"}],
  "estimatedTime": "X minutes",
  "keyInsights": ["insight 1", "insight 2"]
}

Transcript:\n${t}`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, transcript, tool, extra, messages, model } = body;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 });

    const selectedModel = model || 'google/gemini-2.0-flash-001';

    // Underlord chat mode
    if (mode === 'underlord') {
      const systemPrompt = `You are Underlord, an expert AI video co-editor. You have deep knowledge of video editing, storytelling, pacing, and content strategy.

You are working on a video with this transcript:
---
${transcript || 'No transcript loaded yet.'}
---

You can understand natural language editing instructions and return structured actions the editor can apply.

When the user asks you to make edits, ALWAYS return your response in this format:
1. A brief conversational explanation of what you're doing
2. If applicable, a JSON block wrapped in <actions>...</actions> tags with this structure:
{
  "actions": [
    {
      "type": "add_cuts|add_captions|add_clips|add_highlights|suggest",
      "label": "Human-readable description",
      "payload": { ...action-specific data... }
    }
  ]
}

For add_cuts payload: {"cuts": [{"start": "MM:SS", "end": "MM:SS", "reason": "..."}]}
For add_captions payload: {"captions": [{"time": 0.0, "endTime": 3.5, "text": "..."}]}
For add_clips payload: {"clips": [{"title": "...", "start": "MM:SS", "end": "MM:SS", "platform": "..."}]}
For add_highlights payload: {"highlights": [{"start": "MM:SS", "end": "MM:SS", "label": "...", "color": "#hex"}]}
For suggest payload: {"suggestions": ["suggestion 1", "suggestion 2"]}

You are tireless, skilled, and have excellent taste. Be direct, action-oriented, and creative.`;

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'ClipAI',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(messages || []),
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data.error?.message || 'API error' }, { status: response.status });

      const content = data.choices?.[0]?.message?.content || '';

      // Parse actions block if present
      const actionsMatch = content.match(/<actions>([\s\S]*?)<\/actions>/);
      let actions = null;
      let cleanContent = content.replace(/<actions>[\s\S]*?<\/actions>/g, '').trim();

      if (actionsMatch) {
        try {
          const parsed = JSON.parse(actionsMatch[1].trim());
          actions = parsed.actions;
        } catch {
          // ignore parse errors
        }
      }

      return NextResponse.json({ content: cleanContent, actions });
    }

    // Discrete tool mode
    if (mode === 'tool' && tool) {
      const promptFn = TOOL_PROMPTS[tool];
      if (!promptFn) return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });

      const prompt = promptFn(transcript || '', extra);

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'ClipAI',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data.error?.message || 'API error' }, { status: response.status });

      const content = data.choices?.[0]?.message?.content || '';

      // Try to parse JSON from content
      let structured = null;
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)```/) || content.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) structured = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // Return raw content if not JSON
      }

      return NextResponse.json({ content, structured });
    }

    return NextResponse.json({ error: 'Invalid request mode' }, { status: 400 });
  } catch (err) {
    console.error('AI route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
