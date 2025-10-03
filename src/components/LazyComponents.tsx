// src/components/LazyComponents.tsx
import { lazy } from 'react';

// ATTENZIONE: NON lazy load per componenti con stato critico!
// KanbanBoard NON è qui perché gestisce stato SWR importante

// ✅ SICURI da lazy load (no stato critico)
// VoiceRecorder non esiste ancora - lo aggiungeremo se necessario

// ✅ Tabs - sicuri perché ricaricano dati sempre fresh  
export const LazyMaterialiTab = lazy(() => import('@/app/dashboard/buste/[id]/_components/tabs/MaterialiTab'));
export const LazyLavorazioneTab = lazy(() => import('@/app/dashboard/buste/[id]/_components/tabs/LavorazioneTab'));
export const LazyNotificheTab = lazy(() => import('@/app/dashboard/buste/[id]/_components/tabs/NotificheTab'));

// ✅ Pagine specializzate - sicure perché non in dashboard principale
// PWA voice interface removed - using Telegram bot instead
export const LazyRicercaAvanzataPage = lazy(() => import('@/app/dashboard/ricerca-avanzata/page'));
// LazyFiltriOrdiniPage removed - replaced by /modules/operations (Oct 2025)

// 🚫 NON INCLUDERE:
// - KanbanBoard (stato SWR critico)
// - MultiStepBustaForm (stato form importante)
// - Qualsiasi componente che gestisce cache/stato condiviso