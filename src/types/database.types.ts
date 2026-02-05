export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_202510: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_log_202511: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_log_202512: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_log_202601: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      buste: {
        Row: {
          cliente_id: string | null
          controllo_completato: boolean | null
          controllo_completato_at: string | null
          controllo_completato_da: string | null
          creato_da: string | null
          data_apertura: string
          data_completamento_consegna: string | null
          data_consegna_prevista: string | null
          data_selezione_consegna: string | null
          data_sospensione: string | null
          data_riesame_sospensione: string | null
          archived_mode: string | null
          sospesa_followup_done_at: string | null
          sospesa_followup_reason: string | null
          sospesa_followup_note: string | null
          id: string
          is_suspended: boolean
          metodo_consegna:
            | Database["public"]["Enums"]["metodo_consegna_enum"]
            | null
          modo_avviso_id: number | null
          note_generali: string | null
          note_spedizione: string | null
          numero_tracking: string | null
          priorita: Database["public"]["Enums"]["job_priority"]
          readable_id: string | null
          stato_attuale: Database["public"]["Enums"]["job_status"]
          stato_consegna:
            | Database["public"]["Enums"]["stato_consegna_enum"]
            | null
          tipo_lavorazione: Database["public"]["Enums"]["work_type"] | null
          tipo_lavorazione_codice: string | null
          tipo_montaggio_id: number | null
          deleted_at: string | null
          deleted_by: string | null
          updated_at: string | null
          updated_by: string | null
          richiede_telefonata: boolean | null
          telefonata_assegnata_a: string | null
          telefonata_completata: boolean | null
          telefonata_completata_data: string | null
          telefonata_completata_da: string | null
        }
        Insert: {
          cliente_id?: string | null
          controllo_completato?: boolean | null
          controllo_completato_at?: string | null
          controllo_completato_da?: string | null
          creato_da?: string | null
          data_apertura?: string
          data_completamento_consegna?: string | null
          data_consegna_prevista?: string | null
          data_selezione_consegna?: string | null
          data_sospensione?: string | null
          data_riesame_sospensione?: string | null
          archived_mode?: string | null
          sospesa_followup_done_at?: string | null
          sospesa_followup_reason?: string | null
          sospesa_followup_note?: string | null
          id?: string
          is_suspended?: boolean
          metodo_consegna?:
            | Database["public"]["Enums"]["metodo_consegna_enum"]
            | null
          modo_avviso_id?: number | null
          note_generali?: string | null
          note_spedizione?: string | null
          numero_tracking?: string | null
          priorita?: Database["public"]["Enums"]["job_priority"]
          readable_id?: string | null
          stato_attuale?: Database["public"]["Enums"]["job_status"]
          stato_consegna?:
            | Database["public"]["Enums"]["stato_consegna_enum"]
            | null
          tipo_lavorazione?: Database["public"]["Enums"]["work_type"] | null
          tipo_lavorazione_codice?: string | null
          tipo_montaggio_id?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
          richiede_telefonata?: boolean | null
          telefonata_assegnata_a?: string | null
          telefonata_completata?: boolean | null
          telefonata_completata_data?: string | null
          telefonata_completata_da?: string | null
        }
        Update: {
          cliente_id?: string | null
          controllo_completato?: boolean | null
          controllo_completato_at?: string | null
          controllo_completato_da?: string | null
          creato_da?: string | null
          data_apertura?: string
          data_completamento_consegna?: string | null
          data_consegna_prevista?: string | null
          data_selezione_consegna?: string | null
          data_sospensione?: string | null
          data_riesame_sospensione?: string | null
          archived_mode?: string | null
          sospesa_followup_done_at?: string | null
          sospesa_followup_reason?: string | null
          sospesa_followup_note?: string | null
          id?: string
          is_suspended?: boolean
          metodo_consegna?:
            | Database["public"]["Enums"]["metodo_consegna_enum"]
            | null
          modo_avviso_id?: number | null
          note_generali?: string | null
          note_spedizione?: string | null
          numero_tracking?: string | null
          priorita?: Database["public"]["Enums"]["job_priority"]
          readable_id?: string | null
          stato_attuale?: Database["public"]["Enums"]["job_status"]
          stato_consegna?:
            | Database["public"]["Enums"]["stato_consegna_enum"]
            | null
          tipo_lavorazione?: Database["public"]["Enums"]["work_type"] | null
          tipo_lavorazione_codice?: string | null
          tipo_montaggio_id?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
          richiede_telefonata?: boolean | null
          telefonata_assegnata_a?: string | null
          telefonata_completata?: boolean | null
          telefonata_completata_data?: string | null
          telefonata_completata_da?: string | null
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
            foreignKeyName: "buste_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_categorization_fu2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "buste_controllo_completato_da_fkey"
            columns: ["controllo_completato_da"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_controllo_completato_da_fkey"
            columns: ["controllo_completato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
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
          {
            foreignKeyName: "buste_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buste_controlli_qualita: {
        Row: {
          busta_id: string
          completed_at: string
          completed_by: string
          created_at: string
          cycle_index: number
          id: string
        }
        Insert: {
          busta_id: string
          completed_at?: string
          completed_by: string
          created_at?: string
          cycle_index: number
          id?: string
        }
        Update: {
          busta_id?: string
          completed_at?: string
          completed_by?: string
          created_at?: string
          cycle_index?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buste_controlli_qualita_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buste_controlli_qualita_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classificazione_lenti: {
        Row: {
          id: string
          nome: string
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          created_at?: string | null
        }
        Relationships: []
      }
      clienti: {
        Row: {
          categoria_cliente: string | null
          categoria_updated_at: string | null
          cognome: string
          created_at: string | null
          data_nascita: string | null
          email: string | null
          genere: string | null
          id: string
          nome: string
          note_cliente: string | null
          telefono: string | null
          deleted_at: string | null
          deleted_by: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          categoria_cliente?: string | null
          categoria_updated_at?: string | null
          cognome: string
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          genere?: string | null
          id?: string
          nome: string
          note_cliente?: string | null
          telefono?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          categoria_cliente?: string | null
          categoria_updated_at?: string | null
          cognome?: string
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          genere?: string | null
          id?: string
          nome?: string
          note_cliente?: string | null
          telefono?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clienti_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_cost_defaults: {
        Row: {
          default_cost: number
          description: string | null
          error_category: string
          error_type: string
          examples: string[] | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          default_cost: number
          description?: string | null
          error_category: string
          error_type: string
          examples?: string[] | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          default_cost?: number
          description?: string | null
          error_category?: string
          error_type?: string
          examples?: string[] | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      error_tracking: {
        Row: {
          assegnazione_colpa: string | null
          auto_created_from_order: string | null
          busta_id: string | null
          client_impacted: boolean | null
          cliente_id: string | null
          cost_amount: number
          cost_detail: string | null
          cost_type: string
          created_at: string | null
          creato_da_followup: boolean | null
          employee_id: string
          error_category: string
          error_description: string
          error_type: string
          id: string
          impatto_cliente: string | null
          intercettato_da: string | null
          is_draft: boolean | null
          operatore_coinvolto: string | null
          procedura_flag: string | null
          reported_at: string | null
          reported_by: string
          requires_reorder: boolean | null
          resolution_notes: string | null
          resolution_status: string | null
          resolved_at: string | null
          resolved_by: string | null
          step_workflow: string | null
          time_lost_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          assegnazione_colpa?: string | null
          auto_created_from_order?: string | null
          busta_id?: string | null
          client_impacted?: boolean | null
          cliente_id?: string | null
          cost_amount: number
          cost_detail?: string | null
          cost_type: string
          created_at?: string | null
          creato_da_followup?: boolean | null
          employee_id: string
          error_category: string
          error_description: string
          error_type: string
          id?: string
          impatto_cliente?: string | null
          intercettato_da?: string | null
          is_draft?: boolean | null
          operatore_coinvolto?: string | null
          procedura_flag?: string | null
          reported_at?: string | null
          reported_by: string
          requires_reorder?: boolean | null
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          step_workflow?: string | null
          time_lost_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          assegnazione_colpa?: string | null
          auto_created_from_order?: string | null
          busta_id?: string | null
          client_impacted?: boolean | null
          cliente_id?: string | null
          cost_amount?: number
          cost_detail?: string | null
          cost_type?: string
          created_at?: string | null
          creato_da_followup?: boolean | null
          employee_id?: string
          error_category?: string
          error_description?: string
          error_type?: string
          id?: string
          impatto_cliente?: string | null
          intercettato_da?: string | null
          is_draft?: boolean | null
          operatore_coinvolto?: string | null
          procedura_flag?: string | null
          reported_at?: string | null
          reported_by?: string
          requires_reorder?: boolean | null
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          step_workflow?: string | null
          time_lost_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_tracking_auto_created_from_order_fkey"
            columns: ["auto_created_from_order"]
            isOneToOne: false
            referencedRelation: "ordini_materiali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_categorization_fu2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "error_tracking_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_operatore_coinvolto_fkey"
            columns: ["operatore_coinvolto"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_operatore_coinvolto_fkey"
            columns: ["operatore_coinvolto"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_tracking_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_chiamate: {
        Row: {
          archiviato: boolean | null
          busta_id: string
          categoria_cliente: string | null
          crea_errore: boolean | null
          created_at: string | null
          data_chiamata: string | null
          data_completamento: string | null
          data_generazione: string
          id: string
          livello_soddisfazione: string | null
          note_chiamata: string | null
          motivo_urgenza: string | null
          origine: string
          operatore_id: string | null
          orario_richiamata_a: string | null
          orario_richiamata_da: string | null
          priorita: string
          scheduled_at: string | null
          stato_chiamata: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archiviato?: boolean | null
          busta_id: string
          categoria_cliente?: string | null
          crea_errore?: boolean | null
          created_at?: string | null
          data_chiamata?: string | null
          data_completamento?: string | null
          data_generazione?: string
          id?: string
          livello_soddisfazione?: string | null
          note_chiamata?: string | null
          motivo_urgenza?: string | null
          origine?: string
          operatore_id?: string | null
          orario_richiamata_a?: string | null
          orario_richiamata_da?: string | null
          priorita: string
          scheduled_at?: string | null
          stato_chiamata?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archiviato?: boolean | null
          busta_id?: string
          categoria_cliente?: string | null
          crea_errore?: boolean | null
          created_at?: string | null
          data_chiamata?: string | null
          data_completamento?: string | null
          data_generazione?: string
          id?: string
          livello_soddisfazione?: string | null
          note_chiamata?: string | null
          motivo_urgenza?: string | null
          origine?: string
          operatore_id?: string | null
          orario_richiamata_a?: string | null
          orario_richiamata_da?: string | null
          priorita?: string
          scheduled_at?: string | null
          stato_chiamata?: string
          updated_at?: string | null
          updated_by?: string | null
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
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_chiamate_operatore_id_fkey"
            columns: ["operatore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_chiamate_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_chiamate_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fornitori_accessori: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          note: string | null
          referente_nome: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note?: string | null
          referente_nome?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Relationships: []
      }
      fornitori_lab_esterno: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          note: string | null
          referente_nome: string | null
          telefono: string | null
          tempi_consegna_medi: number | null
          web_address: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          note?: string | null
          referente_nome?: string | null
          telefono?: string | null
          tempi_consegna_medi?: number | null
          web_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          referente_nome?: string | null
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
          note: string | null
          referente_nome: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note: string | null
          referente_nome: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note: string | null
          referente_nome: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note: string | null
          referente_nome: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          note?: string | null
          referente_nome?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          updated_at: string | null
          updated_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "info_pagamenti_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: true
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_pagamenti_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_pagamenti_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_pagamenti_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_pagamenti_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_update_logs: {
        Row: {
          busta_id: string
          created_at: string
          from_status: string
          id: string
          metadata: Json | null
          note: string | null
          to_status: string
          user_id: string
        }
        Insert: {
          busta_id: string
          created_at?: string
          from_status: string
          id?: string
          metadata?: Json | null
          note?: string | null
          to_status: string
          user_id: string
        }
        Update: {
          busta_id?: string
          created_at?: string
          from_status?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          to_status?: string
          user_id?: string
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
            referencedRelation: "employee_error_summary"
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
      lavorazioni: {
        Row: {
          busta_id: string
          created_at: string
          data_completamento: string | null
          data_fallimento: string | null
          data_inizio: string
          id: string
          note: string | null
          scheduled_pickup: string | null
          scheduled_return: string | null
          actual_pickup: string | null
          actual_return: string | null
          responsabile_id: string
          stato: string
          tentativo: number
          tipo_montaggio_id: number
          deleted_at: string | null
          deleted_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          busta_id: string
          created_at?: string
          data_completamento?: string | null
          data_fallimento?: string | null
          data_inizio?: string
          id?: string
          note?: string | null
          scheduled_pickup?: string | null
          scheduled_return?: string | null
          actual_pickup?: string | null
          actual_return?: string | null
          responsabile_id: string
          stato?: string
          tentativo?: number
          tipo_montaggio_id: number
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          busta_id?: string
          created_at?: string
          data_completamento?: string | null
          data_fallimento?: string | null
          data_inizio?: string
          id?: string
          note?: string | null
          scheduled_pickup?: string | null
          scheduled_return?: string | null
          actual_pickup?: string | null
          actual_return?: string | null
          responsabile_id?: string
          stato?: string
          tentativo?: number
          tipo_montaggio_id?: number
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string
          updated_by?: string | null
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
          {
            foreignKeyName: "lavorazioni_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavorazioni_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavorazioni_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavorazioni_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lavorazioni_checklist_items: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean
          item_label: string
          lavorazione_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean
          item_label: string
          lavorazione_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean
          item_label?: string
          lavorazione_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lavorazioni_checklist_items_lavorazione_id_fkey"
            columns: ["lavorazione_id"]
            isOneToOne: false
            referencedRelation: "lavorazioni"
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
            referencedRelation: "employee_error_summary"
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
          classificazione_lenti_id: string | null
          comunicazione_automatica_inviata: boolean | null
          created_at: string | null
          creato_da: string | null
          da_ordinare: boolean | null
          data_consegna_effettiva: string | null
          data_consegna_prevista: string | null
          data_ordine: string | null
          descrizione_prodotto: string
          fornitore_accessori_id: string | null
          fornitore_id: string | null
          fornitore_lab_esterno_id: string | null
          fornitore_lac_id: string | null
          fornitore_lenti_id: string | null
          fornitore_montature_id: string | null
          fornitore_sport_id: string | null
          giorni_consegna_medi: number | null
          giorni_ritardo: number | null
          id: string
          cancel_reason: string | null
          needs_action: boolean | null
          needs_action_type: string | null
          needs_action_done: boolean | null
          needs_action_due_date: string | null
          note: string | null
          prezzo_prodotto: number | null
          promemoria_disponibilita: string | null
          stato: Database["public"]["Enums"]["ordine_status"] | null
          stato_disponibilita: string
          tipo_lenti_id: string | null
          tipo_ordine_id: number | null
          trattamenti: string[] | null
          deleted_at: string | null
          deleted_by: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          alert_ritardo_inviato?: boolean | null
          busta_id: string
          categoria_fornitore?: string | null
          classificazione_lenti_id?: string | null
          comunicazione_automatica_inviata?: boolean | null
          created_at?: string | null
          creato_da?: string | null
          da_ordinare?: boolean | null
          data_consegna_effettiva?: string | null
          data_consegna_prevista?: string | null
          data_ordine?: string | null
          descrizione_prodotto: string
          fornitore_accessori_id?: string | null
          fornitore_id?: string | null
          fornitore_lab_esterno_id?: string | null
          fornitore_lac_id?: string | null
          fornitore_lenti_id?: string | null
          fornitore_montature_id?: string | null
          fornitore_sport_id?: string | null
          giorni_consegna_medi?: number | null
          giorni_ritardo?: number | null
          id?: string
          cancel_reason?: string | null
          needs_action?: boolean | null
          needs_action_type?: string | null
          needs_action_done?: boolean | null
          needs_action_due_date?: string | null
          note?: string | null
          prezzo_prodotto?: number | null
          promemoria_disponibilita?: string | null
          stato?: Database["public"]["Enums"]["ordine_status"] | null
          stato_disponibilita?: string
          tipo_lenti_id?: string | null
          tipo_ordine_id?: number | null
          trattamenti?: string[] | null
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          alert_ritardo_inviato?: boolean | null
          busta_id?: string
          categoria_fornitore?: string | null
          classificazione_lenti_id?: string | null
          comunicazione_automatica_inviata?: boolean | null
          created_at?: string | null
          creato_da?: string | null
          da_ordinare?: boolean | null
          data_consegna_effettiva?: string | null
          data_consegna_prevista?: string | null
          data_ordine?: string | null
          descrizione_prodotto?: string
          fornitore_accessori_id?: string | null
          fornitore_id?: string | null
          fornitore_lab_esterno_id?: string | null
          fornitore_lac_id?: string | null
          fornitore_lenti_id?: string | null
          fornitore_montature_id?: string | null
          fornitore_sport_id?: string | null
          giorni_consegna_medi?: number | null
          giorni_ritardo?: number | null
          id?: string
          cancel_reason?: string | null
          needs_action?: boolean | null
          needs_action_type?: string | null
          needs_action_done?: boolean | null
          needs_action_due_date?: string | null
          note?: string | null
          prezzo_prodotto?: number | null
          promemoria_disponibilita?: string | null
          stato?: Database["public"]["Enums"]["ordine_status"] | null
          stato_disponibilita?: string
          tipo_lenti_id?: string | null
          tipo_ordine_id?: number | null
          trattamenti?: string[] | null
          deleted_at?: string | null
          deleted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
            foreignKeyName: "ordini_materiali_fornitore_accessori_id_fkey"
            columns: ["fornitore_accessori_id"]
            isOneToOne: false
            referencedRelation: "fornitori_accessori"
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
            foreignKeyName: "ordini_materiali_classificazione_lenti_id_fkey"
            columns: ["classificazione_lenti_id"]
            isOneToOne: false
            referencedRelation: "classificazione_lenti"
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
          {
            foreignKeyName: "ordini_materiali_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_materiali_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          created_at: string | null
          due_date: string
          expected_amount: number | null
          id: string
          installment_number: number
          is_completed: boolean | null
          paid_amount: number | null
          payment_plan_id: string
          reminder_10_days_sent: boolean | null
          reminder_3_days_sent: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          due_date: string
          expected_amount?: number | null
          id?: string
          installment_number: number
          is_completed?: boolean | null
          paid_amount?: number | null
          payment_plan_id: string
          reminder_10_days_sent?: boolean | null
          reminder_3_days_sent?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          due_date?: string
          expected_amount?: number | null
          id?: string
          installment_number?: number
          is_completed?: boolean | null
          paid_amount?: number | null
          payment_plan_id?: string
          reminder_10_days_sent?: boolean | null
          reminder_3_days_sent?: boolean | null
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
          acconto: number | null
          auto_reminders_enabled: boolean | null
          busta_id: string
          created_at: string | null
          id: string
          is_completed: boolean | null
          payment_type: string
          reminder_preference: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          acconto?: number | null
          auto_reminders_enabled?: boolean | null
          busta_id: string
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          payment_type: string
          reminder_preference?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          acconto?: number | null
          auto_reminders_enabled?: boolean | null
          busta_id?: string
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          payment_type?: string
          reminder_preference?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_busta_id_fkey"
            columns: ["busta_id"]
            isOneToOne: false
            referencedRelation: "buste"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_access_log: {
        Row: {
          accessed_at: string | null
          id: string
          procedure_id: string | null
          user_id: string | null
        }
        Insert: {
          accessed_at?: string | null
          id?: string
          procedure_id?: string | null
          user_id?: string | null
        }
        Update: {
          accessed_at?: string | null
          id?: string
          procedure_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_access_log_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_dependencies: {
        Row: {
          created_at: string | null
          depends_on_id: string | null
          id: string
          procedure_id: string | null
          relationship_type: string | null
        }
        Insert: {
          created_at?: string | null
          depends_on_id?: string | null
          id?: string
          procedure_id?: string | null
          relationship_type?: string | null
        }
        Update: {
          created_at?: string | null
          depends_on_id?: string | null
          id?: string
          procedure_id?: string | null
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_dependencies_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_dependencies_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_favorites: {
        Row: {
          created_at: string | null
          id: string
          procedure_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          procedure_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          procedure_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_favorites_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_helpfulness_votes: {
        Row: {
          id: string
          is_helpful: boolean
          procedure_id: string
          user_id: string
          voted_at: string | null
        }
        Insert: {
          id?: string
          is_helpful: boolean
          procedure_id: string
          user_id: string
          voted_at?: string | null
        }
        Update: {
          id?: string
          is_helpful?: boolean
          procedure_id?: string
          user_id?: string
          voted_at?: string | null
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
            referencedRelation: "employee_error_summary"
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
      procedure_read_receipts: {
        Row: {
          acknowledged_at: string
          acknowledged_updated_at: string
          acknowledged_version: number | null
          created_at: string
          id: string
          procedure_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_updated_at?: string
          acknowledged_version?: number | null
          created_at?: string
          id?: string
          procedure_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_updated_at?: string
          acknowledged_version?: number | null
          created_at?: string
          id?: string
          procedure_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_read_receipts_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_suggestions: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          description: string
          errore_id: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          procedure_id: string
          status: string | null
          step_workflow: string | null
          suggested_by: string
          tipo_suggerimento: string | null
          title: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          description: string
          errore_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          procedure_id: string
          status?: string | null
          step_workflow?: string | null
          suggested_by: string
          tipo_suggerimento?: string | null
          title: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string
          errore_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          procedure_id?: string
          status?: string | null
          step_workflow?: string | null
          suggested_by?: string
          tipo_suggerimento?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_suggestions_errore_id_fkey"
            columns: ["errore_id"]
            isOneToOne: false
            referencedRelation: "error_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_suggestions_errore_id_fkey"
            columns: ["errore_id"]
            isOneToOne: false
            referencedRelation: "v_error_analysis_et2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_suggestions_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_suggestions_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_suggestions_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          approval_status: string | null
          content: string
          context_category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          mini_help_action: string | null
          mini_help_summary: string | null
          mini_help_title: string | null
          procedure_type: string | null
          search_tags: string[] | null
          slug: string
          target_roles: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
          version: number | null
          view_count: number | null
        }
        Insert: {
          approval_status?: string | null
          content: string
          context_category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          mini_help_action?: string | null
          mini_help_summary?: string | null
          mini_help_title?: string | null
          procedure_type?: string | null
          search_tags?: string[] | null
          slug: string
          target_roles?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
          view_count?: number | null
        }
        Update: {
          approval_status?: string | null
          content?: string
          context_category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          mini_help_action?: string | null
          mini_help_summary?: string | null
          mini_help_title?: string | null
          procedure_type?: string | null
          search_tags?: string[] | null
          slug?: string
          target_roles?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "procedures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_last_reviewed_by_fkey"
            columns: ["last_reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_last_reviewed_by_fkey"
            columns: ["last_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          telegram_bot_access: boolean | null
          telegram_user_id: string | null
          total_time_online_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string
          telegram_bot_access?: boolean | null
          telegram_user_id?: string | null
          total_time_online_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string
          telegram_bot_access?: boolean | null
          telegram_user_id?: string | null
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
      statistiche_follow_up: {
        Row: {
          cellulari_staccati: number | null
          chiamate_completate: number | null
          chiamate_totali: number | null
          created_at: string | null
          da_richiamare: number | null
          data_riferimento: string
          id: string
          insoddisfatti: number | null
          molto_soddisfatti: number | null
          non_risponde: number | null
          non_vuole_contatto: number | null
          numeri_sbagliati: number | null
          operatore_id: string | null
          poco_soddisfatti: number | null
          soddisfatti: number | null
        }
        Insert: {
          cellulari_staccati?: number | null
          chiamate_completate?: number | null
          chiamate_totali?: number | null
          created_at?: string | null
          da_richiamare?: number | null
          data_riferimento?: string
          id?: string
          insoddisfatti?: number | null
          molto_soddisfatti?: number | null
          non_risponde?: number | null
          non_vuole_contatto?: number | null
          numeri_sbagliati?: number | null
          operatore_id?: string | null
          poco_soddisfatti?: number | null
          soddisfatti?: number | null
        }
        Update: {
          cellulari_staccati?: number | null
          chiamate_completate?: number | null
          chiamate_totali?: number | null
          created_at?: string | null
          da_richiamare?: number | null
          data_riferimento?: string
          id?: string
          insoddisfatti?: number | null
          molto_soddisfatti?: number | null
          non_risponde?: number | null
          non_vuole_contatto?: number | null
          numeri_sbagliati?: number | null
          operatore_id?: string | null
          poco_soddisfatti?: number | null
          soddisfatti?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "statistiche_follow_up_operatore_id_fkey"
            columns: ["operatore_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistiche_follow_up_operatore_id_fkey"
            columns: ["operatore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "employee_error_summary"
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
      telegram_allowed_users: {
        Row: {
          can_use_bot: boolean | null
          created_at: string | null
          label: string
          profile_id: string | null
          telegram_user_id: string
          updated_at: string | null
        }
        Insert: {
          can_use_bot?: boolean | null
          created_at?: string | null
          label: string
          profile_id?: string | null
          telegram_user_id: string
          updated_at?: string | null
        }
        Update: {
          can_use_bot?: boolean | null
          created_at?: string | null
          label?: string
          profile_id?: string | null
          telegram_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_allowed_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_allowed_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_auth_requests: {
        Row: {
          authorized: boolean | null
          first_name: string | null
          first_seen_at: string | null
          id: number
          last_name: string | null
          last_seen_at: string | null
          message_count: number | null
          telegram_user_id: string
          telegram_username: string | null
        }
        Insert: {
          authorized?: boolean | null
          first_name?: string | null
          first_seen_at?: string | null
          id?: number
          last_name?: string | null
          last_seen_at?: string | null
          message_count?: number | null
          telegram_user_id: string
          telegram_username?: string | null
        }
        Update: {
          authorized?: boolean | null
          first_name?: string | null
          first_seen_at?: string | null
          id?: number
          last_name?: string | null
          last_seen_at?: string | null
          message_count?: number | null
          telegram_user_id?: string
          telegram_username?: string | null
        }
        Relationships: []
      }
      telegram_config: {
        Row: {
          active: boolean | null
          auto_analyze: boolean | null
          auto_transcribe: boolean | null
          bot_token: string
          created_at: string | null
          id: number
          max_file_size_mb: number | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          auto_analyze?: boolean | null
          auto_transcribe?: boolean | null
          bot_token: string
          created_at?: string | null
          id?: number
          max_file_size_mb?: number | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          auto_analyze?: boolean | null
          auto_transcribe?: boolean | null
          bot_token?: string
          created_at?: string | null
          id?: number
          max_file_size_mb?: number | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
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
      unpredicted_cases: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          context_category: string | null
          created_at: string | null
          created_by: string
          description: string
          id: string
          is_completed: boolean | null
          related_procedure_id: string | null
          severity: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          context_category?: string | null
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          is_completed?: boolean | null
          related_procedure_id?: string | null
          severity: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          context_category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          is_completed?: boolean | null
          related_procedure_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "unpredicted_cases_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unpredicted_cases_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unpredicted_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unpredicted_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unpredicted_cases_related_procedure_id_fkey"
            columns: ["related_procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notes: {
        Row: {
          addetto_nome: string
          audio_blob: string
          audio_file_path: string | null
          busta_id: string | null
          category_auto: string | null
          cliente_id: string | null
          cliente_riferimento: string | null
          confidence_scores: Json | null
          created_at: string | null
          dismissed_at: string | null
          duration_seconds: number | null
          extracted_dates: Json | null
          file_size: number | null
          id: string
          needs_review: boolean | null
          note_aggiuntive: string | null
          priority_level: number | null
          processed_at: string | null
          processed_by: string | null
          sentiment: string | null
          stato: string
          telegram_message_id: string | null
          telegram_user_id: string | null
          telegram_username: string | null
          transcription: string | null
          updated_at: string | null
        }
        Insert: {
          addetto_nome: string
          audio_blob: string
          audio_file_path?: string | null
          busta_id?: string | null
          category_auto?: string | null
          cliente_id?: string | null
          cliente_riferimento?: string | null
          confidence_scores?: Json | null
          created_at?: string | null
          dismissed_at?: string | null
          duration_seconds?: number | null
          extracted_dates?: Json | null
          file_size?: number | null
          id?: string
          needs_review?: boolean | null
          note_aggiuntive?: string | null
          priority_level?: number | null
          processed_at?: string | null
          processed_by?: string | null
          sentiment?: string | null
          stato?: string
          telegram_message_id?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          transcription?: string | null
          updated_at?: string | null
        }
        Update: {
          addetto_nome?: string
          audio_blob?: string
          audio_file_path?: string | null
          busta_id?: string | null
          category_auto?: string | null
          cliente_id?: string | null
          cliente_riferimento?: string | null
          confidence_scores?: Json | null
          created_at?: string | null
          dismissed_at?: string | null
          duration_seconds?: number | null
          extracted_dates?: Json | null
          file_size?: number | null
          id?: string
          needs_review?: boolean | null
          note_aggiuntive?: string | null
          priority_level?: number | null
          processed_at?: string | null
          processed_by?: string | null
          sentiment?: string | null
          stato?: string
          telegram_message_id?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
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
          {
            foreignKeyName: "voice_notes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_categorization_fu2"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      warning_letters: {
        Row: {
          critical_errors: number
          employee_id: string
          employee_name: string
          generated_at: string
          generated_by: string | null
          id: string
          letter_type: string
          monthly_errors: number
          notes: string | null
          pdf_data: string | null
          sent_at: string | null
          sent_to_email: string | null
          sent_via_email: boolean
          total_cost: number
          total_errors: number
          weekly_errors: number
        }
        Insert: {
          critical_errors?: number
          employee_id: string
          employee_name: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          letter_type: string
          monthly_errors?: number
          notes?: string | null
          pdf_data?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          sent_via_email?: boolean
          total_cost?: number
          total_errors?: number
          weekly_errors?: number
        }
        Update: {
          critical_errors?: number
          employee_id?: string
          employee_name?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          letter_type?: string
          monthly_errors?: number
          notes?: string | null
          pdf_data?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          sent_via_email?: boolean
          total_cost?: number
          total_errors?: number
          weekly_errors?: number
        }
        Relationships: [
          {
            foreignKeyName: "warning_letters_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "employee_error_summary"
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
    }
    Views: {
      audit_by_table: {
        Row: {
          first_change: string | null
          last_change: string | null
          table_name: string | null
          total_changes: number | null
          unique_records: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      cestino_items: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          days_remaining: number | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          id: string | null
          is_expiring_soon: boolean | null
          label: string | null
          table_name: string | null
        }
        Relationships: []
      }
      employee_error_summary: {
        Row: {
          critical_errors: number | null
          full_name: string | null
          id: string | null
          low_errors: number | null
          medium_errors: number | null
          role: string | null
          total_cost: number | null
          total_errors: number | null
        }
        Relationships: []
      }
      recent_audit_logs: {
        Row: {
          action: string | null
          changed_fields: Json | null
          created_at: string | null
          current_user_role: string | null
          id: string | null
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_error_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audit_summary: {
        Row: {
          change_count: number | null
          full_name: string | null
          last_activity: string | null
          role: string | null
          table_name: string | null
        }
        Relationships: []
      }
      v_cliente_categorization_fu2: {
        Row: {
          categoria_cliente: string | null
          categoria_updated_at: string | null
          cliente_id: string | null
          cognome: string | null
          email: string | null
          followups_generated_errors: number | null
          last_contact_date: string | null
          negative_feedbacks: number | null
          nome: string | null
          positive_feedbacks: number | null
          telefono: string | null
          total_followups: number | null
        }
        Relationships: []
      }
      v_error_analysis_et2: {
        Row: {
          assegnazione_colpa: string | null
          busta_readable_id: string | null
          cliente_categoria: string | null
          cliente_cognome: string | null
          cliente_nome: string | null
          cost_amount: number | null
          creato_da_followup: boolean | null
          employee_name: string | null
          employee_role: string | null
          error_category: string | null
          error_type: string | null
          id: string | null
          impatto_cliente: string | null
          intercettato_da: string | null
          operatore_coinvolto_name: string | null
          procedura_flag: string | null
          procedure_suggestion_id: string | null
          reported_at: string | null
          resolution_status: string | null
          step_workflow: string | null
          suggestion_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archivia_chiamate_completate: { Args: never; Returns: number }
      build_audit_changed_fields: {
        Args: { p_new: Json; p_old: Json }
        Returns: Json
      }
      calcola_giorni_ritardo: {
        Args: {
          p_data_consegna_effettiva?: string
          p_data_consegna_prevista: string
        }
        Returns: number
      }
      calcola_priorita_follow_up: {
        Args: {
          ha_primo_acquisto_lac: boolean
          prezzo_finale: number
          tipo_lavorazione: string
        }
        Returns: string
      }
      delete_busta_completa: { Args: { busta_uuid: string }; Returns: boolean }
      ensure_audit_log_partition_for_month: {
        Args: { p_month: string }
        Returns: string
      }
      ensure_audit_log_partitions: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      generate_numero_busta: { Args: never; Returns: string }
      get_my_claim: { Args: { claim: string }; Returns: Json }
      get_procedure_helpfulness_stats: {
        Args: { procedure_uuid: string }
        Returns: {
          helpful_count: number
          helpfulness_percentage: number
          not_helpful_count: number
          total_votes: number
        }[]
      }
      get_recently_viewed_procedures: {
        Args: { limit_count?: number; user_uuid: string }
        Returns: {
          accessed_at: string
          context_category: string
          id: string
          slug: string
          title: string
        }[]
      }
      get_unpredicted_cases_stats: {
        Args: never
        Returns: {
          category: string
          completed_count: number
          pending_count: number
          total_count: number
        }[]
      }
      increment_online_time: {
        Args: { duration_param: number; user_id_param: string }
        Returns: undefined
      }
      increment_procedure_view_count: {
        Args: { procedure_uuid: string; user_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      log_audit_change: {
        Args: {
          p_action: string
          p_changed_fields?: Json
          p_metadata?: Json
          p_reason?: string
          p_record_id: string
          p_table_name: string
          p_user_id: string
        }
        Returns: string
      }
      prune_audit_log_partitions: {
        Args: { p_retain_months?: number }
        Returns: number
      }
      purge_expired_cestino_items: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          deleted_count: number
        }[]
      }
      recover_cestino_item: {
        Args: { p_table_name: string; p_record_id: string; p_user_id: string }
        Returns: Json
      }
      run_audit_log_maintenance: {
        Args: { p_future_months?: number; p_retain_months?: number }
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
      metodo_consegna_enum: "da_ritirare" | "consegna_domicilio" | "spedizione"
      ordine_status:
        | "ordinato"
        | "in_arrivo"
        | "in_ritardo"
        | "consegnato"
        | "accettato_con_riserva"
        | "rifiutato"
        | "da_ordinare"
        | "annullato"
        | "sbagliato"
      stato_consegna_enum:
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
        | "LAB"
        | "SA"
        | "SG"
        | "CT"
        | "BR"
        | "ES"
        | "REL"
        | "FT"
        | "SPRT"
        | "VFT"
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
  graphql_public: {
    Enums: {},
  },
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
      metodo_consegna_enum: ["da_ritirare", "consegna_domicilio", "spedizione"],
      ordine_status: [
        "ordinato",
        "in_arrivo",
        "in_ritardo",
        "consegnato",
        "accettato_con_riserva",
        "rifiutato",
        "da_ordinare",
        "annullato",
        "sbagliato",
      ],
      stato_consegna_enum: [
        "in_attesa",
        "ritirato",
        "consegnato",
        "spedito",
        "arrivato",
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
        "LAB",
        "SA",
        "SG",
        "CT",
        "BR",
        "ES",
        "REL",
        "FT",
        "SPRT",
        "VFT",
      ],
    },
  },
} as const
