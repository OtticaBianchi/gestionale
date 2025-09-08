// src/telegram/config/telegram.js
const TelegramBot = require('node-telegram-bot-api');

class TelegramConfig {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    this.bot = null;
    
    if (!this.token) {
      console.error('❌ TELEGRAM_BOT_TOKEN non configurato');
      return;
    }
    
    // Configurazione bot
    this.options = {
      polling: process.env.NODE_ENV === 'development',
      webHook: process.env.NODE_ENV === 'production'
    };
    
    // Inizializza bot
    this.initBot();
  }
  
  initBot() {
    try {
      this.bot = new TelegramBot(this.token, this.options);
      
      // Set webhook per produzione
      if (this.options.webHook && this.webhookUrl) {
        this.bot.setWebHook(this.webhookUrl);
        console.log('✅ Telegram webhook configurato:', this.webhookUrl);
      }
      
      // Event listeners per errori
      this.bot.on('error', (error) => {
        console.error('🔥 Telegram Bot Error:', error);
      });
      
      this.bot.on('polling_error', (error) => {
        console.error('🔥 Telegram Polling Error:', error);
      });
      
      console.log('✅ Telegram Bot inizializzato');
      
    } catch (error) {
      console.error('❌ Errore inizializzazione Telegram Bot:', error);
    }
  }
  
  getBot() {
    return this.bot;
  }
  
  // Configurazioni per diversi ambienti
  getConfig() {
    return {
      // File settings
      maxFileSizeMB: 20,
      supportedAudioTypes: [
        'audio/ogg',
        'audio/mpeg', 
        'audio/wav',
        'audio/mp4',
        'audio/webm'
      ],
      
      // AssemblyAI settings
      assemblyAI: {
        apiKey: process.env.ASSEMBLYAI_API_KEY,
        language: 'it',
        features: {
          punctuate: true,
          format_text: true,
          auto_punctuation: true,
          language_code: 'it'
        },
        wordBoost: [
          // Brand principali ottici
          'Zeiss', 'Essilor', 'Hoya', 'Ray-Ban', 'Oakley', 'Persol', 
          'Prada', 'Gucci', 'Versace', 'Tom Ford', 'Armani', 
          'Dolce e Gabbana', 'Chanel', 'Brunello Cucinelli', 'Swarovski',
          'Luxottica', 'Ultra Limited', 'Serengeti', 'Bollé', 'Miu miu',
          'Rudy Project', 'Garmin', 'CEP', 'Craft', 'Umbrail', 'Meta',
          'Nuance', 'Assoluto', 'Arnette', 'Vogue', 'Bulgari', 'Michael Kors',
          'Centro Stile', 'BluOptical',
          
          // Lenti e trattamenti
          'progressive', 'progressivi', 'bifocali', 'multifocali', 'monofocali',
          'antiriflesso', 'Office', 'toriche', 'Crizal', 'Transitions',
          'polarizzate', 'fotocromatiche', 'Blue Control', 'DriveSafe',
          'A supporto accomodativo', 'DuraVision', 'Anti Luce Blu',
          'UV Protection', 'Eyezen', 'Computer', 'Relax', 'Varilux',
          'MiyoSmart', 'Mirror', 'A specchio', 'Hoyalux', 'PhotoFusion',
          
          // Termini tecnici
          'diottrie', 'centratura', 'distanza pupillare', 'calibro',
          'cilindro', 'asse', 'addizione', 'prisma', 'sferico',
          'astigmatismo', 'miopia', 'ipermetropia', 'presbiopia',
          'ambliopia', 'strabismo', 'cataratta', 'glaucoma',
          
          // Materiali
          'acetato', 'titanio', 'metallo', 'plastica', 'nylon',
          'TR90', 'alluminio', 'aviator', 'wayfarer', 'cat eye',
          'rotonda', 'quadrata', 'rettangolare', 'Holbrook',
          'Clubmaster', 'Frogskins', 'glasant',
          
          // Parti occhiale  
          'montatura', 'lente', 'nasello', 'plaquette', 'terminale',
          'flex', 'cerniera', 'vite', 'stanghetta', 'frontale',
          'ponte', 'asta',
          
          // Servizi
          'controllo vista', 'esame visivo', 'refrazione', 'tonometria',
          'pachimetria', 'campo visivo', 'OCT', 'retinografia',
          'autorefrazione', 'ortochertologia', 'cheratocono'
        ]
      },
      
      // AI Analysis settings  
      aiAnalysis: {
        provider: 'openrouter', // openrouter | openai | anthropic
        model: 'anthropic/claude-3-haiku', // Fast and economical
        backupModel: 'meta-llama/llama-3-8b-instruct', // Free backup
        openRouterKey: process.env.OPENROUTER_API_KEY,
        
        categories: [
          'CLIENTE',           // Gestione clienti, reclami, feedback  
          'TECNICO',          // Riparazioni, manutenzione strumenti
          'AMMINISTRATIVO',   // Fatture, documenti, burocrazia
          'INVENTARIO',       // Ordini, scorte, fornitori
          'APPUNTAMENTI',     // Visite, controlli, agenda
          'URGENTE',          // Emergenze immediate
          'SEGUIRE',          // Richiede follow-up
          'ALTRO'             // Non classificabile
        ],
        
        sentiments: [
          'NEUTRALE',         // Tono normale
          'PREOCCUPATO',      // Operatore mostra preoccupazione
          'FRUSTRATO',        // Irritazione evidente
          'ARRABBIATO',       // Rabbia o disappunto
          'URGENTE',          // Richiede azione immediata
          'POSITIVO'          // Soddisfatto o entusiasta
        ],
        
        priorityLevels: {
          1: 'MOLTO_BASSA',
          2: 'BASSA', 
          3: 'MEDIA',
          4: 'ALTA',
          5: 'CRITICA'
        }
      },
      
      // Database settings
      database: {
        tableName: 'voice_notes',
        autoCleanup: true,
        cleanupDays: 30 // Delete completed notes after 30 days
      },
      
      // Response messages
      messages: {
        welcome: "🎙️ *OB Voice Telegram Bot*\n\nInvia un messaggio vocale e verrà automaticamente:\n• 📝 Trascritto\n• 🏷️ Categorizzato\n• 😊 Analizzato per sentiment\n• 📅 Estratte eventuali date\n• 💾 Salvato nel gestionale",
        
        processing: "⏳ *Elaborazione in corso...*\n\n📥 Audio ricevuto\n🔄 Trascrizione in corso...",
        
        transcriptionComplete: "✅ *Trascrizione completata*\n\n🤖 Analisi AI in corso...",
        
        saved: "💾 *Nota salvata nel gestionale*\n\n🆔 ID: #%s\n⏰ Salvata: %s",
        
        error: "❌ *Errore durante l'elaborazione*\n\n%s\n\nRiprova o contatta l'amministratore.",
        
        unsupportedFile: "⚠️ *Tipo file non supportato*\n\nInvia un messaggio vocale o un file audio nei formati:\n• OGG/Opus (Telegram voice)\n• MP3, WAV, MP4, WebM"
      }
    };
  }
}

module.exports = TelegramConfig;