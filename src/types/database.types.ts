export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      buste: {
        Row: {
          cliente_id: string | null
          creato_da: string | null
          data_apertura: string
          data_consegna_prevista: string | null
          data_completamento_consegna: string | null
          data_selezione_consegna: string | null
          id: string
          is_suspended: boolean
          metodo_consegna: Database["public"]["Enums"]["metodo_consegna"] | null
          modo_avviso_id: number | null
          note_generali: string | null
          priorita: Database["public"]["Enums"]["job_priority"]
          readable_id: string | null
          stato_attuale: Database["public"]["Enums"]["job_status"]
          stato_consegna: Database["public"]["Enums"]["stato_consegna"] | null
          tipo_lavorazione: Database["public"]["Enums"]["work_type"] | null
          tipo_lavorazione_codice: string | null
          tipo_montaggio_id: number | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          creato_da?: string | null
          data_apertura?: string
          data_consegna_prevista?: string | null
          data_completamento_consegna?: string | null
          data_selezione_consegna?: string | null
          id?: string
          is_suspended?: boolean
          metodo_consegna?: Database["public"]["Enums"]["metodo_consegna"] | null
          modo_avviso_id?: number | null
          note_generali?: string | null
          priorita?: Database["public"]["Enums"]["job_priority"]
          readable_id?: string | null
          stato_attuale?: Database["public"]["Enums"]["job_status"]
          stato_consegna?: Database["public"]["Enums"]["stato_consegna"] | null
          tipo_lavorazione?: Database["public"]["Enums"]["work_type"] | null
          tipo_lavorazione_codice?: string | null
          tipo_montaggio_id?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          creato_da?: string | null
          data_apertura?: string
          data_consegna_prevista?: string | null
          data_completamento_consegna?: string | null
          data_selezione_consegna?: string | null
          id?: string
          is_suspended?: boolean
          metodo_consegna?: Database["public"]["Enums"]["metodo_consegna"] | null
          modo_avviso_id?: number | null
          note_generali?: string | null
          priorita?: Database["public"]["Enums"]["job_priority"]
          readable_id?: string | null
          stato_attuale?: Database["public"]["Enums"]["job_status"]
          stato_consegna?: Database["public"]["Enums"]["stato_consegna"] | null
          tipo_lavorazione?: Database["public"]["Enums"]["work_type"] | null
          tipo_lavorazione_codice?: string | null
          tipo_montaggio_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buste_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_modo_avviso_id_fkey"
            columns: ["modo_avviso_id"]
            isOneToOne: false
            referencedRelation: "modi_avviso_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_tipo_lavorazione_codice_fkey"
            columns: ["tipo_lavorazione_codice"]
            isOneToOne: false
            referencedRelation: "tipi_lavorazione"
            referencedColumns: ["codice"]
          },
          {
            foreignKeyName: "buste_tipo_montaggio_id_fkey"
            columns: ["tipo_montaggio_id"]
            isOneToOne: false
            referencedRelation: "tipi_montaggio"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          cognome: string
          created_at: string | null
          data_nascita: string | null
          email: string | null
          genere: string | null
          id: string
          nome: string
          note_cliente: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          cognome: string
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          genere?: string | null
          id?: string
          nome: string
          note_cliente?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          cognome?: string
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          genere?: string | null
          id?: string
          nome?: string
          note_cliente?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comunicazioni: {
        Row: {
          busta_id: string
          canale_invio: string | null
          created_at: string | null
          data_invio: string
          destinatario_contatto: string | null
          destinatario_nome: string
          destinatario_tipo: string
          id: string
          inviato_da: string
          nome_operatore: string
          stato_invio: string | null
          testo_messaggio: string
          tipo_messaggio: string
          updated_at: string | null
        }
        Insert: {
          busta_id: string
          canale_invio?: string | null
          created_at?: string | null
          data_invio?: string
          destinatario_contatto?: string | null
          destinatario_nome: string
          destinatario_tipo: string
          id?: string
          inviato_da: string
          nome_operatore: string
          stato_invio?: string | null
          testo_messaggio: string
          tipo_messaggio: string
          updated_at?: string | null
        }
        Update: {
          busta_id?: string
          canale_invio?: string | null
          created_at?: string | null
          data_invio?: string
          destinatario_contatto?: string | null
          destinatario_nome?: string
          destinatario_tipo?: string
          id?: string
          inviato_da?: string
          nome_operatore?: string
          stato_invio?: string | null
          testo_messaggio?: string
          tipo_messaggio?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
        ]
      }
      fornitori_lab_esterno: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          referente_nome: string | null
          note: string | null
          telefono: string | null
          tempi_consegna_medi: number | null
          web_address: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          web_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          web_address?: string | null
        }
        Relationships: []
      }
      fornitori_lac: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          referente_nome: string | null
          note: string | null
          telefono: string | null
          tempi_consegna_medi: number | null
          updated_at: string | null
          web_address: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Relationships: []
      }
      fornitori_lenti: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          referente_nome: string | null
          note: string | null
          telefono: string | null
          tempi_consegna_medi: number | null
          updated_at: string | null
          web_address: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Relationships: []
      }
      fornitori_montature: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          referente_nome: string | null
          note: string | null
          telefono: string | null
          tempi_consegna_medi: number | null
          updated_at: string | null
          web_address: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Relationships: []
      }
      fornitori_sport: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          referente_nome: string | null
          note: string | null
          telefono: string | null
          tempi_consegna_medi: number | null
          updated_at: string | null
          web_address: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          referente_nome?: string | null
          note?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Relationships: []
      }
      info_pagamenti: {
        Row: {
          busta_id: string
          created_at: string | null
          data_acconto: string | null
          data_saldo: string | null
          ha_acconto: boolean | null
          id: string
          importo_acconto: number | null
          is_saldato: boolean | null
          modalita_saldo: string
          note_pagamento: string | null
          prezzo_finale: number | null
          updated_at: string | null
        }
        Insert: {
          busta_id: string
          created_at?: string | null
          data_acconto?: string | null
          data_saldo?: string | null
          ha_acconto?: boolean | null
          id?: string
          importo_acconto?: number | null
          is_saldato?: boolean | null
          modalita_saldo?: string
          note_pagamento?: string | null
          prezzo_finale?: number | null
          updated_at?: string | null
        }
        Update: {
          busta_id?: string
          created_at?: string | null
          data_acconto?: string | null
          data_saldo?: string | null
          ha_acconto?: boolean | null
          id?: string
          importo_acconto?: number | null
          is_saldato?: boolean | null
          modalita_saldo?: string
          note_pagamento?: string | null
          prezzo_finale?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "info_pagamenti_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: true
          referencedRelation: "buste"
          referencedColumns: ["id"]
        },
      ]
      }
      payment_installments: {
        Row: {
          id: string
          payment_plan_id: string
          installment_number: number
          due_date: string
          expected_amount: number | null
          paid_amount: number | null
          is_completed: boolean
          reminder_3_days_sent: boolean
          reminder_10_days_sent: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          payment_plan_id: string
          installment_number: number
          due_date: string
          expected_amount?: number | null
          paid_amount?: number | null
          is_completed?: boolean
          reminder_3_days_sent?: boolean
          reminder_10_days_sent?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          payment_plan_id?: string
          installment_number?: number
          due_date?: string
          expected_amount?: number | null
          paid_amount?: number | null
          is_completed?: boolean
          reminder_3_days_sent?: boolean
          reminder_10_days_sent?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          id: string
          busta_id: string
          total_amount: number | null
          acconto: number | null
          payment_type: string
          auto_reminders_enabled: boolean | null
          reminder_preference: string | null
          is_completed: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          busta_id: string
          total_amount?: number | null
          acconto?: number | null
          payment_type: string
          auto_reminders_enabled?: boolean | null
          reminder_preference?: string | null
          is_completed?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          busta_id?: string
          total_amount?: number | null
          acconto?: number | null
          payment_type?: string
          auto_reminders_enabled?: boolean | null
          reminder_preference?: string | null
          is_completed?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: true
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
        ]
      }
      lavorazioni: {
        Row: {
          busta_id: string
          created_at: string
          data_completamento: string | null
          data_fallimento: string | null
          data_inizio: string
          id: string
          note: string | null
          responsabile_id: string
          stato: string
          tentativo: number
          tipo_montaggio_id: number
          updated_at: string
        }
        Insert: {
          busta_id: string
          created_at?: string
          data_completamento?: string | null
          data_fallimento?: string | null
          data_inizio?: string
          id?: string
          note?: string | null
          responsabile_id: string
          stato?: string
          tentativo?: number
          tipo_montaggio_id: number
          updated_at?: string
        }
        Update: {
          busta_id?: string
          created_at?: string
          data_completamento?: string | null
          data_fallimento?: string | null
          data_inizio?: string
          id?: string
          note?: string | null
          responsabile_id?: string
          stato?: string
          tentativo?: number
          tipo_montaggio_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lavorazioni_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavorazioni_tipo_montaggio_id_fkey"
            columns: ["tipo_montaggio_id"]
            isOneToOne: false
            referencedRelation: "tipi_montaggio"
            referencedColumns: ["id"]
          },
        ]
      }
      materiali: {
        Row: {
          busta_id: string
          codice_prodotto: string | null
          costo: number | null
          created_at: string | null
          fornitore: string | null
          fornitore_id: string | null
          id: string
          note: string | null
          primo_acquisto_lac: boolean | null
          stato: string | null
          tipo: string
          tipo_lente_id: string | null
          tipo_ordine_id: number | null
          updated_at: string | null
        }
        Insert: {
          busta_id: string
          codice_prodotto?: string | null
          costo?: number | null
          created_at?: string | null
          fornitore?: string | null
          fornitore_id?: string | null
          id?: string
          note?: string | null
          primo_acquisto_lac?: boolean | null
          stato?: string | null
          tipo: string
          tipo_lente_id?: string | null
          tipo_ordine_id?: number | null
          updated_at?: string | null
        }
        Update: {
          busta_id?: string
          codice_prodotto?: string | null
          costo?: number | null
          created_at?: string | null
          fornitore?: string | null
          fornitore_id?: string | null
          id?: string
          note?: string | null
          primo_acquisto_lac?: boolean | null
          stato?: string | null
          tipo?: string
          tipo_lente_id?: string | null
          tipo_ordine_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiali_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiali_tipo_lente_id_fkey"
            columns: ["tipo_lente_id"]
            isOneToOne: false
            referencedRelation: "tipi_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiali_tipo_ordine_id_fkey"
            columns: ["tipo_ordine_id"]
            isOneToOne: false
            referencedRelation: "tipi_ordine"
            referencedColumns: ["id"]
          },
        ]
      }
      modi_avviso_cliente: {
        Row: {
          automatizzabile: boolean | null
          created_at: string | null
          id: number
          nome: string
        }
        Insert: {
          automatizzabile?: boolean | null
          created_at?: string | null
          id?: number
          nome: string
        }
        Update: {
          automatizzabile?: boolean | null
          created_at?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      note: {
        Row: {
          allegati: Json | null
          busta_id: string
          categoria: string | null
          created_at: string | null
          id: string
          keywords: string[] | null
          testo: string
          utente_id: string | null
        }
        Insert: {
          allegati?: Json | null
          busta_id: string
          categoria?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          testo: string
          utente_id?: string | null
        }
        Update: {
          allegati?: Json | null
          busta_id?: string
          categoria?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          testo?: string
          utente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordini_materiali: {
        Row: {
          alert_ritardo_inviato: boolean | null
          busta_id: string
          categoria_fornitore: string | null
          comunicazione_automatica_inviata: boolean | null
          created_at: string | null
          creato_da: string | null
          da_ordinare: boolean | null
          data_consegna_effettiva: string | null
          data_consegna_prevista: string | null
          data_ordine: string | null
          descrizione_prodotto: string
          fornitore_id: string | null
          fornitore_lab_esterno_id: string | null
          fornitore_lac_id: string | null
          fornitore_lenti_id: string | null
          fornitore_montature_id: string | null
          fornitore_sport_id: string | null
          giorni_consegna_medi: number | null
          giorni_ritardo: number | null
          id: string
          note: string | null
          stato: Database["public"]["Enums"]["ordine_status"] | null
          tipo_lenti_id: string | null
          tipo_ordine_id: number | null
          updated_at: string | null
        }
        Insert: {
          alert_ritardo_inviato?: boolean | null
          busta_id: string
          categoria_fornitore?: string | null
          comunicazione_automatica_inviata?: boolean | null
          created_at?: string | null
          creato_da?: string | null
          da_ordinare?: boolean | null
          data_consegna_effettiva?: string | null
          data_consegna_prevista: string | null
          data_ordine?: string | null
          descrizione_prodotto: string
          fornitore_id?: string | null
          fornitore_lab_esterno_id?: string | null
          fornitore_lac_id?: string | null
          fornitore_lenti_id?: string | null
          fornitore_montature_id?: string | null
          fornitore_sport_id?: string | null
          giorni_consegna_medi?: number | null
          giorni_ritardo?: number | null
          id?: string
          note?: string | null
          stato?: Database["public"]["Enums"]["ordine_status"] | null
          tipo_lenti_id?: string | null
          tipo_ordine_id?: number | null
          updated_at?: string | null
        }
        Update: {
          alert_ritardo_inviato?: boolean | null
          busta_id?: string
          categoria_fornitore?: string | null
          comunicazione_automatica_inviata?: boolean | null
          created_at?: string | null
          creato_da?: string | null
          da_ordinare?: boolean | null
          data_consegna_effettiva?: string | null
          data_consegna_prevista?: string | null
          data_ordine?: string | null
          descrizione_prodotto?: string
          fornitore_id?: string | null
          fornitore_lab_esterno_id?: string | null
          fornitore_lac_id?: string | null
          fornitore_lenti_id?: string | null
          fornitore_montature_id?: string | null
          fornitore_sport_id?: string | null
          giorni_consegna_medi?: number | null
          giorni_ritardo?: number | null
          id?: string
          note?: string | null
          stato?: Database["public"]["Enums"]["ordine_status"] | null
          tipo_lenti_id?: string | null
          tipo_ordine_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordini_materiali_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lab_esterno_id_fkey"
            columns: ["fornitore_lab_esterno_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lab_esterno"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lac_id_fkey"
            columns: ["fornitore_lac_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lac"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lenti_id_fkey"
            columns: ["fornitore_lenti_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_montature_id_fkey"
            columns: ["fornitore_montature_id"]
            isOneToOne: false
            referencedRelation: "fornitori_montature"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_sport_id_fkey"
            columns: ["fornitore_sport_id"]
            isOneToOne: false
            referencedRelation: "fornitori_sport"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_tipo_lenti_id_fkey"
            columns: ["tipo_lenti_id"]
            isOneToOne: false
            referencedRelation: "tipi_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_tipo_ordine_id_fkey"
            columns: ["tipo_ordine_id"]
            isOneToOne: false
            referencedRelation: "tipi_ordine"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string
          total_time_online_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string
          total_time_online_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string
          total_time_online_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_pagamenti: {
        Row: {
          busta_id: string
          created_at: string | null
          data_pagamento: string | null
          data_scadenza: string
          id: string
          importo_rata: number | null
          is_pagata: boolean | null
          numero_rata: number
          reminder_attivo: boolean | null
          ultimo_reminder: string | null
          updated_at: string | null
        }
        Insert: {
          busta_id: string
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza: string
          id?: string
          importo_rata?: number | null
          is_pagata?: boolean | null
          numero_rata: number
          reminder_attivo?: boolean | null
          ultimo_reminder?: string | null
          updated_at?: string | null
        }
        Update: {
          busta_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza?: string
          id?: string
          importo_rata?: number | null
          is_pagata?: boolean | null
          numero_rata?: number
          reminder_attivo?: boolean | null
          ultimo_reminder?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_pagamenti_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          busta_id: string
          data_ingresso: string
          id: number
          note_stato: string | null
          operatore_id: string | null
          stato: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          busta_id: string
          data_ingresso?: string
          id?: number
          note_stato?: string | null
          operatore_id?: string | null
          stato: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          busta_id?: string
          data_ingresso?: string
          id?: number
          note_stato?: string | null
          operatore_id?: string | null
          stato?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_history_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_operatore_id_fkey"
            columns: ["operatore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_update_logs: {
        Row: {
          id: string
          busta_id: string
          from_status: string
          to_status: string
          user_id: string
          note: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          busta_id: string
          from_status: string
          to_status: string
          user_id: string
          note?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          busta_id?: string
          from_status?: string
          to_status?: string
          user_id?: string
          note?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_update_logs_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_update_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tipi_lavorazione: {
        Row: {
          codice: string
          created_at: string | null
          descrizione: string
        }
        Insert: {
          codice: string
          created_at?: string | null
          descrizione: string
        }
        Update: {
          codice?: string
          created_at?: string | null
          descrizione?: string
        }
        Relationships: []
      }
      tipi_lenti: {
        Row: {
          created_at: string | null
          giorni_consegna_stimati: number | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          giorni_consegna_stimati?: number | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          giorni_consegna_stimati?: number | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      tipi_montaggio: {
        Row: {
          created_at: string | null
          id: number
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      tipi_ordine: {
        Row: {
          created_at: string | null
          id: number
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      follow_up_chiamate: {
        Row: {
          id: string
          busta_id: string
          data_generazione: string
          data_chiamata: string | null
          operatore_id: string | null
          stato_chiamata: string
          livello_soddisfazione: string | null
          note_chiamata: string | null
          orario_richiamata_da: string | null
          orario_richiamata_a: string | null
          data_completamento: string | null
          archiviato: boolean
          priorita: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          busta_id: string
          data_generazione?: string
          data_chiamata?: string | null
          operatore_id?: string | null
          stato_chiamata?: string
          livello_soddisfazione?: string | null
          note_chiamata?: string | null
          orario_richiamata_da?: string | null
          orario_richiamata_a?: string | null
          data_completamento?: string | null
          archiviato?: boolean
          priorita: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          busta_id?: string
          data_generazione?: string
          data_chiamata?: string | null
          operatore_id?: string | null
          stato_chiamata?: string
          livello_soddisfazione?: string | null
          note_chiamata?: string | null
          orario_richiamata_da?: string | null
          orario_richiamata_a?: string | null
          data_completamento?: string | null
          archiviato?: boolean
          priorita?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_chiamate_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_chiamate_operatore_id_fkey"
            columns: ["operatore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statistiche_follow_up: {
        Row: {
          id: string
          data_riferimento: string
          operatore_id: string | null
          chiamate_totali: number
          chiamate_completate: number
          molto_soddisfatti: number
          soddisfatti: number
          poco_soddisfatti: number
          insoddisfatti: number
          non_vuole_contatto: number
          numeri_sbagliati: number
          cellulari_staccati: number
          non_risponde: number
          da_richiamare: number
          created_at: string | null
        }
        Insert: {
          id?: string
          data_riferimento?: string
          operatore_id?: string | null
          chiamate_totali?: number
          chiamate_completate?: number
          molto_soddisfatti?: number
          soddisfatti?: number
          poco_soddisfatti?: number
          insoddisfatti?: number
          non_vuole_contatto?: number
          numeri_sbagliati?: number
          cellulari_staccati?: number
          non_risponde?: number
          da_richiamare?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          data_riferimento?: string
          operatore_id?: string | null
          chiamate_totali?: number
          chiamate_completate?: number
          molto_soddisfatti?: number
          soddisfatti?: number
          poco_soddisfatti?: number
          insoddisfatti?: number
          non_vuole_contatto?: number
          numeri_sbagliati?: number
          cellulari_staccati?: number
          non_risponde?: number
          da_richiamare?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statistiche_follow_up_operatore_id_fkey"
            columns: ["operatore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notes: {
        Row: {
          addetto_nome: string
          audio_blob: string
          busta_id: string | null
          cliente_id: string | null
          cliente_riferimento: string | null
          created_at: string | null
          dismissed_at: string | null
          duration_seconds: number | null
          file_size: number | null
          id: string
          note_aggiuntive: string | null
          processed_at: string | null
          processed_by: string | null
          stato: string
          transcription: string | null
          updated_at: string | null
        }
        Insert: {
          addetto_nome: string
          audio_blob: string
          busta_id?: string | null
          cliente_id?: string | null
          cliente_riferimento?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          note_aggiuntive?: string | null
          processed_at?: string | null
          processed_by?: string | null
          stato?: string
          transcription?: string | null
          updated_at?: string | null
        }
        Update: {
          addetto_nome?: string
          audio_blob?: string
          busta_id?: string | null
          cliente_id?: string | null
          cliente_riferimento?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          note_aggiuntive?: string | null
          processed_at?: string | null
          processed_by?: string | null
          stato?: string
          transcription?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      warning_letters: {
        Row: {
          id: string
          employee_id: string
          employee_name: string
          letter_type: "verbal" | "written" | "disciplinary"
          pdf_data: string | null
          notes: string | null
          generated_by: string | null
          generated_at: string | null
          total_errors: number
          critical_errors: number
          total_cost: number
          weekly_errors: number
          monthly_errors: number
          sent_via_email: boolean
          sent_at: string | null
          sent_to_email: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          employee_name: string
          letter_type: "verbal" | "written" | "disciplinary"
          pdf_data?: string | null
          notes?: string | null
          generated_by?: string | null
          generated_at?: string | null
          total_errors?: number
          critical_errors?: number
          total_cost?: number
          weekly_errors?: number
          monthly_errors?: number
          sent_via_email?: boolean
          sent_at?: string | null
          sent_to_email?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          employee_name?: string
          letter_type?: "verbal" | "written" | "disciplinary"
          pdf_data?: string | null
          notes?: string | null
          generated_by?: string | null
          generated_at?: string | null
          total_errors?: number
          critical_errors?: number
          total_cost?: number
          weekly_errors?: number
          monthly_errors?: number
          sent_via_email?: boolean
          sent_at?: string | null
          sent_to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warning_letters_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warning_letters_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unpredicted_cases: {
        Row: {
          id: string
          description: string
          context_category: string | null
          severity: string
          created_by: string
          created_at: string
          is_completed: boolean
          completed_at: string | null
          completed_by: string | null
          related_procedure_id: string | null
        }
        Insert: {
          id?: string
          description: string
          context_category?: string | null
          severity: string
          created_by: string
          created_at?: string
          is_completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          related_procedure_id?: string | null
        }
        Update: {
          id?: string
          description?: string
          context_category?: string | null
          severity?: string
          created_by?: string
          created_at?: string
          is_completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          related_procedure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unpredicted_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unpredicted_cases_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_suggestions: {
        Row: {
          id: string
          procedure_id: string
          title: string
          description: string
          suggested_by: string
          created_at: string
          status: string
          admin_notes: string | null
          handled_by: string | null
          handled_at: string | null
        }
        Insert: {
          id?: string
          procedure_id: string
          title: string
          description: string
          suggested_by: string
          created_at?: string
          status?: string
          admin_notes?: string | null
          handled_by?: string | null
          handled_at?: string | null
        }
        Update: {
          id?: string
          procedure_id?: string
          title?: string
          description?: string
          suggested_by?: string
          created_at?: string
          status?: string
          admin_notes?: string | null
          handled_by?: string | null
          handled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_suggestions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_suggestions_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_suggestions_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_helpfulness_votes: {
        Row: {
          id: string
          procedure_id: string
          user_id: string
          is_helpful: boolean
          voted_at: string
        }
        Insert: {
          id?: string
          procedure_id: string
          user_id: string
          is_helpful: boolean
          voted_at?: string
        }
        Update: {
          id?: string
          procedure_id?: string
          user_id?: string
          is_helpful?: boolean
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_helpfulness_votes_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_helpfulness_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_ordini_materiali_completi: {
        Row: {
          alert_ritardo_inviato: boolean | null
          busta_id: string | null
          categoria_fornitore: string | null
          comunicazione_automatica_inviata: boolean | null
          created_at: string | null
          creato_da: string | null
          data_consegna_effettiva: string | null
          data_consegna_prevista: string | null
          data_ordine: string | null
          descrizione_prodotto: string | null
          fornitore_email: string | null
          fornitore_id: string | null
          fornitore_lac_id: string | null
          fornitore_lenti_id: string | null
          fornitore_montature_id: string | null
          fornitore_nome: string | null
          fornitore_sport_id: string | null
          fornitore_telefono: string | null
          fornitore_tempi_medi: number | null
          giorni_consegna_medi: number | null
          giorni_ritardo: number | null
          id: string | null
          note: string | null
          stato: Database["public"]["Enums"]["ordine_status"] | null
          tipo_lenti_giorni: number | null
          tipo_lenti_id: string | null
          tipo_lenti_nome: string | null
          tipo_ordine_id: number | null
          tipo_ordine_nome: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordini_materiali_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lac_id_fkey"
            columns: ["fornitore_lac_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lac"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lenti_id_fkey"
            columns: ["fornitore_lenti_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_montature_id_fkey"
            columns: ["fornitore_montature_id"]
            isOneToOne: false
            referencedRelation: "fornitori_montature"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_sport_id_fkey"
            columns: ["fornitore_sport_id"]
            isOneToOne: false
            referencedRelation: "fornitori_sport"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_tipo_lenti_id_fkey"
            columns: ["tipo_lenti_id"]
            isOneToOne: false
            referencedRelation: "tipi_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_tipo_ordine_id_fkey"
            columns: ["tipo_ordine_id"]
            isOneToOne: false
            referencedRelation: "tipi_ordine"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ordini_materiali_con_fornitori: {
        Row: {
          alert_ritardo_inviato: boolean | null
          busta_id: string | null
          categoria_fornitore: string | null
          comunicazione_automatica_inviata: boolean | null
          created_at: string | null
          creato_da: string | null
          da_ordinare: boolean | null
          data_consegna_effettiva: string | null
          data_consegna_prevista: string | null
          data_ordine: string | null
          descrizione_prodotto: string | null
          email_fornitore: string | null
          fornitore_id: string | null
          fornitore_lab_esterno_id: string | null
          fornitore_lac_id: string | null
          fornitore_lenti_id: string | null
          fornitore_montature_id: string | null
          fornitore_sport_id: string | null
          giorni_consegna_medi: number | null
          giorni_ritardo: number | null
          id: string | null
          nome_fornitore: string | null
          note: string | null
          stato: Database["public"]["Enums"]["ordine_status"] | null
          telefono_fornitore: string | null
          tempi_consegna_fornitore: number | null
          tipo_lenti_id: string | null
          tipo_ordine_id: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordini_materiali_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lab_esterno_id_fkey"
            columns: ["fornitore_lab_esterno_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lab_esterno"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lac_id_fkey"
            columns: ["fornitore_lac_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lac"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_lenti_id_fkey"
            columns: ["fornitore_lenti_id"]
            isOneToOne: false
            referencedRelation: "fornitori_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_montature_id_fkey"
            columns: ["fornitore_montature_id"]
            isOneToOne: false
            referencedRelation: "fornitori_montature"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_fornitore_sport_id_fkey"
            columns: ["fornitore_sport_id"]
            isOneToOne: false
            referencedRelation: "fornitori_sport"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_tipo_lenti_id_fkey"
            columns: ["tipo_lenti_id"]
            isOneToOne: false
            referencedRelation: "tipi_lenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_tipo_ordine_id_fkey"
            columns: ["tipo_ordine_id"]
            isOneToOne: false
            referencedRelation: "tipi_ordine"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calcola_giorni_ritardo: {
        Args: {
          p_data_consegna_prevista: string
          p_data_consegna_effettiva?: string
        }
        Returns: number
      }
      delete_busta_completa: {
        Args: { busta_uuid: string }
        Returns: boolean
      }
      generate_numero_busta: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_my_claim: {
        Args: { claim: string }
        Returns: Json
      }
      increment_online_time: {
        Args: { user_id_param: string; duration_param: number }
        Returns: undefined
      }
    }
    Enums: {
      job_priority: "normale" | "urgente" | "critica"
      job_status:
        | "nuove"
        | "materiali_ordinati"
        | "materiali_arrivati"
        | "in_lavorazione"
        | "pronto_ritiro"
        | "consegnato_pagato"
      metodo_consegna:
        | "da_ritirare"
        | "consegna_domicilio"
        | "spedizione"
      ordine_status:
        | "ordinato"
        | "in_arrivo"
        | "in_ritardo"
        | "consegnato"
        | "accettato_con_riserva"
        | "rifiutato"
        | "sbagliato"
        | "annullato"
        | "da_ordinare"
      stato_consegna:
        | "in_attesa"
        | "ritirato"
        | "consegnato"
        | "spedito"
        | "arrivato"
      work_type:
        | "OCV"
        | "OV"
        | "OS"
        | "LV"
        | "LS"
        | "LAC"
        | "ACC"
        | "RIC"
        | "RIP"
        | "SA"
        | "SG"
        | "CT"
        | "ES"
        | "REL"
        | "FT"
        | "SPRT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_priority: ["normale", "urgente", "critica"],
      job_status: [
        "nuove",
        "materiali_ordinati",
        "materiali_arrivati",
        "in_lavorazione",
        "pronto_ritiro",
        "consegnato_pagato",
      ],
      ordine_status: [
        "ordinato",
        "in_arrivo",
        "in_ritardo",
        "consegnato",
        "accettato_con_riserva",
        "rifiutato",
        "annullato",
        "da_ordinare",
      ],
      work_type: [
        "OCV",
        "OV",
        "OS",
        "LV",
        "LS",
        "LAC",
        "ACC",
        "RIC",
        "RIP",
        "SA",
        "SG",
        "CT",
        "ES",
        "REL",
        "FT",
        "SPRT",
      ],
    },
  },
} as const
