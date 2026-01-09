'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'
import { Eye, Search, Users, BookOpen, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface UserCompliance {
  user_id: string
  full_name: string
  role: string
  read_count: number
  unread_count: number
  total_procedures: number
  read_percentage: number
  last_read_at: string | null
  read_procedures: Array<{
    procedure_id: string
    procedure_title: string
    procedure_slug: string
    acknowledged_at: string
  }>
}

interface ComplianceStats {
  total_procedures: number
  total_users: number
  total_reads: number
  average_read_percentage: number
}

export default function ProcedureCompliancePage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [users, setUsers] = useState<UserCompliance[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUserRole()
    fetchComplianceData()
  }, [])

  async function checkUserRole() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(profile?.role || null)
    }
  }

  async function fetchComplianceData() {
    try {
      const response = await fetch('/api/procedures/compliance')
      if (!response.ok) {
        throw new Error('Failed to fetch compliance data')
      }

      const data = await response.json()
      setStats(data.stats)
      setUsers(data.users)
    } catch (error) {
      console.error('Error fetching compliance data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter users by search term and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  // Get color based on read percentage
  function getStatusColor(percentage: number) {
    if (percentage >= 90) return 'text-green-600 bg-green-50'
    if (percentage >= 50) return 'text-amber-600 bg-amber-50'
    return 'text-red-600 bg-red-50'
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case 'admin': return 'Admin'
      case 'manager': return 'Manager'
      case 'operatore': return 'Operatore'
      default: return role
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Mai'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Pochi minuti fa'
    if (diffHours < 24) return `${diffHours}h fa`
    if (diffDays === 1) return 'Ieri'
    if (diffDays < 7) return `${diffDays}g fa`

    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dati compliance...</p>
        </div>
      </div>
    )
  }

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
          <p className="text-gray-600">Solo gli amministratori possono accedere a questa pagina.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back to Dashboard */}
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Torna alla Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Controllo Letture Procedure</h1>
        </div>
        <p className="text-gray-600">Monitora quali procedure sono state lette da ogni utente</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Procedure</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_procedures || 0}</p>
            </div>
            <BookOpen className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Utenti</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_users || 0}</p>
            </div>
            <Users className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Letture Totali</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_reads || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Media Letture</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.average_read_percentage || 0}%</p>
            </div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getStatusColor(stats?.average_read_percentage || 0)}`}>
              <span className="text-sm font-bold">{stats?.average_read_percentage || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cerca per nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="w-full md:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutti i ruoli</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="operatore">Operatore</option>
            </select>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ruolo
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lette
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Non Lette
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Completamento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ultima Lettura
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Nessun utente trovato
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <>
                  <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{user.full_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-600 font-semibold">{user.read_count}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${user.unread_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {user.unread_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              user.read_percentage >= 90 ? 'bg-green-600' :
                              user.read_percentage >= 50 ? 'bg-amber-500' :
                              'bg-red-600'
                            }`}
                            style={{ width: `${user.read_percentage}%` }}
                          />
                        </div>
                        <span className={`text-sm font-semibold ${getStatusColor(user.read_percentage)}`}>
                          {user.read_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{formatDate(user.last_read_at)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setExpandedUser(expandedUser === user.user_id ? null : user.user_id)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1 mx-auto"
                      >
                        {expandedUser === user.user_id ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Nascondi
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Dettagli
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row - Show read procedures */}
                  {expandedUser === user.user_id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-900 mb-3">Procedure Lette ({user.read_count})</h4>
                          {user.read_procedures.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">Nessuna procedura letta</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {user.read_procedures.map((proc) => (
                                <div key={proc.procedure_id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                  <div className="flex-1">
                                    <a
                                      href={`/procedure/${proc.procedure_slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {proc.procedure_title}
                                    </a>
                                  </div>
                                  <span className="text-xs text-gray-500 ml-2">
                                    {formatDate(proc.acknowledged_at)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
