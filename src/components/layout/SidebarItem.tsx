'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isCollapsed: boolean;
  disabled?: boolean;
  badge?: string;
  className?: string;
}

export default function SidebarItem({
  href,
  icon: Icon,
  label,
  isCollapsed,
  disabled = false,
  badge,
  className = ''
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const baseClasses = `
    relative flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
    ${isCollapsed ? 'justify-center' : 'justify-start'}
  `;

  const stateClasses = disabled
    ? 'text-gray-400 cursor-not-allowed opacity-50'
    : isActive
    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900';

  const itemContent = (
    <>
      <div className="relative flex items-center justify-center">
        <Icon className={`h-5 w-5 ${isCollapsed ? '' : 'flex-shrink-0'}`} />
        {badge && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold text-[10px]">
            {badge}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <span className="truncate">
          {label}
        </span>
      )}
      {isCollapsed && badge && (
        <div className="absolute left-full ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
          {badge}
        </div>
      )}
    </>
  );

  if (disabled) {
    return (
      <div className={`${baseClasses} ${stateClasses} ${className}`} title={isCollapsed ? label : undefined}>
        {itemContent}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${baseClasses} ${stateClasses} ${className}`}
      title={isCollapsed ? label : undefined}
    >
      {itemContent}
    </Link>
  );
}