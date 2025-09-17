'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  isCollapsed: boolean;
}

export default function SidebarSection({
  title,
  icon: Icon,
  children,
  isCollapsed
}: SidebarSectionProps) {
  return (
    <div className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center space-x-2 px-2">
        <Icon className="h-4 w-4 text-gray-500" />
        {!isCollapsed && (
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </h3>
        )}
      </div>

      {/* Section Items */}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}