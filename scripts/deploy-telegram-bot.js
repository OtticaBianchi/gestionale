#!/usr/bin/env node
// scripts/deploy-telegram-bot.js
// Deployment and setup script for Telegram bot

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

class TelegramBotDeployment {
  constructor() {
    this.config = {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      assemblyAiKey: process.env.ASSEMBLYAI_API_KEY,
      openRouterKey: process.env.OPENROUTER_API_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
  }

  async run() {
    console.log('🚀 OB Voice Telegram Bot Deployment Script\n');
    
    try {
      // Check environment
      await this.checkEnvironment();
      
      // Verify services
      await this.verifyServices();
      
      // Setup webhook
      await this.setupWebhook();
      
      // Test bot
      await this.testBot();
      
      console.log('✅ Deployment completed successfully!\n');
      this.printSuccessInfo();
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async checkEnvironment() {
    console.log('🔍 Checking environment configuration...\n');
    
    const required = [
      { key: 'TELEGRAM_BOT_TOKEN', value: this.config.botToken },
      { key: 'TELEGRAM_WEBHOOK_URL', value: this.config.webhookUrl },
      { key: 'ASSEMBLYAI_API_KEY', value: this.config.assemblyAiKey },
      { key: 'NEXT_PUBLIC_SUPABASE_URL', value: this.config.supabaseUrl },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', value: this.config.serviceRoleKey }
    ];

    const optional = [
      { key: 'OPENROUTER_API_KEY', value: this.config.openRouterKey }
    ];

    let hasErrors = false;

    console.log('Required environment variables:');
    for (const env of required) {
      if (env.value) {
        console.log(`  ✅ ${env.key}: Configured`);
      } else {
        console.log(`  ❌ ${env.key}: MISSING`);
        hasErrors = true;
      }
    }

    console.log('\nOptional environment variables:');
    for (const env of optional) {
      if (env.value) {
        console.log(`  ✅ ${env.key}: Configured`);
      } else {
        console.log(`  ⚠️ ${env.key}: Not configured (AI analysis will be disabled)`);
      }
    }

    if (hasErrors) {
      console.log('\n❌ Required environment variables are missing.');
      console.log('Please check your .env file or environment configuration.');
      throw new Error('Environment configuration incomplete');
    }

    console.log('\n✅ Environment configuration OK\n');
  }

  async verifyServices() {
    console.log('🔧 Verifying external services...\n');

    // Test Telegram Bot API
    await this.testTelegramAPI();
    
    // Test AssemblyAI
    await this.testAssemblyAI();
    
    // Test AI Analysis (if configured)
    if (this.config.openRouterKey) {
      await this.testOpenRouter();
    }
    
    // Test Supabase
    await this.testSupabase();

    console.log('✅ All services verified\n');
  }

  async testTelegramAPI() {
    try {
      console.log('  🤖 Testing Telegram Bot API...');
      
      const response = await axios.get(
        `https://api.telegram.org/bot${this.config.botToken}/getMe`
      );
      
      if (response.data.ok) {
        console.log(`    ✅ Bot connected: ${response.data.result.first_name} (@${response.data.result.username})`);
      } else {
        throw new Error('Invalid bot token');
      }
      
    } catch (error) {
      console.log('    ❌ Telegram API test failed');
      throw new Error(`Telegram API error: ${error.message}`);
    }
  }

  async testAssemblyAI() {
    try {
      console.log('  🎙️ Testing AssemblyAI...');
      
      const response = await axios.get('https://api.assemblyai.com/v2/transcript', {
        headers: {
          'Authorization': this.config.assemblyAiKey,
          'Content-Type': 'application/json'
        }
      });
      
      // AssemblyAI returns 200 even for empty list
      console.log('    ✅ AssemblyAI API connected');
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid AssemblyAI API key');
      }
      console.log('    ❌ AssemblyAI test failed');
      throw new Error(`AssemblyAI error: ${error.message}`);
    }
  }

  async testOpenRouter() {
    try {
      console.log('  🤖 Testing OpenRouter AI...');
      
      const response = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.openRouterKey}`
        },
        timeout: 10000
      });
      
      if (response.data) {
        console.log('    ✅ OpenRouter API connected');
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenRouter API key');
      }
      console.log('    ⚠️ OpenRouter test failed (AI analysis will be limited)');
      // Don't throw - AI is optional
    }
  }

  async testSupabase() {
    try {
      console.log('  💾 Testing Supabase connection...');
      
      // Simple connection test
      const response = await axios.get(
        `${this.config.supabaseUrl}/rest/v1/voice_notes?limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.serviceRoleKey}`,
            'apikey': this.config.serviceRoleKey
          }
        }
      );
      
      console.log('    ✅ Supabase database connected');
      
    } catch (error) {
      console.log('    ❌ Supabase test failed');
      throw new Error(`Supabase error: ${error.message}`);
    }
  }

  async setupWebhook() {
    console.log('🔗 Setting up Telegram webhook...\n');
    
    try {
      const webhookResponse = await axios.post(
        `https://api.telegram.org/bot${this.config.botToken}/setWebhook`,
        {
          url: this.config.webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false
        }
      );
      
      if (webhookResponse.data.ok) {
        console.log('✅ Webhook configured successfully');
        console.log(`   URL: ${this.config.webhookUrl}`);
      } else {
        throw new Error(webhookResponse.data.description);
      }
      
    } catch (error) {
      throw new Error(`Webhook setup failed: ${error.message}`);
    }
  }

  async testBot() {
    console.log('\n🧪 Testing bot functionality...\n');
    
    const botUsername = await this.getBotUsername();
    
    console.log('Test the bot by:');
    console.log(`1. Search for @${botUsername} on Telegram`);
    console.log('2. Start a conversation with /start');
    console.log('3. Send a voice message');
    console.log('4. Verify it gets transcribed and analyzed\n');
    
    const shouldTest = await question('Do you want to test the bot now? (y/N): ');
    
    if (shouldTest.toLowerCase() === 'y') {
      console.log('Please test the bot manually and return here...');
      await question('Press Enter when testing is complete...');
    }
  }

  async getBotUsername() {
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${this.config.botToken}/getMe`
      );
      return response.data.result.username;
    } catch (error) {
      return 'your_bot';
    }
  }

  printSuccessInfo() {
    const botUsername = this.config.botToken ? 'your_bot' : 'bot';
    
    console.log('🎉 OB Voice Telegram Bot is now deployed and ready!\n');
    console.log('📋 NEXT STEPS:\n');
    console.log('1. 📱 MOBILE USAGE:');
    console.log(`   - Search @${botUsername} on Telegram`);
    console.log('   - Start with /start command');
    console.log('   - Send voice messages for transcription\n');
    
    console.log('2. 💻 MANAGEMENT:');
    console.log('   - View notes at: /dashboard/voice-notes');
    console.log('   - All AI analysis is automatic');
    console.log('   - Notes are categorized and prioritized\n');
    
    console.log('3. 📊 MONITORING:');
    console.log('   - Check Vercel logs for errors');
    console.log('   - Monitor AssemblyAI usage');
    console.log('   - Watch OpenRouter credits\n');
    
    console.log('4. 🔧 TROUBLESHOOTING:');
    console.log('   - Check webhook: /api/telegram/webhook (GET)');
    console.log('   - View bot status in Telegram');
    console.log('   - Check environment variables\n');
    
    console.log('✨ Enjoy your new AI-powered voice note system!');
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployment = new TelegramBotDeployment();
  deployment.run().catch(console.error);
}

module.exports = TelegramBotDeployment;