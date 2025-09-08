// src/app/api/telegram/webhook/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// Import Telegram Bot (JS modules in TS)
const TelegramVoiceBot = require('@/telegram/bot.js');

// Bot instance (singleton)
let botInstance: any = null;

// Initialize bot instance
function getBotInstance() {
  if (!botInstance) {
    try {
      botInstance = new TelegramVoiceBot();
      console.log('🤖 Telegram bot instance created for webhook');
    } catch (error) {
      console.error('❌ Failed to create bot instance:', error);
      throw error;
    }
  }
  return botInstance;
}

// ===== WEBHOOK HANDLER =====
export async function POST(request: NextRequest) {
  try {
    console.log('📡 Webhook request received');
    
    // Verify webhook authenticity (basic)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
    }
    // Verify secret token if configured
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (configuredSecret && providedSecret !== configuredSecret) {
      console.error('❌ Invalid Telegram webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse Telegram update
    const update = await request.json();
    
    if (!update) {
      console.error('❌ Invalid webhook payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    
    console.log('📨 Telegram update received:', {
      update_id: update.update_id,
      message_type: update.message ? 
        (update.message.voice ? 'voice' : 
         update.message.audio ? 'audio' :
         update.message.document ? 'document' :
         update.message.text ? 'text' : 'other') : 
        (update.callback_query ? 'callback' : 'unknown'),
      from: update.message?.from?.username || update.callback_query?.from?.username || 'unknown'
    });
    
    // Get bot instance
    const bot = getBotInstance();
    
    if (!bot || !bot.getBot()) {
      console.error('❌ Bot not initialized');
      return NextResponse.json({ error: 'Bot not available' }, { status: 503 });
    }
    
    // Process update with Telegram Bot API library
    try {
      // The bot instance handles the update through its event listeners
      await bot.getBot().processUpdate(update);
      
      console.log('✅ Webhook update processed successfully');
      return NextResponse.json({ status: 'ok' });
      
    } catch (processingError: any) {
      console.error('❌ Error processing update:', processingError);
      
      // Try to send error message to user if possible
      if (update.message?.chat?.id) {
        try {
          await bot.sendMessage(
            update.message.chat.id,
            '❌ Si è verificato un errore temporaneo. Riprova tra qualche secondo.',
            { parse_mode: 'Markdown' }
          );
        } catch (errorSendError) {
          console.error('❌ Could not send error message to user:', errorSendError);
        }
      }
      
      // Return success to Telegram to avoid retries
      return NextResponse.json({ 
        status: 'error_handled',
        error: processingError.message 
      });
    }
    
  } catch (error: any) {
    console.error('🔥 Webhook handler error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// ===== WEBHOOK SETUP/INFO (GET) =====
export async function GET(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    
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
      bot_instance: botInstance ? '✅ Active' : '❌ Not initialized',
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
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    
    if (!botToken || !webhookUrl) {
      return NextResponse.json(
        { error: 'Bot token or webhook URL not configured' },
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
