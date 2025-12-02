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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <NewSidebar />

      {/* Main Content Area - Dynamic margin based on collapse state */}
      <div className={`
        flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out
        ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
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