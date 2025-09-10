'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Play, Pause, Calendar, Clock, User, ArrowLeft, Download, Trash2, CheckCircle, FolderOpen, ExternalLink, Search, Eye, Copy, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';

interface VoiceNote {
  id: string;
  audio_blob: string;
  addetto_nome: string;
  cliente_riferimento: string | null;
  note_aggiuntive: string | null;
  stato: 'pending' | 'processing' | 'completed' | 'failed';
  file_size: number;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
  cliente_id: string | null;
  busta_id: string | null;
  clienti?: {
    id: string;
    nome: string;
    cognome: string;
  } | null;
  buste?: {
    id: string;
    readable_id: string;
    stato_attuale: string;
  } | null;
}

interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
}

interface BustaSearchResult {
  id: string;
  readable_id: string;
  stato_attuale: string;
  data_apertura: string;
}

interface ClientSearchResult {
  cliente: Cliente;
  buste: BustaSearchResult[];
}

export default function VoiceNotesPage() {
  const { profile } = useUser();
  const isAdmin = profile?.role === 'admin';
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<VoiceNote | null>(null);
  const [showDuplicateMenu, setShowDuplicateMenu] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // UI permissions (RLS handles database security)
  const canDeleteNotes = profile?.role === 'admin';
  const canCreateNotes = profile?.role === 'admin' || profile?.role === 'manager';
  const isReadOnly = profile?.role === 'operatore';

  const fetchVoiceNotes = async () => {
    try {
      setLoading(true);
      const url = filter !== 'all' ? `/api/voice-notes?status=${filter}` : '/api/voice-notes';
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setVoiceNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching voice notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoiceNotes();
  }, [filter]);

  const playAudio = async (note: VoiceNote) => {
    try {
      if (playingId === note.id) {
        // Stop current audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayingId(null);
        return;
      }

      // Create audio blob from base64
      const audioBlob = new Blob([
        Uint8Array.from(atob(note.audio_blob), c => c.charCodeAt(0))
      ], { type: 'audio/webm' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setPlayingId(null);
          URL.revokeObjectURL(audioUrl);
        };
        audioRef.current.onerror = () => {
          setPlayingId(null);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audioRef.current.play();
        setPlayingId(note.id);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayingId(null);
    }
  };

  const downloadAudio = (note: VoiceNote) => {
    try {
      const audioBlob = new Blob([
        Uint8Array.from(atob(note.audio_blob), c => c.charCodeAt(0))
      ], { type: 'audio/webm' });
      
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nota-vocale-${note.id}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading audio:', error);
    }
  };

  const markAsCompleted = async (noteId: string) => {
    try {
      const response = await fetch(`/api/voice-notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stato: 'completed'
        })
      });
      
      if (response.ok) {
        setVoiceNotes(prev => prev.map(note => 
          note.id === noteId 
            ? { ...note, stato: 'completed' as const }
            : note
        ));
        toast.success('Nota marcata come completata');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error(`Errore: ${errorData.error || 'Impossibile aggiornare la nota'}`);
      }
    } catch (error) {
      console.error('Error updating note status:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa nota vocale?')) return;
    
    try {
      const response = await fetch(`/api/voice-notes/${noteId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Only update local state if server deletion succeeded
        setVoiceNotes(prev => prev.filter(note => note.id !== noteId));
        toast.success('Nota eliminata con successo');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server deletion failed:', errorData);
        toast.error(`Errore: ${errorData.error || 'Impossibile eliminare la nota'}`);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Errore di connessione');
    }
  };

  const searchClients = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearchLoading(true);
      const response = await fetch(`/api/clienti/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const duplicateBusta = async (bustaId: string, includeItems: boolean) => {
    try {
      const response = await fetch('/api/buste/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: bustaId,
          includeItems
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        window.open(`/dashboard/buste/${data.newBustaId}`, '_blank');
      }
    } catch (error) {
      console.error('Error duplicating busta:', error);
    }
    setShowDuplicateMenu(null);
  };

  // Enhanced duplicate function that includes voice note transcription
  const duplicateBustaWithTranscription = async (bustaId: string, includeItems: boolean, clientId: string) => {
    if (!selectedNote) {
      toast.error('Nessuna nota vocale selezionata');
      return;
    }

    try {
      setLoading(true);
      
      // First, get transcription by triggering it
      const transcribeResponse = await fetch(`/api/voice-notes/${selectedNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redo_transcription: true })
      });
      
      let transcription = '';
      if (transcribeResponse.ok) {
        // Get the fresh transcription
        const noteResponse = await fetch(`/api/voice-notes/${selectedNote.id}`);
        if (noteResponse.ok) {
          const noteData = await noteResponse.json();
          transcription = noteData.note?.transcription || noteData.note?.note_aggiuntive || '';
        }
      }
      
      // Duplicate the busta
      const duplicateResponse = await fetch('/api/buste/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: bustaId,
          includeItems
        })
      });
      
      if (!duplicateResponse.ok) {
        const error = await duplicateResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Impossibile duplicare la busta');
      }
      
      const duplicateData = await duplicateResponse.json();
      const newBustaId = duplicateData.newBustaId;
      
      // Add voice note transcription to the new busta's notes
      if (newBustaId && transcription) {
        const addTranscriptionResponse = await fetch(`/api/voice-notes/${selectedNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cliente_id: clientId, 
            busta_id: newBustaId,
            stato: 'completed',
            redo_transcription: false // Don't redo, we already have it
          })
        });
        
        if (addTranscriptionResponse.ok) {
          toast.success('Busta duplicata con trascrizione vocale!');
        }
      }
      
      // Open the new busta
      if (newBustaId) {
        window.location.href = `/dashboard/buste/${newBustaId}`;
      }
      
    } catch (error: any) {
      console.error('Error duplicating busta with transcription:', error);
      toast.error(error.message || 'Errore nella duplicazione della busta');
    } finally {
      setLoading(false);
      setShowDuplicateMenu(null);
    }
  };

  // Create a new busta from selected note with transcription
  const createBustaFromNote = async (clientId: string) => {
    if (!selectedNote) {
      toast.error('Nessuna nota vocale selezionata');
      return;
    }

    try {
      setLoading(true);
      
      // First, get transcription by linking note temporarily
      const transcribeResponse = await fetch(`/api/voice-notes/${selectedNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redo_transcription: true })
      });
      
      let transcription = '';
      if (transcribeResponse.ok) {
        const transcribeData = await transcribeResponse.json();
        // Get the fresh transcription
        const noteResponse = await fetch(`/api/voice-notes/${selectedNote.id}`);
        if (noteResponse.ok) {
          const noteData = await noteResponse.json();
          transcription = noteData.note?.transcription || noteData.note?.note_aggiuntive || '';
        }
      }
      
      // Create new busta with client data and transcription
      const bustaResponse = await fetch('/api/buste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clientId,
          stato_attuale: 'nuove',
          tipo_lavorazione: 'OV', // Default, can be changed later
          priorita: 'normale',
          note_generali: transcription ? `Nota vocale collegata il ${new Date().toLocaleString('it-IT')}\n${transcription}` : 'Creata da nota vocale (nessuna trascrizione disponibile)',
          data_apertura: new Date().toISOString(),
          data_consegna_prevista: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // +7 days
        })
      });
      
      if (!bustaResponse.ok) {
        const error = await bustaResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Impossibile creare la busta');
      }
      
      const bustaData = await bustaResponse.json();
      const bustaId = bustaData.busta?.id;
      
      if (bustaId) {
        // Link the voice note to the new busta
        await fetch(`/api/voice-notes/${selectedNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cliente_id: clientId, 
            busta_id: bustaId,
            stato: 'completed',
            processed_by: null // Will be set by server
          })
        });
        
        // Redirect to the new busta
        window.location.href = `/dashboard/buste/${bustaId}`;
      }
      
    } catch (error: any) {
      console.error('Error creating busta from note:', error);
      toast.error(error.message || 'Errore nella creazione della busta');
    } finally {
      setLoading(false);
    }
  };

  // Link currently selected note to a client (and optionally to a busta)
  const linkNote = async (noteId: string, clientId: string, bustaId?: string) => {
    try {
      const response = await fetch(`/api/voice-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clientId, busta_id: bustaId ?? null, redo_transcription: true })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Impossibile collegare la nota');
      }
      // Update local state for immediate feedback
      setVoiceNotes(prev => prev.map(n => {
        if (n.id !== noteId) return n;
        return {
          ...n,
          cliente_id: clientId,
          busta_id: bustaId ?? null,
          clienti: bustaId ? n.clienti : (n.clienti || { id: clientId, nome: '', cognome: '' }),
          buste: bustaId ? (n.buste || { id: bustaId, readable_id: '', stato_attuale: '' }) : n.buste
        } as VoiceNote;
      }));
      toast.success('Nota collegata correttamente');
      // Optionally close the search panel
      setSelectedNote(null);
      // Refresh to hydrate relations if needed
      fetchVoiceNotes();
    } catch (e: any) {
      toast.error(e.message || 'Errore collegamento nota');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const getStateColor = (stato: string) => {
    switch (stato) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateText = (stato: string) => {
    switch (stato) {
      case 'completed': return 'Completata';
      case 'pending': return 'In attesa';
      case 'processing': return 'In elaborazione';
      case 'failed': return 'Errore';
      default: return stato;
    }
  };

  const getBustaStatusText = (stato: string) => {
    switch (stato) {
      case 'nuove': return 'Nuova';
      case 'materiali_ordinati': return 'Materiali Ordinati';
      case 'materiali_parzialmente_arrivati': return 'Materiali Parziali';
      case 'materiali_arrivati': return 'Materiali Arrivati';
      case 'in_lavorazione': return 'In Lavorazione';
      case 'pronto_ritiro': return 'Pronto Ritiro';
      case 'consegnato_pagato': return 'Consegnato';
      default: return stato;
    }
  };

  const isBustaOpen = (stato: string) => {
    return stato !== 'consegnato_pagato';
  };

  const isBustaArchived = (busta: BustaSearchResult) => {
    if (busta.stato_attuale !== 'consegnato_pagato') return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const updatedAt = new Date(busta.data_apertura); // Usando data_apertura come proxy per updated_at
    return updatedAt < sevenDaysAgo;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Torna alla Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Mic className="h-6 w-6 text-purple-600" />
                <span>Note Vocali</span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {voiceNotes.length} note registrate
              </p>
            </div>
          </div>

          {/* Filtri */}
          <div className="flex items-center space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'pending' | 'completed')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">Tutte le note</option>
              <option value="pending">In attesa</option>
              <option value="completed">Completate</option>
            </select>
            <button
              onClick={fetchVoiceNotes}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              Aggiorna
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Client Search Section */}
        {selectedNote && isAdmin && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Cerca Cliente per questa Nota</h3>
            
            {/* Selected Note Preview */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600 mb-1">Nota selezionata:</p>
              <p className="text-sm text-gray-800 line-clamp-2">
                {selectedNote.note_aggiuntive || 'Nessuna trascrizione disponibile'}
              </p>
            </div>

            {/* Search Input */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchClients()}
                  placeholder="Cerca per cognome cliente..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={searchClients}
                disabled={searchLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {searchLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                {searchResults.map((result) => (
                  <div key={result.cliente.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {result.cliente.nome} {result.cliente.cognome}
                        </h4>
                        {result.cliente.telefono && (
                          <p className="text-sm text-gray-600">📞 {result.cliente.telefono}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => selectedNote && linkNote(selectedNote.id, result.cliente.id)}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                              title="Collega la nota al cliente (trascrizione salvata solo nella nota)"
                            >
                              Collega al Cliente
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-500">Suggerimento: la trascrizione parte quando colleghi la nota a una busta.</p>
                        </div>
                      )}
                    </div>

                    {/* Buste List */}
                    {result.buste.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Buste:</p>
                        {result.buste.map((busta) => (
                          <div key={busta.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{busta.readable_id}</span>
                                <span className="text-sm text-gray-600">
                                  ({getBustaStatusText(busta.stato_attuale)})
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatDate(busta.data_apertura)}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isBustaOpen(busta.stato_attuale) && !isReadOnly ? (
                                <Link
                                  href={`/dashboard/buste/${busta.id}?returnTo=/dashboard/voice-notes`}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                                >
                                  <Eye className="w-3 h-3" />
                                  Modifica
                                </Link>
                              ) : (
                                <Link
                                  href={`/dashboard/buste/${busta.id}?returnTo=/dashboard/voice-notes`}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                                >
                                  <Eye className="w-3 h-3" />
                                  Visualizza
                                </Link>
                              )}
                              
                              {!isReadOnly && (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowDuplicateMenu(showDuplicateMenu === busta.id ? null : busta.id)}
                                    className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Duplica
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                  
                                  {showDuplicateMenu === busta.id && (
                                    <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                      <button
                                        onClick={() => duplicateBustaWithTranscription(busta.id, false, result.cliente.id)}
                                        className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                      >
                                        Solo Anagrafica + Nota Vocale
                                      </button>
                                      <button
                                        onClick={() => duplicateBustaWithTranscription(busta.id, true, result.cliente.id)}
                                        className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                      >
                                        Anagrafica + Materiali + Nota Vocale
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => selectedNote && linkNote(selectedNote.id, result.cliente.id, busta.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                                  title="Collega la nota a questa busta e avvia la trascrizione"
                                >
                                  Collega qui
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nessuna busta trovata per questo cliente</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedNote(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Chiudi Ricerca
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : voiceNotes.length === 0 ? (
          <div className="text-center py-10">
            <Mic className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">Nessuna nota vocale</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'Non ci sono note vocali registrate.'
                : `Non ci sono note vocali con stato "${getStateText(filter)}".`
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {voiceNotes.map((note) => (
              <div key={note.id} className="bg-white rounded-md border border-gray-200 p-3 hover:shadow-sm transition-shadow">
                {/* Header della nota */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-col space-y-1">
                    {/* Cliente info */}
                    {note.clienti ? (
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3 text-blue-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {note.clienti.nome} {note.clienti.cognome}
                        </span>
                      </div>
                    ) : note.cliente_riferimento ? (
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">{note.cliente_riferimento}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Mic className="h-3 w-3 text-purple-500" />
                        <span className="text-xs text-gray-500">Nota generica</span>
                      </div>
                    )}
                    
                    {/* Busta info */}
                    {note.buste && (
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="h-3 w-3 text-green-500" />
                        <span className="text-[11px] text-gray-600">
                          Busta {note.buste.readable_id} • {note.buste.stato_attuale}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStateColor(note.stato)}`}>
                    {getStateText(note.stato)}
                  </span>
                </div>

                {/* Informazioni temporali */}
                <div className="space-y-1 mb-2 text-xs text-gray-600">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(note.created_at)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(note.duration_seconds)} • {formatFileSize(note.file_size)}</span>
                  </div>
                </div>

                {/* Trascrizione */}
                {note.note_aggiuntive && (
                  <div className="mb-2">
                    <div className="bg-gray-50 rounded-md p-2">
                      <p className="text-xs text-gray-700 leading-snug line-clamp-3">
                        {note.note_aggiuntive}
                      </p>
                    </div>
                  </div>
                )}

                {/* Controlli audio */}
                <div className="flex items-center justify-between">
                  {isAdmin ? (
                    <button
                      onClick={() => playAudio(note)}
                      disabled={!note.audio_blob}
                      className={`flex items-center space-x-2 px-2 py-1 rounded transition-colors text-xs ${
                        note.audio_blob
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {playingId === note.id ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      <span>{note.audio_blob ? (playingId === note.id ? 'Pausa' : 'Play') : 'Audio rimosso'}</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Solo gli amministratori possono riprodurre l'audio
                    </div>
                  )}

                  <div className="flex items-center space-x-1">
                    {/* Link to busta */}
                    {note.buste && (
                      <Link
                        href={`/dashboard/buste/${note.buste.id}`}
                        className="p-1.5 text-blue-500 hover:text-blue-700 transition-colors"
                        title="Apri busta"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    
                    {/* Mark as completed */}
                    {isAdmin && note.stato === 'pending' && (
                      <button
                        onClick={() => markAsCompleted(note.id)}
                        className="p-1.5 text-green-500 hover:text-green-700 transition-colors"
                        title="Segna come completata"
                      >
                        <CheckCircle className="h-3 w-3" />
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => downloadAudio(note)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                          title="Scarica audio"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setSelectedNote(note)}
                          className="p-1.5 text-purple-500 hover:text-purple-700 transition-colors"
                          title="Cerca cliente"
                        >
                          <Search className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {canDeleteNotes && (
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 transition-colors"
                        title="Elimina nota (solo amministratore)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio element for playback */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
