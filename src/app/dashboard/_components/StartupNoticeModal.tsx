'use client';

import { useState } from 'react';

export default function StartupNoticeModal() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return sessionStorage.getItem('startup_notice_dismissed') !== '1';
    } catch {
      return true;
    }
  });

  if (!isOpen) return null;

  const handleClose = () => {
    try {
      sessionStorage.setItem('startup_notice_dismissed', '1');
    } catch {
      // Ignore storage errors and just close the modal for this render.
    }
    setIsOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-notice-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.55)]">
        <h2 id="startup-notice-title" className="kiasma-hero text-xl text-[var(--ink)]">
          Avviso importante
        </h2>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p>
            Il programma è ancora in via di sviluppo, quindi solo chi è stato autorizzato dai responsabili può
            utilizzarlo.
          </p>
          <p>
            Chi non è stato autorizzato può comunque esplorare il programma, vedere cosa c&apos;è dentro e leggere ciò che
            è stato inserito, così da iniziare a prendere confidenza.
          </p>
          <p>
            Non appena saremo operativi, organizzeremo una mattina di formazione dove spiegheremo a tutti l&apos;utilizzo
            appropriato.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-[var(--paper)] transition-colors hover:bg-black"
          >
            Ho capito
          </button>
        </div>
      </div>
    </div>
  );
}
