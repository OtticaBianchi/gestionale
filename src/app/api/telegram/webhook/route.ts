// src/app/api/telegram/webhook/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// Lazy import to avoid top-level ESM/CJS conflicts
const { createClient } = require('@supabase/supabase-js');
const { AssemblyAI } = require('assemblyai');
const fs = require('fs');
const path = require('path');

// ===== Helpers =====
function jsonSafe<T>(v: T) {
  try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials missing');
  return createClient(url, key);
}

async function telegramGetFile(botToken: string, fileId: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!resp.ok) throw new Error(`getFile failed: ${resp.status}`);
  const data = await resp.json();
  if (!data.ok) throw new Error(`getFile error: ${data.description || 'unknown'}`);
  return data.result as { file_path: string; file_size?: number };
}

async function telegramDownloadBase64(botToken: string, filePath: string) {
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`file download failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf.toString('base64');
}

function messageType(update: any) {
  if (update.message?.voice) return 'voice';
  if (update.message?.audio) return 'audio';
  if (update.message?.document) return 'document';
  if (update.callback_query) return 'callback';
  if (update.message?.text) return 'text';
  return 'unknown';
}

// ===== WEBHOOK HANDLER =====
export async function POST(request: NextRequest) {
  try {
    console.log('📡 Webhook request received');

    // Verify bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
    }

    // Verify secret header (if configured)
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (configuredSecret && providedSecret !== configuredSecret) {
      console.error('❌ Invalid Telegram webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse update
    const update = await request.json();
    if (!update) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const mtype = messageType(update);
    const fromUser = update.message?.from || update.callback_query?.from;
    console.log('📨 Telegram update:', jsonSafe({
      update_id: update.update_id,
      type: mtype,
      from: fromUser?.username || fromUser?.id || 'unknown'
    }));

    // Only handle voice/audio/document here
    if (!['voice', 'audio', 'document'].includes(mtype)) {
      return NextResponse.json({ status: 'ignored' });
    }

    const msg = update.message;
    const fileObj = msg.voice || msg.audio || msg.document;
    const fileId: string = fileObj.file_id;
    const duration: number = msg.voice?.duration || msg.audio?.duration || 0;
    const fileSize: number = fileObj.file_size || 0;

    // 1) Resolve file path and download to base64 (in-memory)
    const fileMeta = await telegramGetFile(botToken, fileId);
    const audioBase64 = await telegramDownloadBase64(botToken, fileMeta.file_path);

    // 2) Idempotency: skip if this telegram_message_id already exists
    const supabase = getSupabaseAdmin();
    const telegramMessageId = String(msg.message_id);
    const { data: existing, error: findErr } = await supabase
      .from('voice_notes')
      .select('id')
      .eq('telegram_message_id', telegramMessageId)
      .limit(1);
    if (findErr) {
      console.error('⚠️ Idempotency check failed:', findErr.message);
    }
    if (existing && existing.length > 0) {
      console.log('↩️ Duplicate update: voice_note already saved');
      return NextResponse.json({ status: 'ok_duplicate' });
    }

    // 3) Save minimal voice note record
    const voiceNoteData = {
      audio_blob: audioBase64,
      addetto_nome: fromUser?.username || `${fromUser?.first_name || ''} ${fromUser?.last_name || ''}`.trim() || 'Telegram',
      note_aggiuntive: null,
      stato: 'pending',
      file_size: fileSize || fileMeta.file_size || 0,
      duration_seconds: duration || 0,
      cliente_id: null,
      busta_id: null,
      telegram_message_id: telegramMessageId,
      telegram_user_id: String(fromUser?.id || ''),
      telegram_username: fromUser?.username || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: saved, error: saveErr } = await supabase
      .from('voice_notes')
      .insert(voiceNoteData)
      .select('id')
      .single();

    if (saveErr) {
      console.error('❌ Database save failed:', saveErr.message);
      // Return 200 to avoid Telegram retries, but mark failure
      return NextResponse.json({ status: 'saved_error', error: saveErr.message });
    }

    console.log('✅ Voice note saved:', saved?.id);

    // 4) Transcribe synchronously (best effort). This may take time; ensure Vercel timeout is adequate.
    const aaiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!aaiKey) {
      console.warn('⚠️ ASSEMBLYAI_API_KEY missing; skipping transcription');
      return NextResponse.json({ status: 'ok_saved_no_transcription', id: saved?.id });
    }

    try {
      // Write temp file to /tmp for upload
      const tmpDir = process.env.TMPDIR || '/tmp';
      const tmpFile = path.join(tmpDir, `voice_${saved.id}.bin`);
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(tmpFile, audioBuffer);

      const client = new AssemblyAI({ apiKey: aaiKey });
      const uploadedUrl = await client.files.upload(tmpFile);
      const transcript = await client.transcripts.transcribe({
        audio_url: uploadedUrl,
        language_code: 'it'
      });

      if (transcript.status === 'error') {
        throw new Error(transcript.error || 'AssemblyAI error');
      }

      const text = (transcript.text || '').trim();
      if (!text) throw new Error('Empty transcription');

      // Update note as completed
      const { error: updErr } = await supabase
        .from('voice_notes')
        .update({
          note_aggiuntive: text,
          stato: 'completed',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', saved.id);

      if (updErr) {
        console.error('⚠️ Failed to update transcription:', updErr.message);
      } else {
        console.log('📝 Transcription saved for note:', saved.id);
      }

      // Cleanup tmp file
      try { fs.unlinkSync(tmpFile); } catch {}

      return NextResponse.json({ status: 'ok_transcribed', id: saved?.id });
    } catch (txErr: any) {
      console.error('❌ Transcription failed:', txErr?.message || txErr);
      // Mark pending with error note (optional)
      const { error: updErr2 } = await supabase
        .from('voice_notes')
        .update({
          note_aggiuntive: `Transcription Error: ${txErr?.message || 'unknown'}`,
          stato: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', saved.id);
      if (updErr2) console.error('⚠️ Failed to write error note:', updErr2.message);
      return NextResponse.json({ status: 'ok_saved_pending', id: saved?.id, error: txErr?.message });
    }

  } catch (error: any) {
    console.error('🔥 Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ===== WEBHOOK SETUP/INFO (GET) =====
export async function GET(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = 'https://ob-gestionale-2025.vercel.app/api/telegram/webhook';
    
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }
    
    // Get webhook info from Telegram
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await response.json();
    
    const info = {
      configured: {
        bot_token: botToken ? '✅ Configured' : '❌ Missing',
        webhook_url: webhookUrl || '❌ Not set',
        environment: process.env.NODE_ENV || 'unknown'
      },
      telegram_webhook: webhookInfo.result || {},
      bot_instance: 'n/a (direct handler)',
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(info);
    
  } catch (error: any) {
    console.error('❌ Webhook info error:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook info', details: error.message },
      { status: 500 }
    );
  }
}

// ===== WEBHOOK SETUP (PUT) =====
export async function PUT(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = 'https://ob-gestionale-2025.vercel.app/api/telegram/webhook';
    
    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      );
    }
    
    console.log('🔧 Setting up Telegram webhook:', webhookUrl);
    
    // Set webhook
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Telegram webhook configured successfully');
      return NextResponse.json({
        success: true,
        message: 'Webhook configured successfully',
        webhook_url: webhookUrl,
        result: result.result
      });
    } else {
      console.error('❌ Failed to set webhook:', result);
      return NextResponse.json(
        { error: 'Failed to set webhook', details: result },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('❌ Webhook setup error:', error);
    return NextResponse.json(
      { error: 'Webhook setup failed', details: error.message },
      { status: 500 }
    );
  }
}

// ===== DELETE WEBHOOK (DELETE) =====
export async function DELETE(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }
    
    console.log('🗑️ Deleting Telegram webhook');
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Telegram webhook deleted successfully');
      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete webhook', details: result },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('❌ Webhook deletion error:', error);
    return NextResponse.json(
      { error: 'Webhook deletion failed', details: error.message },
      { status: 500 }
    );
  }
}
