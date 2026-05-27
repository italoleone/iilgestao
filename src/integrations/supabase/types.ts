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
      active_timers: {
        Row: {
          id: string
          project_id: string
          started_at: string
          task_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          id?: string
          project_id: string
          started_at?: string
          task_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          id?: string
          project_id?: string
          started_at?: string
          task_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_timers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_timers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      commercial_clients: {
        Row: {
          city: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      commercial_proposals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          area_m2: number
          arquivo_ref_1: string | null
          arquivo_ref_2: string | null
          billing_mode: string
          client_id: string
          created_at: string
          disciplines: Json
          discounts: Json
          final_disciplines: Json
          final_total_value: number
          id: string
          installment_count: number | null
          installment_start_month: number | null
          installment_start_year: number | null
          linked_project_id: string | null
          notes: string | null
          price_per_m2: Json
          project_name: string
          proposal_date: string
          responsible_id: string
          scope: string
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          area_m2: number
          arquivo_ref_1?: string | null
          arquivo_ref_2?: string | null
          billing_mode?: string
          client_id: string
          created_at?: string
          disciplines?: Json
          discounts?: Json
          final_disciplines?: Json
          final_total_value?: number
          id?: string
          installment_count?: number | null
          installment_start_month?: number | null
          installment_start_year?: number | null
          linked_project_id?: string | null
          notes?: string | null
          price_per_m2?: Json
          project_name: string
          proposal_date?: string
          responsible_id: string
          scope?: string
          status?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          area_m2?: number
          arquivo_ref_1?: string | null
          arquivo_ref_2?: string | null
          billing_mode?: string
          client_id?: string
          created_at?: string
          disciplines?: Json
          discounts?: Json
          final_disciplines?: Json
          final_total_value?: number
          id?: string
          installment_count?: number | null
          installment_start_month?: number | null
          installment_start_year?: number | null
          linked_project_id?: string | null
          notes?: string | null
          price_per_m2?: Json
          project_name?: string
          proposal_date?: string
          responsible_id?: string
          scope?: string
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "commercial_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          audio_path: string | null
          created_at: string
          created_by: string
          date: string
          end_time: string | null
          id: string
          minutes_text: string | null
          name: string
          pdf_path: string | null
          processing_status: string
          project_id: string
          speaker_map: Json | null
          start_time: string
          transcription: string | null
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          created_by: string
          date?: string
          end_time?: string | null
          id?: string
          minutes_text?: string | null
          name: string
          pdf_path?: string | null
          processing_status?: string
          project_id: string
          speaker_map?: Json | null
          start_time: string
          transcription?: string | null
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          created_by?: string
          date?: string
          end_time?: string | null
          id?: string
          minutes_text?: string | null
          name?: string
          pdf_path?: string | null
          processing_status?: string
          project_id?: string
          speaker_map?: Json | null
          start_time?: string
          transcription?: string | null
        }
        Relationships: []
      }
      payables: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          recurrent: boolean
          recurrent_day: number | null
          status: string
          supplier: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          recurrent?: boolean
          recurrent_day?: number | null
          status?: string
          supplier?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          recurrent?: boolean
          recurrent_day?: number | null
          status?: string
          supplier?: string | null
        }
        Relationships: []
      }
      pdf_annotations: {
        Row: {
          annotation_data: Json
          attachment_id: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          annotation_data?: Json
          attachment_id: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
          user_name?: string
        }
        Update: {
          annotation_data?: Json
          attachment_id?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_annotations_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "task_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_annotations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cost_per_hour: number | null
          created_at: string | null
          discipline: string | null
          email: string
          id: string
          monthly_capacity_hours: number | null
          name: string
          status: string
        }
        Insert: {
          avatar_url?: string | null
          cost_per_hour?: number | null
          created_at?: string | null
          discipline?: string | null
          email?: string
          id: string
          monthly_capacity_hours?: number | null
          name?: string
          status?: string
        }
        Update: {
          avatar_url?: string | null
          cost_per_hour?: number | null
          created_at?: string | null
          discipline?: string | null
          email?: string
          id?: string
          monthly_capacity_hours?: number | null
          name?: string
          status?: string
        }
        Relationships: []
      }
      project_billing_schedule: {
        Row: {
          amount: number
          billing_month: number | null
          billing_year: number | null
          created_at: string
          created_by: string | null
          execution_month: number | null
          execution_year: number | null
          id: string
          project_id: string
          stage_key: string
          stage_label: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_month?: number | null
          billing_year?: number | null
          created_at?: string
          created_by?: string | null
          execution_month?: number | null
          execution_year?: number | null
          id?: string
          project_id: string
          stage_key: string
          stage_label: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_month?: number | null
          billing_year?: number | null
          created_at?: string
          created_by?: string | null
          execution_month?: number | null
          execution_year?: number | null
          id?: string
          project_id?: string
          stage_key?: string
          stage_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_schedule_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string
          created_at: string
          deadline: string
          discipline: string
          hours_sold: number
          hours_worked: number
          id: string
          name: string
          responsible: string
          revisions: Json
          sale_value: number
          stages: Json
          start_date: string
          status: string
          team: string[]
        }
        Insert: {
          client: string
          created_at?: string
          deadline: string
          discipline: string
          hours_sold?: number
          hours_worked?: number
          id?: string
          name: string
          responsible: string
          revisions?: Json
          sale_value?: number
          stages?: Json
          start_date: string
          status?: string
          team?: string[]
        }
        Update: {
          client?: string
          created_at?: string
          deadline?: string
          discipline?: string
          hours_sold?: number
          hours_worked?: number
          id?: string
          name?: string
          responsible?: string
          revisions?: Json
          sale_value?: number
          stages?: Json
          start_date?: string
          status?: string
          team?: string[]
        }
        Relationships: []
      }
      proposal_billing_schedule: {
        Row: {
          amount: number
          billing_month: number
          billing_year: number
          created_at: string
          created_by: string | null
          discipline_key: string
          discipline_label: string
          execution_month: number | null
          execution_year: number | null
          id: string
          installment_count: number | null
          is_installment: boolean
          percentage: number
          proposal_id: string
          stage_key: string
          stage_label: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_month: number
          billing_year: number
          created_at?: string
          created_by?: string | null
          discipline_key?: string
          discipline_label?: string
          execution_month?: number | null
          execution_year?: number | null
          id?: string
          installment_count?: number | null
          is_installment?: boolean
          percentage?: number
          proposal_id: string
          stage_key: string
          stage_label: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_month?: number
          billing_year?: number
          created_at?: string
          created_by?: string | null
          discipline_key?: string
          discipline_label?: string
          execution_month?: number | null
          execution_year?: number | null
          id?: string
          installment_count?: number | null
          is_installment?: boolean
          percentage?: number
          proposal_id?: string
          stage_key?: string
          stage_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_billing_schedule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_billing_schedule_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          category: string
          client_name: string
          competence_date: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          installment_number: string | null
          nf_number: string | null
          notes: string | null
          project_id: string | null
          proposal_id: string | null
          received_date: string | null
          status: string
          tax_percentage: number | null
        }
        Insert: {
          amount?: number
          category?: string
          client_name: string
          competence_date?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date: string
          id?: string
          installment_number?: string | null
          nf_number?: string | null
          notes?: string | null
          project_id?: string | null
          proposal_id?: string | null
          received_date?: string | null
          status?: string
          tax_percentage?: number | null
        }
        Update: {
          amount?: number
          category?: string
          client_name?: string
          competence_date?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          installment_number?: string | null
          nf_number?: string | null
          notes?: string | null
          project_id?: string | null
          proposal_id?: string | null
          received_date?: string | null
          status?: string
          tax_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          sheet_title: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          sheet_title?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          sheet_title?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          parent_id: string | null
          task_id: string
          title: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          task_id: string
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_review_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          page: number | null
          task_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          page?: number | null
          task_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          page?: number | null
          task_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          discipline: string
          end_date: string | null
          estimated_hours: number
          hours_worked: number
          id: string
          name: string
          parent_task_id: string | null
          project_id: string
          rejection_reason: string | null
          responsible: string | null
          stage_name: string
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          discipline: string
          end_date?: string | null
          estimated_hours?: number
          hours_worked?: number
          id?: string
          name: string
          parent_task_id?: string | null
          project_id: string
          rejection_reason?: string | null
          responsible?: string | null
          stage_name: string
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          discipline?: string
          end_date?: string | null
          estimated_hours?: number
          hours_worked?: number
          id?: string
          name?: string
          parent_task_id?: string | null
          project_id?: string
          rejection_reason?: string | null
          responsible?: string | null
          stage_name?: string
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          id: string
          project_id: string
          start_time: string
          task_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          date?: string
          duration_minutes?: number
          end_time: string
          id?: string
          project_id: string
          start_time: string
          task_id: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number
          end_time?: string
          id?: string
          project_id?: string
          start_time?: string
          task_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_start_timer: {
        Args: { _project_id: string; _task_id: string }
        Returns: undefined
      }
      fn_stop_timer: { Args: never; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin_geral"
        | "admin"
        | "planejamento"
        | "coordenador"
        | "projetista"
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
      app_role: [
        "admin_geral",
        "admin",
        "planejamento",
        "coordenador",
        "projetista",
      ],
    },
  },
} as const
