// src/app/api/assemblyai-upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { strictRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await strictRateLimit(request);
  if (rateLimitResult) return rateLimitResult;
  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Upload to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': process.env.ASSEMBLYAI_API_KEY!,
      },
      body: audioFile
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to AssemblyAI');
    }

    const { upload_url } = await uploadResponse.json();
    
    return NextResponse.json({ audioUrl: upload_url });
    
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'Upload failed' }, 
      { status: 500 }
    );
  }
}