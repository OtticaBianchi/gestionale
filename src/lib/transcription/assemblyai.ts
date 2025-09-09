/**
 * Lightweight AssemblyAI transcription helper.
 * Re-transcribes audio from a base64-encoded blob.
 *
 * Requirements:
 * - process.env.ASSEMBLYAI_API_KEY
 */

const AAI_BASE = 'https://api.assemblyai.com/v2';

type TranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

export async function transcribeFromBase64(base64: string, mime: string = 'audio/webm', timeoutMs = 120000): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY non configurata');

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64, 'base64');

  // 1) Upload
  const uploadRes = await fetch(`${AAI_BASE}/upload`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': mime,
    },
    body: buffer,
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    throw new Error(`AssemblyAI upload failed: ${uploadRes.status} ${txt}`);
  }
  const uploadJson = await uploadRes.json() as { upload_url: string };
  const uploadUrl = uploadJson.upload_url;

  // 2) Create transcript
  const createRes = await fetch(`${AAI_BASE}/transcripts`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ audio_url: uploadUrl, language_code: 'it' }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => '');
    throw new Error(`AssemblyAI create transcript failed: ${createRes.status} ${txt}`);
  }
  const createJson = await createRes.json() as { id: string };
  const transcriptId = createJson.id;

  // 3) Poll transcript
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${AAI_BASE}/transcripts/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    if (!pollRes.ok) continue;
    const pollJson = await pollRes.json() as { status: TranscriptStatus; text?: string; error?: string };
    if (pollJson.status === 'completed') {
      return pollJson.text || '';
    }
    if (pollJson.status === 'error') {
      throw new Error(`AssemblyAI error: ${pollJson.error || 'unknown'}`);
    }
  }
  throw new Error('AssemblyAI timeout');
}

