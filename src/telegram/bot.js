// src/telegram/bot.js
const TelegramConfig = require('./config/telegram');
const VoiceHandlerSimple = require('./handlers/voice-simple');
const TextHandler = require('./handlers/text');
const ErrorHandler = require('./handlers/error');

class TelegramVoiceBot {
  constructor() {
    this.config = new TelegramConfig();
    this.bot = this.config.getBot();
    this.settings = this.config.getConfig();
    
    if (!this.bot) {
      console.error('❌ Bot Telegram non inizializzato');
      return;
    }
    
    // Initialize handlers
    this.voiceHandler = new VoiceHandlerSimple(this.bot, this.settings);
    this.textHandler = new TextHandler(this.bot, this.settings);  
    this.errorHandler = new ErrorHandler(this.bot);
    
    // Setup message listeners
    this.setupListeners();
    
    console.log('🤖 OB Voice Telegram Bot avviato');
  }
  
  setupListeners() {
    // ===== VOICE MESSAGE HANDLER =====
    this.bot.on('voice', async (msg) => {
      try {
        console.log('🎙️ Voice message ricevuto da:', msg.from.username || msg.from.first_name);
        await this.voiceHandler.handleVoiceMessage(msg);
      } catch (error) {
        console.error('❌ Errore voice handler:', error);
        await this.errorHandler.handleError(msg.chat.id, error);
      }
    });
    
    // ===== AUDIO FILE HANDLER =====  
    this.bot.on('audio', async (msg) => {
      try {
        console.log('🎵 Audio file ricevuto da:', msg.from.username || msg.from.first_name);
        await this.voiceHandler.handleAudioFile(msg);
      } catch (error) {
        console.error('❌ Errore audio handler:', error);
        await this.errorHandler.handleError(msg.chat.id, error);
      }
    });
    
    // ===== DOCUMENT HANDLER (Audio files as documents) =====
    this.bot.on('document', async (msg) => {
      try {
        const mimeType = msg.document.mime_type;
        if (this.settings.supportedAudioTypes.includes(mimeType)) {
          console.log('📁 Audio document ricevuto da:', msg.from.username || msg.from.first_name);
          await this.voiceHandler.handleAudioDocument(msg);
        }
      } catch (error) {
        console.error('❌ Errore document handler:', error);
        await this.errorHandler.handleError(msg.chat.id, error);
      }
    });
    
    // ===== TEXT MESSAGE HANDLER =====
    this.bot.on('message', async (msg) => {
      try {
        // Skip if it's voice, audio, or document (handled above)
        if (msg.voice || msg.audio || msg.document) return;
        
        // Handle text messages and commands
        if (msg.text) {
          console.log('💬 Messaggio testo da:', msg.from.username || msg.from.first_name, ':', msg.text);
          await this.textHandler.handleTextMessage(msg);
        }
      } catch (error) {
        console.error('❌ Errore text handler:', error);
        await this.errorHandler.handleError(msg.chat.id, error);
      }
    });
    
    // ===== CALLBACK QUERY HANDLER (Inline buttons) =====
    this.bot.on('callback_query', async (callbackQuery) => {
      try {
        console.log('🔘 Callback query:', callbackQuery.data);
        await this.textHandler.handleCallbackQuery(callbackQuery);
      } catch (error) {
        console.error('❌ Errore callback handler:', error);
        await this.errorHandler.handleError(callbackQuery.message.chat.id, error);
      }
    });
    
    // ===== GLOBAL ERROR HANDLERS =====
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('🔥 Uncaught Exception:', error);
      process.exit(1);
    });
  }
  
  // ===== PUBLIC METHODS =====
  getBot() {
    return this.bot;
  }
  
  async sendMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      console.error('❌ Errore invio messaggio:', error);
      throw error;
    }
  }
  
  async editMessage(chatId, messageId, text, options = {}) {
    try {
      return await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      console.error('❌ Errore modifica messaggio:', error);
      throw error;
    }
  }
  
  // ===== UTILITY METHODS =====
  formatUserInfo(user) {
    return {
      telegram_user_id: user.id.toString(),
      telegram_username: user.username || `${user.first_name} ${user.last_name || ''}`.trim(),
      first_name: user.first_name,
      last_name: user.last_name || null,
      username: user.username || null
    };
  }
  
  isAudioFile(mimeType) {
    return this.settings.supportedAudioTypes.includes(mimeType);
  }
  
  // ===== SHUTDOWN HANDLER =====
  async shutdown() {
    try {
      console.log('🛑 Shutting down Telegram bot...');
      
      if (this.bot) {
        await this.bot.close();
      }
      
      console.log('✅ Telegram bot shutdown complete');
    } catch (error) {
      console.error('❌ Errore durante shutdown:', error);
    }
  }
}

module.exports = TelegramVoiceBot;