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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string | null
          changes: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          notes: string | null
          reason: string | null
          target_id: string
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          reason?: string | null
          target_id: string
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          reason?: string | null
          target_id?: string
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          bank_id: string
          completed_at: string | null
          created_at: string | null
          current_phase: string | null
          daily_double_positions: Json | null
          final_jeopardy_question: Json | null
          id: string
          num_teams: number
          selected_questions: string[] | null
          started_at: string | null
          status: string | null
          teacher_id: string
          team_names: Json | null
          timer_enabled: boolean | null
          timer_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          bank_id: string
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string | null
          daily_double_positions?: Json | null
          final_jeopardy_question?: Json | null
          id?: string
          num_teams: number
          selected_questions?: string[] | null
          started_at?: string | null
          status?: string | null
          teacher_id: string
          team_names?: Json | null
          timer_enabled?: boolean | null
          timer_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          bank_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string | null
          daily_double_positions?: Json | null
          final_jeopardy_question?: Json | null
          id?: string
          num_teams?: number
          selected_questions?: string[] | null
          started_at?: string | null
          status?: string | null
          teacher_id?: string
          team_names?: Json | null
          timer_enabled?: boolean | null
          timer_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          ip_address: string | null
          reason: string | null
          started_at: string | null
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string | null
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          id: string
          impersonated_by: string | null
          ip_address: string | null
          login_at: string | null
          login_method: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          impersonated_by?: string | null
          ip_address?: string | null
          login_at?: string | null
          login_method?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          impersonated_by?: string | null
          ip_address?: string | null
          login_at?: string | null
          login_method?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_impersonated_by_fkey"
            columns: ["impersonated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_stripe_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accessible_prebuilt_bank_ids: Json | null
          admin_notes: string | null
          billing_cycle: string | null
          created_at: string | null
          current_period_end: string | null
          custom_bank_count: number
          custom_bank_limit: number | null
          custom_plan_expires_at: string | null
          custom_plan_name: string | null
          custom_plan_notes: string | null
          custom_plan_type: string | null
          email: string
          email_verified_manually: boolean | null
          full_name: string | null
          games_created_count: number
          id: string
          is_active: boolean | null
          last_login_at: string | null
          plan_override_limits: Json | null
          role: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          suspended_at: string | null
          suspension_reason: string | null
          trial_end_date: string | null
          updated_at: string | null
        }
        Insert: {
          accessible_prebuilt_bank_ids?: Json | null
          admin_notes?: string | null
          billing_cycle?: string | null
          created_at?: string | null
          current_period_end?: string | null
          custom_bank_count?: number
          custom_bank_limit?: number | null
          custom_plan_expires_at?: string | null
          custom_plan_name?: string | null
          custom_plan_notes?: string | null
          custom_plan_type?: string | null
          email: string
          email_verified_manually?: boolean | null
          full_name?: string | null
          games_created_count?: number
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          plan_override_limits?: Json | null
          role?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          trial_end_date?: string | null
          updated_at?: string | null
        }
        /**
         * IMPORTANT: The following columns are protected by database triggers:
         * - custom_bank_count: Managed automatically by triggers. Direct updates blocked for non-admin users.
         * - custom_bank_limit: Set by subscription tier. Direct updates blocked for non-admin users.
         *
         * Attempting to UPDATE these columns will throw a PostgreSQL exception at runtime.
         * Use create_custom_bank_with_limit_check() RPC for bank creation.
         * Subscription tier changes must go through Stripe webhooks or admin functions.
         */
        Update: {
          accessible_prebuilt_bank_ids?: Json | null
          admin_notes?: string | null
          billing_cycle?: string | null
          created_at?: string | null
          current_period_end?: string | null
          /** @deprecated Managed by trigger. Direct updates blocked. Use create_custom_bank_with_limit_check() RPC. */
          custom_bank_count?: number
          /** @deprecated Managed by subscription tier. Direct updates blocked. Upgrade via Stripe. */
          custom_bank_limit?: number | null
          custom_plan_expires_at?: string | null
          custom_plan_name?: string | null
          custom_plan_notes?: string | null
          custom_plan_type?: string | null
          email?: string
          email_verified_manually?: boolean | null
          full_name?: string | null
          games_created_count?: number
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          plan_override_limits?: Json | null
          role?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          trial_end_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      question_banks: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          is_custom: boolean | null
          is_public: boolean | null
          owner_id: string | null
          subject: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_custom?: boolean | null
          is_public?: boolean | null
          owner_id?: string | null
          subject?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_custom?: boolean | null
          is_public?: boolean | null
          owner_id?: string | null
          subject?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_text: string
          bank_id: string | null
          category: string
          created_at: string | null
          id: string
          image_url: string | null
          point_value: number
          position: number
          question_text: string
          teacher_notes: string | null
          updated_at: string | null
        }
        Insert: {
          answer_text: string
          bank_id?: string | null
          category: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          point_value: number
          position: number
          question_text: string
          teacher_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          answer_text?: string
          bank_id?: string | null
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          point_value?: number
          position?: number
          question_text?: string
          teacher_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          reason_category: string
          refunded_by: string | null
          stripe_charge_id: string
          stripe_refund_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          reason_category: string
          refunded_by?: string | null
          stripe_charge_id: string
          stripe_refund_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          reason_category?: string
          refunded_by?: string | null
          stripe_charge_id?: string
          stripe_refund_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          connection_status: string | null
          created_at: string | null
          device_id: string | null
          final_jeopardy_answer: string | null
          final_jeopardy_submitted_at: string | null
          final_jeopardy_wager: number | null
          game_id: string | null
          id: string
          last_seen: string | null
          score: number | null
          team_name: string | null
          team_number: number
          updated_at: string | null
        }
        Insert: {
          connection_status?: string | null
          created_at?: string | null
          device_id?: string | null
          final_jeopardy_answer?: string | null
          final_jeopardy_submitted_at?: string | null
          final_jeopardy_wager?: number | null
          game_id?: string | null
          id?: string
          last_seen?: string | null
          score?: number | null
          team_name?: string | null
          team_number: number
          updated_at?: string | null
        }
        Update: {
          connection_status?: string | null
          created_at?: string | null
          device_id?: string | null
          final_jeopardy_answer?: string | null
          final_jeopardy_submitted_at?: string | null
          final_jeopardy_wager?: number | null
          game_id?: string | null
          id?: string
          last_seen?: string | null
          score?: number | null
          team_name?: string | null
          team_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_user_with_audit: {
        Args: {
          p_admin_id: string
          p_changes?: Json
          p_ip_address?: string
          p_notes?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_old_stripe_events: { Args: never; Returns: undefined }
      decrement_game_count: { Args: { p_user_id: string }; Returns: boolean }
      end_game: { Args: { p_game_id: string }; Returns: Json }
      end_impersonation_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      expire_old_impersonation_sessions: { Args: never; Returns: number }
      get_active_impersonation: { Args: never; Returns: Json }
      increment_game_count_if_allowed: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_changes?: Json
          p_ip_address?: string
          p_notes?: string
          p_reason?: string
          p_target_id: string
          p_target_type: string
          p_user_agent?: string
        }
        Returns: string
      }
      reveal_final_jeopardy_answer: {
        Args: {
          p_game_id: string
          p_is_correct: boolean
          p_teacher_id: string
          p_team_id: string
        }
        Returns: {
          error_message: string
          new_score: number
          score_change: number
          success: boolean
        }[]
      }
      skip_final_jeopardy: {
        Args: { p_game_id: string; p_teacher_id: string }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      start_final_jeopardy: {
        Args: { p_game_id: string; p_teacher_id: string }
        Returns: {
          error_message: string
          question: Json
          success: boolean
        }[]
      }
      start_impersonation_session: {
        Args: {
          p_ip_address?: string
          p_reason: string
          p_target_user_id: string
          p_user_agent?: string
        }
        Returns: Json
      }
      submit_final_jeopardy_answer: {
        Args: { p_answer: string; p_game_id: string; p_team_id: string }
        Returns: {
          error_message: string
          submitted_at: string
          success: boolean
        }[]
      }
      submit_final_jeopardy_wager: {
        Args: { p_game_id: string; p_team_id: string; p_wager: number }
        Returns: {
          error_message: string
          submitted_at: string
          success: boolean
        }[]
      }
      suspend_user_with_audit: {
        Args: {
          p_action_type: string
          p_admin_id: string
          p_changes?: Json
          p_formatted_reason: string
          p_ip_address?: string
          p_notes?: string
          p_reason: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_team_score: {
        Args: { p_game_id: string; p_score_change: number; p_team_id: string }
        Returns: {
          error_message: string
          new_score: number
          success: boolean
          team_id: string
        }[]
      }
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
