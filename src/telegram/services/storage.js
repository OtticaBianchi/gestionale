// src/telegram/services/storage.js
const { createClient } = require('@supabase/supabase-js');

class StorageService {
  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      console.error('❌ Supabase credentials not configured');
      return;
    }
    
    // Use service role client to bypass RLS for bot operations
    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
    console.log('✅ Supabase storage client initialized');
  }
  
  // ===== SAVE VOICE NOTE =====
  async saveVoiceNote(data) {
    try {
      console.log('💾 Saving voice note to database...');
      
      if (!this.supabase) {
        throw new Error('Database not configured');
      }
      
      // Prepare voice note data
      const voiceNoteData = {
        // Original fields (maintained compatibility)
        audio_blob: data.audioBase64,
        addetto_nome: data.addetto_nome || 'Telegram Bot',
        cliente_riferimento: data.cliente_riferimento || null,
        note_aggiuntive: data.transcription || null,
        stato: 'pending',
        file_size: data.file_size || 0,
        duration_seconds: data.duration_seconds || 0,
        cliente_id: data.cliente_id || null,
        busta_id: data.busta_id || null,
        
        // NEW: Telegram-specific fields
        telegram_message_id: data.telegram_message_id,
        telegram_user_id: data.telegram_user_id,
        telegram_username: data.telegram_username,
        audio_file_path: data.audio_file_path || null,
        
        // NEW: AI Analysis fields (if provided)
        category_auto: data.category_auto || null,
        sentiment: data.sentiment || null,
        priority_level: data.priority_level || 2,
        extracted_dates: data.extracted_dates ? JSON.stringify(data.extracted_dates) : null,
        confidence_scores: data.confidence_scores ? JSON.stringify(data.confidence_scores) : null,
        needs_review: data.needs_review || false,
        
        // Metadata
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('📝 Voice note data prepared:', {
        telegram_user: voiceNoteData.telegram_username,
        transcription_length: voiceNoteData.note_aggiuntive?.length || 0,
        file_size: voiceNoteData.file_size,
        duration: voiceNoteData.duration_seconds,
        category: voiceNoteData.category_auto,
        sentiment: voiceNoteData.sentiment
      });
      
      // Insert into database
      const { data: result, error } = await this.supabase
        .from('voice_notes')
        .insert(voiceNoteData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database insert error:', error);
        throw new Error(`Database save failed: ${error.message}`);
      }
      
      console.log('✅ Voice note saved with ID:', result.id);
      return result;
      
    } catch (error) {
      console.error('❌ Storage error:', error);
      throw new Error(`Failed to save voice note: ${error.message}`);
    }
  }
  
  // ===== UPDATE VOICE NOTE =====
  async updateVoiceNote(noteId, updates) {
    try {
      console.log('🔄 Updating voice note:', noteId);
      
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await this.supabase
        .from('voice_notes')
        .update(updateData)
        .eq('id', noteId)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }
      
      console.log('✅ Voice note updated:', noteId);
      return data;
      
    } catch (error) {
      console.error('❌ Update error:', error);
      throw error;
    }
  }
  
  // ===== GET USER VOICE NOTES =====
  async getUserVoiceNotes(telegramUserId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('voice_notes')
        .select(`
          *,
          clienti:cliente_id (
            id,
            nome,
            cognome
          ),
          buste:busta_id (
            id,
            readable_id,
            stato_attuale
          )
        `)
        .eq('telegram_user_id', telegramUserId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw new Error(`Query failed: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Query error:', error);
      throw error;
    }
  }
  
  // ===== GET USER STATISTICS =====
  async getUserStatistics(telegramUserId) {
    try {
      console.log('📊 Getting user statistics for:', telegramUserId);
      
      // Get all user notes
      const { data: notes, error } = await this.supabase
        .from('voice_notes')
        .select('*')
        .eq('telegram_user_id', telegramUserId);
      
      if (error) {
        throw new Error(`Statistics query failed: ${error.message}`);
      }
      
      if (!notes || notes.length === 0) {
        return {
          total_notes: 0,
          first_note_date: null,
          last_note_date: null,
          categories: {},
          sentiments: {},
          total_duration: 0,
          average_duration: 0,
          total_words: 0,
          average_words: 0
        };
      }
      
      // Calculate statistics
      const stats = {
        total_notes: notes.length,
        first_note_date: notes[notes.length - 1]?.created_at,
        last_note_date: notes[0]?.created_at,
        categories: {},
        sentiments: {},
        total_duration: 0,
        total_words: 0
      };
      
      // Analyze notes
      notes.forEach(note => {
        // Duration stats
        if (note.duration_seconds) {
          stats.total_duration += note.duration_seconds;
        }
        
        // Word count stats
        if (note.note_aggiuntive) {
          const words = note.note_aggiuntive.split(/\s+/).filter(w => w.length > 0);
          stats.total_words += words.length;
        }
        
        // Category stats
        if (note.category_auto) {
          stats.categories[note.category_auto] = (stats.categories[note.category_auto] || 0) + 1;
        }
        
        // Sentiment stats
        if (note.sentiment) {
          stats.sentiments[note.sentiment] = (stats.sentiments[note.sentiment] || 0) + 1;
        }
      });
      
      // Calculate averages
      stats.average_duration = stats.total_duration / notes.length;
      stats.average_words = stats.total_words / notes.length;
      
      return stats;
      
    } catch (error) {
      console.error('❌ Statistics error:', error);
      throw error;
    }
  }
  
  // ===== SEARCH CLIENTS =====
  async searchClients(query, limit = 10) {
    try {
      if (!query || query.length < 2) {
        return [];
      }
      
      const { data, error } = await this.supabase
        .from('clienti')
        .select(`
          id,
          nome,
          cognome,
          telefono,
          email,
          buste:buste!cliente_id (
            id,
            readable_id,
            stato_attuale,
            data_apertura
          )
        `)
        .or(`cognome.ilike.%${query}%,nome.ilike.%${query}%,telefono.ilike.%${query}%`)
        .limit(limit);
      
      if (error) {
        throw new Error(`Client search failed: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Client search error:', error);
      throw error;
    }
  }
  
  // ===== LINK NOTE TO CLIENT/BUSTA =====
  async linkNoteToClient(noteId, clientId, bustaId = null) {
    try {
      const updates = {
        cliente_id: clientId,
        busta_id: bustaId,
        updated_at: new Date().toISOString()
      };
      
      return await this.updateVoiceNote(noteId, updates);
      
    } catch (error) {
      console.error('❌ Link error:', error);
      throw error;
    }
  }
  
  // ===== CLEANUP OLD NOTES =====
  async cleanupOldNotes(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const { data, error } = await this.supabase
        .from('voice_notes')
        .delete()
        .eq('stato', 'completed')
        .lt('created_at', cutoffDate.toISOString())
        .select('id');
      
      if (error) {
        console.error('❌ Cleanup error:', error);
        return 0;
      }
      
      const deletedCount = data?.length || 0;
      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${deletedCount} old voice notes`);
      }
      
      return deletedCount;
      
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      return 0;
    }
  }
  
  // ===== DATABASE HEALTH CHECK =====
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('voice_notes')
        .select('id')
        .limit(1);
      
      if (error) {
        return {
          status: 'unhealthy',
          message: `Database error: ${error.message}`
        };
      }
      
      return {
        status: 'healthy',
        message: 'Database connection OK'
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`
      };
    }
  }
  
  // ===== UTILITY =====
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = StorageService;