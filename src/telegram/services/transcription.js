// src/telegram/services/transcription.js
const { AssemblyAI } = require('assemblyai');
const fs = require('fs');

class TranscriptionService {
  constructor(settings) {
    this.settings = settings;
    this.client = new AssemblyAI({
      apiKey: settings.assemblyAI.apiKey
    });
    
    if (!settings.assemblyAI.apiKey) {
      console.error('❌ AssemblyAI API key not configured');
    } else {
      console.log('✅ AssemblyAI client initialized');
    }
  }
  
  // ===== MAIN TRANSCRIPTION METHOD =====
  async transcribeFile(filePath, options = {}) {
    try {
      console.log('🎙️ Starting transcription:', filePath);
      
      if (!this.settings.assemblyAI.apiKey) {
        throw new Error('AssemblyAI API key not configured');
      }
      
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }
      
      // Upload audio file to AssemblyAI
      console.log('📤 Uploading audio file to AssemblyAI...');
      const uploadedUrl = await this.client.files.upload(filePath);
      console.log('✅ Audio uploaded, URL:', uploadedUrl);
      
      // Prepare transcription config (simplified)
      const config = {
        audio_url: uploadedUrl,
        language_code: 'it'
      };
      
      console.log('⏳ Submitting transcription request...');
      
      // Submit transcription
      const transcript = await this.client.transcripts.transcribe(config);
      
      if (transcript.status === 'error') {
        throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
      }
      
      // Validate result
      if (!transcript.text || transcript.text.trim() === '') {
        throw new Error('Transcription result is empty - please speak more clearly');
      }
      
      console.log('✅ Transcription completed:', transcript.text.substring(0, 100) + '...');
      
      // Format response
      const result = {
        text: transcript.text,
        confidence: transcript.confidence || 0,
        words: transcript.words || [],
        audio_duration: transcript.audio_duration || 0,
        
        // Additional metadata
        language_code: transcript.language_code,
        language_confidence: transcript.language_confidence,
        
        // Processing info
        processing_time: transcript.audio_duration ? 
          Math.round((Date.now() - Date.now()) / 1000) : null,
        
        // AssemblyAI metadata
        id: transcript.id,
        status: transcript.status
      };
      
      return result;
      
    } catch (error) {
      console.error('❌ Transcription error:', error);
      
      // Enhanced error handling
      if (error.message.includes('audio_duration')) {
        throw new Error('Audio file is too short or corrupted');
      } else if (error.message.includes('language')) {
        throw new Error('Language not detected - please speak in Italian');
      } else if (error.message.includes('network')) {
        throw new Error('Network error - please try again later');
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error('Transcription service temporarily unavailable');
      }
      
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }
  
  // ===== TRANSCRIPTION WITH RETRY =====
  async transcribeWithRetry(filePath, maxRetries = 3, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Transcription attempt ${attempt}/${maxRetries}`);
        return await this.transcribeFile(filePath, options);
        
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.message.includes('API key') || 
            error.message.includes('not found') ||
            error.message.includes('quota')) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }
  
  // ===== BATCH TRANSCRIPTION =====
  async transcribeMultiple(filePaths, options = {}) {
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.transcribeFile(filePath, options);
        results.push({ 
          filePath, 
          success: true, 
          result 
        });
      } catch (error) {
        results.push({ 
          filePath, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }
  
  // ===== TEXT POST-PROCESSING =====
  postProcessTranscription(text) {
    if (!text) return text;
    
    // Basic cleanup
    let processed = text.trim();
    
    // Fix common transcription issues for Italian optical terms
    const corrections = {
      'zais': 'Zeiss',
      'essilor': 'Essilor', 
      'oja': 'Hoya',
      'rayban': 'Ray-Ban',
      'oakly': 'Oakley',
      'progress': 'progressive',
      'progressiva': 'progressive',
      'antiriflesso': 'antiriflesso',
      'transizione': 'Transitions',
      'polaris': 'polarizzate',
      'fotocr': 'fotocromatiche',
      'miope': 'miopia',
      'presb': 'presbiopia',
      'astigmat': 'astigmatismo',
      'diott': 'diottrie',
      'monofoc': 'monofocali',
      'multifoc': 'multifocali',
      'bifoc': 'bifocali'
    };
    
    // Apply corrections (case insensitive)
    for (const [wrong, correct] of Object.entries(corrections)) {
      const regex = new RegExp(wrong, 'gi');
      processed = processed.replace(regex, correct);
    }
    
    // Clean up extra spaces and punctuation
    processed = processed
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/\.\s*\./g, '.')       // Double dots
      .replace(/,\s*,/g, ',')         // Double commas
      .replace(/\s+([.,!?])/g, '$1')  // Space before punctuation
      .trim();
    
    return processed;
  }
  
  // ===== VALIDATION =====
  validateTranscriptionResult(result) {
    if (!result || !result.text) {
      return { valid: false, error: 'No transcription text' };
    }
    
    if (result.text.trim().length < 3) {
      return { valid: false, error: 'Transcription too short' };
    }
    
    if (result.confidence && result.confidence < 0.3) {
      return { valid: false, error: 'Low confidence transcription' };
    }
    
    return { valid: true };
  }
  
  // ===== STATISTICS =====
  getTranscriptionStats(result) {
    if (!result || !result.text) {
      return null;
    }
    
    const words = result.text.split(/\s+/).filter(word => word.length > 0);
    
    return {
      characterCount: result.text.length,
      wordCount: words.length,
      averageWordsPerMinute: result.audio_duration ? 
        Math.round((words.length / result.audio_duration) * 60) : null,
      confidence: result.confidence,
      duration: result.audio_duration,
      language: result.language_code
    };
  }
  
  // ===== HEALTH CHECK =====
  async healthCheck() {
    try {
      // Simple API connectivity test
      const testConfig = {
        audio: 'https://github.com/AssemblyAI-Examples/audio-examples/raw/main/20230607_me_canadian_wildfires.mp3',
        language_code: 'en'
      };
      
      const response = await this.client.transcripts.transcribe(testConfig);
      return { 
        status: 'healthy', 
        message: 'AssemblyAI service is operational',
        apiKey: this.settings.assemblyAI.apiKey ? 'configured' : 'missing'
      };
      
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: error.message,
        apiKey: this.settings.assemblyAI.apiKey ? 'configured' : 'missing'
      };
    }
  }
}

module.exports = TranscriptionService;