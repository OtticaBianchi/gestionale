// ===== FILE: _components/PrintBustaButton.tsx =====

import React from 'react';
import { Printer } from 'lucide-react';

// ===== TYPES =====
interface PrintBustaButtonProps {
  bustaData: {
    readable_id?: string | null;
    cliente_nome: string;
    cliente_cognome: string;
    tipo_lavorazione: string | null;
    data_apertura?: string | null;
  };
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ===== UTILITY FUNCTION =====
const getTipoLavorazioneFull = (tipo: string | null): string => {
  if (!tipo) return 'DA SPECIFICARE';
  
  const tipiLavorazione: { [key: string]: string } = {
    'OCV': 'OCCHIALI DA VISTA COMPLETI',
    'OV': 'OCCHIALI DA VISTA',
    'OS': 'OCCHIALI DA SOLE',
    'LV': 'LENTI DA VISTA',
    'LS': 'LENTI DA SOLE',
    'LAC': 'LENTI A CONTATTO',
    'ACC': 'ACCESSORI',
    'RIC': 'RICAMBIO',
    'RIP': 'RIPARAZIONE',
    'SA': 'SAGOMATURA',
    'SG': 'STRINGATURA',
    'CT': 'CONTROLLO VISTA',
    'ES': 'ESAME SPECIALISTICO',
    'REL': 'RELAZIONE',
    'FT': 'FATTURA',
    'SPRT': 'SPORT'
};
  
return tipiLavorazione[tipo] || tipo.toUpperCase();
};

// ===== MAIN COMPONENT =====
const PrintBustaButton: React.FC<PrintBustaButtonProps> = ({ 
bustaData, 
disabled = false, 
size = 'md',
className = ''
}) => {

// ===== STAMPA DIRETTA SENZA POPUP - MOLTO MEGLIO! =====
const handlePrint = () => {
  // Validazione base
  if (!bustaData.cliente_nome || !bustaData.cliente_cognome) {
    alert('Nome e cognome sono obbligatori per la stampa');
    return;
  }

  try {
    // ✅ CREA ELEMENTO IFRAME NASCOSTO PER STAMPA DIRETTA
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.left = '-10000px';
    printFrame.style.top = '-10000px';
    printFrame.style.width = '0px';
    printFrame.style.height = '0px';
    printFrame.style.border = 'none';
    
    document.body.appendChild(printFrame);

    // ✅ CONTENUTO HTML PULITO E SICURO
    const printContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Busta ${bustaData.readable_id || 'NUOVA'}</title>
<style>
@page { margin: 10mm; size: A4 landscape; }
* { box-sizing: border-box; }
body { 
font-family: Arial, sans-serif; 
font-size: 12px; 
line-height: 1.3;
margin: 0;
padding: 0;
background: white;
}
.busta-info {
background: #f8f9fa;
padding: 15px;
border: 2px solid #333;
margin-bottom: 20px;
display: grid;
grid-template-columns: 1fr 1fr;
gap: 20px;
}
.busta-numero {
font-size: 48px;
font-weight: bold;
margin: 0 0 8px 0;
}
.cliente-nome {
font-size: 36px;
font-weight: bold;
margin: 0 0 6px 0;
}
.lavorazione {
font-size: 18px;
font-weight: bold;
color: #0066cc;
}
.data-apertura {
font-size: 20px;
color: #666;
margin: 4px 0 0 0;
}
.content-grid {
display: grid;
grid-template-columns: 1.2fr 0.8fr;
gap: 20px;
}
.note-section, .checklist {
padding: 15px;
border: 1px solid #ddd;
}
.note-section h3, .checklist h3 {
font-size: 14px;
font-weight: bold;
margin: 0 0 12px 0;
border-bottom: 1px solid #ddd;
padding-bottom: 4px;
}
.note-line {
border-bottom: 1px solid #ccc;
height: 18px;
margin-bottom: 4px;
}
.checklist-item {
display: flex;
align-items: center;
gap: 8px;
font-size: 11px;
margin-bottom: 8px;
}
.checkbox {
width: 14px;
height: 14px;
border: 2px solid #000;
flex-shrink: 0;
}
.footer {
margin-top: 15px;
padding-top: 10px;
border-top: 1px solid #ccc;
text-align: center;
font-size: 9px;
color: #666;
}
@media print { 
body { print-color-adjust: exact; }
.no-print { display: none; }
}
</style>
</head>
<body>
<div class="busta-info">
<div>
  <div class="busta-numero">#${bustaData.readable_id || 'NUOVA'}</div>
  <div class="data-apertura">Apertura: ${bustaData.data_apertura ? new Date(bustaData.data_apertura).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT')}</div>
</div>
<div style="text-align: right;">
  <div class="cliente-nome">${bustaData.cliente_cognome.toUpperCase()} ${bustaData.cliente_nome.toUpperCase()}</div>
  <div class="lavorazione">${getTipoLavorazioneFull(bustaData.tipo_lavorazione)}</div>
</div>
</div>
<div class="content-grid">
<div class="note-section">
  <h3>NOTE E APPUNTI</h3>
  ${Array.from({ length: 12 }, () => '<div class="note-line"></div>').join('')}
</div>
<div class="checklist">
  <h3>CHECKLIST</h3>
  <div class="checklist-item"><div class="checkbox"></div><span>Prescrizione medica</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Montatura scelta</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Lenti ordinate</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Misure prese</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Acconto versato</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Documenti allegati</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Data consegna</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Controllo finale</span></div>
</div>
</div>
<div class="footer">
<p>Documento interno - Stampato il ${new Date().toLocaleString('it-IT')}</p>
</div>
</body>
</html>`;

    // ✅ SCRIVE CONTENUTO NELL'IFRAME
    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(printContent);
      frameDoc.close();

      // ✅ STAMPA DIRETTA APPENA IL CONTENUTO È CARICATO
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          
          // ✅ RIMUOVE L'IFRAME DOPO LA STAMPA
          setTimeout(() => {
            if (printFrame.parentNode) {
              document.body.removeChild(printFrame);
            }
          }, 1000);
          
        } catch (printError) {
          console.warn('Errore durante la stampa:', printError);
          // Rimuovi iframe anche in caso di errore
          if (printFrame.parentNode) {
            document.body.removeChild(printFrame);
          }
        }
      }, 500);
    }

  } catch (error) {
    console.error('❌ Errore stampa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    alert('Errore durante la stampa: ' + errorMessage);
  }
};

// ===== BUTTON STYLES =====
const getSizeClasses = () => {
  switch (size) {
    case 'sm':
      return 'px-2 py-1 text-xs';
    case 'lg':
      return 'px-4 py-2 text-base';
    default:
      return 'px-3 py-1.5 text-sm';
  }
};

const canPrint = bustaData.cliente_nome && bustaData.cliente_cognome;
const isDisabled = disabled || !canPrint;

return (
  <button
    onClick={handlePrint}
    disabled={isDisabled}
    className={`
      flex items-center space-x-2 
      ${getSizeClasses()}
      ${isDisabled 
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
      }
      rounded-md transition-colors font-medium
      ${className}
    `}
    title={!canPrint ? 'Inserisci nome e cognome per abilitare la stampa' : 'Stampa template busta'}
  >
    <Printer className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />
    <span>Stampa</span>
  </button>
);
};

export default PrintBustaButton;