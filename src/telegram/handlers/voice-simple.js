// src/telegram/handlers/voice-simple.js
const FileHandler = require('../utils/fileHandler');
const StorageService = require('../services/storage');

class VoiceHandlerSimple {
  constructor(bot, settings) {
    this.bot = bot;
    this.settings = settings;
    
    // Initialize services
    this.fileHandler = new FileHandler(bot, settings);
    this.storageService = new StorageService();
    
    console.log('🎙️ VoiceHandlerSimple initialized');
  }
  
  // ===== MAIN VOICE MESSAGE HANDLER =====
  async handleVoiceMessage(msg) {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userInfo = this.formatUserInfo(msg.from);
    let statusMessage = null;
    let tempFilePath = null;
    
    try {
      console.log('🎙️ Processing voice message from:', userInfo.telegram_username);
      
      // Send initial processing message
      statusMessage = await this.bot.sendMessage(
        chatId, 
        '⏳ *Elaborazione messaggio vocale...*\n\n📥 Download in corso...',
        { parse_mode: 'Markdown' }
      );
      
      // ===== STEP 1: DOWNLOAD VOICE FILE =====
      console.log('📥 Step 1: Downloading voice file...');
      const fileInfo = await this.fileHandler.processVoiceMessage(msg.voice);
      tempFilePath = fileInfo.tempFilePath;
      
      // ===== STEP 2: CONVERT TO BASE64 AND SAVE =====
      console.log('💾 Step 2: Converting to base64 and saving to database...');
      
      // Convert file to base64
      const audioBase64 = await this.fileHandler.fileToBase64(tempFilePath);
      
      // Create voice note data with just basic info
      const voiceNoteData = {
        telegram_message_id: messageId.toString(),
        telegram_user_id: userInfo.telegram_user_id,
        telegram_username: userInfo.telegram_username,
        addetto_nome: userInfo.addetto_nome,
        audioBase64: audioBase64,
        duration_seconds: msg.voice.duration,
        file_size: msg.voice.file_size,
        transcription: null, // Will be filled by Voice Triage
        category_auto: null,
        sentiment: null,
        priority_level: null,
        extracted_dates: null,
        confidence_scores: null,
        needs_review: true, // Always needs review
        stato: 'pending'
      };
      
      // Save to database
      const savedNote = await this.storageService.saveVoiceNote(voiceNoteData);
      
      // Send simple success message
      await this.bot.editMessageText(
        '✅ *Nota vocale salvata!*\n\n📝 *ID:* #' + savedNote.id.slice(-8) + 
        '\n⏰ *Durata:* ' + this.storageService.formatDuration(msg.voice.duration) +
        '\n\n👥 Sarà processata dal team tramite Voice Triage.',
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
          parse_mode: 'Markdown'
        }
      );
      
      console.log('✅ Voice message processing completed for:', userInfo.telegram_username);
      
    } catch (error) {
      console.error('❌ Voice message processing failed:', error);
      
      // Update status message with error
      if (statusMessage) {
        try {
          await this.bot.editMessageText(
            `❌ *Errore durante l'elaborazione*\n\n${error.message}`,
            {
              chat_id: chatId,
              message_id: statusMessage.message_id,
              parse_mode: 'Markdown'
            }
          );
        } catch (editError) {
          // If editing fails, send new error message
          await this.bot.sendMessage(
            chatId,
            `❌ *Errore durante l'elaborazione*\n\n${error.message}`,
            { parse_mode: 'Markdown' }
          );
        }
      } else {
        await this.bot.sendMessage(
          chatId,
          `❌ *Errore durante l'elaborazione*\n\n${error.message}`,
          { parse_mode: 'Markdown' }
        );
      }
      
      throw error;
      
    } finally {
      // ===== CLEANUP =====
      if (tempFilePath) {
        await this.fileHandler.cleanupTempFile(tempFilePath);
      }
    }
  }
  
  // ===== AUDIO FILE HANDLER =====
  async handleAudioFile(msg) {
    const chatId = msg.chat.id;
    const userInfo = this.formatUserInfo(msg.from);
    
    try {
      console.log('🎵 Processing audio file from:', userInfo.telegram_username);
      
      // Validate file type
      if (!this.fileHandler.isAudioMimeType(msg.audio.mime_type)) {
        throw new Error(`Formato audio non supportato: ${msg.audio.mime_type}`);
      }
      
      // Process similar to voice message but with audio object
      await this.processAudioMessage(msg, msg.audio, 'audio');
      
    } catch (error) {
      console.error('❌ Audio file processing failed:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Errore file audio*\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    }
  }
  
  // ===== AUDIO DOCUMENT HANDLER =====
  async handleAudioDocument(msg) {
    const chatId = msg.chat.id;
    const userInfo = this.formatUserInfo(msg.from);
    
    try {
      console.log('📁 Processing audio document from:', userInfo.telegram_username);
      
      // Validate file type
      if (!this.fileHandler.isAudioMimeType(msg.document.mime_type)) {
        throw new Error(`Formato documento non supportato: ${msg.document.mime_type}`);
      }
      
      // Process similar to voice message but with document object
      await this.processAudioMessage(msg, msg.document, 'document');
      
    } catch (error) {
      console.error('❌ Audio document processing failed:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Errore documento audio*\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    }
  }
  
  // ===== GENERIC AUDIO MESSAGE PROCESSOR =====
  async processAudioMessage(msg, audioObject, type) {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userInfo = this.formatUserInfo(msg.from);
    let statusMessage = null;
    let tempFilePath = null;
    
    try {
      // Send processing message
      statusMessage = await this.bot.sendMessage(
        chatId,
        `⏳ *Elaborazione ${type}...*\n\n📥 Download in corso...`,
        { parse_mode: 'Markdown' }
      );
      
      // Download file
      let fileInfo;
      if (type === 'audio') {
        fileInfo = await this.fileHandler.processAudioFile(audioObject);
      } else if (type === 'document') {
        fileInfo = await this.fileHandler.processAudioDocument(audioObject);
      }
      
      tempFilePath = fileInfo.tempFilePath;
      
      // Prepare and save data (simplified - no transcription)
      const audioBase64 = await this.fileHandler.fileToBase64(tempFilePath);
      
      const voiceNoteData = {
        audioBase64,
        file_size: fileInfo.fileSize,
        duration_seconds: audioObject.duration || 0,
        transcription: null, // Will be filled by Voice Triage
        telegram_message_id: messageId.toString(),
        telegram_user_id: userInfo.telegram_user_id,
        telegram_username: userInfo.telegram_username,
        addetto_nome: `${userInfo.first_name} (Telegram)`,
        category_auto: null,
        sentiment: null,
        priority_level: null,
        extracted_dates: null,
        confidence_scores: null,
        needs_review: true,
        stato: 'pending'
      };
      
      const savedNote = await this.storageService.saveVoiceNote(voiceNoteData);
      
      // Send success message
      await this.bot.editMessageText(
        `✅ *${type === 'audio' ? 'File audio' : 'Documento audio'} salvato!*\n\n` +
        `📝 *ID:* #${savedNote.id.slice(-8)}\n` +
        `📁 *Dimensione:* ${this.fileHandler.formatFileSize(fileInfo.fileSize)}\n\n` +
        `👥 Sarà processato dal team tramite Voice Triage.`,
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
          parse_mode: 'Markdown'
        }
      );
      
    } catch (error) {
      console.error(`❌ ${type} processing failed:`, error);
      
      if (statusMessage) {
        await this.bot.editMessageText(
          `❌ *Errore elaborazione ${type}*\n\n${error.message}`,
          {
            chat_id: chatId,
            message_id: statusMessage.message_id,
            parse_mode: 'Markdown'
          }
        );
      }
      
      throw error;
      
    } finally {
      if (tempFilePath) {
        await this.fileHandler.cleanupTempFile(tempFilePath);
      }
    }
  }
  
  // ===== UTILITY =====
  formatUserInfo(user) {
    return {
      telegram_user_id: user.id.toString(),
      telegram_username: user.username || `${user.first_name} ${user.last_name || ''}`.trim(),
      first_name: user.first_name,
      last_name: user.last_name || null,
      username: user.username || null,
      addetto_nome: user.username || `${user.first_name} ${user.last_name || ''}`.trim()
    };
  }
  
  // ===== HEALTH CHECK =====
  async healthCheck() {
    const checks = {
      fileHandler: 'OK',
      storageService: 'OK'
    };
    
    try {
      // Test storage service
      const storageHealth = await this.storageService.healthCheck();
      checks.storageService = storageHealth.status;
      
    } catch (error) {
      console.error('❌ Voice handler health check failed:', error);
    }
    
    return checks;
  }
}

module.exports = VoiceHandlerSimple;