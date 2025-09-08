'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/context/UserContext'
import { useRouter } from 'next/navigation'
import { Users, Shield, Mail, Loader2, Search, Check, X, User, Trash2 } from 'lucide-react'

type AdminUser = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  user_metadata: Record<string, any>
  profile: {
    id: string
    full_name: string | null
    role: string
    avatar_url: string | null
    updated_at: string | null
    created_at: string | null
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
  const [savingId, setSavingId] = useState<string | null>(null)
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'operatore' })
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

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
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.profile?.full_name || '').toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  }, [users, search])

  const updateUser = async (id: string, updates: { role?: string, full_name?: string }) => {
    try {
      setSavingId(id)
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
      setSavingId(null)
    }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo utente?')) return
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Eliminazione fallita')
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
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <h1 className="text-xl font-semibold text-gray-900">Gestione Utenti</h1>
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
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-600 border-b">
            <div className="col-span-3">Utente</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Ultimo Accesso</div>
            <div className="col-span-2">Ruolo</div>
            <div className="col-span-2 text-right">Azioni</div>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(u => (
                <UserRow key={u.id} user={u} savingId={savingId} onSave={updateUser} onDelete={deleteUser} />
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

function UserRow({ user, savingId, onSave, onDelete }: {
  user: AdminUser,
  savingId: string | null,
  onSave: (id: string, updates: { role?: string, full_name?: string }) => Promise<void>,
  onDelete: (id: string) => Promise<void> | void
}) {
  const [fullName, setFullName] = useState(user.profile?.full_name || user.user_metadata?.full_name || '')
  const [role, setRole] = useState(user.profile?.role || 'operatore')
  const isSaving = savingId === user.id

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
      <div className="col-span-3">
        <div className="font-medium text-gray-900 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          <input
            className="border px-2 py-1 rounded w-full"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Nome completo"
          />
        </div>
        <div className="text-xs text-gray-500 truncate">{user.id}</div>
      </div>
      <div className="col-span-3 text-sm text-gray-700 truncate">{user.email || '—'}</div>
      <div className="col-span-2 text-xs text-gray-600">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('it-IT') : '—'}</div>
      <div className="col-span-2">
        <select className="border px-2 py-1 rounded w-full" value={role} onChange={e => setRole(e.target.value)}>
          {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="col-span-2 text-right">
        <button
          onClick={() => onSave(user.id, { full_name: fullName, role })}
          disabled={isSaving}
          className="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salva
        </button>
        <button
          onClick={() => onDelete(user.id)}
          className="inline-flex items-center gap-1 ml-2 bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
          title="Elimina utente"
        >
          <Trash2 className="w-4 h-4" />
          Elimina
        </button>
      </div>
    </div>
  )
}
