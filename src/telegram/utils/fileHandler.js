// src/telegram/utils/fileHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FileHandler {
  constructor(bot, settings) {
    this.bot = bot;
    this.settings = settings;
    this.tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  // ===== TELEGRAM FILE DOWNLOAD =====
  async downloadTelegramFile(fileId, originalFilename = null) {
    try {
      console.log('📥 Downloading file:', fileId);
      
      // Get file info from Telegram
      const fileInfo = await this.bot.getFile(fileId);
      const filePath = fileInfo.file_path;
      const fileSize = fileInfo.file_size;
      
      // Validate file size
      const maxSizeBytes = this.settings.maxFileSizeMB * 1024 * 1024;
      if (fileSize > maxSizeBytes) {
        throw new Error(`file too large: ${fileSize} bytes > ${maxSizeBytes} bytes`);
      }
      
      // Generate temp filename
      const tempFilename = originalFilename || 
        `telegram_${fileId}_${Date.now()}.${this.getExtensionFromPath(filePath)}`;
      const tempFilePath = path.join(this.tempDir, tempFilename);
      
      // Download file from Telegram servers
      const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'stream'
      });
      
      // Save to temp file
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      console.log('✅ File downloaded:', tempFilePath, `(${fileSize} bytes)`);
      
      return {
        tempFilePath,
        originalName: originalFilename,
        fileSize,
        mimeType: this.getMimeTypeFromExtension(this.getExtensionFromPath(filePath))
      };
      
    } catch (error) {
      console.error('❌ Error downloading Telegram file:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }
  
  // ===== VOICE MESSAGE PROCESSING =====
  async processVoiceMessage(voiceFile) {
    return await this.downloadTelegramFile(
      voiceFile.file_id, 
      `voice_${Date.now()}.ogg`
    );
  }
  
  // ===== AUDIO FILE PROCESSING =====
  async processAudioFile(audioFile) {
    const extension = this.getExtensionFromMimeType(audioFile.mime_type);
    return await this.downloadTelegramFile(
      audioFile.file_id,
      audioFile.file_name || `audio_${Date.now()}.${extension}`
    );
  }
  
  // ===== DOCUMENT AUDIO PROCESSING =====
  async processAudioDocument(document) {
    if (!this.isAudioMimeType(document.mime_type)) {
      throw new Error('unsupported format: ' + document.mime_type);
    }
    
    return await this.downloadTelegramFile(
      document.file_id,
      document.file_name || `document_${Date.now()}.${this.getExtensionFromMimeType(document.mime_type)}`
    );
  }
  
  // ===== FILE TO BASE64 CONVERSION =====
  async fileToBase64(filePath) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      return fileBuffer.toString('base64');
    } catch (error) {
      console.error('❌ Error converting file to base64:', error);
      throw new Error(`File conversion failed: ${error.message}`);
    }
  }
  
  // ===== CLEANUP =====
  async cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Temp file deleted:', filePath);
      }
    } catch (error) {
      console.error('⚠️ Warning: Could not delete temp file:', filePath, error);
    }
  }
  
  async cleanupAllTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete files older than 1 hour
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (stats.mtime.getTime() < oneHourAgo) {
          await this.cleanupTempFile(filePath);
        }
      }
    } catch (error) {
      console.error('⚠️ Warning: Cleanup failed:', error);
    }
  }
  
  // ===== VALIDATION =====
  isAudioMimeType(mimeType) {
    return this.settings.supportedAudioTypes.includes(mimeType);
  }
  
  validateFileSize(fileSize) {
    const maxSizeBytes = this.settings.maxFileSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
  }
  
  // ===== UTILITY METHODS =====
  getExtensionFromPath(filePath) {
    return path.extname(filePath).slice(1) || 'unknown';
  }
  
  getExtensionFromMimeType(mimeType) {
    const extensions = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/mp4': 'mp4',
      'audio/webm': 'webm',
      'audio/x-wav': 'wav',
      'audio/x-mpeg': 'mp3'
    };
    return extensions[mimeType] || 'audio';
  }
  
  getMimeTypeFromExtension(extension) {
    const mimeTypes = {
      'ogg': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav', 
      'mp4': 'audio/mp4',
      'webm': 'audio/webm'
    };
    return mimeTypes[extension] || 'audio/unknown';
  }
  
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  getDurationFromSeconds(seconds) {
    if (!seconds) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = FileHandler;