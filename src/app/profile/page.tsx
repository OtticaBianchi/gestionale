// app/profile/page.tsx - Admin-managed avatars version
"use client"

import { useState, useRef, ChangeEvent } from 'react'
import { useUser } from '@/context/UserContext'
import Link from 'next/link'
import { ArrowLeft, User, Camera, Save, AlertTriangle, CheckCircle, Loader2, Shield, Mail, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, profile, refreshProfile, isLoading } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [showAvatarRequest, setShowAvatarRequest] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploadingRequest, setIsUploadingRequest] = useState(false)
  
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    email: user?.email || '',
    role: profile?.role || 'operatore'
  })

  // Check if current user is admin
  const isAdmin = profile?.role === 'admin'

  // Redirect if not authenticated
  if (!isLoading && !user) {
    router.push('/login')
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento profilo...</p>
        </div>
      </div>
    )
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSaveProfile = async () => {
    if (!user || !profile) return
    
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      setSuccess('Profilo aggiornato con successo!')
      setIsEditing(false)
    } catch (err: any) {
      setError('Errore durante il salvataggio: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarRequest = () => {
    setShowAvatarRequest(true)
  }

  const sendAvatarRequestEmail = () => {
    const subject = encodeURIComponent(`[Gestionale Ottica] Richiesta cambio avatar - ${profile?.full_name}`)
    const body = encodeURIComponent(`Ciao,

Vorrei cambiare il mio avatar nel gestionale.

Dettagli utente:
- Nome: ${profile?.full_name}
- Email: ${user?.email}
- Ruolo: ${profile?.role}

Per favore, dimmi come procedere per inviarti la nuova foto.

Grazie!`)

    window.open(`mailto:admin@example.com?subject=${subject}&body=${body}`, '_blank')
    setShowAvatarRequest(false)
    setSuccess('Email di richiesta preparata! Invia la tua foto all\'amministratore.')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
  
    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un\'immagine valida')
      return
    }
  
    if (file.size > 10 * 1024 * 1024) { // 10MB
      setError('Immagine troppo grande (max 10MB)')
      return
    }
  
    setSelectedFile(file)
    setError('')
  }
  
  const handleSendAvatarRequest = async () => {
    if (!selectedFile) {
      setError('Seleziona prima un\'immagine')
      return
    }
  
    setIsUploadingRequest(true)
    setError('')
  
    try {
      const formData = new FormData()
      formData.append('avatar', selectedFile)
      formData.append('userName', profile?.full_name || '')
      formData.append('userEmail', user?.email || '')
      formData.append('userRole', profile?.role || '')
  
      const response = await fetch('/api/send-avatar-request', {
        method: 'POST',
        body: formData
      })
  
      const data = await response.json()
  
      if (!response.ok) {
        throw new Error(data.error || 'Errore invio richiesta')
      }
  
      setSuccess('✅ Richiesta avatar inviata con successo! L\'amministratore processerà la tua immagine.')
      setSelectedFile(null)
      setShowAvatarRequest(false)
      
    } catch (err: any) {
      setError(`Errore: ${err.message}`)
    } finally {
      setIsUploadingRequest(false)
    }
  }

  // Admin-only avatar upload function
  const handleAdminAvatarUpload = async (file: File, targetUserId: string = user?.id || '') => {
    if (!isAdmin) {
      setError('Solo gli amministratori possono caricare avatar')
      return
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un\'immagine valida')
      return
    }

    // Admin can upload larger files but should be warned
    if (file.size > 2 * 1024 * 1024) { // 2MB warning
      if (!confirm(`L'immagine è ${(file.size / 1024 / 1024).toFixed(1)}MB. Continuare? (Consigliato: <2MB)`)) {
        return
      }
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB hard limit
      setError('Immagine troppo grande. Massimo 10MB consentiti.')
      return
    }

    setIsUploadingAvatar(true)
    setError('')
    setSuccess('')

    try {
      console.log('📤 Admin uploading avatar for user:', targetUserId)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${targetUserId}/avatar.${fileExt}`

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        if (uploadError.message.includes('Policy')) {
          setError('Errore: Solo gli amministratori possono caricare avatar. Verifica i tuoi permessi.')
        } else if (uploadError.message.includes('Bucket not found')) {
          setError('Bucket avatar non configurato. Contatta l\'amministratore.')
        } else {
          setError(`Errore upload: ${uploadError.message}`)
        }
        return
      }

      console.log('✅ Upload successful:', uploadData)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update target user's profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId)

      if (updateError) {
        setError(`Errore aggiornamento profilo: ${updateError.message}`)
        return
      }

      await refreshProfile()
      setSuccess(`Avatar aggiornato con successo! Dimensione: ${(file.size / 1024).toFixed(0)}KB`)
      
      setTimeout(() => setSuccess(''), 5000)
      
    } catch (err: any) {
      console.error('❌ Unexpected error:', err)
      setError('Errore imprevisto: ' + err.message)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (isAdmin) {
      await handleAdminAvatarUpload(file)
    } else {
      setError('Solo gli amministratori possono caricare avatar direttamente')
    }
    
    // Reset file input
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Torna alla Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">Profilo Utente</h1>
              {isAdmin && (
                <div className="flex items-center space-x-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs">
                  <Shield className="w-3 h-3" />
                  <span>Admin</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Modifica Profilo
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setFormData({
                        fullName: profile?.full_name || '',
                        email: user?.email || '',
                        role: profile?.role || 'operatore'
                      })
                      setError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{isSaving ? 'Salvataggio...' : 'Salva'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Errore</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          {/* Avatar Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Foto Profilo</h2>
            <div className="flex items-center space-x-6">
              <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-200">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // FIX: Evita loop infinito
                        const img = e.target as HTMLImageElement;
                        if (!img.src.includes('ui-avatars.com')) {
                          console.error('❌ Avatar failed, using fallback');
                          img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=random&size=128`;
                        }
                      }}
                    />
                  ) : (
                    <User className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                
                {/* Admin can upload directly */}
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar || isSaving}
                      className="absolute -bottom-2 -right-2 bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50"
                      title="Upload avatar (Admin)"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </>
                ) : (
                  /* Regular users can only request */
                  <button
                    onClick={handleAvatarRequest}
                    className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                    title="Richiedi cambio avatar"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="flex-1">
                {isAdmin ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-purple-700 flex items-center space-x-1">
                      <Shield className="w-4 h-4" />
                      <span>Modalità Amministratore</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Puoi caricare avatar direttamente. Raccomandato: &lt;2MB per prestazioni ottimali.
                    </p>
                    <p className="text-xs text-gray-500">
                      Formati: JPG, PNG, WebP | Limite: 10MB | Consigliato: 200x200px
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Per cambiare il tuo avatar, invia una richiesta all'amministratore.
                    </p>
                    <button
                      onClick={handleAvatarRequest}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center space-x-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Richiedi Cambio Avatar</span>
                    </button>
                    <p className="text-xs text-gray-500">
                      L'amministratore ottimizzerà la tua foto per le migliori prestazioni.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Avatar Request Modal */}
          {showAvatarRequest && !isAdmin && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Camera className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold">Richiesta Cambio Avatar</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleziona la tua foto per l'avatar:
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {selectedFile && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              ✅ <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          </div>
        )}

        <div className="bg-blue-50 p-3 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>Suggerimenti:</strong><br/>
            • Foto quadrata (es. 400x400px)<br/>
            • Volto ben visibile e centrato<br/>
            • Formato JPG o PNG<br/>
            • Dimensione ragionevole (&lt;5MB)
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleSendAvatarRequest}
            disabled={!selectedFile || isUploadingRequest}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isUploadingRequest ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Invio in corso...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Invia Richiesta Avatar</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              setShowAvatarRequest(false)
              setSelectedFile(null)
              setError('')
            }}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  </div>
)}

          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <User className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Informazioni Personali</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FIX #3: Nome sempre editabile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">L'email non può essere modificata</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={formData.role}
                    disabled
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                  {isAdmin && (
                    <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                      ADMIN
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Il ruolo può essere modificato solo da un amministratore</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ultimo Accesso</label>
                <input
                  type="text"
                  value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('it-IT') : 'N/A'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Creato</label>
                <input
                  type="text"
                  value={user?.created_at ? new Date(user.created_at).toLocaleString('it-IT') : 'N/A'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profilo Aggiornato</label>
                <input
                  type="text"
                  value={profile?.updated_at ? new Date(profile.updated_at).toLocaleString('it-IT') : 'N/A'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}