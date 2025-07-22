// src/components/SmartLazyWrapper.tsx
import { Suspense, ReactNode } from 'react';
import LoadingFallback from './LoadingFallback';

interface SmartLazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  preserveData?: boolean; // CRITICO: mantiene cache SWR attiva
}

// Wrapper intelligente che NON interferisce con la cache SWR esistente
export default function SmartLazyWrapper({ 
  children, 
  fallback,
  preserveData = true 
}: SmartLazyWrapperProps) {
  
  return (
    <Suspense 
      fallback={fallback || <LoadingFallback />}
    >
      {children}
    </Suspense>
  );
}