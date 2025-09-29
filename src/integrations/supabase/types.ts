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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      invoices: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          due_date: string | null
          id: string
          invoice_ref: string
          notes: string | null
          paid_date: string | null
          project_id: string | null
          quote_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_name: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_ref: string
          notes?: string | null
          paid_date?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_ref?: string
          notes?: string | null
          paid_date?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          city: string
          commentaire: string | null
          company: string | null
          created_at: string
          date_rdv: string | null
          email: string
          full_name: string
          heure_rdv: string | null
          id: string
          phone_raw: string
          postal_code: string
          product_name: string | null
          status: string
          surface_m2: number | null
          updated_at: string
          user_id: string
          utm_source: string | null
        }
        Insert: {
          city: string
          commentaire?: string | null
          company?: string | null
          created_at?: string
          date_rdv?: string | null
          email: string
          full_name: string
          heure_rdv?: string | null
          id?: string
          phone_raw: string
          postal_code: string
          product_name?: string | null
          status?: string
          surface_m2?: number | null
          updated_at?: string
          user_id: string
          utm_source?: string | null
        }
        Update: {
          city?: string
          commentaire?: string | null
          company?: string | null
          created_at?: string
          date_rdv?: string | null
          email?: string
          full_name?: string
          heure_rdv?: string | null
          id?: string
          phone_raw?: string
          postal_code?: string
          product_name?: string | null
          status?: string
          surface_m2?: number | null
          updated_at?: string
          user_id?: string
          utm_source?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          assigned_to: string
          city: string
          client_name: string
          company: string | null
          created_at: string
          date_debut_prevue: string | null
          date_fin_prevue: string | null
          estimated_value: number | null
          id: string
          lead_id: string | null
          postal_code: string
          product_name: string
          project_ref: string
          status: string
          surface_batiment_m2: number | null
          surface_isolee_m2: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to: string
          city: string
          client_name: string
          company?: string | null
          created_at?: string
          date_debut_prevue?: string | null
          date_fin_prevue?: string | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          postal_code: string
          product_name: string
          project_ref: string
          status?: string
          surface_batiment_m2?: number | null
          surface_isolee_m2?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string
          city?: string
          client_name?: string
          company?: string | null
          created_at?: string
          date_debut_prevue?: string | null
          date_fin_prevue?: string | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          postal_code?: string
          product_name?: string
          project_ref?: string
          status?: string
          surface_batiment_m2?: number | null
          surface_isolee_m2?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          id: string
          notes: string | null
          product_name: string
          project_id: string | null
          quote_ref: string
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          client_name: string
          created_at?: string
          id?: string
          notes?: string | null
          product_name: string
          project_id?: string | null
          quote_ref: string
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_name?: string
          project_id?: string | null
          quote_ref?: string
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string
          city: string
          client_name: string
          created_at: string
          date_debut: string
          date_fin_prevue: string | null
          id: string
          postal_code: string
          product_name: string
          progress_percentage: number | null
          project_id: string | null
          project_ref: string
          site_ref: string
          status: string
          team_members: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          client_name: string
          created_at?: string
          date_debut: string
          date_fin_prevue?: string | null
          id?: string
          postal_code: string
          product_name: string
          progress_percentage?: number | null
          project_id?: string | null
          project_ref: string
          site_ref: string
          status?: string
          team_members?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          client_name?: string
          created_at?: string
          date_debut?: string
          date_fin_prevue?: string | null
          id?: string
          postal_code?: string
          product_name?: string
          progress_percentage?: number | null
          project_id?: string | null
          project_ref?: string
          site_ref?: string
          status?: string
          team_members?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
