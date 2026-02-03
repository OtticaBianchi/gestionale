'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import {
  LayoutDashboard,
  ClipboardList,
  MessageSquareMore,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Phone,
  Mic,
  Archive,
  Users,
  Building2,
  Activity,
  Mail,
  RotateCcw,
  AlertTriangle,
  BookOpen,
  FileSpreadsheet,
  Lightbulb,
  ListChecks
} from 'lucide-react';
import SidebarSection from './SidebarSection';
import SidebarItem from './SidebarItem';
import { useSidebar } from './SidebarContext';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className = '' }: SidebarProps) {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [voiceNotesCount, setVoiceNotesCount] = useState(0);
  const [telegramRequestsCount, setTelegramRequestsCount] = useState(0);
  const [errorDraftCount, setErrorDraftCount] = useState(0);
  const [procedureUnreadCount, setProcedureUnreadCount] = useState(0);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const isMountedRef = useRef(true);
  const voiceNotesFetchLock = useRef(false);
  const telegramFetchLock = useRef(false);
  const errorDraftFetchLock = useRef(false);
  const procedureUnreadFetchLock = useRef(false);
  const suggestionsFetchLock = useRef(false);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        setUserRole(profile?.role || null);
      }
    };

    checkUserRole();
  }, [supabase]);

  // Fetch voice notes count
  const fetchVoiceNotesCount = useCallback(async (background = false) => {
    if (voiceNotesFetchLock.current) return;
    voiceNotesFetchLock.current = true;

    try {
      const response = await fetch('/api/voice-notes?summary=count', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) {
          console.error('Error fetching voice notes count:', response.statusText);
        }
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      const nextCount = data.count ?? data.notes?.length ?? 0;
      setVoiceNotesCount(nextCount);
    } catch (error) {
      if (!background) {
        console.error('Error fetching voice notes count:', error);
      }
    } finally {
      voiceNotesFetchLock.current = false;
    }
  }, []);

  // Fetch telegram auth requests count (admin only)
  const fetchTelegramRequestsCount = useCallback(async (background = false) => {
    if (!userRole || !['admin', 'manager'].includes(userRole) || telegramFetchLock.current) return;
    telegramFetchLock.current = true;

    try {
      const response = await fetch('/api/admin/telegram-auth?summary=count', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) {
          console.error('Error fetching telegram requests count:', response.statusText);
        }
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      const nextCount = data.count ?? data.unauthorizedUsers?.length ?? 0;
      setTelegramRequestsCount(nextCount);
    } catch (error) {
      if (!background) {
        console.error('Error fetching telegram requests count:', error);
      }
    } finally {
      telegramFetchLock.current = false;
    }
  }, [userRole]);

  const fetchErrorDraftCount = useCallback(async (background = false) => {
    if (!userRole || userRole !== 'admin' || errorDraftFetchLock.current) return;
    errorDraftFetchLock.current = true;

    try {
      const response = await fetch('/api/error-tracking/drafts?summary=count', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) {
          console.error('Error fetching error draft count:', response.statusText);
        }
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setErrorDraftCount(data.count ?? 0);
    } catch (error) {
      if (!background) {
        console.error('Error fetching error draft count:', error);
      }
    } finally {
      errorDraftFetchLock.current = false;
    }
  }, [userRole]);

  const fetchProcedureUnreadCount = useCallback(async (background = false) => {
    if (procedureUnreadFetchLock.current) return;
    procedureUnreadFetchLock.current = true;

    try {
      const response = await fetch('/api/procedures?summary=unread_count', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) {
          console.error('Error fetching procedure unread count:', response.statusText);
        }
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      const metaCount = typeof data?.meta?.unread_count === 'number' ? data.meta.unread_count : 0;
      setProcedureUnreadCount(metaCount);
    } catch (error) {
      if (!background) {
        console.error('Error fetching procedure unread count:', error);
      }
    } finally {
      procedureUnreadFetchLock.current = false;
    }
  }, []);

  const fetchSuggestionsCount = useCallback(async (background = false) => {
    if (!userRole || userRole !== 'admin' || suggestionsFetchLock.current) return;
    suggestionsFetchLock.current = true;

    try {
      const response = await fetch('/api/procedure-suggestions?summary=count&status=open', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) {
          console.error('Error fetching suggestions count:', response.statusText);
        }
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setSuggestionsCount(typeof data.count === 'number' ? data.count : 0);
    } catch (error) {
      if (!background) {
        console.error('Error fetching suggestions count:', error);
      }
    } finally {
      suggestionsFetchLock.current = false;
    }
  }, [userRole]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchVoiceNotesCount(true);
    }, 60000);

    fetchVoiceNotesCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchVoiceNotesCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchVoiceNotesCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchProcedureUnreadCount(true);
    }, 120000);

    fetchProcedureUnreadCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchProcedureUnreadCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchProcedureUnreadCount]);

  useEffect(() => {
    if (!userRole || !['admin', 'manager'].includes(userRole)) {
      setTelegramRequestsCount(0);
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchTelegramRequestsCount(true);
    }, 60000);

    fetchTelegramRequestsCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTelegramRequestsCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userRole, fetchTelegramRequestsCount]);

  useEffect(() => {
    const handleDraftUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number; delta?: number }>
      if (typeof custom.detail?.count === 'number') {
        setErrorDraftCount(custom.detail.count)
      } else if (typeof custom.detail?.delta === 'number') {
        setErrorDraftCount(prev => Math.max(0, prev + custom.detail!.delta!))
      } else {
        fetchErrorDraftCount(true)
      }
    }

    window.addEventListener('errorDrafts:update', handleDraftUpdate)
    return () => {
      window.removeEventListener('errorDrafts:update', handleDraftUpdate)
    }
  }, [fetchErrorDraftCount])

  useEffect(() => {
    const handleProceduresUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number; delta?: number }>
      if (typeof custom.detail?.count === 'number') {
        setProcedureUnreadCount(custom.detail.count)
      } else if (typeof custom.detail?.delta === 'number') {
        setProcedureUnreadCount(prev => Math.max(0, prev + custom.detail!.delta!))
      } else {
        fetchProcedureUnreadCount(true)
      }
    }

    window.addEventListener('procedures:unread:update', handleProceduresUpdate)
    return () => {
      window.removeEventListener('procedures:unread:update', handleProceduresUpdate)
    }
  }, [fetchProcedureUnreadCount])

  useEffect(() => {
    if (!userRole || userRole !== 'admin') {
      setSuggestionsCount(0);
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchSuggestionsCount(true);
    }, 90000);

    fetchSuggestionsCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSuggestionsCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userRole, fetchSuggestionsCount]);

  useEffect(() => {
    if (!userRole || userRole !== 'admin') {
      setErrorDraftCount(0);
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchErrorDraftCount(true);
    }, 60000);

    fetchErrorDraftCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchErrorDraftCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userRole, fetchErrorDraftCount]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Chiudi menu"
        ></button>
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-50
        transition-all duration-300 ease-in-out flex flex-col
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${className}
      `}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900">
              Menu
            </h2>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors hidden lg:block"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Menu Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">

          {/* DASHBOARD Section */}
          <SidebarSection
            title="Dashboard"
            icon={LayoutDashboard}
            isCollapsed={isCollapsed}
          >
            <SidebarItem
              href="/dashboard"
              icon={LayoutDashboard}
              label="Kanban Board"
              isCollapsed={isCollapsed}
            />
            {userRole === 'admin' && (
              <SidebarItem
                href="/dashboard/analytics"
                icon={Activity}
                label="Analytics"
                isCollapsed={isCollapsed}
              />
            )}
            {userRole === 'admin' && (
              <SidebarItem
                href="/dashboard/audit"
                icon={FileSpreadsheet}
                label="Audit"
                isCollapsed={isCollapsed}
              />
            )}
          </SidebarSection>

          {/* OPERAZIONI Section */}
          <SidebarSection
            title="Operazioni"
            icon={ClipboardList}
            isCollapsed={isCollapsed}
          >
            <SidebarItem
              href="/dashboard/buste/new"
              icon={Plus}
              label="Nuova Busta"
              isCollapsed={isCollapsed}
              disabled={userRole === 'operatore'}
            />
            <SidebarItem
              href="/modules/operations"
              icon={Filter}
              label="Ordini"
              isCollapsed={isCollapsed}
              disabled={userRole === 'operatore'}
            />
            <SidebarItem
              href="/dashboard/ricerca-avanzata"
              icon={Search}
              label="Ricerca"
              isCollapsed={isCollapsed}
              disabled={userRole === 'operatore'}
            />
            {userRole === 'admin' && (
              <SidebarItem
                href="/errori"
                icon={AlertTriangle}
                label="Tracciamento Errori"
                isCollapsed={isCollapsed}
                badge={errorDraftCount > 0 ? (errorDraftCount > 99 ? '99+' : errorDraftCount.toString()) : undefined}
              />
            )}
            {userRole !== 'operatore' && (
              <SidebarItem
                href="/modules/archive"
                icon={Archive}
                label="Archivio"
                isCollapsed={isCollapsed}
              />
            )}
          </SidebarSection>

          {/* COMUNICAZIONI Section */}
          <SidebarSection
            title="Comunicazioni"
            icon={MessageSquareMore}
            isCollapsed={isCollapsed}
          >
            {userRole && userRole !== 'operatore' && (
              <SidebarItem
                href="/dashboard/voice-notes"
                icon={Mic}
                label="Note Vocali"
                isCollapsed={isCollapsed}
                badge={voiceNotesCount > 0 ? (voiceNotesCount > 99 ? '99+' : voiceNotesCount.toString()) : undefined}
              />
            )}
            <SidebarItem
              href="/dashboard/follow-up"
              icon={Phone}
              label="Follow-up Chiamate"
              isCollapsed={isCollapsed}
            />
            {userRole === 'admin' && (
              <SidebarItem
                href="/modules/marketing"
                icon={Mail}
                label="Marketing"
                isCollapsed={isCollapsed}
              />
            )}
            {userRole === 'admin' && (
              <SidebarItem
                href="/modules/reactivation"
                icon={RotateCcw}
                label="Riattivazione"
                isCollapsed={isCollapsed}
              />
            )}
          </SidebarSection>

          {/* GESTIONE Section */}
          <SidebarSection
          title="Gestione"
          icon={Settings}
          isCollapsed={isCollapsed}
        >
          {userRole === 'admin' && (
            <SidebarItem
              href="/dashboard/procedure-suggestions"
              icon={Lightbulb}
              label="Proposte Procedure"
              isCollapsed={isCollapsed}
              badge={suggestionsCount > 0 ? (suggestionsCount > 99 ? '99+' : suggestionsCount.toString()) : undefined}
              badgeVariant="blue"
            />
          )}
          <SidebarItem
            href="/procedure"
            icon={BookOpen}
            label="Procedure"
            isCollapsed={isCollapsed}
            badge={procedureUnreadCount > 0 ? (procedureUnreadCount > 99 ? '99+' : procedureUnreadCount.toString()) : undefined}
            />
            {userRole === 'admin' && (
              <SidebarItem
                href="/modules/fornitori"
                icon={Building2}
                label="Fornitori"
                isCollapsed={isCollapsed}
              />
            )}
            {userRole === 'admin' && (
              <>
                <SidebarItem
                  href="/admin/users"
                  icon={Users}
                  label="Utenti"
                  isCollapsed={isCollapsed}
                  badge={telegramRequestsCount > 0 ? telegramRequestsCount.toString() : undefined}
                />
                <SidebarItem
                  href="/dashboard/admin/import-clienti"
                  icon={FileSpreadsheet}
                  label="Import Clienti"
                  isCollapsed={isCollapsed}
                />
                <SidebarItem
                  href="/dashboard/admin/dedup-clienti"
                  icon={ListChecks}
                  label="Duplicati Clienti"
                  isCollapsed={isCollapsed}
                />
              </>
            )}
          </SidebarSection>
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-md shadow-md lg:hidden"
      >
        <LayoutDashboard className="h-5 w-5" />
      </button>
    </>
  );
}
