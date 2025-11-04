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
      appointment_types: {
        Row: {
          created_at: string
          email_template_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_template_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_template_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delegates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          price_eur_per_mwh: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          price_eur_per_mwh?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          price_eur_per_mwh?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_first_name: string | null
          client_last_name: string | null
          client_name: string
          created_at: string
          due_date: string | null
          id: string
          invoice_ref: string
          notes: string | null
          org_id: string | null
          paid_date: string | null
          project_id: string | null
          quote_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_first_name?: string | null
          client_last_name?: string | null
          client_name: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_ref: string
          notes?: string | null
          org_id?: string | null
          paid_date?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_first_name?: string | null
          client_last_name?: string | null
          client_name?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_ref?: string
          notes?: string | null
          org_id?: string | null
          paid_date?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
      lead_product_types: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_product_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string
          appointment_type_id: string | null
          assigned_to: string | null
          city: string
          commentaire: string | null
          company: string | null
          created_at: string
          created_by: string | null
          date_rdv: string | null
          email: string
          extra_fields: Json | null
          first_name: string | null
          full_name: string
          heure_rdv: string | null
          id: string
          last_name: string | null
          org_id: string | null
          phone_raw: string
          photo_previsite_url: string | null
          postal_code: string
          product_name: string | null
          siren: string | null
          status: string
          surface_m2: number | null
          updated_at: string
          user_id: string
          utm_source: string | null
        }
        Insert: {
          address?: string
          appointment_type_id?: string | null
          assigned_to?: string | null
          city: string
          commentaire?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          date_rdv?: string | null
          email: string
          extra_fields?: Json | null
          first_name?: string | null
          full_name: string
          heure_rdv?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          phone_raw: string
          photo_previsite_url?: string | null
          postal_code: string
          product_name?: string | null
          siren?: string | null
          status?: string
          surface_m2?: number | null
          updated_at?: string
          user_id: string
          utm_source?: string | null
        }
        Update: {
          address?: string
          appointment_type_id?: string | null
          assigned_to?: string | null
          city?: string
          commentaire?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          date_rdv?: string | null
          email?: string
          extra_fields?: Json | null
          first_name?: string | null
          full_name?: string
          heure_rdv?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          phone_raw?: string
          photo_previsite_url?: string | null
          postal_code?: string
          product_name?: string | null
          siren?: string | null
          status?: string
          surface_m2?: number | null
          updated_at?: string
          user_id?: string
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          org_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          org_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          org_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          business_location:
            | Database["public"]["Enums"]["business_location"]
            | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          postal_code: string | null
          prime_bonification: number | null
          siret: string | null
          tva: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_location?:
            | Database["public"]["Enums"]["business_location"]
            | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          postal_code?: string | null
          prime_bonification?: number | null
          siret?: string | null
          tva?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_location?:
            | Database["public"]["Enums"]["business_location"]
            | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          postal_code?: string | null
          prime_bonification?: number | null
          siret?: string | null
          tva?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_catalog: {
        Row: {
          base_price_ht: number | null
          category: string | null
          cee_config: Json | null
          code: string
          created_at: string
          custom_description_primary: string | null
          custom_description_secondary: string | null
          default_params: Json | null
          description: string | null
          eco_admin_percentage: number | null
          eco_furn_percentage: number | null
          eco_log_percentage: number | null
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          owner_id: string
          params_schema: Json | null
          price_ttc: number | null
          prime_percentage: number | null
          schema_version: number
          supplier_name: string | null
          supplier_reference: string | null
          technical_sheet_url: string | null
          tva_percentage: number | null
          unit_type: string | null
          updated_at: string
          valeur_sante_entrepot_commerce_ge_400: number | null
          valeur_sante_entrepot_commerce_lt_400: number | null
        }
        Insert: {
          base_price_ht?: number | null
          category?: string | null
          cee_config?: Json | null
          code: string
          created_at?: string
          custom_description_primary?: string | null
          custom_description_secondary?: string | null
          default_params?: Json | null
          description?: string | null
          eco_admin_percentage?: number | null
          eco_furn_percentage?: number | null
          eco_log_percentage?: number | null
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          owner_id: string
          params_schema?: Json | null
          price_ttc?: number | null
          prime_percentage?: number | null
          schema_version?: number
          supplier_name?: string | null
          supplier_reference?: string | null
          technical_sheet_url?: string | null
          tva_percentage?: number | null
          unit_type?: string | null
          updated_at?: string
          valeur_sante_entrepot_commerce_ge_400?: number | null
          valeur_sante_entrepot_commerce_lt_400?: number | null
        }
        Update: {
          base_price_ht?: number | null
          category?: string | null
          cee_config?: Json | null
          code?: string
          created_at?: string
          custom_description_primary?: string | null
          custom_description_secondary?: string | null
          default_params?: Json | null
          description?: string | null
          eco_admin_percentage?: number | null
          eco_furn_percentage?: number | null
          eco_log_percentage?: number | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          owner_id?: string
          params_schema?: Json | null
          price_ttc?: number | null
          prime_percentage?: number | null
          schema_version?: number
          supplier_name?: string | null
          supplier_reference?: string | null
          technical_sheet_url?: string | null
          tva_percentage?: number | null
          unit_type?: string | null
          updated_at?: string
          valeur_sante_entrepot_commerce_ge_400?: number | null
          valeur_sante_entrepot_commerce_lt_400?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kwh_cumac: {
        Row: {
          building_type: string
          created_at: string
          id: string
          kwh_cumac: number
          product_id: string
          updated_at: string
        }
        Insert: {
          building_type: string
          created_at?: string
          id?: string
          kwh_cumac: number
          product_id: string
          updated_at?: string
        }
        Update: {
          building_type?: string
          created_at?: string
          id?: string
          kwh_cumac?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kwh_cumac_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
        ]
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
      project_appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          appointment_type_id: string | null
          assignee_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          org_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          appointment_type_id?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          org_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          appointment_type_id?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          org_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_appointments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media: {
        Row: {
          category: Database["public"]["Enums"]["project_media_category"]
          created_at: string
          created_by: string | null
          drive_url: string | null
          file_name: string
          file_url: string | null
          id: string
          mime_type: string | null
          org_id: string
          preview_url: string | null
          project_id: string
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["project_media_category"]
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          mime_type?: string | null
          org_id: string
          preview_url?: string | null
          project_id: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["project_media_category"]
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          preview_url?: string | null
          project_id?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_products: {
        Row: {
          created_at: string
          dynamic_params: Json | null
          id: string
          product_id: string
          project_id: string
          quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dynamic_params?: Json | null
          id?: string
          product_id: string
          project_id: string
          quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dynamic_params?: Json | null
          id?: string
          product_id?: string
          project_id?: string
          quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          notes: string | null
          org_id: string
          project_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          project_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string
          id: string
          next_step: string | null
          org_id: string
          project_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          next_step?: string | null
          org_id: string
          project_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          next_step?: string | null
          org_id?: string
          project_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          assigned_to: string
          building_type: string | null
          city: string
          client_first_name: string | null
          client_last_name: string | null
          client_name: string
          company: string | null
          created_at: string
          date_debut_prevue: string | null
          date_fin_prevue: string | null
          delegate_id: string | null
          discount: number | null
          email: string | null
          estimated_value: number | null
          external_reference: string | null
          hq_address: string | null
          hq_city: string | null
          hq_postal_code: string | null
          id: string
          lead_id: string | null
          org_id: string | null
          phone: string | null
          postal_code: string
          prime_cee: number | null
          prime_cee_total_cents: number | null
          product_cee_categories: string | null
          product_name: string
          project_ref: string
          same_address: boolean | null
          signatory_name: string | null
          signatory_title: string | null
          siren: string | null
          source: string | null
          status: string
          surface_batiment_m2: number | null
          surface_isolee_m2: number | null
          unit_price: number | null
          updated_at: string
          usage: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          assigned_to: string
          building_type?: string | null
          city: string
          client_first_name?: string | null
          client_last_name?: string | null
          client_name: string
          company?: string | null
          created_at?: string
          date_debut_prevue?: string | null
          date_fin_prevue?: string | null
          delegate_id?: string | null
          discount?: number | null
          email?: string | null
          estimated_value?: number | null
          external_reference?: string | null
          hq_address?: string | null
          hq_city?: string | null
          hq_postal_code?: string | null
          id?: string
          lead_id?: string | null
          org_id?: string | null
          phone?: string | null
          postal_code: string
          prime_cee?: number | null
          prime_cee_total_cents?: number | null
          product_cee_categories?: string | null
          product_name: string
          project_ref: string
          same_address?: boolean | null
          signatory_name?: string | null
          signatory_title?: string | null
          siren?: string | null
          source?: string | null
          status?: string
          surface_batiment_m2?: number | null
          surface_isolee_m2?: number | null
          unit_price?: number | null
          updated_at?: string
          usage?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          assigned_to?: string
          building_type?: string | null
          city?: string
          client_first_name?: string | null
          client_last_name?: string | null
          client_name?: string
          company?: string | null
          created_at?: string
          date_debut_prevue?: string | null
          date_fin_prevue?: string | null
          delegate_id?: string | null
          discount?: number | null
          email?: string | null
          estimated_value?: number | null
          external_reference?: string | null
          hq_address?: string | null
          hq_city?: string | null
          hq_postal_code?: string | null
          id?: string
          lead_id?: string | null
          org_id?: string | null
          phone?: string | null
          postal_code?: string
          prime_cee?: number | null
          prime_cee_total_cents?: number | null
          product_cee_categories?: string | null
          product_name?: string
          project_ref?: string
          same_address?: boolean | null
          signatory_name?: string | null
          signatory_title?: string | null
          siren?: string | null
          source?: string | null
          status?: string
          surface_batiment_m2?: number | null
          surface_isolee_m2?: number | null
          unit_price?: number | null
          updated_at?: string
          usage?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          client_first_name: string | null
          client_last_name: string | null
          client_name: string
          created_at: string
          id: string
          notes: string | null
          org_id: string | null
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
          client_first_name?: string | null
          client_last_name?: string | null
          client_name: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
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
          client_first_name?: string | null
          client_last_name?: string | null
          client_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
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
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          org_id: string
          statuts_projets: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          org_id: string
          statuts_projets?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          org_id?: string
          statuts_projets?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          additional_costs: Json | null
          address: string
          ca_ttc: number | null
          city: string
          client_first_name: string | null
          client_last_name: string | null
          client_name: string
          cofrac_status: string | null
          commission_commerciale_ht: string | null
          commission_commerciale_ht_montant: number | null
          commission_commerciale_par_m2: number | null
          commission_eur_per_m2: number | null
          commission_eur_per_m2_enabled: boolean | null
          cout_chantier_ttc: number | null
          cout_isolant_par_m2: number | null
          cout_isolation_m2: number | null
          cout_main_oeuvre_m2_ht: number | null
          cout_materiaux_par_m2: number | null
          cout_mo_par_m2: number | null
          cout_total_materiaux: number | null
          cout_total_materiaux_eclairage: number | null
          cout_total_mo: number | null
          created_at: string
          date_debut: string
          date_fin: string | null
          date_fin_prevue: string | null
          frais_additionnels_total: number | null
          id: string
          isolation_utilisee_m2: number | null
          marge_totale_ttc: number | null
          montant_commission: number | null
          nb_luminaires: number | null
          notes: string | null
          org_id: string | null
          postal_code: string
          product_name: string
          profit_margin: number | null
          progress_percentage: number | null
          project_id: string | null
          project_ref: string
          rentability_additional_costs_total: number | null
          rentability_margin_per_unit: number | null
          rentability_margin_rate: number | null
          rentability_margin_total: number | null
          rentability_total_costs: number | null
          rentability_unit_label: string | null
          revenue: number | null
          site_ref: string
          status: string
          subcontractor_id: string | null
          subcontractor_payment_confirmed: boolean
          surface_facturee: number | null
          surface_facturee_m2: number | null
          surface_posee_m2: number | null
          team_members: string[] | null
          travaux_non_subventionnes: string | null
          travaux_non_subventionnes_client: number | null
          travaux_non_subventionnes_montant: number | null
          tva_rate: number | null
          updated_at: string
          user_id: string
          valorisation_cee: number | null
        }
        Insert: {
          additional_costs?: Json | null
          address: string
          ca_ttc?: number | null
          city: string
          client_first_name?: string | null
          client_last_name?: string | null
          client_name: string
          cofrac_status?: string | null
          commission_commerciale_ht?: string | null
          commission_commerciale_ht_montant?: number | null
          commission_commerciale_par_m2?: number | null
          commission_eur_per_m2?: number | null
          commission_eur_per_m2_enabled?: boolean | null
          cout_chantier_ttc?: number | null
          cout_isolant_par_m2?: number | null
          cout_isolation_m2?: number | null
          cout_main_oeuvre_m2_ht?: number | null
          cout_materiaux_par_m2?: number | null
          cout_mo_par_m2?: number | null
          cout_total_materiaux?: number | null
          cout_total_materiaux_eclairage?: number | null
          cout_total_mo?: number | null
          created_at?: string
          date_debut: string
          date_fin?: string | null
          date_fin_prevue?: string | null
          frais_additionnels_total?: number | null
          id?: string
          isolation_utilisee_m2?: number | null
          marge_totale_ttc?: number | null
          montant_commission?: number | null
          nb_luminaires?: number | null
          notes?: string | null
          org_id?: string | null
          postal_code: string
          product_name: string
          profit_margin?: number | null
          progress_percentage?: number | null
          project_id?: string | null
          project_ref: string
          rentability_additional_costs_total?: number | null
          rentability_margin_per_unit?: number | null
          rentability_margin_rate?: number | null
          rentability_margin_total?: number | null
          rentability_total_costs?: number | null
          rentability_unit_label?: string | null
          revenue?: number | null
          site_ref: string
          status?: string
          subcontractor_id?: string | null
          subcontractor_payment_confirmed?: boolean
          surface_facturee?: number | null
          surface_facturee_m2?: number | null
          surface_posee_m2?: number | null
          team_members?: string[] | null
          travaux_non_subventionnes?: string | null
          travaux_non_subventionnes_client?: number | null
          travaux_non_subventionnes_montant?: number | null
          tva_rate?: number | null
          updated_at?: string
          user_id: string
          valorisation_cee?: number | null
        }
        Update: {
          additional_costs?: Json | null
          address?: string
          ca_ttc?: number | null
          city?: string
          client_first_name?: string | null
          client_last_name?: string | null
          client_name?: string
          cofrac_status?: string | null
          commission_commerciale_ht?: string | null
          commission_commerciale_ht_montant?: number | null
          commission_commerciale_par_m2?: number | null
          commission_eur_per_m2?: number | null
          commission_eur_per_m2_enabled?: boolean | null
          cout_chantier_ttc?: number | null
          cout_isolant_par_m2?: number | null
          cout_isolation_m2?: number | null
          cout_main_oeuvre_m2_ht?: number | null
          cout_materiaux_par_m2?: number | null
          cout_mo_par_m2?: number | null
          cout_total_materiaux?: number | null
          cout_total_materiaux_eclairage?: number | null
          cout_total_mo?: number | null
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          date_fin_prevue?: string | null
          frais_additionnels_total?: number | null
          id?: string
          isolation_utilisee_m2?: number | null
          marge_totale_ttc?: number | null
          montant_commission?: number | null
          nb_luminaires?: number | null
          notes?: string | null
          org_id?: string | null
          postal_code?: string
          product_name?: string
          profit_margin?: number | null
          progress_percentage?: number | null
          project_id?: string | null
          project_ref?: string
          rentability_additional_costs_total?: number | null
          rentability_margin_per_unit?: number | null
          rentability_margin_rate?: number | null
          rentability_margin_total?: number | null
          rentability_total_costs?: number | null
          rentability_unit_label?: string | null
          revenue?: number | null
          site_ref?: string
          status?: string
          subcontractor_id?: string | null
          subcontractor_payment_confirmed?: boolean
          surface_facturee?: number | null
          surface_facturee_m2?: number | null
          surface_posee_m2?: number | null
          team_members?: string[] | null
          travaux_non_subventionnes?: string | null
          travaux_non_subventionnes_client?: number | null
          travaux_non_subventionnes_montant?: number | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string
          valorisation_cee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          org_id: string
          pricing_details: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          org_id: string
          pricing_details?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          org_id?: string
          pricing_details?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_membership: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner_or_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_user_id_by_email: { Args: { email: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "commercial" | "user"
      business_location:
        | "metropole"
        | "guadeloupe"
        | "martinique"
        | "guyane"
        | "reunion"
        | "mayotte"
      org_role: "owner" | "admin" | "member" | "commercial"
      project_media_category:
        | "PHOTOS"
        | "DEVIS"
        | "FACTURES"
        | "CONTRATS"
        | "TECHNIQUES"
        | "AUTRES"
        | "PRODUITS"
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
      app_role: ["admin", "commercial", "user"],
      business_location: [
        "metropole",
        "guadeloupe",
        "martinique",
        "guyane",
        "reunion",
        "mayotte",
      ],
      org_role: ["owner", "admin", "member", "commercial"],
      project_media_category: [
        "PHOTOS",
        "DEVIS",
        "FACTURES",
        "CONTRATS",
        "TECHNIQUES",
        "AUTRES",
        "PRODUITS",
      ],
    },
  },
} as const
