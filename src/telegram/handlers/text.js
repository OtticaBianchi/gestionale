// src/telegram/handlers/text.js

class TextHandler {
  constructor(bot, settings) {
    this.bot = bot;
    this.settings = settings;
  }
  
  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase().trim();
    const userId = msg.from.id;
    
    // ===== COMMAND HANDLING =====
    if (text.startsWith('/')) {
      await this.handleCommand(msg);
      return;
    }
    
    // ===== REGULAR TEXT MESSAGE =====
    const welcomeMessage = this.settings.messages.welcome + '\n\n' +
      '📋 *Comandi disponibili:*\n' +
      '/start - Mostra questo messaggio\n' +
      '/help - Guida completa\n' +
      '/status - Stato del bot\n' +
      '/stats - Statistiche personali\n\n' +
      '💡 *Suggerimento:* Invia un messaggio vocale per iniziare!';
    
    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown'
    });
  }
  
  async handleCommand(msg) {
    const chatId = msg.chat.id;
    const command = msg.text.toLowerCase().split(' ')[0];
    const userInfo = this.formatUserInfo(msg.from);
    
    console.log('⚡ Command ricevuto:', command, 'da:', userInfo.telegram_username);
    
    switch (command) {
      case '/start':
        await this.handleStartCommand(chatId, userInfo);
        break;
        
      case '/help':
        await this.handleHelpCommand(chatId);
        break;
        
      case '/status':
        await this.handleStatusCommand(chatId);
        break;
        
      case '/stats':
        await this.handleStatsCommand(chatId, userInfo);
        break;
        
      case '/test':
        await this.handleTestCommand(chatId);
        break;
        
      default:
        await this.handleUnknownCommand(chatId, command);
    }
  }
  
  async handleStartCommand(chatId, userInfo) {
    const welcomeMessage = `👋 *Benvenuto in OB Voice Bot!*\n\n` +
      `Ciao ${userInfo.first_name}! 👤\n\n` +
      this.settings.messages.welcome + '\n\n' +
      '🚀 *Inizia subito:*\n' +
      '1. Invia un messaggio vocale\n' +
      '2. Attendi l\'elaborazione\n' +
      '3. Ricevi il risultato con analisi completa\n\n' +
      '📋 Digita /help per la guida completa';
    
    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❓ Guida Completa', callback_data: 'help' },
            { text: '📊 Statistiche', callback_data: 'stats' }
          ],
          [
            { text: '🔧 Stato Bot', callback_data: 'status' }
          ]
        ]
      }
    });
  }
  
  async handleHelpCommand(chatId) {
    const helpMessage = `📖 *Guida OB Voice Bot*\n\n` +
      
      `🎙️ *MESSAGGI VOCALI*\n` +
      `• Invia un messaggio vocale di max 20MB\n` +
      `• Parla chiaramente in italiano\n` +
      `• Evita rumori di fondo eccessivi\n\n` +
      
      `🎵 *FILE AUDIO SUPPORTATI*\n` +
      `• OGG/Opus (messaggi vocali Telegram)\n` +
      `• MP3, WAV, MP4, WebM\n` +
      `• Massimo 20MB per file\n\n` +
      
      `🤖 *FUNZIONI AUTOMATICHE*\n` +
      `• 📝 Trascrizione in italiano\n` +
      `• 🏷️ Categorizzazione automatica\n` +
      `• 😊 Analisi sentiment (tono)\n` +
      `• 📅 Estrazione date e orari\n` +
      `• ⚡ Livello priorità (1-5)\n` +
      `• 💾 Salvataggio nel gestionale\n\n` +
      
      `📋 *COMANDI DISPONIBILI*\n` +
      `/start - Messaggio di benvenuto\n` +
      `/help - Questa guida\n` +
      `/status - Controllo stato bot\n` +
      `/stats - Tue statistiche personali\n` +
      `/test - Test connessione\n\n` +
      
      `🔧 *CATEGORIE AUTO*\n` +
      `• CLIENTE - Gestione clienti, reclami\n` +
      `• TECNICO - Riparazioni, manutenzione\n` +
      `• AMMINISTRATIVO - Fatture, documenti\n` +
      `• INVENTARIO - Ordini, scorte\n` +
      `• APPUNTAMENTI - Visite, controlli\n` +
      `• URGENTE - Emergenze immediate\n` +
      `• SEGUIRE - Richiede follow-up\n\n` +
      
      `😊 *ANALISI SENTIMENT*\n` +
      `• NEUTRALE - Tono normale\n` +
      `• PREOCCUPATO - Mostra preoccupazione\n` +
      `• FRUSTRATO - Irritazione evidente\n` +
      `• ARRABBIATO - Rabbia/disappunto\n` +
      `• URGENTE - Azione immediata\n` +
      `• POSITIVO - Soddisfatto\n\n` +
      
      `❓ *SUPPORTO*\n` +
      `Per problemi o domande, contatta l'amministratore del sistema.`;
    
    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown'
    });
  }
  
  async handleStatusCommand(chatId) {
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    const statusMessage = `🔧 *Stato OB Voice Bot*\n\n` +
      `✅ Bot attivo e operativo\n` +
      `⏰ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n` +
      `🌐 Ambiente: ${process.env.NODE_ENV || 'development'}\n` +
      `📡 Connessione: OK\n` +
      `💾 Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Connesso' : 'Non configurato'}\n` +
      `🎙️ AssemblyAI: ${process.env.ASSEMBLYAI_API_KEY ? 'Configurato' : 'Non configurato'}\n` +
      `🤖 Analisi AI: ${process.env.OPENROUTER_API_KEY ? 'Attiva' : 'Non attiva'}\n\n` +
      `🕐 Ultimo controllo: ${new Date().toLocaleString('it-IT')}`;
    
    await this.bot.sendMessage(chatId, statusMessage, {
      parse_mode: 'Markdown'
    });
  }
  
  async handleStatsCommand(chatId, userInfo) {
    try {
      // Qui dovremmo interrogare il database per le statistiche utente
      // Per ora mostriamo un messaggio placeholder
      const statsMessage = `📊 *Le tue statistiche*\n\n` +
        `👤 Utente: ${userInfo.telegram_username}\n` +
        `🆔 ID Telegram: ${userInfo.telegram_user_id}\n\n` +
        `📝 Note vocali inviate: Caricamento...\n` +
        `🏷️ Categorie più usate: Caricamento...\n` +
        `😊 Sentiment predominante: Caricamento...\n` +
        `📅 Prima nota: Caricamento...\n` +
        `⏱️ Ultima nota: Caricamento...\n\n` +
        `📈 *Prossimamente:*\n` +
        `• Grafici dettagliati\n` +
        `• Statistiche temporali\n` +
        `• Report personalizzati`;
      
      await this.bot.sendMessage(chatId, statsMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Aggiorna Stats', callback_data: 'refresh_stats' }
            ]
          ]
        }
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, '❌ Errore nel recupero delle statistiche', {
        parse_mode: 'Markdown'
      });
    }
  }
  
  async handleTestCommand(chatId) {
    const testMessage = `🧪 *Test Connessione*\n\n` +
      `✅ Bot Telegram: OK\n` +
      `✅ Ricezione messaggi: OK\n` +
      `✅ Invio risposte: OK\n` +
      `🕐 Timestamp: ${new Date().toISOString()}\n\n` +
      `Tutto funziona correttamente! 🎉`;
    
    await this.bot.sendMessage(chatId, testMessage, {
      parse_mode: 'Markdown'
    });
  }
  
  async handleUnknownCommand(chatId, command) {
    const unknownMessage = `❓ *Comando non riconosciuto*\n\n` +
      `Il comando \`${command}\` non esiste.\n\n` +
      `📋 Comandi disponibili:\n` +
      `/start - Messaggio di benvenuto\n` +
      `/help - Guida completa\n` +
      `/status - Stato del bot\n` +
      `/stats - Tue statistiche\n` +
      `/test - Test connessione\n\n` +
      `💡 Oppure invia un messaggio vocale!`;
    
    await this.bot.sendMessage(chatId, unknownMessage, {
      parse_mode: 'Markdown'
    });
  }
  
  // ===== CALLBACK QUERY HANDLER =====
  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userInfo = this.formatUserInfo(callbackQuery.from);
    
    // Acknowledge the callback query
    await this.bot.answerCallbackQuery(callbackQuery.id);
    
    switch (data) {
      case 'help':
        await this.handleHelpCommand(chatId);
        break;
        
      case 'status':
        await this.handleStatusCommand(chatId);
        break;
        
      case 'stats':
        await this.handleStatsCommand(chatId, userInfo);
        break;
        
      case 'refresh_stats':
        await this.handleStatsCommand(chatId, userInfo);
        break;
        
      default:
        await this.bot.sendMessage(chatId, '❓ Azione non riconosciuta');
    }
  }
  
  // ===== UTILITY =====
  formatUserInfo(user) {
    return {
      telegram_user_id: user.id.toString(),
      telegram_username: user.username || `${user.first_name} ${user.last_name || ''}`.trim(),
      first_name: user.first_name,
      last_name: user.last_name || null,
      username: user.username || null
    };
  }
}

module.exports = TextHandler;