export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      buste: {
        Row: {
          cliente_id: string | null
          creato_da: string | null
          data_apertura: string
          data_consegna_prevista: string | null
          id: string
          is_suspended: boolean
          modo_avviso_id: number | null
          note_generali: string | null
          priorita: Database["public"]["Enums"]["job_priority"]
          readable_id: string | null
          stato_attuale: Database["public"]["Enums"]["job_status"]
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
          id?: string
          is_suspended?: boolean
          modo_avviso_id?: number | null
          note_generali?: string | null
          priorita?: Database["public"]["Enums"]["job_priority"]
          readable_id?: string | null
          stato_attuale?: Database["public"]["Enums"]["job_status"]
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
          id?: string
          is_suspended?: boolean
          modo_avviso_id?: number | null
          note_generali?: string | null
          priorita?: Database["public"]["Enums"]["job_priority"]
          readable_id?: string | null
          stato_attuale?: Database["public"]["Enums"]["job_status"]
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
          id?: string
          nome?: string
          note_cliente?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fornitori: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
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
            foreignKeyName: "materiali_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
        | "materiali_parzialmente_arrivati"
        | "materiali_arrivati"
        | "in_lavorazione"
        | "pronto_ritiro"
        | "consegnato_pagato"
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
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
        "materiali_parzialmente_arrivati",
        "materiali_arrivati",
        "in_lavorazione",
        "pronto_ritiro",
        "consegnato_pagato",
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
      ],
    },
  },
} as const
