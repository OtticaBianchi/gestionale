// src/telegram/services/dateExtraction.js
const chrono = require('chrono-node');

class DateExtractionService {
  constructor() {
    // Configure chrono for Italian language (fallback to default if .it not available)
    this.parser = chrono.it || chrono;
    
    // Custom Italian patterns
    this.italianPatterns = [
      // Days of week
      { pattern: /domani/gi, description: 'tomorrow' },
      { pattern: /dopodomani/gi, description: 'day after tomorrow' },
      { pattern: /oggi/gi, description: 'today' },
      { pattern: /ieri/gi, description: 'yesterday' },
      { pattern: /lunedì|lunedi/gi, description: 'Monday' },
      { pattern: /martedì|martedi/gi, description: 'Tuesday' },
      { pattern: /mercoledì|mercoledi/gi, description: 'Wednesday' },
      { pattern: /giovedì|giovedi/gi, description: 'Thursday' },
      { pattern: /venerdì|venerdi/gi, description: 'Friday' },
      { pattern: /sabato/gi, description: 'Saturday' },
      { pattern: /domenica/gi, description: 'Sunday' },
      
      // Relative time
      { pattern: /fra\s+(\d+)\s+or[ei]/gi, description: 'in X hours' },
      { pattern: /tra\s+(\d+)\s+or[ei]/gi, description: 'in X hours' },
      { pattern: /fra\s+(\d+)\s+giorn[oi]/gi, description: 'in X days' },
      { pattern: /tra\s+(\d+)\s+giorn[oi]/gi, description: 'in X days' },
      { pattern: /settimana\s+prossima/gi, description: 'next week' },
      { pattern: /mese\s+prossimo/gi, description: 'next month' },
      
      // Time expressions
      { pattern: /stamattina/gi, description: 'this morning' },
      { pattern: /stasera/gi, description: 'this evening' },
      { pattern: /stanotte/gi, description: 'tonight' },
      { pattern: /nel\s+pomeriggio/gi, description: 'in the afternoon' },
      { pattern: /la\s+mattina/gi, description: 'in the morning' },
      { pattern: /verso\s+le\s+(\d{1,2})/gi, description: 'around X oclock' },
      { pattern: /alle\s+(\d{1,2})/gi, description: 'at X oclock' },
      
      // Specific dates
      { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, description: 'DD/MM/YYYY' },
      { pattern: /(\d{1,2})-(\d{1,2})-(\d{2,4})/g, description: 'DD-MM-YYYY' },
      { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g, description: 'DD.MM.YYYY' }
    ];
    
    console.log('✅ Date extraction service initialized');
  }
  
  // ===== MAIN EXTRACTION METHOD =====
  extractDates(text, referenceDate = new Date()) {
    try {
      console.log('📅 Extracting dates from text:', text.substring(0, 100) + '...');
      
      const results = [];
      
      // Use chrono-node for standard parsing
      const chronoParsed = this.parser.parse(text, referenceDate, { forwardDate: true });
      
      // Process chrono results
      for (const result of chronoParsed) {
        const extracted = {
          text: result.text,
          parsed_date: result.start.date().toISOString(),
          type: this.classifyDateType(result.text, text),
          confidence: this.calculateConfidence(result),
          source: 'chrono',
          original_index: result.index
        };
        
        results.push(extracted);
      }
      
      // Apply custom Italian patterns
      const customResults = this.applyCustomPatterns(text, referenceDate);
      results.push(...customResults);
      
      // Remove duplicates and sort by confidence
      const uniqueResults = this.removeDuplicates(results);
      const sortedResults = uniqueResults.sort((a, b) => b.confidence - a.confidence);
      
      console.log(`✅ Found ${sortedResults.length} date(s):`, 
        sortedResults.map(r => ({ text: r.text, date: r.parsed_date.substring(0, 16) }))
      );
      
      return sortedResults.slice(0, 5); // Limit to top 5 results
      
    } catch (error) {
      console.error('❌ Date extraction error:', error);
      return [];
    }
  }
  
  // ===== CUSTOM ITALIAN PATTERNS =====
  applyCustomPatterns(text, referenceDate) {
    const results = [];
    
    for (const pattern of this.italianPatterns) {
      const matches = text.matchAll(pattern.pattern);
      
      for (const match of matches) {
        try {
          const extractedDate = this.parseItalianExpression(match[0], referenceDate);
          
          if (extractedDate) {
            results.push({
              text: match[0],
              parsed_date: extractedDate.toISOString(),
              type: this.classifyDateType(match[0], text),
              confidence: 0.7,
              source: 'custom_pattern',
              original_index: match.index
            });
          }
        } catch (error) {
          console.warn('⚠️ Error parsing custom pattern:', match[0], error.message);
        }
      }
    }
    
    return results;
  }
  
  // ===== ITALIAN EXPRESSION PARSER =====
  parseItalianExpression(expression, referenceDate) {
    const expr = expression.toLowerCase().trim();
    const now = new Date(referenceDate);
    
    // Direct mappings
    switch (expr) {
      case 'oggi':
        return new Date(now);
        
      case 'domani':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
        
      case 'dopodomani':
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        return dayAfter;
        
      case 'ieri':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
        
      case 'stamattina':
        const thisMorning = new Date(now);
        thisMorning.setHours(9, 0, 0, 0);
        return thisMorning;
        
      case 'stasera':
        const thisEvening = new Date(now);
        thisEvening.setHours(19, 0, 0, 0);
        return thisEvening;
        
      case 'stanotte':
        const tonight = new Date(now);
        tonight.setHours(22, 0, 0, 0);
        return tonight;
    }
    
    // Days of week
    const dayNames = {
      'lunedì': 1, 'lunedi': 1,
      'martedì': 2, 'martedi': 2,
      'mercoledì': 3, 'mercoledi': 3,
      'giovedì': 4, 'giovedi': 4,
      'venerdì': 5, 'venerdi': 5,
      'sabato': 6,
      'domenica': 0
    };
    
    for (const [dayName, dayNum] of Object.entries(dayNames)) {
      if (expr.includes(dayName)) {
        return this.getNextDayOfWeek(now, dayNum);
      }
    }
    
    // Time expressions with "verso le" or "alle"
    const timeMatch = expr.match(/(?:verso le|alle)\s+(\d{1,2})(?:[:.](d{2}))?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      
      const timeDate = new Date(now);
      timeDate.setHours(hour, minute, 0, 0);
      
      // If time has passed today, set for tomorrow
      if (timeDate < now) {
        timeDate.setDate(timeDate.getDate() + 1);
      }
      
      return timeDate;
    }
    
    // Relative time expressions
    const relativeMatch = expr.match(/(?:fra|tra)\s+(\d+)\s+(or[ei]|giorn[oi])/);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2];
      
      const relativeDate = new Date(now);
      
      if (unit.startsWith('or')) {
        relativeDate.setHours(relativeDate.getHours() + amount);
      } else if (unit.startsWith('giorn')) {
        relativeDate.setDate(relativeDate.getDate() + amount);
      }
      
      return relativeDate;
    }
    
    // Week expressions
    if (expr.includes('settimana prossima')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    
    return null;
  }
  
  // ===== UTILITY METHODS =====
  getNextDayOfWeek(fromDate, dayOfWeek) {
    const date = new Date(fromDate);
    const currentDay = date.getDay();
    const daysUntil = (dayOfWeek + 7 - currentDay) % 7;
    
    // If it's the same day, get next week's occurrence
    const daysToAdd = daysUntil === 0 ? 7 : daysUntil;
    
    date.setDate(date.getDate() + daysToAdd);
    return date;
  }
  
  classifyDateType(text, fullText) {
    const textLower = text.toLowerCase();
    
    // Appointment indicators
    const appointmentWords = ['appuntament', 'visit', 'control', 'consulta', 'incontro'];
    if (appointmentWords.some(word => fullText.toLowerCase().includes(word))) {
      return 'appointment';
    }
    
    // Deadline indicators
    const deadlineWords = ['entro', 'scadenza', 'deadline', 'termine', 'limite'];
    if (deadlineWords.some(word => fullText.toLowerCase().includes(word))) {
      return 'deadline';
    }
    
    // Delivery indicators
    const deliveryWords = ['arriv', 'consegn', 'pronto', 'ritir'];
    if (deliveryWords.some(word => fullText.toLowerCase().includes(word))) {
      return 'delivery';
    }
    
    // Reminder indicators
    const reminderWords = ['ricordar', 'promemoria', 'non dimenticar', 'da fare'];
    if (reminderWords.some(word => fullText.toLowerCase().includes(word))) {
      return 'reminder';
    }
    
    return 'general';
  }
  
  calculateConfidence(chronoResult) {
    let confidence = 0.6; // Base confidence
    
    // Higher confidence for explicit dates
    if (chronoResult.text.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/)) {
      confidence += 0.3;
    }
    
    // Higher confidence for time included
    if (chronoResult.start.get('hour') !== null) {
      confidence += 0.2;
    }
    
    // Lower confidence for very vague expressions
    if (chronoResult.text.length < 4) {
      confidence -= 0.1;
    }
    
    return Math.min(1.0, Math.max(0.1, confidence));
  }
  
  removeDuplicates(results) {
    const unique = [];
    const seen = new Set();
    
    for (const result of results) {
      // Create a key based on the parsed date (rounded to nearest hour)
      const date = new Date(result.parsed_date);
      date.setMinutes(0, 0, 0); // Round to nearest hour
      const key = date.toISOString();
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      } else {
        // If duplicate, keep the one with higher confidence
        const existingIndex = unique.findIndex(u => {
          const uDate = new Date(u.parsed_date);
          uDate.setMinutes(0, 0, 0);
          return uDate.toISOString() === key;
        });
        
        if (existingIndex >= 0 && result.confidence > unique[existingIndex].confidence) {
          unique[existingIndex] = result;
        }
      }
    }
    
    return unique;
  }
  
  // ===== FORMATTING =====
  formatExtractedDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }
  
  // ===== HEALTH CHECK =====
  healthCheck() {
    try {
      const testText = 'Appuntamento domani alle 15:30 e controllo venerdì prossimo';
      const results = this.extractDates(testText);
      
      return {
        status: 'healthy',
        message: 'Date extraction service operational',
        test_results: results.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

module.exports = DateExtractionService;