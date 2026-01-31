'use client';

import { ReactNode, useState, useEffect } from 'react';
import NewSidebar from './NewSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="relative flex h-screen bg-[var(--paper)] text-slate-900">
      <style jsx global>{`
        :root {
          --paper: #f6f1e9;
          --ink: #1b1f24;
          --teal: #0f6a6e;
          --copper: #b2734b;
        }
        .kiasma-hero {
          font-family: "DM Serif Display", "Iowan Old Style", "Times New Roman", serif;
        }
        .kiasma-body {
          font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
        }
        .kiasma-body .bg-gray-50 {
          background-color: rgba(246, 241, 233, 0.7);
        }
        .kiasma-body .bg-white {
          background-color: rgba(255, 255, 255, 0.9);
        }
        .kiasma-body .border-gray-200 {
          border-color: rgba(148, 163, 184, 0.45);
        }
        .kiasma-body .text-gray-900 {
          color: #1b1f24;
        }
        .kiasma-body .text-gray-700 {
          color: #334155;
        }
        .kiasma-body .text-gray-600 {
          color: #475569;
        }
        .kiasma-body .text-gray-500 {
          color: #64748b;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(15,106,110,0.12),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(178,115,75,0.12),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(15,106,110,0.08),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(120deg,rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />
      {/* Sidebar */}
      <NewSidebar />

      {/* Main Content Area - Dynamic margin based on collapse state */}
      <div className={`
        relative z-10 flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out kiasma-body
        ${isCollapsed ? 'lg:ml-0' : 'lg:ml-0'}
      `}>
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}
