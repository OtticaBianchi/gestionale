// app/admin/avatar-management/page.tsx - Dashboard per gestire avatar di tutti gli utenti
'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { User, Upload, Trash2, Eye, Search, Camera, Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UserWithProfile extends Profile {
  user_metadata?: {
    email: string;
    last_sign_in_at?: string;
  };
}

export default function AdminAvatarManagement() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user => 
      (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      (user.id.toLowerCase().includes(searchTerm.toLowerCase()) || '')
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setUsers(profiles || []);
      
    } catch (err: any) {
      setError(`Errore nel caricamento utenti: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (userId: string, file: File) => {
    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Seleziona un\'immagine valida');
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB warning
        const proceed = confirm(`File grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Continua? Raccomandato: <2MB`);
        if (!proceed) return;
      }

      console.log('📤 Admin uploading avatar for user:', userId);

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw new Error(`Upload fallito: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Errore aggiornamento profilo: ${updateError.message}`);
      }

      setSuccess(`Avatar aggiornato per ${users.find(u => u.id === userId)?.full_name} | ${(file.size / 1024).toFixed(0)}KB`);
      
      // Refresh users list
      await loadUsers();
      
      setTimeout(() => setSuccess(''), 5000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAvatar = async (userId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo avatar?')) return;

    try {
      setIsUploading(true);
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`]);

      // Update profile (remove avatar_url)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess(`Avatar eliminato per ${users.find(u => u.id === userId)?.full_name}`);
      await loadUsers();
      
    } catch (err: any) {
      setError(`Errore eliminazione: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Caricamento utenti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Dashboard
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <h1 className="text-xl font-semibold text-gray-900">Gestione Avatar</h1>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {filteredUsers.length} utenti
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per nome o ID utente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* User Avatar & Info */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={`Avatar di ${user.full_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  
                  {/* Upload overlay */}
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      fileInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 hover:opacity-100 transition-opacity disabled:opacity-75"
                    title="Cambia avatar"
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || 'Nome non impostato'}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    ID: {user.id.slice(0, 8)}...
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Avatar Info */}
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Avatar:</span>
                  <span className={user.avatar_url ? 'text-green-600' : 'text-orange-600'}>
                    {user.avatar_url ? '✓ Presente' : '- Mancante'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Creato:</span>
                  <span>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : 'N/A'}
                  </span>
                </div>
                {user.total_time_online_seconds && (
                  <div className="flex justify-between">
                    <span>Tempo online:</span>
                    <span>{Math.round(user.total_time_online_seconds / 3600)}h</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center space-x-1"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </button>
                
                {user.avatar_url && (
                  <button
                    onClick={() => window.open(user.avatar_url!, '_blank')}
                    className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
                    title="Visualizza avatar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                
                {user.avatar_url && (
                  <button
                    onClick={() => handleDeleteAvatar(user.id)}
                    disabled={isUploading}
                    className="px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
                    title="Elimina avatar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* No users message */}
        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Prova a modificare i termini di ricerca.' : 'Non ci sono utenti nel sistema.'}
            </p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && selectedUser) {
              handleFileUpload(selectedUser.id, file);
            }
          }}
          className="hidden"
        />

        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Gestione Avatar - Info</h3>
              <div className="mt-2 text-sm text-blue-700 space-y-1">
                <p>• <strong>Raccomandazioni:</strong> Immagini quadrate 200x200px, formato JPG/PNG/WebP</p>
                <p>• <strong>Dimensioni:</strong> Mantieni sotto 2MB per prestazioni ottimali</p>
                <p>• <strong>Sicurezza:</strong> Solo gli admin possono gestire avatar di tutti gli utenti</p>
                <p>• <strong>Storage:</strong> Limite Supabase: 50MB (versione free)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}