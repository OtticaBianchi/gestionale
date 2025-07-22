// src/components/LoadingFallback.tsx
import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingFallback({ 
  message = 'Caricamento...', 
  size = 'md' 
}: LoadingFallbackProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8'
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] space-y-3">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

// ATTENZIONE: Questi fallback NON devono mostrare dati stale!
export function KanbanLoadingFallback() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 min-h-[400px]">
      <LoadingFallback message="Caricamento Kanban..." size="lg" />
    </div>
  );
}

export function FormLoadingFallback() {
  return <LoadingFallback message="Caricamento modulo..." />;
}

export function TabLoadingFallback() {
  return <LoadingFallback message="Caricamento contenuto..." />;
}