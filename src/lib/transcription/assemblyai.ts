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
  console.log('🚀 transcribeFromBase64 function called');
  console.log('📊 Input params:', { base64Length: base64.length, mime, timeoutMs });
  
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  console.log('🔑 API Key check:', apiKey ? 'Present' : 'Missing');
  
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY non configurata');

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64, 'base64');

  // 1) Upload
  console.log('🔄 Starting AssemblyAI upload...');
  const uploadRes = await fetch(`${AAI_BASE}/upload`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      // AssemblyAI accepts raw bytes; octet-stream is safest
      'content-type': 'application/octet-stream',
    },
    body: buffer,
  });
  
  console.log('📤 Upload response status:', uploadRes.status);
  
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    console.log('❌ Upload response body:', txt.substring(0, 200));
    throw new Error(`AssemblyAI upload failed: ${uploadRes.status} ${txt}`);
  }
  
  const uploadJson = await uploadRes.json() as { upload_url: string };
  const uploadUrl = uploadJson.upload_url;
  console.log('✅ Upload successful, got URL:', uploadUrl ? 'OK' : 'MISSING');

  // 2) Create transcript
  console.log('🔄 Creating transcript with AssemblyAI...');
  const createRes = await fetch(`${AAI_BASE}/transcripts`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ audio_url: uploadUrl, language_code: 'it' }),
  });
  
  console.log('📝 Create transcript response status:', createRes.status);
  console.log('📝 Response headers:', Object.fromEntries(createRes.headers.entries()));
  
  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => '');
    console.log('❌ Create transcript response body:', txt.substring(0, 500));
    throw new Error(`AssemblyAI create transcript failed: ${createRes.status} ${txt}`);
  }
  
  const createJson = await createRes.json() as { id: string };
  const transcriptId = createJson.id;
  console.log('✅ Transcript created with ID:', transcriptId ? 'OK' : 'MISSING');

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
