// app/dashboard/_components/BustaCard.tsx

import { Database } from '@/types/database.types';
import { Clock, AlertTriangle, Euro } from 'lucide-react';
import Link from 'next/link';
import { BustaWithCliente, OrdineMaterialeEssenziale, RataPagamentoEssenziale } from '@/types/shared.types';

interface BustaCardProps {
  busta: BustaWithCliente;
}

// Funzione helper per calcolare i giorni passati dall'apertura
const calculateDaysOpen = (dataApertura: string) => {
  const openDate = new Date(dataApertura);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - openDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Funzione helper per ottenere SOLO sigle con emoji
const getTipoLavorazioneSigla = (tipo: string | null) => {
  const tipiLavorazione: { [key: string]: string } = {
    'OCV': '👓 OCV',
    'OV': '👓 OV', 
    'OS': '🕶️ OS',
    'LV': '🔍 LV',
    'LS': '🌅 LS',
    'LAC': '👁️ LAC',
    'ACC': '🔧 ACC',
    'RIC': '🔄 RIC',
    'RIP': '🔨 RIP',
    'SA': '📐 SA',
    'SG': '🧵 SG',
    'CT': '👁️ CT',
    'ES': '🔬 ES',
    'REL': '📋 REL',
    'FT': '🧾 FT'
  };
  
  return tipo ? tipiLavorazione[tipo] || tipo : '❓ ---';
};

// Funzione per ottenere emoji stato ordine
const getStatoOrdineEmoji = (stato: string | null) => {
  const stati = {
    'da_ordinare': '🛒',
    'ordinato': '📦',
    'in_arrivo': '🚚',
    'in_ritardo': '⏰',
    'accettato_con_riserva': '🔄',
    'rifiutato': '❌',
    'consegnato': '✅'
  };
  
  return stati[(stato || 'ordinato') as keyof typeof stati] || '📦';
};

// Funzione per calcolare il livello di criticità dei ritardi
const getDelayLevel = (ordini: OrdineMaterialeEssenziale[]) => {
  const ritardi = ordini.filter(o => (o.stato || 'ordinato') === 'in_ritardo').length;
  const rifiutati = ordini.filter(o => (o.stato || 'ordinato') === 'rifiutato').length;
  
  if (rifiutati > 0) return 'critical'; // Rosso per rifiutati
  if (ritardi >= 2) return 'severe'; // Rosso per molti ritardi
  if (ritardi === 1) return 'warning'; // Giallo per un ritardo
  return 'none';
};

// ✅ FIX: Funzione per verificare rate in scadenza - GESTISCE NULL
const getPaymentAlerts = (rate: RataPagamentoEssenziale[], isSaldato: boolean | null) => {
  // ✅ FIX: Gestisce null per is_saldato
  if ((isSaldato === true) || !rate || rate.length === 0) return null;
  
  const oggi = new Date();
  
  // ✅ FIX: Verifica rate scadute - gestisce null
  const rateScadute = rate.filter(rata => {
    const scadenza = new Date(rata.data_scadenza);
    // ✅ Usa confronto esplicito per gestire null
    return !(rata.is_pagata === true) && (rata.reminder_attivo === true) && oggi > scadenza;
  });
  
  // ✅ FIX: Verifica rate in scadenza - gestisce null
  const rateInScadenza = rate.filter(rata => {
    const scadenza = new Date(rata.data_scadenza);
    const giorniAllaScadenza = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
    // ✅ Usa confronto esplicito per gestire null
    return !(rata.is_pagata === true) && (rata.reminder_attivo === true) && giorniAllaScadenza <= 7 && giorniAllaScadenza >= 0;
  });
  
  if (rateScadute.length > 0) {
    return {
      type: 'scaduta',
      message: `${rateScadute.length} rata${rateScadute.length > 1 ? 'e' : ''} scaduta${rateScadute.length > 1 ? 'e' : ''}`,
      color: 'bg-red-100 text-red-700',
      icon: '🔴'
    };
  }
  
  if (rateInScadenza.length > 0) {
    const prossima = rateInScadenza.sort((a, b) => 
      new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime()
    )[0];
    const scadenza = new Date(prossima.data_scadenza);
    const giorni = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      type: 'in_scadenza',
      message: giorni === 0 ? 'Rata oggi' : `Rata tra ${giorni} gg`,
      color: 'bg-yellow-100 text-yellow-700',
      icon: '🟡'
    };
  }
  
  return null;
};

export default function BustaCard({ busta }: BustaCardProps) {
  const daysOpen = calculateDaysOpen(busta.data_apertura);
  const cliente = busta.clienti;
  const ordini = busta.ordini_materiali || [];
  const rate = busta.rate_pagamenti || [];
  const infoPagamenti = busta.info_pagamenti;

  // Ordina prodotti: stati critici prima, poi per descrizione
  const ordiniOrdinati = [...ordini].sort((a, b) => {
    const statoA = a.stato || 'ordinato';
    const statoB = b.stato || 'ordinato';
    
    // Priorità: rifiutato > in_ritardo > altri stati
    const priorita = { 'rifiutato': 3, 'in_ritardo': 2 };
    const prioA = priorita[statoA as keyof typeof priorita] || 1;
    const prioB = priorita[statoB as keyof typeof priorita] || 1;
    
    if (prioA !== prioB) return prioB - prioA; // Ordine decrescente
    return a.descrizione_prodotto.localeCompare(b.descrizione_prodotto);
  });

  const delayLevel = getDelayLevel(ordini);
  // ✅ FIX: Passa is_saldato anche se null
  const paymentAlert = getPaymentAlerts(rate, infoPagamenti?.is_saldato || null);
  
  const priorityStyles = {
    normale: 'border-l-gray-400',
    urgente: 'border-l-orange-500',
    critica: 'border-l-red-600',
  };

  // Indicatore criticità per ritardi
  const delayIndicator = {
    'none': null,
    'warning': <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    'severe': <AlertTriangle className="h-4 w-4 text-red-500" />,
    'critical': <AlertTriangle className="h-4 w-4 text-red-600" />
  };

  return (
    <Link href={`/dashboard/buste/${busta.id}`}>
      <div 
        data-busta-id={busta.id}
        className={`
          bg-white rounded-lg shadow-sm p-4 mb-3 border-l-4 min-h-[180px]
          hover:shadow-lg hover:-translate-y-2 hover:border-blue-400 transition-all cursor-pointer
          ${priorityStyles[busta.priorita]}
          ${busta.is_suspended ? 'bg-gray-50 opacity-90' : ''}
        `}
      >
        {/* Header con ID, priorità e indicatori critici */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-600">{busta.readable_id}</span>
            
            {/* Indicatori stato */}
            {busta.is_suspended && (
              <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                SOSPESA
              </span>
            )}
            
            {/* ✅ NUOVO: Alert rate pagamento */}
            {paymentAlert && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${paymentAlert.color}`}>
                <Euro className="h-3 w-3 inline mr-1" />
                {paymentAlert.message}
              </span>
            )}
            
            {/* Indicatore ritardi/problemi materiali */}
            {delayIndicator[delayLevel]}
          </div>
          
          {/* Badge priorità (solo se non normale) */}
          {busta.priorita !== 'normale' && (
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
              busta.priorita === 'critica' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {busta.priorita.toUpperCase()}
            </span>
          )}
        </div>

        {/* Nome cliente */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {cliente ? `${cliente.cognome} ${cliente.nome}` : 'Cliente non specificato'}
          </h3>
        </div>

        {/* Tipo lavorazione - SOLO SIGLA */}
        <div className="mb-3">
          <p className="text-sm text-gray-700 font-medium">
            {getTipoLavorazioneSigla(busta.tipo_lavorazione)}
          </p>
        </div>

        {/* PRODOTTI ORDINATI - Solo descrizione + emoji stato */}
        <div className="mb-3 flex-1">
          {ordini.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nessun prodotto ordinato</p>
          ) : (
            <div className="space-y-2">
              {ordiniOrdinati.slice(0, 3).map((ordine) => { // Max 3 prodotti
                const statoEmoji = getStatoOrdineEmoji(ordine.stato);
                return (
                  <div key={ordine.id} className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">{statoEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-900 leading-tight" title={ordine.descrizione_prodotto}>
                        {ordine.descrizione_prodotto.length > 50 
                          ? `${ordine.descrizione_prodotto.substring(0, 50)}...`
                          : ordine.descrizione_prodotto
                        }
                      </p>
                      {ordine.note && (
                        <p className="text-xs text-gray-500 italic mt-1" title={ordine.note}>
                          "{ordine.note.length > 30 ? `${ordine.note.substring(0, 30)}...` : ordine.note}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {ordini.length > 3 && (
                <p className="text-xs text-gray-500 italic pl-6">
                  +{ordini.length - 3} altri prodotti...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer con giorni aperti e info pagamento */}
        <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>{daysOpen} giorni</span>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {/* Info veloce ordini se presenti */}
            {ordini.length > 0 && (
              <span>{ordini.length} prodott{ordini.length === 1 ? 'o' : 'i'}</span>
            )}
            
            {/* ✅ NUOVO: Status pagamento */}
            {infoPagamenti && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                infoPagamenti.is_saldato === true
                  ? 'bg-green-100 text-green-700' 
                  : infoPagamenti.modalita_saldo === 'saldo_unico'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {infoPagamenti.is_saldato === true ? '✅ Saldato' : 
                 infoPagamenti.modalita_saldo === 'saldo_unico' ? '💰 Saldo' :
                 infoPagamenti.modalita_saldo === 'due_rate' ? '📅 2 Rate' :
                 infoPagamenti.modalita_saldo === 'tre_rate' ? '📅 3 Rate' :
                 '🏦 Finanz.'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}