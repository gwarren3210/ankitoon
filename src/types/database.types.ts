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
      chapter_vocabulary: {
        Row: {
          chapter_id: string
          example: string | null
          id: string
          importance_score: number
          vocabulary_id: string
        }
        Insert: {
          chapter_id: string
          example?: string | null
          id?: string
          importance_score?: number
          vocabulary_id: string
        }
        Update: {
          chapter_id?: string
          example?: string | null
          id?: string
          importance_score?: number
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_vocabulary_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_vocabulary_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          chapter_number: number
          created_at: string | null
          external_url: string | null
          id: string
          series_id: string
          title: string | null
        }
        Insert: {
          chapter_number: number
          created_at?: string | null
          external_url?: string | null
          id?: string
          series_id: string
          title?: string | null
        }
        Update: {
          chapter_number?: number
          created_at?: string | null
          external_url?: string | null
          id?: string
          series_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          max_new_cards: number | null
          max_total_cards: number | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          max_new_cards?: number | null
          max_total_cards?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          max_new_cards?: number | null
          max_total_cards?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      series: {
        Row: {
          alt_names: string[] | null
          authors: string[] | null
          created_at: string | null
          genres: string[] | null
          id: string
          korean_name: string | null
          name: string
          num_chapters: number
          picture_url: string | null
          popularity: number | null
          slug: string
          synopsis: string | null
          updated_at: string | null
        }
        Insert: {
          alt_names?: string[] | null
          authors?: string[] | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          korean_name?: string | null
          name: string
          num_chapters?: number
          picture_url?: string | null
          popularity?: number | null
          slug: string
          synopsis?: string | null
          updated_at?: string | null
        }
        Update: {
          alt_names?: string[] | null
          authors?: string[] | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          korean_name?: string | null
          name?: string
          num_chapters?: number
          picture_url?: string | null
          popularity?: number | null
          slug?: string
          synopsis?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      srs_progress_logs: {
        Row: {
          created_at: string | null
          difficulty: number
          due: string
          elapsed_days: number
          id: string
          lapses: number
          last_review: string | null
          learning_steps: number | null
          rating: Database["public"]["Enums"]["rating_type"] | null
          reps: number
          review: string | null
          scheduled_days: number
          srs_card_id: string | null
          stability: number
          state: Database["public"]["Enums"]["srs_state"]
          user_id: string
          vocabulary_id: string
        }
        Insert: {
          created_at?: string | null
          difficulty: number
          due: string
          elapsed_days?: number
          id?: string
          lapses?: number
          last_review?: string | null
          learning_steps?: number | null
          rating?: Database["public"]["Enums"]["rating_type"] | null
          reps?: number
          review?: string | null
          scheduled_days?: number
          srs_card_id?: string | null
          stability: number
          state?: Database["public"]["Enums"]["srs_state"]
          user_id: string
          vocabulary_id: string
        }
        Update: {
          created_at?: string | null
          difficulty?: number
          due?: string
          elapsed_days?: number
          id?: string
          lapses?: number
          last_review?: string | null
          learning_steps?: number | null
          rating?: Database["public"]["Enums"]["rating_type"] | null
          reps?: number
          review?: string | null
          scheduled_days?: number
          srs_card_id?: string | null
          stability?: number
          state?: Database["public"]["Enums"]["srs_state"]
          user_id?: string
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "srs_progress_logs_srs_card_id_fkey"
            columns: ["srs_card_id"]
            isOneToOne: false
            referencedRelation: "user_deck_srs_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srs_progress_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srs_progress_logs_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chapter_decks: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chapter_decks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_chapter_decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chapter_progress_summary: {
        Row: {
          accuracy: number | null
          chapter_id: string
          completed: boolean | null
          created_at: string | null
          current_streak: number | null
          first_studied: string | null
          id: string
          last_studied: string | null
          num_cards_studied: number
          series_id: string
          time_spent_seconds: number | null
          total_cards: number | null
          unique_vocab_seen: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          chapter_id: string
          completed?: boolean | null
          created_at?: string | null
          current_streak?: number | null
          first_studied?: string | null
          id?: string
          last_studied?: string | null
          num_cards_studied?: number
          series_id: string
          time_spent_seconds?: number | null
          total_cards?: number | null
          unique_vocab_seen?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          chapter_id?: string
          completed?: boolean | null
          created_at?: string | null
          current_streak?: number | null
          first_studied?: string | null
          id?: string
          last_studied?: string | null
          num_cards_studied?: number
          series_id?: string
          time_spent_seconds?: number | null
          total_cards?: number | null
          unique_vocab_seen?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chapter_progress_summary_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_chapter_progress_summary_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_chapter_progress_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chapter_study_sessions: {
        Row: {
          accuracy: number
          cards_studied: number
          chapter_id: string
          deck_id: string | null
          id: string
          studied_at: string
          time_spent_seconds: number
          user_id: string
        }
        Insert: {
          accuracy: number
          cards_studied: number
          chapter_id: string
          deck_id?: string | null
          id?: string
          studied_at?: string
          time_spent_seconds: number
          user_id: string
        }
        Update: {
          accuracy?: number
          cards_studied?: number
          chapter_id?: string
          deck_id?: string | null
          id?: string
          studied_at?: string
          time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chapter_study_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_chapter_study_sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "user_chapter_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_chapter_study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_deck_srs_cards: {
        Row: {
          created_at: string | null
          deck_id: string
          difficulty: number
          due: string | null
          first_seen_date: string | null
          id: string
          last_reviewed_date: string | null
          learning_steps: number | null
          scheduled_days: number | null
          stability: number
          state: Database["public"]["Enums"]["srs_state"]
          streak_correct: number
          streak_incorrect: number
          total_reviews: number
          updated_at: string | null
          user_id: string
          vocabulary_id: string
        }
        Insert: {
          created_at?: string | null
          deck_id: string
          difficulty: number
          due?: string | null
          first_seen_date?: string | null
          id?: string
          last_reviewed_date?: string | null
          learning_steps?: number | null
          scheduled_days?: number | null
          stability: number
          state?: Database["public"]["Enums"]["srs_state"]
          streak_correct?: number
          streak_incorrect?: number
          total_reviews?: number
          updated_at?: string | null
          user_id: string
          vocabulary_id: string
        }
        Update: {
          created_at?: string | null
          deck_id?: string
          difficulty?: number
          due?: string | null
          first_seen_date?: string | null
          id?: string
          last_reviewed_date?: string | null
          learning_steps?: number | null
          scheduled_days?: number | null
          stability?: number
          state?: Database["public"]["Enums"]["srs_state"]
          streak_correct?: number
          streak_incorrect?: number
          total_reviews?: number
          updated_at?: string | null
          user_id?: string
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_deck_srs_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "user_chapter_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_deck_srs_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_deck_srs_cards_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      user_series_progress_summary: {
        Row: {
          average_accuracy: number | null
          cards_studied: number | null
          chapters_completed: number
          created_at: string | null
          current_streak: number | null
          id: string
          last_studied: string | null
          series_id: string
          total_cards: number | null
          total_chapters: number | null
          total_time_spent_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_accuracy?: number | null
          cards_studied?: number | null
          chapters_completed?: number
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_studied?: string | null
          series_id: string
          total_cards?: number | null
          total_chapters?: number | null
          total_time_spent_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_accuracy?: number | null
          cards_studied?: number | null
          chapters_completed?: number
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_studied?: string | null
          series_id?: string
          total_cards?: number | null
          total_chapters?: number | null
          total_time_spent_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_series_progress_summary_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_series_progress_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary: {
        Row: {
          created_at: string
          definition: string
          example: string | null
          id: string
          sense_key: string
          term: string
        }
        Insert: {
          created_at?: string
          definition: string
          example?: string | null
          id?: string
          sense_key?: string
          term: string
        }
        Update: {
          created_at?: string
          definition?: string
          example?: string | null
          id?: string
          sense_key?: string
          term?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_study_cards: {
        Args: { p_chapter_id: string; p_user_id: string }
        Returns: {
          chapter_example: string
          definition: string
          difficulty: number
          due: string
          example: string
          first_seen_date: string
          last_reviewed_date: string
          learning_steps: number
          scheduled_days: number
          sense_key: string
          srs_card_id: string
          stability: number
          state: Database["public"]["Enums"]["srs_state"]
          streak_incorrect: number
          term: string
          total_reviews: number
          vocabulary_created_at: string
          vocabulary_id: string
        }[]
      }
      get_user_library_decks: {
        Args: { p_user_id: string }
        Returns: {
          chapter_created_at: string
          chapter_external_url: string
          chapter_id: string
          chapter_number: number
          chapter_series_id: string
          chapter_title: string
          due_later_today: number
          due_now: number
          progress_accuracy: number
          progress_completed: boolean
          progress_created_at: string
          progress_current_streak: number
          progress_first_studied: string
          progress_id: string
          progress_last_studied: string
          progress_num_cards_studied: number
          progress_time_spent_seconds: number
          progress_total_cards: number
          progress_unique_vocab_seen: number
          progress_updated_at: string
          series_alt_names: string[]
          series_authors: string[]
          series_created_at: string
          series_genres: string[]
          series_id: string
          series_korean_name: string
          series_name: string
          series_num_chapters: number
          series_picture_url: string
          series_popularity: number
          series_slug: string
          series_synopsis: string
          series_updated_at: string
        }[]
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      persist_session_reviews: {
        Args: {
          p_card_updates: Json
          p_deck_id: string
          p_review_logs: Json
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      rating_type: "Manual" | "Again" | "Hard" | "Good" | "Easy"
      srs_state: "New" | "Learning" | "Review" | "Relearning"
      user_role: "user" | "admin"
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
      rating_type: ["Manual", "Again", "Hard", "Good", "Easy"],
      srs_state: ["New", "Learning", "Review", "Relearning"],
      user_role: ["user", "admin"],
    },
  },
} as const
