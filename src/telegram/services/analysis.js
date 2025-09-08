// src/telegram/services/analysis.js
const axios = require('axios');

class AnalysisService {
  constructor(settings) {
    this.settings = settings;
    this.aiConfig = settings.aiAnalysis;
    
    if (!this.aiConfig.openRouterKey) {
      console.warn('⚠️ OpenRouter API key not configured - AI analysis disabled');
    } else {
      console.log('✅ AI Analysis service initialized with', this.aiConfig.model);
    }
  }
  
  // ===== MAIN ANALYSIS PIPELINE =====
  async analyzeTranscription(transcription, metadata = {}) {
    try {
      console.log('🤖 Starting AI analysis for transcription...');
      
      if (!transcription || transcription.trim().length < 5) {
        throw new Error('Transcription too short for analysis');
      }
      
      if (!this.aiConfig.openRouterKey) {
        console.log('⚠️ AI analysis skipped - API key not configured');
        return this.getDefaultAnalysis();
      }
      
      // Prepare analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(transcription, metadata);
      
      // Call AI model
      const aiResponse = await this.callAIModel(analysisPrompt);
      
      // Parse and validate response
      const analysis = this.parseAIResponse(aiResponse);
      
      // Add confidence scoring
      analysis.confidence_scores = this.calculateConfidenceScores(analysis, transcription);
      
      console.log('✅ AI analysis completed:', {
        category: analysis.category_auto,
        sentiment: analysis.sentiment,
        priority: analysis.priority_level,
        dates_found: analysis.extracted_dates?.length || 0
      });
      
      return analysis;
      
    } catch (error) {
      console.error('❌ AI analysis error:', error);
      
      // Return safe fallback analysis
      return this.getDefaultAnalysis(transcription);
    }
  }
  
  // ===== AI MODEL INTERACTION =====
  async callAIModel(prompt, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 AI model call attempt ${attempt}/${maxRetries}`);
        
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: this.aiConfig.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent analysis
          max_tokens: 1000,
          top_p: 0.9
        }, {
          headers: {
            'Authorization': `Bearer ${this.aiConfig.openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost:3000',
            'X-Title': 'OB Voice Telegram Bot'
          },
          timeout: 30000 // 30 seconds timeout
        });
        
        if (response.data?.choices?.[0]?.message?.content) {
          return response.data.choices[0].message.content;
        } else {
          throw new Error('Invalid AI response format');
        }
        
      } catch (error) {
        lastError = error;
        console.error(`❌ AI model call attempt ${attempt} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          break; // Invalid API key
        }
        
        // Wait before retry
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }
  
  // ===== SYSTEM PROMPT =====
  getSystemPrompt() {
    return `Sei un assistente AI specializzato nell'analisi di note vocali per un negozio di ottica.

Il tuo compito è analizzare trascrizioni di messaggi vocali degli addetti del negozio e fornire:

1. CATEGORIZZAZIONE (una categoria):
- CLIENTE: Gestione clienti, reclami, feedback, richieste
- TECNICO: Riparazioni, manutenzione, problemi strumenti
- AMMINISTRATIVO: Fatture, documenti, burocrazia, pratiche
- INVENTARIO: Ordini materiali, scorte, fornitori
- APPUNTAMENTI: Visite, controlli vista, appuntamenti
- URGENTE: Emergenze che richiedono azione immediata
- SEGUIRE: Note che richiedono follow-up futuro
- ALTRO: Non classificabile nelle categorie precedenti

2. SENTIMENT ANALYSIS (un sentiment):
- NEUTRALE: Tono normale, informativo
- PREOCCUPATO: Operatore mostra preoccupazione
- FRUSTRATO: Irritazione o frustrazione evidente  
- ARRABBIATO: Rabbia, forte disappunto
- URGENTE: Richiede azione immediata, tono allarmato
- POSITIVO: Soddisfatto, entusiasta, contento

3. PRIORITÀ (numero 1-5):
- 1: Molto bassa (informazioni generali)
- 2: Bassa (routine normale)
- 3: Media (da gestire entro qualche giorno)
- 4: Alta (da gestire oggi/domani)
- 5: Critica (urgente, azione immediata)

4. ESTRAZIONE DATE: Trova e formatta date/orari menzionati

5. NECESSITA REVISIONE: true se l'analisi è incerta

Rispondi SEMPRE in formato JSON valido, senza markdown o formattazione extra.`;
  }
  
  // ===== ANALYSIS PROMPT BUILDER =====
  buildAnalysisPrompt(transcription, metadata = {}) {
    let prompt = `Analizza questa trascrizione di nota vocale da un negozio di ottica:\n\n`;
    prompt += `TRASCRIZIONE: "${transcription}"\n\n`;
    
    if (metadata.duration) {
      prompt += `DURATA: ${Math.round(metadata.duration)} secondi\n`;
    }
    
    if (metadata.confidence) {
      prompt += `CONFIDENZA TRASCRIZIONE: ${Math.round(metadata.confidence * 100)}%\n`;
    }
    
    prompt += `\nFornisci l'analisi in questo formato JSON esatto:\n`;
    prompt += `{\n`;
    prompt += `  "category_auto": "CATEGORIA",\n`;
    prompt += `  "sentiment": "SENTIMENT",\n`;
    prompt += `  "priority_level": numero_1_5,\n`;
    prompt += `  "extracted_dates": [\n`;
    prompt += `    {\n`;
    prompt += `      "text": "testo_originale",\n`;
    prompt += `      "parsed_date": "YYYY-MM-DDTHH:MM:SS.000Z",\n`;
    prompt += `      "type": "appointment|deadline|reminder",\n`;
    prompt += `      "confidence": numero_0_1\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "needs_review": boolean,\n`;
    prompt += `  "reasoning": "spiegazione_breve_della_scelta"\n`;
    prompt += `}`;
    
    return prompt;
  }
  
  // ===== AI RESPONSE PARSING =====
  parseAIResponse(aiResponse) {
    try {
      // Clean up response (remove markdown formatting if present)
      let cleanResponse = aiResponse.trim();
      
      // Remove markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*|```\s*/g, '');
      
      // Try to find JSON in response
      const jsonMatch = cleanResponse.match(/{[\s\S]*}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      // Validate and clean up parsed data
      const analysis = {
        category_auto: this.validateCategory(parsed.category_auto),
        sentiment: this.validateSentiment(parsed.sentiment),
        priority_level: this.validatePriority(parsed.priority_level),
        extracted_dates: this.validateDates(parsed.extracted_dates || []),
        needs_review: Boolean(parsed.needs_review),
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
      console.error('Raw AI response:', aiResponse);
      
      // Return safe fallback
      throw new Error('Invalid AI response format');
    }
  }
  
  // ===== VALIDATION METHODS =====
  validateCategory(category) {
    const validCategories = this.aiConfig.categories;
    return validCategories.includes(category) ? category : 'ALTRO';
  }
  
  validateSentiment(sentiment) {
    const validSentiments = this.aiConfig.sentiments;
    return validSentiments.includes(sentiment) ? sentiment : 'NEUTRALE';
  }
  
  validatePriority(priority) {
    const num = parseInt(priority);
    return (num >= 1 && num <= 5) ? num : 2;
  }
  
  validateDates(dates) {
    if (!Array.isArray(dates)) return [];
    
    return dates.filter(date => {
      return date && 
             typeof date.text === 'string' &&
             typeof date.parsed_date === 'string' &&
             typeof date.type === 'string';
    }).slice(0, 5); // Limit to 5 dates max
  }
  
  // ===== CONFIDENCE SCORING =====
  calculateConfidenceScores(analysis, transcription) {
    const scores = {
      overall: 0.8 // Default confidence
    };
    
    // Category confidence based on keywords
    const categoryKeywords = {
      'CLIENTE': ['cliente', 'signor', 'signora', 'telefon', 'chiama', 'reclam', 'lament'],
      'TECNICO': ['ripara', 'aggiust', 'rott', 'problem', 'manutenz', 'sistemare'],
      'AMMINISTRATIVO': ['fattur', 'document', 'praticha', 'ufficio', 'admin'],
      'INVENTARIO': ['ordin', 'material', 'stock', 'fornitor', 'arriva', 'scort'],
      'APPUNTAMENTI': ['appuntament', 'visit', 'control', 'domani', 'oggi', 'ore'],
      'URGENTE': ['urgent', 'subito', 'immediat', 'emergency', 'problem']
    };
    
    const transcLower = transcription.toLowerCase();
    const categoryWords = categoryKeywords[analysis.category_auto] || [];
    const foundKeywords = categoryWords.filter(keyword => 
      transcLower.includes(keyword)
    ).length;
    
    scores.category = Math.min(0.9, 0.4 + (foundKeywords * 0.1));
    
    // Sentiment confidence based on emotional indicators
    const sentimentIndicators = {
      'ARRABBIATO': ['maledett', 'cazz', 'merda', 'odio', 'rabbia'],
      'FRUSTRATO': ['stress', 'nervos', 'irrit', 'stufo', 'basta'],
      'PREOCCUPATO': ['preoccup', 'ansia', 'problem', 'paura', 'timore'],
      'POSITIVO': ['bene', 'ottimo', 'perfetto', 'contento', 'bravo'],
      'URGENTE': ['urgent', 'subito', 'veloce', 'presto', 'immediat']
    };
    
    const sentimentWords = sentimentIndicators[analysis.sentiment] || [];
    const foundSentiments = sentimentWords.filter(word => 
      transcLower.includes(word)
    ).length;
    
    scores.sentiment = Math.min(0.9, 0.5 + (foundSentiments * 0.1));
    
    // Priority confidence based on urgency indicators
    const urgencyWords = ['urgent', 'subito', 'presto', 'immediat', 'emergency'];
    const foundUrgency = urgencyWords.filter(word => 
      transcLower.includes(word)
    ).length;
    
    if (analysis.priority_level >= 4 && foundUrgency > 0) {
      scores.priority = 0.8;
    } else if (analysis.priority_level <= 2 && foundUrgency === 0) {
      scores.priority = 0.7;
    } else {
      scores.priority = 0.6;
    }
    
    // Date extraction confidence
    scores.dates = analysis.extracted_dates.length > 0 ? 0.7 : 0.9;
    
    // Overall confidence
    scores.overall = (scores.category + scores.sentiment + scores.priority) / 3;
    
    return scores;
  }
  
  // ===== FALLBACK ANALYSIS =====
  getDefaultAnalysis(transcription = '') {
    console.log('🔧 Using default analysis (AI not available)');
    
    return {
      category_auto: 'ALTRO',
      sentiment: 'NEUTRALE', 
      priority_level: 2,
      extracted_dates: [],
      needs_review: true,
      reasoning: 'AI analysis not available - manual review needed',
      confidence_scores: {
        overall: 0.1,
        category: 0.1,
        sentiment: 0.1,
        priority: 0.1,
        dates: 0.1
      }
    };
  }
  
  // ===== HEALTH CHECK =====
  async healthCheck() {
    try {
      if (!this.aiConfig.openRouterKey) {
        return {
          status: 'disabled',
          message: 'AI analysis disabled - API key not configured'
        };
      }
      
      // Test with simple analysis
      const testAnalysis = await this.analyzeTranscription(
        'Il cliente ha chiamato per un problema con gli occhiali'
      );
      
      return {
        status: 'healthy',
        message: 'AI analysis service operational',
        test_result: {
          category: testAnalysis.category_auto,
          sentiment: testAnalysis.sentiment
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

module.exports = AnalysisService;