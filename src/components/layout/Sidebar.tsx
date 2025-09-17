'use client';

import { useState, useEffect } from 'react';
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
  Activity
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
  const fetchVoiceNotesCount = async () => {
    try {
      const response = await fetch('/api/voice-notes');
      if (response.ok) {
        const data = await response.json();
        setVoiceNotesCount(data.notes?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching voice notes count:', error);
    }
  };

  // Fetch telegram auth requests count (admin only)
  const fetchTelegramRequestsCount = async () => {
    if (userRole !== 'admin') return;

    try {
      const response = await fetch('/api/admin/telegram-auth');
      if (response.ok) {
        const data = await response.json();
        setTelegramRequestsCount(data.unauthorizedUsers?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching telegram requests count:', error);
    }
  };

  useEffect(() => {
    fetchVoiceNotesCount();
    const interval = setInterval(fetchVoiceNotesCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchTelegramRequestsCount();
      const interval = setInterval(fetchTelegramRequestsCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${className}
      `}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

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
            <SidebarItem
              href="/dashboard/analytics"
              icon={Activity}
              label="Analytics"
              isCollapsed={isCollapsed}
              disabled={true}
              className="opacity-50"
            />
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
              label="Gestione Ordini"
              isCollapsed={isCollapsed}
              disabled={userRole === 'operatore'}
            />
            <SidebarItem
              href="/dashboard/ricerca-avanzata"
              icon={Search}
              label="Ricerca Avanzata"
              isCollapsed={isCollapsed}
              disabled={userRole === 'operatore'}
            />
            <SidebarItem
              href="/modules/archive"
              icon={Archive}
              label="Archivio"
              isCollapsed={isCollapsed}
            />
          </SidebarSection>

          {/* COMUNICAZIONI Section */}
          <SidebarSection
            title="Comunicazioni"
            icon={MessageSquareMore}
            isCollapsed={isCollapsed}
          >
            <SidebarItem
              href="/dashboard/voice-notes"
              icon={Mic}
              label="Note Telegram"
              isCollapsed={isCollapsed}
              badge={voiceNotesCount > 0 ? (voiceNotesCount > 99 ? '99+' : voiceNotesCount.toString()) : undefined}
            />
            <SidebarItem
              href="/dashboard/follow-up"
              icon={Phone}
              label="Follow-up Chiamate"
              isCollapsed={isCollapsed}
            />
          </SidebarSection>

          {/* GESTIONE Section (Manager+ only) */}
          {userRole !== 'operatore' && (
            <SidebarSection
              title="Gestione"
              icon={Settings}
              isCollapsed={isCollapsed}
            >
              <SidebarItem
                href="/modules/fornitori"
                icon={Building2}
                label="Fornitori"
                isCollapsed={isCollapsed}
              />
              {userRole === 'admin' && (
                <SidebarItem
                  href="/admin/users"
                  icon={Users}
                  label="Utenti"
                  isCollapsed={isCollapsed}
                  badge={telegramRequestsCount > 0 ? telegramRequestsCount.toString() : undefined}
                />
              )}
            </SidebarSection>
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
    </>
  );
}