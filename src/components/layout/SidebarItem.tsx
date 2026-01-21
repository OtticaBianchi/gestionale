'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  href?: string;
  icon: LucideIcon;
  label: string;
  isCollapsed: boolean;
  disabled?: boolean;
  disabledTooltip?: string; // Tooltip text for disabled items
  badge?: string;
  className?: string;
  badgeVariant?: 'red' | 'blue' | 'amber' | 'gray';
  onClick?: () => void; // Optional click handler - renders as button when provided
}

export default function SidebarItem({
  href,
  icon: Icon,
  label,
  isCollapsed,
  disabled = false,
  disabledTooltip,
  badge,
  className = '',
  badgeVariant = 'red',
  onClick
}: SidebarItemProps) {
  const pathname = usePathname();
  // For /dashboard, only match exactly. For others, match if pathname starts with href
  const isActive = href && href !== '#'
    ? href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href)
    : false;

  const baseClasses = `
    relative flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
    ${isCollapsed ? 'justify-center' : 'justify-start'}
  `;

  const stateClasses = disabled
    ? 'text-gray-400 cursor-not-allowed opacity-50 font-medium'
    : isActive
    ? '!bg-blue-600 !text-white !font-bold !shadow-md hover:!bg-blue-700'
    : 'text-gray-700 font-medium hover:bg-gray-100 hover:text-gray-900';

  const badgeClasses: Record<NonNullable<SidebarItemProps['badgeVariant']>, string> = {
    red: 'bg-red-500 text-white',
    blue: 'bg-blue-600 text-white',
    amber: 'bg-amber-500 text-white',
    gray: 'bg-gray-500 text-white'
  };

  const badgeColorClass = badgeClasses[badgeVariant] || badgeClasses.red;

  const itemContent = (
    <>
      <div className="relative flex items-center justify-center">
        <Icon className={`h-5 w-5 ${isCollapsed ? '' : 'flex-shrink-0'}`} />
        {badge && (
          <span className={`absolute -top-1 -right-1 ${badgeColorClass} text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold text-[10px]`}>
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
        <div className={`absolute left-full ml-2 ${badgeColorClass} text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold`}>
          {badge}
        </div>
      )}
    </>
  );

  if (disabled) {
    return (
      <div
        className={`${className} ${baseClasses} ${stateClasses}`}
        title={disabledTooltip || (isCollapsed ? label : "Modulo in sviluppo")}
      >
        {itemContent}
      </div>
    );
  }

  // Render as button when onClick is provided
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} ${baseClasses} ${stateClasses} w-full`}
        title={isCollapsed ? label : undefined}
      >
        {itemContent}
      </button>
    );
  }

  return (
    <Link
      href={href || '#'}
      className={`${className} ${baseClasses} ${stateClasses}`}
      style={isActive ? {
        backgroundColor: '#2563eb',
        color: 'white',
        fontWeight: 'bold',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      } : undefined}
      title={isCollapsed ? label : undefined}
    >
      {itemContent}
    </Link>
  );
}
