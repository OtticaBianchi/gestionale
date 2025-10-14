'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUser } from '@/context/UserContext'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Loader2, Search, Check, X, User, Trash2, MessageCircle, Link, ArrowLeft, Lock, Unlock } from 'lucide-react'

type AdminUser = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  user_metadata: {
    full_name?: string | null
    role?: string | null
    account_status?: 'active' | 'disabled'
    disabled_at?: string | null
    [key: string]: any
  }
  profile: {
    id: string
    full_name: string | null
    role: string
    avatar_url: string | null
    updated_at: string | null
    created_at: string | null
    telegram_user_id: string | null
    telegram_bot_access: boolean | null
  } | null
}

type TelegramAuthRequest = {
  id: number
  telegram_user_id: string
  telegram_username: string | null
  first_name: string | null
  last_name: string | null
  first_seen_at: string
  last_seen_at: string
  message_count: number
  authorized: boolean
}

type TelegramAllowListEntry = {
  telegram_user_id: string
  profile_id: string | null
  label: string | null
  can_use_bot: boolean
  updated_at: string | null
  profiles?: {
    id: string
    full_name: string | null
    role: string | null
    telegram_user_id: string | null
    telegram_bot_access: boolean | null
    updated_at: string | null
  } | null
}

const roles = [
  { value: 'operatore', label: 'Operatore' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Amministratore' },
]

export default function AdminUsersPage() {
  const { profile, isLoading } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [savingState, setSavingState] = useState<{ id: string, action: 'save' | 'toggle' | null } | null>(null)
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'operatore' })
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [pendingTelegramRequests, setPendingTelegramRequests] = useState<TelegramAuthRequest[]>([])
  const [authorizedTelegramUsers, setAuthorizedTelegramUsers] = useState<TelegramAllowListEntry[]>([])
  const [revokedTelegramUsers, setRevokedTelegramUsers] = useState<TelegramAllowListEntry[]>([])
  const [showTelegramRequests, setShowTelegramRequests] = useState(false)
  const [showRevokedTelegram, setShowRevokedTelegram] = useState(false)
  const [telegramActionId, setTelegramActionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!profile) {
        router.push('/login')
      } else if (profile.role !== 'admin') {
        router.push('/dashboard?error=admin_required')
      }
    }
  }, [isLoading, profile, router])

  const fetchUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore caricamento')
      setUsers(data.users || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchTelegramRequests()
  }, [])

  const fetchTelegramRequests = async () => {
    try {
      const res = await fetch('/api/admin/telegram-auth')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore caricamento richieste Telegram')
      const pending: TelegramAuthRequest[] = data.unauthorizedUsers || []
      const authorized: TelegramAllowListEntry[] = data.authorizedUsers || []
      const revoked: TelegramAllowListEntry[] = data.revokedUsers || []
      setPendingTelegramRequests(pending)
      setAuthorizedTelegramUsers(authorized.filter(entry => entry.can_use_bot))
      setRevokedTelegramUsers(revoked.filter(entry => !entry.can_use_bot))
    } catch (e: any) {
      console.error('Telegram requests error:', e.message)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.profile?.full_name || '').toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  }, [users, search])

  const authorizeTelegramUser = async (telegramUserId: string, profileId: string) => {
    try {
      setError('')
      setTelegramActionId(telegramUserId)
      const res = await fetch('/api/admin/telegram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId, profileId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore autorizzazione')
      setSuccess('Utente Telegram autorizzato')
      setTimeout(() => setSuccess(''), 2000)
      fetchUsers()
      fetchTelegramRequests()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTelegramActionId(null)
    }
  }

  const rejectTelegramRequest = async (telegramUserId: string | null, requestId: number) => {
    if (!confirm('Rifiutare questa richiesta Telegram?')) return
    const actionKey = telegramUserId ?? `req-${requestId}`
    try {
      setError('')
      setTelegramActionId(actionKey)
      const res = await fetch('/api/admin/telegram-auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId, requestId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Errore eliminazione richiesta')
      setSuccess('Richiesta Telegram eliminata')
      setTimeout(() => setSuccess(''), 2000)
      fetchTelegramRequests()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTelegramActionId(null)
    }
  }

  const revokeTelegramAccess = async (telegramUserId: string) => {
    if (!confirm('Revocare l\'accesso a questo account Telegram?')) return
    try {
      setError('')
      setTelegramActionId(telegramUserId)
      const res = await fetch('/api/admin/telegram-auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore revoca accesso Telegram')
      setSuccess('Accesso Telegram revocato')
      setTimeout(() => setSuccess(''), 2000)
      fetchUsers()
      fetchTelegramRequests()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTelegramActionId(null)
    }
  }

  const updateUser = async (id: string, updates: { role?: string, full_name?: string }) => {
    try {
      setSavingState({ id, action: 'save' })
      setError('')
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio')
      setSuccess('Utente aggiornato')
      setTimeout(() => setSuccess(''), 2000)
      fetchUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingState(null)
    }
  }

  const toggleUserAccess = async (user: AdminUser) => {
    const shouldDisable = user.user_metadata?.account_status !== 'disabled'
    if (!confirm(shouldDisable
      ? 'Bloccare l\'accesso a questo utente? Potrà essere riattivato in seguito.'
      : 'Riattivare l\'accesso per questo utente?')) return

    try {
      setSavingState({ id: user.id, action: 'toggle' })
      setError('')
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_disabled: shouldDisable })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Errore aggiornamento stato utente')
      }
      setSuccess(shouldDisable ? 'Accesso utente disattivato' : 'Accesso utente riattivato')
      setTimeout(() => setSuccess(''), 2000)
      fetchUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingState(null)
    }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo utente?')) return
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'USER_HAS_ACTIVITY' && Array.isArray(data.activity) && data.activity.length > 0) {
          const summary = data.activity
            .map((act: any) => `${act.label || act.table} (${act.count})`)
            .join(', ')
          throw new Error(`Impossibile eliminare l'utente: ha attività registrate (${summary}). Disattivalo invece.`)
        }
        throw new Error(data.error || 'Eliminazione fallita')
      }
      setUsers(prev => prev.filter(u => u.id !== id))
      setSuccess('Utente eliminato')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const sendInvite = async () => {
    if (!invite.email || !invite.role) return
    try {
      setInviting(true)
      setError('')
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invite)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invito fallito')
      setSuccess(`Invito inviato a ${invite.email}`)
      setInvite({ email: '', full_name: '', role: 'operatore' })
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                title="Torna alla Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Dashboard</span>
              </button>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <h1 className="text-xl font-semibold text-gray-900">Gestione Utenti</h1>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filtered.length} utenti
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded">{success}</div>
        )}

        {/* Invite form */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-blue-600" />
            <h2 className="font-medium">Invita Nuovo Utente</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="email"
              placeholder="email@esempio.it"
              value={invite.email}
              onChange={e => setInvite({ ...invite, email: e.target.value })}
              className="px-3 py-2 border rounded-md md:col-span-2"
            />
            <input
              type="text"
              placeholder="Nome completo (opzionale)"
              value={invite.full_name}
              onChange={e => setInvite({ ...invite, full_name: e.target.value })}
              className="px-3 py-2 border rounded-md md:col-span-2"
            />
            <select
              value={invite.role}
              onChange={e => setInvite({ ...invite, role: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="pt-3">
            <button
              onClick={sendInvite}
              disabled={inviting || !invite.email}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Invia Invito
            </button>
          </div>
        </div>

        {/* Telegram Authorization Requests */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-orange-600" />
              <h2 className="font-medium text-orange-800">Richieste Accesso Bot Telegram</h2>
              <span className="bg-orange-200 text-orange-800 text-xs px-2 py-1 rounded-full">
                {pendingTelegramRequests.length}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-orange-900">
              <span>Autorizzati: {authorizedTelegramUsers.length}</span>
              <span>Revocati: {revokedTelegramUsers.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTelegramRequests(!showTelegramRequests)}
              className="text-orange-600 hover:text-orange-700 text-sm"
            >
              {showTelegramRequests ? 'Nascondi richieste in attesa' : 'Mostra richieste in attesa'}
            </button>
            {revokedTelegramUsers.length > 0 && (
              <button
                onClick={() => setShowRevokedTelegram(!showRevokedTelegram)}
                className="text-orange-600 hover:text-orange-700 text-sm"
              >
                {showRevokedTelegram ? 'Nascondi revocati' : 'Mostra revocati'}
              </button>
            )}
          </div>

          {showTelegramRequests && (
            <>
              {pendingTelegramRequests.length === 0 ? (
                <div className="text-sm text-orange-700">Non ci sono richieste in attesa.</div>
              ) : (
                <div className="space-y-2">
                  {pendingTelegramRequests.map(req => {
                    const requestKey = req.telegram_user_id || `req-${req.id}`
                    return (
                      <TelegramRequestRow
                        key={requestKey}
                        request={req}
                        users={users}
                        authorizedUsers={authorizedTelegramUsers}
                        onAuthorize={authorizeTelegramUser}
                        onReject={rejectTelegramRequest}
                        isProcessing={telegramActionId === requestKey}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}

          {authorizedTelegramUsers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-orange-900">Utenti autorizzati</h3>
              {authorizedTelegramUsers.map(entry => (
                <AuthorizedTelegramRow
                  key={entry.telegram_user_id}
                  entry={entry}
                  onRevoke={revokeTelegramAccess}
                  isProcessing={telegramActionId === entry.telegram_user_id}
                />
              ))}
            </div>
          )}

          {showRevokedTelegram && revokedTelegramUsers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-orange-900">Accessi revocati</h3>
              {revokedTelegramUsers.map(entry => (
                <AuthorizedTelegramRow
                  key={`revoked-${entry.telegram_user_id}`}
                  entry={entry}
                  onRevoke={revokeTelegramAccess}
                  isProcessing={false}
                />
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
            <input
              placeholder="Cerca per nome, email o ID"
              className="w-full pl-8 pr-3 py-2 border rounded-md"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={fetchUsers} className="px-3 py-2 border rounded-md">Aggiorna</button>
        </div>

        {/* Users table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-3 md:gap-2 px-4 py-2 text-xs font-medium text-gray-600 border-b">
            <div className="col-span-12 md:col-span-2">Utente</div>
            <div className="col-span-12 md:col-span-3">Email</div>
            <div className="col-span-6 md:col-span-2">Ultimo Accesso</div>
            <div className="col-span-6 md:col-span-2">Ruolo</div>
            <div className="col-span-6 md:col-span-1 text-center md:text-left">Telegram</div>
            <div className="col-span-12 md:col-span-2 text-left md:text-right">Azioni</div>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  savingState={savingState}
                  onSave={updateUser}
                  onToggleAccess={toggleUserAccess}
                  onDelete={deleteUser}
                />
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-gray-500 text-sm">Nessun utente trovato</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserRow({ user, savingState, onSave, onToggleAccess, onDelete }: {
  user: AdminUser,
  savingState: { id: string, action: 'save' | 'toggle' | null } | null,
  onSave: (id: string, updates: { role?: string, full_name?: string }) => Promise<void>,
  onToggleAccess: (user: AdminUser) => Promise<void>,
  onDelete: (id: string) => Promise<void> | void
}) {
  const [fullName, setFullName] = useState(user.profile?.full_name || user.user_metadata?.full_name || '')
  const [role, setRole] = useState(user.profile?.role || 'operatore')
  const isSaving = savingState?.id === user.id
  const savingAction = isSaving ? savingState?.action : null
  const accountStatus = user.user_metadata?.account_status === 'disabled' ? 'disabled' : 'active'
  const isDisabled = accountStatus === 'disabled'

  return (
    <div className="grid grid-cols-12 gap-3 md:gap-2 px-4 py-4 md:py-3 items-start md:items-center">
      <div className="col-span-12 md:col-span-2">
        <div className="font-medium text-gray-900 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          <input
            className="border px-2 py-1 rounded w-full text-sm"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Nome completo"
          />
        </div>
        <div className="text-xs text-gray-500 truncate">{user.id}</div>
      </div>
      <div className="col-span-12 md:col-span-3 text-sm text-gray-700 truncate">{user.email || '—'}</div>
      <div className="col-span-6 md:col-span-2 text-xs text-gray-600">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('it-IT') : '—'}</div>
      <div className="col-span-6 md:col-span-2">
        <select className="border px-2 py-1 rounded w-full text-sm" value={role} onChange={e => setRole(e.target.value)}>
          {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="col-span-6 md:col-span-1 text-sm text-center md:text-left">
        {user.profile?.telegram_bot_access ? (
          <div className="flex items-center justify-start md:justify-center gap-1" title="Bot Telegram autorizzato">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <span className="md:hidden text-xs text-green-700">Attivo</span>
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </div>
      <div className="col-span-12 md:col-span-2 flex flex-col md:items-end gap-2">
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded w-max ${isDisabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
        >
          {isDisabled ? <Lock className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
          {isDisabled ? 'Disattivato' : 'Attivo'}
        </span>
        <div className="flex flex-wrap justify-between md:justify-end gap-2">
          <ActionButton
            onClick={() => onToggleAccess(user)}
            disabled={isSaving}
            intent={isDisabled ? 'primary' : 'warning'}
            title={isDisabled ? 'Riattiva accesso' : 'Disattiva accesso'}
            loading={savingAction === 'toggle'}
            icon={isDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            label={isDisabled ? 'Riattiva' : 'Disattiva'}
          />
          <ActionButton
            onClick={() => onSave(user.id, { full_name: fullName, role })}
            disabled={savingAction === 'save'}
            intent="success"
            loading={savingAction === 'save'}
            icon={<Check className="w-4 h-4" />}
            label="Salva"
          />
          <ActionButton
            onClick={() => onDelete(user.id)}
            intent="danger"
            icon={<Trash2 className="w-4 h-4" />}
            label="Elimina"
          />
        </div>
      </div>
    </div>
  )
}

type ActionButtonProps = {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  intent: 'primary' | 'warning' | 'success' | 'danger'
  icon: ReactNode
  label: string
  title?: string
}

function ActionButton({ onClick, disabled, loading, intent, icon, label, title }: ActionButtonProps) {
  const baseClasses = 'inline-flex items-center gap-1 px-3 py-1.5 rounded text-white text-sm md:text-xs'
  const intentClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    success: 'bg-green-600 hover:bg-green-700',
    danger: 'bg-red-600 hover:bg-red-700'
  }[intent]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${intentClasses} disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none justify-center`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

function TelegramRequestRow({ request, users, authorizedUsers, onAuthorize, onReject, isProcessing }: {
  request: TelegramAuthRequest,
  users: AdminUser[],
  authorizedUsers: TelegramAllowListEntry[],
  onAuthorize: (telegramUserId: string, profileId: string) => Promise<void>,
  onReject: (telegramUserId: string | null, requestId: number) => Promise<void>,
  isProcessing: boolean
}) {
  const [selectedUserId, setSelectedUserId] = useState('')

  const displayName = [request.first_name, request.last_name].filter(Boolean).join(' ') ||
                     request.telegram_username ||
                     (request.telegram_user_id ? `User ${request.telegram_user_id}` : `Richiesta #${request.id}`)

  const normalizedName = displayName.trim().toLowerCase()

  useEffect(() => {
    if (!selectedUserId) {
      const candidate = users.find(user => {
        const fullName = (user.profile?.full_name || user.user_metadata?.full_name || '').trim().toLowerCase()
        return fullName && fullName === normalizedName
      })
      if (candidate) {
        setSelectedUserId(candidate.id)
      }
    }
  }, [normalizedName, selectedUserId, users])

  const authorizedProfileIds = new Set(
    authorizedUsers
      .filter(entry => entry.can_use_bot && entry.profile_id)
      .map(entry => entry.profile_id as string)
  )

  const availableUsers = users.filter(user => user.profile)
  const selectedUser = selectedUserId ? users.find(user => user.id === selectedUserId) : undefined
  const selectedUserTelegramId = selectedUser?.profile?.telegram_user_id
  const showConflictWarning = Boolean(
    selectedUserTelegramId &&
    selectedUserTelegramId !== request.telegram_user_id &&
    !authorizedProfileIds.has(selectedUser?.profile?.id || selectedUserId)
  )
  const telegramIdDisplay = request.telegram_user_id || 'Non disponibile'
  const canAuthorize = Boolean(request.telegram_user_id)

  return (
    <div className="bg-white border border-orange-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-gray-900 text-sm md:text-base">{displayName}</div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>ID Telegram: <span className="font-mono text-gray-800">{telegramIdDisplay}</span></div>
              {request.telegram_username && (
                <div>Username: @{request.telegram_username}</div>
              )}
              <div>Messaggi totali: {request.message_count}</div>
              <div>Ultimo contatto: {new Date(request.last_seen_at).toLocaleString('it-IT')}</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Primo contatto: {new Date(request.first_seen_at).toLocaleString('it-IT')}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          className="border px-3 py-2 rounded text-sm md:w-60"
        >
          <option value="">Abbina a un utente del gestionale…</option>
          {availableUsers.map(user => {
            const fullName = user.profile?.full_name || user.user_metadata?.full_name || user.email || 'Senza nome'
            const roleKey = user.profile?.role ?? user.user_metadata?.role
            const roleLabel = roles.find(r => r.value === roleKey)?.label
            const linkedTelegramId = user.profile?.telegram_user_id
            const isLinkedToOther = linkedTelegramId && linkedTelegramId !== request.telegram_user_id
            const hintParts = [
              fullName,
              roleLabel ? `(${roleLabel})` : null,
              linkedTelegramId ? `ID attuale: ${linkedTelegramId}` : null
            ].filter(Boolean)
            return (
              <option
                key={user.id}
                value={user.id}
                disabled={Boolean(isLinkedToOther && !authorizedProfileIds.has(user.profile?.id || user.id))}
              >
                {hintParts.join(' ')}
              </option>
            )
          })}
        </select>

        {showConflictWarning && selectedUserTelegramId && (
          <div className="text-xs text-red-600 max-w-sm">
            Questo utente è già collegato all&apos;ID Telegram {selectedUserTelegramId}. Revoca prima l&apos;accesso esistente per evitare conflitti.
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          {!canAuthorize && (
            <div className="text-xs text-orange-700 max-w-sm">
              Questo contatto non ha fornito un ID Telegram valido. Puoi solo rifiutare la richiesta per rimuoverla dalla lista.
            </div>
          )}
          <button
            onClick={async () => {
              if (!canAuthorize || !selectedUserId || isProcessing) return
              await onAuthorize(request.telegram_user_id!, selectedUserId)
            }}
            disabled={!canAuthorize || !selectedUserId || isProcessing}
            className="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
            Autorizza
          </button>
          <button
            onClick={async () => {
              if (isProcessing) return
              await onReject(request.telegram_user_id, request.id)
            }}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Rifiuta
          </button>
        </div>
      </div>
    </div>
  )
}

function AuthorizedTelegramRow({ entry, onRevoke, isProcessing }: {
  entry: TelegramAllowListEntry,
  onRevoke: (telegramUserId: string) => Promise<void>,
  isProcessing: boolean
}) {
  const profile = entry.profiles
  const statusLabel = entry.can_use_bot ? 'Attivo' : 'Revocato'
  const statusClasses = entry.can_use_bot
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'
  const isActive = entry.can_use_bot

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-gray-200 rounded-lg p-4 bg-white">
      <div>
        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-500" />
          <span>{entry.label || entry.telegram_user_id}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusClasses}`}>{statusLabel}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
          <div>ID Telegram: <span className="font-mono text-gray-800">{entry.telegram_user_id}</span></div>
          {profile?.full_name && (
            <div>Collegato a: {profile.full_name} ({profile.role || 'ruolo sconosciuto'})</div>
          )}
          <div>Aggiornato: {entry.updated_at ? new Date(entry.updated_at).toLocaleString('it-IT') : '—'}</div>
        </div>
      </div>
      {isActive ? (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onRevoke(entry.telegram_user_id)}
            disabled={!isActive || isProcessing}
            className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Revoca accesso
          </button>
        </div>
      ) : (
        <div className="text-xs text-red-600 font-medium text-right">Accesso già revocato</div>
      )}
    </div>
  )
}
