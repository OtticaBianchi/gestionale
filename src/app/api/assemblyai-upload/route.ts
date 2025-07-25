// src/app/api/assemblyai-upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { strictRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await strictRateLimit(request);
  if (rateLimitResult) return rateLimitResult;
  try {
    // Debug: check if API key is loaded
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    console.log('AssemblyAI API Key loaded:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT FOUND');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'AssemblyAI API key not configured' }, { status: 500 });
    }
    
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Upload to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
      },
      body: audioFile
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('AssemblyAI upload error:', uploadResponse.status, errorText);
      throw new Error(`Failed to upload to AssemblyAI: ${uploadResponse.status} ${errorText}`);
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