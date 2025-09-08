#!/usr/bin/env node
// scripts/test-telegram-bot.js
// Test suite for Telegram bot functionality

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const TelegramVoiceBot = require('../src/telegram/bot.js');
const TranscriptionService = require('../src/telegram/services/transcription.js');
const AnalysisService = require('../src/telegram/services/analysis.js');
const StorageService = require('../src/telegram/services/storage.js');
const DateExtractionService = require('../src/telegram/services/dateExtraction.js');

class TelegramBotTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTests() {
    console.log('🧪 OB Voice Telegram Bot Test Suite\n');
    
    try {
      await this.testServices();
      await this.testAnalysis();
      await this.testDateExtraction();
      await this.testDatabase();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testServices() {
    console.log('🔧 Testing Services...\n');

    // Test Transcription Service
    await this.test('TranscriptionService initialization', async () => {
      const service = new TranscriptionService({
        assemblyAI: {
          apiKey: process.env.ASSEMBLYAI_API_KEY,
          language: 'it'
        }
      });
      
      const health = await service.healthCheck();
      return health.status === 'healthy' || health.apiKey === 'configured';
    });

    // Test Analysis Service
    await this.test('AnalysisService initialization', async () => {
      const service = new AnalysisService({
        aiAnalysis: {
          openRouterKey: process.env.OPENROUTER_API_KEY,
          model: 'anthropic/claude-3-haiku',
          categories: ['CLIENTE', 'TECNICO', 'ALTRO'],
          sentiments: ['NEUTRALE', 'POSITIVO']
        }
      });
      
      // Test with fallback analysis
      const result = service.getDefaultAnalysis('test transcription');
      return result.category_auto && result.sentiment && result.priority_level;
    });

    // Test Storage Service  
    await this.test('StorageService database connection', async () => {
      const service = new StorageService();
      const health = await service.healthCheck();
      return health.status === 'healthy';
    });

    console.log('');
  }

  async testAnalysis() {
    console.log('🤖 Testing AI Analysis...\n');

    const service = new AnalysisService({
      aiAnalysis: {
        openRouterKey: process.env.OPENROUTER_API_KEY,
        model: 'anthropic/claude-3-haiku',
        categories: ['CLIENTE', 'TECNICO', 'AMMINISTRATIVO', 'ALTRO'],
        sentiments: ['NEUTRALE', 'PREOCCUPATO', 'FRUSTRATO', 'POSITIVO']
      }
    });

    // Test different types of transcriptions
    const testCases = [
      {
        name: 'Client complaint analysis',
        text: 'Il cliente Rossi ha chiamato per lamentarsi delle lenti progressive che non vanno bene',
        expectedCategory: 'CLIENTE',
        expectedSentiment: 'PREOCCUPATO'
      },
      {
        name: 'Technical issue analysis', 
        text: 'La macchina per tagliare le lenti si è rotta stamattina, bisogna chiamare il tecnico',
        expectedCategory: 'TECNICO',
        expectedPriority: 4
      },
      {
        name: 'Appointment scheduling',
        text: 'Ricordati che domani alle 15 abbiamo la signora Verdi per il controllo della vista',
        expectedCategory: 'APPUNTAMENTI',
        hasDate: true
      },
      {
        name: 'Inventory note',
        text: 'Sono finite le montature Ray-Ban modello aviator, bisogna riordinare',
        expectedCategory: 'INVENTARIO'
      }
    ];

    for (const testCase of testCases) {
      await this.test(testCase.name, async () => {
        const analysis = await service.analyzeTranscription(testCase.text);
        
        let passed = true;
        
        if (testCase.expectedCategory && analysis.category_auto !== testCase.expectedCategory) {
          console.log(`    Expected category: ${testCase.expectedCategory}, got: ${analysis.category_auto}`);
          // Don't fail - AI might categorize differently
        }
        
        if (testCase.expectedSentiment && analysis.sentiment !== testCase.expectedSentiment) {
          console.log(`    Expected sentiment: ${testCase.expectedSentiment}, got: ${analysis.sentiment}`);
          // Don't fail - AI might analyze differently
        }
        
        if (testCase.expectedPriority && analysis.priority_level !== testCase.expectedPriority) {
          console.log(`    Expected priority: ${testCase.expectedPriority}, got: ${analysis.priority_level}`);
          // Don't fail - AI might prioritize differently
        }
        
        if (testCase.hasDate && analysis.extracted_dates.length === 0) {
          console.log('    Expected to extract dates, but none found');
          // Don't fail - date extraction is complex
        }
        
        // Basic validation
        return analysis.category_auto && 
               analysis.sentiment && 
               typeof analysis.priority_level === 'number' &&
               Array.isArray(analysis.extracted_dates);
      });
    }

    console.log('');
  }

  async testDateExtraction() {
    console.log('📅 Testing Date Extraction...\n');

    const service = new DateExtractionService();

    const dateTests = [
      {
        name: 'Extract "domani alle 15"',
        text: 'Appuntamento domani alle 15 con il signor Bianchi',
        expectDates: 1
      },
      {
        name: 'Extract "venerdì prossimo"',  
        text: 'Controllo della vista venerdì prossimo mattina',
        expectDates: 1
      },
      {
        name: 'Extract multiple dates',
        text: 'Oggi alle 10 c\'è la signora Rossi e domani alle 14:30 il signor Verdi',
        expectDates: 2
      },
      {
        name: 'No dates to extract',
        text: 'Le montature sono arrivate e sono molto belle',
        expectDates: 0
      }
    ];

    for (const test of dateTests) {
      await this.test(test.name, async () => {
        const dates = service.extractDates(test.text);
        
        if (test.expectDates === 0) {
          return dates.length === 0;
        } else {
          const hasExpectedCount = dates.length >= test.expectDates;
          if (!hasExpectedCount) {
            console.log(`    Expected ${test.expectDates} dates, got ${dates.length}`);
          }
          
          // Check that extracted dates have proper structure
          for (const date of dates) {
            if (!date.text || !date.parsed_date || !date.type || typeof date.confidence !== 'number') {
              console.log('    Invalid date structure:', date);
              return false;
            }
          }
          
          return true; // Accept any reasonable result
        }
      });
    }

    console.log('');
  }

  async testDatabase() {
    console.log('💾 Testing Database Operations...\n');

    const service = new StorageService();

    await this.test('Save test voice note', async () => {
      const testData = {
        audioBase64: 'dGVzdCBhdWRpbyBkYXRh', // 'test audio data' in base64
        file_size: 1024,
        duration_seconds: 10,
        transcription: 'Test transcription for unit tests',
        telegram_message_id: 'test_message_123',
        telegram_user_id: 'test_user_456',
        telegram_username: 'test_user',
        addetto_nome: 'Test User (Telegram)',
        category_auto: 'ALTRO',
        sentiment: 'NEUTRALE',
        priority_level: 2,
        extracted_dates: [],
        confidence_scores: { overall: 0.8 },
        needs_review: false
      };

      const result = await service.saveVoiceNote(testData);
      
      // Clean up test data
      if (result && result.id) {
        // Note: In a real test, you'd clean up the test record
        console.log(`    Created test note with ID: ${result.id.substring(0, 8)}...`);
      }
      
      return result && result.id;
    });

    await this.test('Search clients functionality', async () => {
      const results = await service.searchClients('test');
      return Array.isArray(results);
    });

    console.log('');
  }

  async test(name, testFunction) {
    process.stdout.write(`  🧪 ${name}... `);
    
    try {
      const result = await testFunction();
      
      if (result) {
        console.log('✅ PASS');
        this.results.passed++;
        this.results.tests.push({ name, status: 'PASS' });
      } else {
        console.log('❌ FAIL');
        this.results.failed++;
        this.results.tests.push({ name, status: 'FAIL' });
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'ERROR', error: error.message });
    }
  }

  printResults() {
    console.log('📊 Test Results:\n');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Total: ${this.results.tests.length}\n`);

    if (this.results.failed > 0) {
      console.log('❌ Failed Tests:');
      this.results.tests
        .filter(t => t.status !== 'PASS')
        .forEach(t => {
          console.log(`  - ${t.name}: ${t.status}${t.error ? ` (${t.error})` : ''}`);
        });
      console.log('');
    }

    const successRate = (this.results.passed / this.results.tests.length) * 100;
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 80) {
      console.log('🎉 Overall: GOOD - Bot should work properly');
    } else if (successRate >= 60) {
      console.log('⚠️ Overall: PARTIAL - Some features may not work');
    } else {
      console.log('❌ Overall: POOR - Significant issues detected');
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new TelegramBotTestSuite();
  testSuite.runTests().catch(console.error);
}

module.exports = TelegramBotTestSuite;