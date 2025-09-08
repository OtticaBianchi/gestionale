// src/telegram/handlers/error.js

class ErrorHandler {
  constructor(bot) {
    this.bot = bot;
  }
  
  async handleError(chatId, error, context = '') {
    console.error('🔥 Telegram Bot Error:', error);
    console.error('📍 Context:', context);
    
    let userMessage = '❌ *Errore durante l\'elaborazione*\n\n';
    
    // Categorizza l'errore e fornisci messaggio specifico
    if (error.message) {
      if (error.message.includes('file too large')) {
        userMessage += '📁 File troppo grande (max 20MB)\n\nProva a inviare un messaggio vocale più corto.';
      } 
      else if (error.message.includes('unsupported format')) {
        userMessage += '🎵 Formato audio non supportato\n\nInvia un messaggio vocale o file audio nei formati:\n• OGG/Opus (Telegram voice)\n• MP3, WAV, MP4, WebM';
      }
      else if (error.message.includes('transcription')) {
        userMessage += '🎙️ Errore nella trascrizione audio\n\nPossibili cause:\n• Audio non chiaro\n• Rumore di fondo eccessivo\n• Lingua non riconosciuta\n\nRiprova parlando più chiaramente.';
      }
      else if (error.message.includes('database')) {
        userMessage += '💾 Errore salvataggio nel database\n\nIl problema è temporaneo, riprova tra qualche minuto.';
      }
      else if (error.message.includes('AI analysis')) {
        userMessage += '🤖 Errore nell\'analisi AI\n\nLa trascrizione è riuscita ma l\'analisi automatica ha avuto problemi.\nLa nota è comunque stata salvata.';
      }
      else if (error.message.includes('network') || error.message.includes('timeout')) {
        userMessage += '🌐 Problema di connessione\n\nRiprova tra qualche secondo.';
      }
      else {
        userMessage += `🔧 Errore tecnico\n\nDettagli: ${error.message.substring(0, 100)}...\n\nContatta l'amministratore se il problema persiste.`;
      }
    } else {
      userMessage += '🔧 Errore sconosciuto\n\nContatta l\'amministratore del sistema.';
    }
    
    // Aggiungi timestamp per debug
    const timestamp = new Date().toLocaleString('it-IT');
    userMessage += `\n\n🕐 ${timestamp}`;
    
    try {
      await this.bot.sendMessage(chatId, userMessage, {
        parse_mode: 'Markdown'
      });
    } catch (sendError) {
      console.error('❌ Impossibile inviare messaggio di errore:', sendError);
    }
  }
  
  async handleFileError(chatId, fileError) {
    let message = '❌ *Errore file*\n\n';
    
    if (fileError.message.includes('file_size')) {
      message += '📁 File troppo grande (max 20MB)';
    } else if (fileError.message.includes('mime_type')) {
      message += '🎵 Formato non supportato\n\nFormati accettati: OGG, MP3, WAV, MP4, WebM';
    } else {
      message += '📁 Impossibile processare il file';
    }
    
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('❌ Errore invio messaggio file error:', error);
    }
  }
  
  async handleTranscriptionError(chatId, transcriptionError) {
    const message = '❌ *Errore Trascrizione*\n\n' +
      '🎙️ Impossibile trascrivere l\'audio\n\n' +
      '*Possibili cause:*\n' +
      '• Audio troppo corto o silenzioso\n' +
      '• Qualità audio insufficiente\n' +
      '• Rumore di fondo eccessivo\n' +
      '• Lingua non riconosciuta\n\n' +
      '*Suggerimenti:*\n' +
      '• Parla più chiaramente\n' +
      '• Riduci il rumore ambientale\n' +
      '• Avvicinati al microfono\n' +
      '• Registra in un ambiente silenzioso';
    
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('❌ Errore invio messaggio trascrizione error:', error);
    }
  }
  
  async handleDatabaseError(chatId, dbError) {
    const message = '❌ *Errore Database*\n\n' +
      '💾 Impossibile salvare la nota\n\n' +
      'Il problema è temporaneo, riprova tra qualche minuto.\n' +
      'Se il problema persiste, contatta l\'amministratore.';
    
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('❌ Errore invio messaggio database error:', error);
    }
  }
  
  // Log dettagliato per debugging
  logError(error, context = '') {
    const errorLog = {
      timestamp: new Date().toISOString(),
      context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
    
    console.error('🔥 DETAILED ERROR LOG:', JSON.stringify(errorLog, null, 2));
  }
}

module.exports = ErrorHandler;