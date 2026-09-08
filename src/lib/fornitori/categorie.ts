// Fonte unica di verità per le 6 categorie di fornitore su ordini_materiali.
// Nomi di tabelle/colonne verificati contro src/types/database.types.ts.
// Nota: `fornitore_id` su ordini_materiali è una colonna generica separata
// (in FORBIDDEN_FIELDS di api/ordini/[id]/route.ts), non collegata a una
// tabella fornitori_* e non fa parte di queste 6 categorie.

export type CategoriaFornitoreKey =
  | 'lenti'
  | 'lac'
  | 'montature'
  | 'sport'
  | 'lab_esterno'
  | 'accessori';

export interface FornitoreCategoriaDef {
  key: CategoriaFornitoreKey;
  tabella: string;
  colonnaFk: string;
  label: string;
}

export const FORNITORE_CATEGORIES: FornitoreCategoriaDef[] = [
  { key: 'lenti', tabella: 'fornitori_lenti', colonnaFk: 'fornitore_lenti_id', label: 'Lenti' },
  { key: 'lac', tabella: 'fornitori_lac', colonnaFk: 'fornitore_lac_id', label: 'LAC' },
  { key: 'montature', tabella: 'fornitori_montature', colonnaFk: 'fornitore_montature_id', label: 'Montature' },
  { key: 'sport', tabella: 'fornitori_sport', colonnaFk: 'fornitore_sport_id', label: 'Sport' },
  { key: 'lab_esterno', tabella: 'fornitori_lab_esterno', colonnaFk: 'fornitore_lab_esterno_id', label: 'Lab. esterno' },
  { key: 'accessori', tabella: 'fornitori_accessori', colonnaFk: 'fornitore_accessori_id', label: 'Accessori' },
];

// Frammento di select riutilizzabile per le query Supabase che fanno il join
// con tutte le tabelle fornitore.
export function buildFornitoriSelectFragment(): string {
  return FORNITORE_CATEGORIES
    .map(({ tabella }) => `${tabella}(nome, telefono, email, web_address, note, tempi_consegna_medi)`)
    .join(',\n          ');
}

type FornitoreJoinRow = {
  nome: string | null;
  telefono: string | null;
  email: string | null;
  web_address: string | null;
  note: string | null;
  tempi_consegna_medi: number | null;
} | null | undefined;

export interface FornitoreAttivo {
  nome: string | null;
  tipo: CategoriaFornitoreKey | null;
  telefono: string | null;
  email: string | null;
  web_address: string | null;
  note: string | null;
  tempi_medi: number | null;
}

// Data una riga ordine con i join fornitore già caricati, ritorna il fornitore
// "attivo" (il primo non-null tra le 6 categorie) con tipo e dati di contatto.
export function resolveFornitoreAttivo(ordine: Record<string, any>): FornitoreAttivo | null {
  for (const categoria of FORNITORE_CATEGORIES) {
    const fornitore = ordine?.[categoria.tabella] as FornitoreJoinRow;
    if (fornitore?.nome) {
      return {
        nome: fornitore.nome,
        tipo: categoria.key,
        telefono: fornitore.telefono ?? null,
        email: fornitore.email ?? null,
        web_address: fornitore.web_address ?? null,
        note: fornitore.note ?? null,
        tempi_medi: fornitore.tempi_consegna_medi ?? null,
      };
    }
  }
  return null;
}
