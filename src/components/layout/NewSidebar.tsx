'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  Search,
  Mic,
  Phone,
  AlertTriangle,
  BookOpen,
  Archive,
  Users,
  Building2,
  Activity,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  TrendingUp,
  BarChart3,
  Zap,
  Brain,
  Download,
  Package,
  CheckSquare,
  DollarSign,
  ClipboardCheck,
  Filter,
  Eye,
  GraduationCap,
  ClipboardPen
} from 'lucide-react';
import AccordionSection from './AccordionSection';
import SidebarItem from './SidebarItem';
import { useSidebar } from './SidebarContext';
import QuickAddErrorForm from '@/components/error-tracking/QuickAddErrorForm';

interface NewSidebarProps {
  className?: string;
}

export default function NewSidebar({ className = '' }: NewSidebarProps) {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [voiceNotesCount, setVoiceNotesCount] = useState(0);
  const [errorDraftCount, setErrorDraftCount] = useState(0);
  const [procedureUnreadCount, setProcedureUnreadCount] = useState(0);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [quizReviewsCount, setQuizReviewsCount] = useState(0);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [nestedSections, setNestedSections] = useState<Record<string, boolean>>({});
  const [isErrorFormOpen, setIsErrorFormOpen] = useState(false);
  const isMountedRef = useRef(true);
  const voiceNotesFetchLock = useRef(false);
  const errorDraftFetchLock = useRef(false);
  const procedureUnreadFetchLock = useRef(false);
  const suggestionsFetchLock = useRef(false);
  const quizReviewsFetchLock = useRef(false);

  // Handler to toggle accordion sections - only one open at a time
  const handleToggleSection = (sectionId: string) => {
    setOpenSection(prevOpen => {
      const newSection = prevOpen === sectionId ? null : sectionId;
      // When switching to a different main section, close all nested accordions
      if (newSection !== prevOpen) {
        setNestedSections({});
      }
      return newSection;
    });
  };

  // Handler for nested accordions - can have multiple open
  const handleToggleNestedSection = (sectionId: string) => {
    setNestedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

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
        if (!background) console.error('Error fetching voice notes count:', response.statusText);
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      const nextCount = data.count ?? data.notes?.length ?? 0;
      setVoiceNotesCount(nextCount);
    } catch (error) {
      if (!background) console.error('Error fetching voice notes count:', error);
    } finally {
      voiceNotesFetchLock.current = false;
    }
  }, []);

  const fetchErrorDraftCount = useCallback(async (background = false) => {
    if (!userRole || userRole !== 'admin' || errorDraftFetchLock.current) return;
    errorDraftFetchLock.current = true;

    try {
      const response = await fetch('/api/error-tracking/drafts?summary=count', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) console.error('Error fetching error draft count:', response.statusText);
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setErrorDraftCount(data.count ?? 0);
    } catch (error) {
      if (!background) console.error('Error fetching error draft count:', error);
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
        if (!background) console.error('Error fetching procedure unread count:', response.statusText);
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      const metaCount = typeof data?.meta?.unread_count === 'number' ? data.meta.unread_count : 0;
      setProcedureUnreadCount(metaCount);
    } catch (error) {
      if (!background) console.error('Error fetching procedure unread count:', error);
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
        if (!background) console.error('Error fetching suggestions count:', response.statusText);
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setSuggestionsCount(typeof data.count === 'number' ? data.count : 0);
    } catch (error) {
      if (!background) console.error('Error fetching suggestions count:', error);
    } finally {
      suggestionsFetchLock.current = false;
    }
  }, [userRole]);

  const fetchQuizReviewsCount = useCallback(async (background = false) => {
    if (!userRole || userRole !== 'admin' || quizReviewsFetchLock.current) return;
    quizReviewsFetchLock.current = true;

    try {
      const response = await fetch('/api/procedures/quiz/analytics', { cache: 'no-store' });
      if (!response.ok) {
        if (!background) console.error('Error fetching quiz reviews count:', response.statusText);
        return;
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setQuizReviewsCount(data.overall_stats?.pending_reviews || 0);
    } catch (error) {
      if (!background) console.error('Error fetching quiz reviews count:', error);
    } finally {
      quizReviewsFetchLock.current = false;
    }
  }, [userRole]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Polling intervals
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchVoiceNotesCount(true);
    }, 60000);

    fetchVoiceNotesCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchVoiceNotesCount(true);
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
      if (document.visibilityState === 'visible') fetchProcedureUnreadCount(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchProcedureUnreadCount]);

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
      if (document.visibilityState === 'visible') fetchSuggestionsCount(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userRole, fetchSuggestionsCount]);

  useEffect(() => {
    if (!userRole || userRole !== 'admin') {
      setQuizReviewsCount(0);
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchQuizReviewsCount(true);
    }, 120000); // 2 minutes

    fetchQuizReviewsCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchQuizReviewsCount(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userRole, fetchQuizReviewsCount]);

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
      if (document.visibilityState === 'visible') fetchErrorDraftCount(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userRole, fetchErrorDraftCount]);

  // Event listeners for real-time updates
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
    return () => window.removeEventListener('errorDrafts:update', handleDraftUpdate)
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
    return () => window.removeEventListener('procedures:unread:update', handleProceduresUpdate)
  }, [fetchProcedureUnreadCount])

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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* 2.A - Kanban Board (Homepage) */}
          <SidebarItem
            href="/dashboard"
            icon={LayoutDashboard}
            label="Kanban Board"
            isCollapsed={isCollapsed}
          />

          {/* 2.B - OPERAZIONI Section */}
          <AccordionSection
            title="Operazioni"
            icon={ClipboardList}
            isCollapsed={isCollapsed}
            isOpen={openSection === 'operazioni'}
            onToggle={() => handleToggleSection('operazioni')}
            sectionId="operazioni"
          >
            <SidebarItem
              href="/dashboard/buste/new"
              icon={Plus}
              label="Nuova Busta"
              isCollapsed={isCollapsed}
            />
            <SidebarItem
              href="#"
              icon={CheckSquare}
              label="Pre-Controllo"
              isCollapsed={isCollapsed}
              disabled={true}
              disabledTooltip="Modulo in sviluppo"
            />
            <SidebarItem
              href="#"
              icon={ClipboardCheck}
              label="Controllo"
              isCollapsed={isCollapsed}
              disabled={true}
              disabledTooltip="Modulo in sviluppo"
            />
            <SidebarItem
              href="#"
              icon={DollarSign}
              label="Preventivo"
              isCollapsed={isCollapsed}
              disabled={true}
              disabledTooltip="Modulo in sviluppo"
            />
            <SidebarItem
              href="/modules/operations"
              icon={Package}
              label="Ordini"
              isCollapsed={isCollapsed}
            />
            <SidebarItem
              href="/dashboard/ricerca-avanzata"
              icon={Search}
              label="Ricerca Avanzata"
              isCollapsed={isCollapsed}
            />
            <SidebarItem
              href="/dashboard/voice-notes"
              icon={Mic}
              label="Nota Vocale"
              isCollapsed={isCollapsed}
              badge={voiceNotesCount > 0 ? (voiceNotesCount > 99 ? '99+' : voiceNotesCount.toString()) : undefined}
            />
            <SidebarItem
              href="/dashboard/follow-up"
              icon={Phone}
              label="Follow-Up"
              isCollapsed={isCollapsed}
            />
            <SidebarItem
              icon={AlertTriangle}
              label="Segnala Errore"
              isCollapsed={isCollapsed}
              onClick={() => setIsErrorFormOpen(true)}
            />
          </AccordionSection>

          {/* 2.C - PROCEDURE Section */}
          <AccordionSection
            title="Procedure"
            icon={BookOpen}
            isCollapsed={isCollapsed}
            isOpen={openSection === 'procedure'}
            onToggle={() => handleToggleSection('procedure')}
            sectionId="procedure"
          >
            <SidebarItem
              href="/procedure"
              icon={BookOpen}
              label="Procedure"
              isCollapsed={isCollapsed}
              badge={procedureUnreadCount > 0 ? (procedureUnreadCount > 99 ? '99+' : procedureUnreadCount.toString()) : undefined}
            />
            <SidebarItem
              href="/casi-non-previsti"
              icon={AlertTriangle}
              label="Caso NON Previsto"
              isCollapsed={isCollapsed}
            />
          </AccordionSection>

          {/* 2.D - ADMIN & GOVERNANCE Section (Admin Only) */}
          {userRole === 'admin' && (
            <AccordionSection
              title="Admin & Governance"
              icon={Activity}
              isCollapsed={isCollapsed}
              isOpen={openSection === 'admin'}
              onToggle={() => handleToggleSection('admin')}
              sectionId="admin"
            >
              <SidebarItem
                href="/dashboard/analytics"
                icon={Activity}
                label="Analytics"
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                href="/errori"
                icon={AlertTriangle}
                label="Tracciamento Errori"
                isCollapsed={isCollapsed}
                badge={errorDraftCount > 0 ? (errorDraftCount > 99 ? '99+' : errorDraftCount.toString()) : undefined}
              />
              <SidebarItem
                href="/dashboard/audit"
                icon={FileSpreadsheet}
                label="Audit"
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                href="/modules/archive"
                icon={Archive}
                label="Archivio"
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                href="/admin/users"
                icon={Users}
                label="Utenti"
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                href="/modules/fornitori"
                icon={Building2}
                label="Fornitori"
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                href="/dashboard/admin/import-clienti"
                icon={FileSpreadsheet}
                label="Import Clienti"
                isCollapsed={isCollapsed}
              />
              <AccordionSection
                title="Procedure"
                icon={BookOpen}
                isCollapsed={isCollapsed}
                isOpen={nestedSections['procedure-admin'] || false}
                onToggle={() => handleToggleNestedSection('procedure-admin')}
                sectionId="procedure-admin"
              >
                <SidebarItem
                  href="/dashboard/procedure-suggestions"
                  icon={Lightbulb}
                  label="Modifiche Proposte"
                  isCollapsed={isCollapsed}
                  badge={suggestionsCount > 0 ? (suggestionsCount > 99 ? '99+' : suggestionsCount.toString()) : undefined}
                  badgeVariant="blue"
                />
                <SidebarItem
                  href="/dashboard/procedure-compliance"
                  icon={Eye}
                  label="Controllo Letture"
                  isCollapsed={isCollapsed}
                />
                <SidebarItem
                  href="/dashboard/governance/quiz-analytics"
                  icon={GraduationCap}
                  label="Analitiche Quiz"
                  isCollapsed={isCollapsed}
                />
                <SidebarItem
                  href="/dashboard/governance/quiz-reviews"
                  icon={ClipboardPen}
                  label="Revisioni Quiz"
                  isCollapsed={isCollapsed}
                  badge={quizReviewsCount > 0 ? (quizReviewsCount > 99 ? '99+' : quizReviewsCount.toString()) : undefined}
                  badgeVariant="amber"
                />
              </AccordionSection>
            </AccordionSection>
          )}

          {/* 2.E - MARKETING & INTELLIGENCE Section (Admin Only, All Disabled) */}
          {userRole === 'admin' && (
            <AccordionSection
              title="Marketing"
              icon={TrendingUp}
              isCollapsed={isCollapsed}
              isOpen={openSection === 'marketing'}
              onToggle={() => handleToggleSection('marketing')}
              sectionId="marketing"
            >
              <SidebarItem
                href="#"
                icon={Filter}
                label="Cluster"
                isCollapsed={isCollapsed}
                disabled={true}
                disabledTooltip="Funzionalità disponibile prossimamente"
              />
              <SidebarItem
                href="#"
                icon={BarChart3}
                label="Behavior Analytics"
                isCollapsed={isCollapsed}
                disabled={true}
                disabledTooltip="Funzionalità disponibile prossimamente"
              />
              <SidebarItem
                href="#"
                icon={Zap}
                label="Suggested Actions"
                isCollapsed={isCollapsed}
                disabled={true}
                disabledTooltip="Funzionalità disponibile prossimamente"
              />
              <SidebarItem
                href="#"
                icon={Brain}
                label="Predictive Models"
                isCollapsed={isCollapsed}
                disabled={true}
                disabledTooltip="Funzionalità disponibile prossimamente"
              />
              <SidebarItem
                href="#"
                icon={Download}
                label="Data Exports"
                isCollapsed={isCollapsed}
                disabled={true}
                disabledTooltip="Funzionalità disponibile prossimamente"
              />
            </AccordionSection>
          )}
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-md shadow-md lg:hidden"
      >
        <LayoutDashboard className="h-5 w-5" />
      </button>

      {/* Error Form Modal */}
      <QuickAddErrorForm
        isOpen={isErrorFormOpen}
        onClose={() => setIsErrorFormOpen(false)}
        onSuccess={() => {
          setIsErrorFormOpen(false);
          // Trigger refresh of error draft count
          window.dispatchEvent(new CustomEvent('errorDrafts:update'));
        }}
      />
    </>
  );
}
