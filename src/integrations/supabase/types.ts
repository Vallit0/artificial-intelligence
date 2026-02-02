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
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      lti_platforms: {
        Row: {
          auth_endpoint: string
          client_id: string
          created_at: string | null
          deployment_id: string
          id: string
          is_active: boolean | null
          issuer_url: string
          jwks_url: string
          name: string
          token_endpoint: string
          updated_at: string | null
        }
        Insert: {
          auth_endpoint: string
          client_id: string
          created_at?: string | null
          deployment_id: string
          id?: string
          is_active?: boolean | null
          issuer_url: string
          jwks_url: string
          name: string
          token_endpoint: string
          updated_at?: string | null
        }
        Update: {
          auth_endpoint?: string
          client_id?: string
          created_at?: string | null
          deployment_id?: string
          id?: string
          is_active?: boolean | null
          issuer_url?: string
          jwks_url?: string
          name?: string
          token_endpoint?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lti_sessions: {
        Row: {
          context_id: string | null
          context_title: string | null
          created_at: string | null
          id: string
          last_launch_at: string | null
          lti_email: string | null
          lti_name: string | null
          lti_user_id: string
          platform_id: string
          resource_link_id: string | null
          roles: Database["public"]["Enums"]["lti_role"][] | null
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_title?: string | null
          created_at?: string | null
          id?: string
          last_launch_at?: string | null
          lti_email?: string | null
          lti_name?: string | null
          lti_user_id: string
          platform_id: string
          resource_link_id?: string | null
          roles?: Database["public"]["Enums"]["lti_role"][] | null
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_title?: string | null
          created_at?: string | null
          id?: string
          last_launch_at?: string | null
          lti_email?: string | null
          lti_name?: string | null
          lti_user_id?: string
          platform_id?: string
          resource_link_id?: string | null
          roles?: Database["public"]["Enums"]["lti_role"][] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lti_sessions_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "lti_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          ai_feedback: string | null
          created_at: string
          duration_seconds: number
          id: string
          passed: boolean | null
          rating: number | null
          scenario_id: string | null
          score: number | null
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          passed?: boolean | null
          rating?: number | null
          scenario_id?: string | null
          score?: number | null
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          passed?: boolean | null
          rating?: number | null
          scenario_id?: string | null
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          client_persona: string
          created_at: string | null
          description: string | null
          difficulty: string | null
          display_order: number | null
          first_message: string | null
          id: string
          is_active: boolean | null
          name: string
          objection: string
          script_content: Json | null
          voice_type: string | null
        }
        Insert: {
          client_persona: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          display_order?: number | null
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          objection: string
          script_content?: Json | null
          voice_type?: string | null
        }
        Update: {
          client_persona?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          display_order?: number | null
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          objection?: string
          script_content?: Json | null
          voice_type?: string | null
        }
        Relationships: []
      }
      student_grades: {
        Row: {
          certificate_generated_at: string | null
          created_at: string
          final_grade: number
          graded_by: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_generated_at?: string | null
          created_at?: string
          final_grade: number
          graded_by: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_generated_at?: string | null
          created_at?: string
          final_grade?: number
          graded_by?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_scenario_progress: {
        Row: {
          attempts: number
          best_score: number | null
          created_at: string
          first_completed_at: string | null
          id: string
          is_completed: boolean
          is_unlocked: boolean
          last_attempt_at: string | null
          scenario_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_score?: number | null
          created_at?: string
          first_completed_at?: string | null
          id?: string
          is_completed?: boolean
          is_unlocked?: boolean
          last_attempt_at?: string | null
          scenario_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_score?: number | null
          created_at?: string
          first_completed_at?: string | null
          id?: string
          is_completed?: boolean
          is_unlocked?: boolean
          last_attempt_at?: string | null
          scenario_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scenario_progress_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      lti_role: "instructor" | "learner" | "admin" | "content_developer"
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
      lti_role: ["instructor", "learner", "admin", "content_developer"],
    },
  },
} as const
