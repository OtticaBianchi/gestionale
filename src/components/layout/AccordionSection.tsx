'use client';

import { ReactNode, useState, useEffect } from 'react';
import { LucideIcon, ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  isCollapsed: boolean;
  defaultOpen?: boolean;
  storageKey?: string; // Key for localStorage to remember state
}

export default function AccordionSection({
  title,
  icon: Icon,
  children,
  isCollapsed,
  defaultOpen = false,
  storageKey
}: AccordionSectionProps) {
  // Initialize state from localStorage if available
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) return defaultOpen;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultOpen;
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, String(isOpen));
    }
  }, [isOpen, storageKey]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="space-y-1">
      {/* Section Header - Clickable */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors group"
      >
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-700">
              {title}
            </h3>
          )}
        </div>
        {!isCollapsed && (
          isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          )
        )}
      </button>

      {/* Section Items - Collapsible */}
      {isOpen && !isCollapsed && (
        <div className="space-y-1 pl-2">
          {children}
        </div>
      )}

      {/* If sidebar is collapsed, show all items */}
      {isCollapsed && (
        <div className="space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
