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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_settings: {
        Row: {
          api_token: string
          api_url: string
          auto_send_hour: number
          auto_send_minute: number
          broadcast_api_token: string
          broadcast_api_url: string
          broadcast_instance_name: string
          bulk_send_enabled: boolean
          campaigns_admin_test_phone: string
          campaigns_engine_enabled: boolean
          company_id: string
          created_at: string
          id: string
          instance_name: string
          overdue_charge_pause_days: number
          overdue_charge_pause_enabled: boolean
          overdue_cycle_cooldown_days: number
          overdue_inactive_after_days: number
          overdue_max_cycles: number
          overdue_sends_per_cycle: number
          pix_key: string
          send_interval_seconds: number
          uazapi_base_url: string
          updated_at: string
          winback_paused: boolean
        }
        Insert: {
          api_token?: string
          api_url?: string
          auto_send_hour?: number
          auto_send_minute?: number
          broadcast_api_token?: string
          broadcast_api_url?: string
          broadcast_instance_name?: string
          bulk_send_enabled?: boolean
          campaigns_admin_test_phone?: string
          campaigns_engine_enabled?: boolean
          company_id: string
          created_at?: string
          id?: string
          instance_name?: string
          overdue_charge_pause_days?: number
          overdue_charge_pause_enabled?: boolean
          overdue_cycle_cooldown_days?: number
          overdue_inactive_after_days?: number
          overdue_max_cycles?: number
          overdue_sends_per_cycle?: number
          pix_key?: string
          send_interval_seconds?: number
          uazapi_base_url?: string
          updated_at?: string
          winback_paused?: boolean
        }
        Update: {
          api_token?: string
          api_url?: string
          auto_send_hour?: number
          auto_send_minute?: number
          broadcast_api_token?: string
          broadcast_api_url?: string
          broadcast_instance_name?: string
          bulk_send_enabled?: boolean
          campaigns_admin_test_phone?: string
          campaigns_engine_enabled?: boolean
          company_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          overdue_charge_pause_days?: number
          overdue_charge_pause_enabled?: boolean
          overdue_cycle_cooldown_days?: number
          overdue_inactive_after_days?: number
          overdue_max_cycles?: number
          overdue_sends_per_cycle?: number
          pix_key?: string
          send_interval_seconds?: number
          uazapi_base_url?: string
          updated_at?: string
          winback_paused?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "api_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_send_category_settings: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_send_category_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_send_control_states: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          last_action: string
          last_activity_at: string | null
          last_error: string | null
          last_error_body: string | null
          pause_requested: boolean
          status: string
          stop_requested: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_action?: string
          last_activity_at?: string | null
          last_error?: string | null
          last_error_body?: string | null
          pause_requested?: boolean
          status?: string
          stop_requested?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_action?: string
          last_activity_at?: string | null
          last_error?: string | null
          last_error_body?: string | null
          pause_requested?: boolean
          status?: string
          stop_requested?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      auto_send_logs: {
        Row: {
          category: string
          client_id: string | null
          client_name: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          message_sent: string
          phone: string | null
          status: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          client_name?: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_sent?: string
          phone?: string | null
          status?: string
        }
        Update: {
          category?: string
          client_id?: string | null
          client_name?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_sent?: string
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_send_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_send_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_send_runtime_events: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          id: string
          level: string
          message: string
          metadata: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type?: string
          id?: string
          level?: string
          message: string
          metadata?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json
        }
        Relationships: []
      }
      bot_training_rules: {
        Row: {
          action_config: Json
          action_type: string
          company_id: string
          created_at: string
          id: string
          instruction: string
          is_active: boolean
          media_id: string | null
          trigger_question: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type?: string
          company_id: string
          created_at?: string
          id?: string
          instruction?: string
          is_active?: boolean
          media_id?: string | null
          trigger_question?: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          company_id?: string
          created_at?: string
          id?: string
          instruction?: string
          is_active?: boolean
          media_id?: string | null
          trigger_question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_training_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_training_rules_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "chatbot_media"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_presets: {
        Row: {
          audience_status: string
          automation_enabled: boolean
          company_id: string
          created_at: string
          date_name: string
          day_month: string
          id: string
          image_url: string | null
          is_configured: boolean
          last_auto_run_year: number | null
          message_text: string
          save_preset: boolean
          target_audience: string
          updated_at: string
        }
        Insert: {
          audience_status?: string
          automation_enabled?: boolean
          company_id: string
          created_at?: string
          date_name: string
          day_month: string
          id?: string
          image_url?: string | null
          is_configured?: boolean
          last_auto_run_year?: number | null
          message_text?: string
          save_preset?: boolean
          target_audience?: string
          updated_at?: string
        }
        Update: {
          audience_status?: string
          automation_enabled?: boolean
          company_id?: string
          created_at?: string
          date_name?: string
          day_month?: string
          id?: string
          image_url?: string | null
          is_configured?: boolean
          last_auto_run_year?: number | null
          message_text?: string
          save_preset?: boolean
          target_audience?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_presets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_auto_replies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          priority: number
          response_media_id: string | null
          response_text: string
          trigger_keyword: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          response_media_id?: string | null
          response_text?: string
          trigger_keyword?: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          response_media_id?: string | null
          response_text?: string
          trigger_keyword?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_auto_replies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_auto_replies_response_media_id_fkey"
            columns: ["response_media_id"]
            isOneToOne: false
            referencedRelation: "chatbot_media"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_blocked_contacts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          phone: string
          reason: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          phone?: string
          reason?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          phone?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_blocked_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversation_messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          phone: string
          role: string
        }
        Insert: {
          company_id: string
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversation_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_logs: {
        Row: {
          client_name: string
          company_id: string
          context_type: string
          created_at: string
          error_message: string | null
          id: string
          message_received: string
          message_sent: string
          phone: string
          status: string
        }
        Insert: {
          client_name?: string
          company_id: string
          context_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_received?: string
          message_sent?: string
          phone?: string
          status?: string
        }
        Update: {
          client_name?: string
          company_id?: string
          context_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_received?: string
          message_sent?: string
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_media: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_media_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_settings: {
        Row: {
          ai_decision_log: boolean
          ai_model: string
          ai_temperature: number
          away_message: string
          billing_cron_hour: number
          billing_cron_minute: number
          business_days: number[]
          business_hours_enabled: boolean
          business_hours_end: string
          business_hours_start: string
          client_instructions: string
          closing_message: string
          company_id: string
          created_at: string
          daily_schedule: Json | null
          id: string
          interactive_menu_body: string
          interactive_menu_button_text: string
          interactive_menu_enabled: boolean
          interactive_menu_footer: string
          interactive_menu_items: Json
          interactive_menu_title: string
          interactive_menu_type: string
          is_active: boolean
          max_delay_seconds: number
          max_messages_per_contact: number
          min_delay_seconds: number
          new_contact_instructions: string
          personality: string
          presence_enabled: boolean
          send_welcome_media_id: string | null
          transfer_keyword: string
          transfer_message: string
          transfer_phone: string
          unknown_message: string
          updated_at: string
          welcome_message: string
        }
        Insert: {
          ai_decision_log?: boolean
          ai_model?: string
          ai_temperature?: number
          away_message?: string
          billing_cron_hour?: number
          billing_cron_minute?: number
          business_days?: number[]
          business_hours_enabled?: boolean
          business_hours_end?: string
          business_hours_start?: string
          client_instructions?: string
          closing_message?: string
          company_id: string
          created_at?: string
          daily_schedule?: Json | null
          id?: string
          interactive_menu_body?: string
          interactive_menu_button_text?: string
          interactive_menu_enabled?: boolean
          interactive_menu_footer?: string
          interactive_menu_items?: Json
          interactive_menu_title?: string
          interactive_menu_type?: string
          is_active?: boolean
          max_delay_seconds?: number
          max_messages_per_contact?: number
          min_delay_seconds?: number
          new_contact_instructions?: string
          personality?: string
          presence_enabled?: boolean
          send_welcome_media_id?: string | null
          transfer_keyword?: string
          transfer_message?: string
          transfer_phone?: string
          unknown_message?: string
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          ai_decision_log?: boolean
          ai_model?: string
          ai_temperature?: number
          away_message?: string
          billing_cron_hour?: number
          billing_cron_minute?: number
          business_days?: number[]
          business_hours_enabled?: boolean
          business_hours_end?: string
          business_hours_start?: string
          client_instructions?: string
          closing_message?: string
          company_id?: string
          created_at?: string
          daily_schedule?: Json | null
          id?: string
          interactive_menu_body?: string
          interactive_menu_button_text?: string
          interactive_menu_enabled?: boolean
          interactive_menu_footer?: string
          interactive_menu_items?: Json
          interactive_menu_title?: string
          interactive_menu_type?: string
          is_active?: boolean
          max_delay_seconds?: number
          max_messages_per_contact?: number
          min_delay_seconds?: number
          new_contact_instructions?: string
          personality?: string
          presence_enabled?: boolean
          send_welcome_media_id?: string | null
          transfer_keyword?: string
          transfer_message?: string
          transfer_phone?: string
          unknown_message?: string
          updated_at?: string
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_activity_logs: {
        Row: {
          action: string
          client_id: string | null
          client_name: string
          company_id: string
          created_at: string
          created_by: string | null
          details: string | null
          id: string
        }
        Insert: {
          action: string
          client_id?: string | null
          client_name?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          client_id?: string | null
          client_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credentials: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          id: string
          label: string
          password: string
          username: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          label?: string
          password?: string
          username?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          label?: string
          password?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_mac_keys: {
        Row: {
          app_name: string
          client_id: string
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          key: string
          mac: string
        }
        Insert: {
          app_name?: string
          client_id: string
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key?: string
          mac?: string
        }
        Update: {
          app_name?: string
          client_id?: string
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key?: string
          mac?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_mac_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_mac_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          amount: number
          client_id: string
          company_id: string
          created_at: string
          custom_price: number | null
          end_date: string
          financial_notes: string | null
          id: string
          payment_status: string
          plan_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          company_id: string
          created_at?: string
          custom_price?: number | null
          end_date: string
          financial_notes?: string | null
          id?: string
          payment_status?: string
          plan_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          company_id?: string
          created_at?: string
          custom_price?: number | null
          end_date?: string
          financial_notes?: string | null
          id?: string
          payment_status?: string
          plan_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          charge_pause_note: string
          charge_pause_until: string | null
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          follow_up_active: boolean
          genero: string
          id: string
          iptv_password: string | null
          iptv_user: string | null
          name: string
          notes: string | null
          overdue_charge_cycles: number
          overdue_charge_resume_date: string | null
          overdue_charge_streak: number
          phone: string | null
          referred_by: string | null
          reseller_id: string | null
          server: string | null
          status: string
          support_started_at: string | null
          ultimo_envio_auto: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          charge_pause_note?: string
          charge_pause_until?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          follow_up_active?: boolean
          genero?: string
          id?: string
          iptv_password?: string | null
          iptv_user?: string | null
          name: string
          notes?: string | null
          overdue_charge_cycles?: number
          overdue_charge_resume_date?: string | null
          overdue_charge_streak?: number
          phone?: string | null
          referred_by?: string | null
          reseller_id?: string | null
          server?: string | null
          status?: string
          support_started_at?: string | null
          ultimo_envio_auto?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          charge_pause_note?: string
          charge_pause_until?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          follow_up_active?: boolean
          genero?: string
          id?: string
          iptv_password?: string | null
          iptv_user?: string | null
          name?: string
          notes?: string | null
          overdue_charge_cycles?: number
          overdue_charge_resume_date?: string | null
          overdue_charge_streak?: number
          phone?: string | null
          referred_by?: string | null
          reseller_id?: string | null
          server?: string | null
          status?: string
          support_started_at?: string | null
          ultimo_envio_auto?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          auto_block_days: number | null
          created_at: string
          credit_balance: number
          id: string
          name: string
          plan_type: string
          updated_at: string
        }
        Insert: {
          auto_block_days?: number | null
          created_at?: string
          credit_balance?: number
          id?: string
          name: string
          plan_type?: string
          updated_at?: string
        }
        Update: {
          auto_block_days?: number | null
          created_at?: string
          credit_balance?: number
          id?: string
          name?: string
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_trial: boolean
          role: Database["public"]["Enums"]["app_role"]
          trial_expires_at: string | null
          trial_link_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_trial?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          trial_expires_at?: string | null
          trial_link_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_trial?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          trial_expires_at?: string | null
          trial_link_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_trial_link_id_fkey"
            columns: ["trial_link_id"]
            isOneToOne: false
            referencedRelation: "trial_links"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          background_color: string
          brand_name: string
          company_id: string
          created_at: string
          icon_url: string | null
          id: string
          login_slug: string | null
          logo_url: string | null
          primary_color: string
          secondary_color: string
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string
          brand_name?: string
          company_id: string
          created_at?: string
          icon_url?: string | null
          id?: string
          login_slug?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string
          brand_name?: string
          company_id?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          login_slug?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_settings: {
        Row: {
          company_id: string
          created_at: string
          credit_cost_client: number
          credit_cost_subreseller: number
          credit_cost_trial: number
          default_credit_value: number
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          credit_cost_client?: number
          credit_cost_subreseller?: number
          credit_cost_trial?: number
          default_credit_value?: number
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          credit_cost_client?: number
          credit_cost_subreseller?: number
          credit_cost_trial?: number
          default_credit_value?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_broadcast_campaigns: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          failure_count: number
          greeting_templates: string[]
          id: string
          message_delay_max_seconds: number
          message_delay_min_seconds: number
          name: string
          offer_templates: string[]
          offer_timeout_minutes: number
          processed_recipients: number
          seller_instructions: string
          started_at: string | null
          status: string
          success_count: number
          total_recipients: number
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          failure_count?: number
          greeting_templates?: string[]
          id?: string
          message_delay_max_seconds?: number
          message_delay_min_seconds?: number
          name?: string
          offer_templates?: string[]
          offer_timeout_minutes?: number
          processed_recipients?: number
          seller_instructions?: string
          started_at?: string | null
          status?: string
          success_count?: number
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failure_count?: number
          greeting_templates?: string[]
          id?: string
          message_delay_max_seconds?: number
          message_delay_min_seconds?: number
          name?: string
          offer_templates?: string[]
          offer_timeout_minutes?: number
          processed_recipients?: number
          seller_instructions?: string
          started_at?: string | null
          status?: string
          success_count?: number
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_broadcast_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_broadcast_conversation_messages: {
        Row: {
          campaign_id: string
          company_id: string
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          id: string
          message: string
          message_type: string
          normalized_phone: string
          phone: string
          recipient_id: string | null
          sender_type: string
          source: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          message?: string
          message_type?: string
          normalized_phone: string
          phone: string
          recipient_id?: string | null
          sender_type?: string
          source?: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          message?: string
          message_type?: string
          normalized_phone?: string
          phone?: string
          recipient_id?: string | null
          sender_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_broadcast_conversation_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_conversation_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_conversation_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_broadcast_conversations: {
        Row: {
          campaign_id: string
          company_id: string
          contact_name: string
          conversation_status: string
          created_at: string
          has_reply: boolean
          id: string
          last_incoming_at: string | null
          last_message_at: string
          last_outgoing_at: string | null
          normalized_phone: string
          phone: string
          recipient_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          contact_name?: string
          conversation_status?: string
          created_at?: string
          has_reply?: boolean
          id?: string
          last_incoming_at?: string | null
          last_message_at?: string
          last_outgoing_at?: string | null
          normalized_phone: string
          phone: string
          recipient_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          contact_name?: string
          conversation_status?: string
          created_at?: string
          has_reply?: boolean
          id?: string
          last_incoming_at?: string | null
          last_message_at?: string
          last_outgoing_at?: string | null
          normalized_phone?: string
          phone?: string
          recipient_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_broadcast_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_conversations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_broadcast_logs: {
        Row: {
          campaign_id: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          message: string
          phone: string
          recipient_id: string | null
          status: string
          step: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          phone: string
          recipient_id?: string | null
          status: string
          step: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          phone?: string
          recipient_id?: string | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_broadcast_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_broadcast_recipients: {
        Row: {
          campaign_id: string
          company_id: string
          created_at: string
          current_step: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          next_action_at: string
          normalized_phone: string
          offer_template: string
          phone: string
          sent_greeting_at: string | null
          sent_offer_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          created_at?: string
          current_step?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          next_action_at?: string
          normalized_phone: string
          offer_template?: string
          phone: string
          sent_greeting_at?: string | null
          sent_offer_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          created_at?: string
          current_step?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          next_action_at?: string
          normalized_phone?: string
          offer_template?: string
          phone?: string
          sent_greeting_at?: string | null
          sent_offer_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mass_broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_broadcast_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          message: string
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          theme_preset: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          theme_preset?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          theme_preset?: string
          updated_at?: string
        }
        Relationships: []
      }
      reseller_activity_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          reseller_id: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reseller_id: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_activity_logs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_activity_logs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          reseller_id: string
          type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          reseller_id: string
          type?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          reseller_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_settings: {
        Row: {
          billing_message: string | null
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string | null
          reseller_id: string
          service_name: string
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          billing_message?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          reseller_id: string
          service_name?: string
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          billing_message?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          reseller_id?: string
          service_name?: string
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_settings_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: true
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_settings_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: true
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          can_create_subreseller: boolean
          can_create_trial: boolean
          can_resell: boolean
          company_id: string
          created_at: string
          credit_balance: number
          email: string | null
          id: string
          level: number
          name: string
          notes: string | null
          parent_reseller_id: string | null
          status: string
          subscription_expires_at: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          can_create_subreseller?: boolean
          can_create_trial?: boolean
          can_resell?: boolean
          company_id: string
          created_at?: string
          credit_balance?: number
          email?: string | null
          id?: string
          level?: number
          name: string
          notes?: string | null
          parent_reseller_id?: string | null
          status?: string
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          can_create_subreseller?: boolean
          can_create_trial?: boolean
          can_resell?: boolean
          company_id?: string
          created_at?: string
          credit_balance?: number
          email?: string | null
          id?: string
          level?: number
          name?: string
          notes?: string | null
          parent_reseller_id?: string | null
          status?: string
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resellers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resellers_parent_reseller_id_fkey"
            columns: ["parent_reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resellers_parent_reseller_id_fkey"
            columns: ["parent_reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          allow_sub_resellers: boolean
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          max_clients: number
          max_resellers: number
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          allow_sub_resellers?: boolean
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          max_clients?: number
          max_resellers?: number
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          allow_sub_resellers?: boolean
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          max_clients?: number
          max_resellers?: number
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_subscriptions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          end_date: string
          id: string
          notes: string | null
          payment_status: string
          saas_plan_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          payment_status?: string
          saas_plan_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          payment_status?: string
          saas_plan_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_subscriptions_saas_plan_id_fkey"
            columns: ["saas_plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          company_id: string
          cost_per_credit: number
          created_at: string
          id: string
          name: string
          url: string
        }
        Insert: {
          company_id: string
          cost_per_credit?: number
          created_at?: string
          id?: string
          name: string
          url?: string
        }
        Update: {
          company_id?: string
          cost_per_credit?: number
          created_at?: string
          id?: string
          name?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "servers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_links: {
        Row: {
          activated_at: string | null
          client_id: string | null
          client_name: string
          client_whatsapp: string | null
          company_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          reseller_id: string | null
          status: string
          token: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          client_id?: string | null
          client_name?: string
          client_whatsapp?: string | null
          company_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          reseller_id?: string | null
          status?: string
          token?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          client_id?: string | null
          client_name?: string
          client_whatsapp?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          reseller_id?: string | null
          status?: string
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_links_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_links_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          device_name: string
          id: string
          instance_name: string
          instance_token: string
          is_connected: boolean
          last_connection_at: string | null
          server_url: string
          status: string
          token: string
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          device_name?: string
          id?: string
          instance_name: string
          instance_token: string
          is_connected?: boolean
          last_connection_at?: string | null
          server_url: string
          status?: string
          token: string
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          device_name?: string
          id?: string
          instance_name?: string
          instance_token?: string
          is_connected?: boolean
          last_connection_at?: string | null
          server_url?: string
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      winback_campaign_progress: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          current_step: number
          id: string
          last_sent_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          current_step?: number
          id?: string
          last_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          current_step?: number
          id?: string
          last_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_campaign_progress_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_campaign_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      resellers_safe: {
        Row: {
          can_create_subreseller: boolean | null
          can_create_trial: boolean | null
          can_resell: boolean | null
          company_id: string | null
          created_at: string | null
          credit_balance: number | null
          email: string | null
          id: string | null
          level: number | null
          name: string | null
          notes: string | null
          parent_reseller_id: string | null
          status: string | null
          subscription_expires_at: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          can_create_subreseller?: boolean | null
          can_create_trial?: boolean | null
          can_resell?: boolean | null
          company_id?: string | null
          created_at?: string | null
          credit_balance?: number | null
          email?: string | null
          id?: string | null
          level?: number | null
          name?: string | null
          notes?: string | null
          parent_reseller_id?: string | null
          status?: string | null
          subscription_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          can_create_subreseller?: boolean | null
          can_create_trial?: boolean | null
          can_resell?: boolean | null
          company_id?: string | null
          created_at?: string | null
          credit_balance?: number | null
          email?: string | null
          id?: string | null
          level?: number | null
          name?: string | null
          notes?: string | null
          parent_reseller_id?: string | null
          status?: string | null
          subscription_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resellers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resellers_parent_reseller_id_fkey"
            columns: ["parent_reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resellers_parent_reseller_id_fkey"
            columns: ["parent_reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_client_credentials: {
        Args: { _client_id: string; _company_id: string }
        Returns: boolean
      }
      can_access_client_record: {
        Args: { _client_id: string; _company_id: string }
        Returns: boolean
      }
      get_reseller_account_plans: {
        Args: { _company_id: string }
        Returns: {
          plan_type: string
          reseller_id: string
        }[]
      }
      get_reseller_company_id: { Args: { _user_id: string }; Returns: string }
      get_reseller_id: { Args: { _user_id: string }; Returns: string }
      get_support_whatsapp: { Args: { _company_id: string }; Returns: string }
      get_trial_link_by_token: {
        Args: { _token: string }
        Returns: {
          client_name: string
          company_id: string
          created_at: string
          expires_at: string
          id: string
          status: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin_or_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      set_reseller_account_plan: {
        Args: { _plan_type: string; _reseller_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "operator"
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
      app_role: ["owner", "admin", "operator"],
    },
  },
} as const
