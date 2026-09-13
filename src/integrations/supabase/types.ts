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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      presets: {
        Row: {
          created_at: string
          effects: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effects?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          effects?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_clips: {
        Row: {
          created_at: string
          duration_ms: number
          fade_in_ms: number
          fade_out_ms: number
          gain: number
          id: string
          name: string
          offset_ms: number
          start_ms: number
          studio_track_id: string
          take_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          fade_in_ms?: number
          fade_out_ms?: number
          gain?: number
          id?: string
          name?: string
          offset_ms?: number
          start_ms?: number
          studio_track_id: string
          take_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          fade_in_ms?: number
          fade_out_ms?: number
          gain?: number
          id?: string
          name?: string
          offset_ms?: number
          start_ms?: number
          studio_track_id?: string
          take_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_clips_studio_track_id_fkey"
            columns: ["studio_track_id"]
            isOneToOne: false
            referencedRelation: "studio_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_clips_take_id_fkey"
            columns: ["take_id"]
            isOneToOne: false
            referencedRelation: "takes"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bpm: number
          created_at: string
          id: string
          master_effects: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bpm?: number
          created_at?: string
          id?: string
          master_effects?: Json
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bpm?: number
          created_at?: string
          id?: string
          master_effects?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          arrangement: Json
          created_at: string
          duration_seconds: number
          id: string
          mixdown_path: string | null
          title: string
          updated_at: string
          uploaded_video_id: string | null
          user_id: string
          youtube_artist: string | null
          youtube_title: string | null
          youtube_video_id: string | null
        }
        Insert: {
          arrangement?: Json
          created_at?: string
          duration_seconds?: number
          id?: string
          mixdown_path?: string | null
          title?: string
          updated_at?: string
          uploaded_video_id?: string | null
          user_id: string
          youtube_artist?: string | null
          youtube_title?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          arrangement?: Json
          created_at?: string
          duration_seconds?: number
          id?: string
          mixdown_path?: string | null
          title?: string
          updated_at?: string
          uploaded_video_id?: string | null
          user_id?: string
          youtube_artist?: string | null
          youtube_title?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      studio_tracks: {
        Row: {
          color: string
          created_at: string
          effects: Json
          id: string
          muted: boolean
          name: string
          order_index: number
          pan: number
          project_id: string
          soloed: boolean
          volume: number
        }
        Insert: {
          color?: string
          created_at?: string
          effects?: Json
          id?: string
          muted?: boolean
          name?: string
          order_index?: number
          pan?: number
          project_id: string
          soloed?: boolean
          volume?: number
        }
        Update: {
          color?: string
          created_at?: string
          effects?: Json
          id?: string
          muted?: boolean
          name?: string
          order_index?: number
          pan?: number
          project_id?: string
          soloed?: boolean
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_tracks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      takes: {
        Row: {
          auto_detected: boolean
          created_at: string
          duration_ms: number
          id: string
          mime_type: string
          peaks: Json | null
          pitch_data: Json | null
          storage_path: string
          title: string
          track_id: string | null
          track_position_ms: number | null
          user_id: string
        }
        Insert: {
          auto_detected?: boolean
          created_at?: string
          duration_ms?: number
          id?: string
          mime_type?: string
          peaks?: Json | null
          pitch_data?: Json | null
          storage_path: string
          title?: string
          track_id?: string | null
          track_position_ms?: number | null
          user_id: string
        }
        Update: {
          auto_detected?: boolean
          created_at?: string
          duration_ms?: number
          id?: string
          mime_type?: string
          peaks?: Json | null
          pitch_data?: Json | null
          storage_path?: string
          title?: string
          track_id?: string | null
          track_position_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          artist: string | null
          created_at: string
          external_id: string | null
          id: string
          source: string
          thumbnail_url: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          artist?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          source?: string
          thumbnail_url?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          artist?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          source?: string
          thumbnail_url?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
