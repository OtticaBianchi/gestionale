// src/app/api/assemblyai-transcribe/route.ts
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
    
    const { audioUrl, wordBoost } = await request.json();
    
    if (!audioUrl) {
      return NextResponse.json({ error: 'No audio URL provided' }, { status: 400 });
    }

    // Request transcription
    const transcribeResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'it', // Italian
        punctuate: true,
        format_text: true,
        word_boost: wordBoost || [],
        boost_param: 'high'
      })
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('AssemblyAI transcribe error:', transcribeResponse.status, errorText);
      throw new Error(`Failed to request transcription: ${transcribeResponse.status} ${errorText}`);
    }

    const { id: transcriptId } = await transcribeResponse.json();
    
    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      attempts++;
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': apiKey
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error('Failed to check transcription status');
      }
      
      const result = await statusResponse.json();
      
      if (result.status === 'completed') {
        return NextResponse.json({ 
          text: result.text,
          confidence: result.confidence,
          words: result.words
        });
      } else if (result.status === 'error') {
        throw new Error(`Transcription failed: ${result.error}`);
      }
      
      // Status is still 'queued' or 'processing', continue polling
    }
    
    throw new Error('Transcription timeout - took longer than expected');
    
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error?.message || 'Transcription failed' }, 
      { status: 500 }
    );
  }
}