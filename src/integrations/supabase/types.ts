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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          activity_type: string
          actor_person_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          group_id: string | null
          id: string
          metadata: Json
          owner_user_id: string
        }
        Insert: {
          activity_type: string
          actor_person_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          group_id?: string | null
          id?: string
          metadata?: Json
          owner_user_id: string
        }
        Update: {
          activity_type?: string
          actor_person_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          group_id?: string | null
          id?: string
          metadata?: Json
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          category: string | null
          confidence: number | null
          created_at: string
          expense_id: string
          id: string
          is_shared: boolean
          name: string
          owner_user_id: string
          position: number
          quantity: number
          total_minor: number
          unit_price_minor: number
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          expense_id: string
          id?: string
          is_shared?: boolean
          name: string
          owner_user_id: string
          position?: number
          quantity?: number
          total_minor?: number
          unit_price_minor?: number
        }
        Update: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          expense_id?: string
          id?: string
          is_shared?: boolean
          name?: string
          owner_user_id?: string
          position?: number
          quantity?: number
          total_minor?: number
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount_minor: number
          expense_id: string
          id: string
          original_amount_minor: number | null
          owner_user_id: string
          percentage: number | null
          person_id: string
          shares: number | null
        }
        Insert: {
          amount_minor?: number
          expense_id: string
          id?: string
          original_amount_minor?: number | null
          owner_user_id: string
          percentage?: number | null
          person_id: string
          shares?: number | null
        }
        Update: {
          amount_minor?: number
          expense_id?: string
          id?: string
          original_amount_minor?: number | null
          owner_user_id?: string
          percentage?: number | null
          person_id?: string
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          card_charged_minor: number | null
          created_at: string
          currency: string
          exchange_rate: number
          exchange_rate_date: string | null
          exchange_rate_source: string
          expense_date: string
          group_id: string | null
          id: string
          merchant: string | null
          original_currency: string | null
          original_total_minor: number | null
          owner_user_id: string
          paid_by_person_id: string
          receipt_image_url: string | null
          source_type: string
          title: string
          total_minor: number
          updated_at: string
        }
        Insert: {
          card_charged_minor?: number | null
          created_at?: string
          currency?: string
          exchange_rate?: number
          exchange_rate_date?: string | null
          exchange_rate_source?: string
          expense_date?: string
          group_id?: string | null
          id?: string
          merchant?: string | null
          original_currency?: string | null
          original_total_minor?: number | null
          owner_user_id: string
          paid_by_person_id: string
          receipt_image_url?: string | null
          source_type?: string
          title: string
          total_minor?: number
          updated_at?: string
        }
        Update: {
          card_charged_minor?: number | null
          created_at?: string
          currency?: string
          exchange_rate?: number
          exchange_rate_date?: string | null
          exchange_rate_source?: string
          expense_date?: string
          group_id?: string | null
          id?: string
          merchant?: string | null
          original_currency?: string | null
          original_total_minor?: number | null
          owner_user_id?: string
          paid_by_person_id?: string
          receipt_image_url?: string | null
          source_type?: string
          title?: string
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_person_id_fkey"
            columns: ["paid_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          quote_currency: string
          rate: number
          rate_date: string
          source: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          id?: string
          quote_currency: string
          rate: number
          rate_date: string
          source?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          rate_date?: string
          source?: string
        }
        Relationships: []
      }
      group_invitations: {
        Row: {
          created_at: string
          expires_at: string
          group_id: string
          id: string
          join_code: string
          owner_user_id: string
          person_id: string | null
          revoked_at: string | null
          sent_at: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          group_id: string
          id?: string
          join_code: string
          owner_user_id: string
          person_id?: string | null
          revoked_at?: string | null
          sent_at?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          join_code?: string
          owner_user_id?: string
          person_id?: string | null
          revoked_at?: string | null
          sent_at?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          default_percentage: number | null
          default_weight: number | null
          group_id: string
          id: string
          joined_at: string
          owner_user_id: string
          person_id: string
          removed_at: string | null
          role: string
        }
        Insert: {
          default_percentage?: number | null
          default_weight?: number | null
          group_id: string
          id?: string
          joined_at?: string
          owner_user_id: string
          person_id: string
          removed_at?: string | null
          role?: string
        }
        Update: {
          default_percentage?: number | null
          default_weight?: number | null
          group_id?: string
          id?: string
          joined_at?: string
          owner_user_id?: string
          person_id?: string
          removed_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          created_at: string
          currency: string
          default_split_type: string
          id: string
          name: string
          orphaned_at: string | null
          owner_person_id: string | null
          owner_user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          default_split_type?: string
          id?: string
          name: string
          orphaned_at?: string | null
          owner_person_id?: string | null
          owner_user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          default_split_type?: string
          id?: string
          name?: string
          orphaned_at?: string | null
          owner_person_id?: string | null
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      item_splits: {
        Row: {
          amount_minor: number
          expense_item_id: string
          id: string
          owner_user_id: string
          percentage: number | null
          person_id: string
          shares: number | null
        }
        Insert: {
          amount_minor?: number
          expense_item_id: string
          id?: string
          owner_user_id: string
          percentage?: number | null
          person_id: string
          shares?: number | null
        }
        Update: {
          amount_minor?: number
          expense_item_id?: string
          id?: string
          owner_user_id?: string
          percentage?: number | null
          person_id?: string
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_splits_expense_item_id_fkey"
            columns: ["expense_item_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_splits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_self: boolean
          linked_profile_id: string | null
          name: string
          owner_user_id: string
          status: string
          unlinked_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_self?: boolean
          linked_profile_id?: string | null
          name: string
          owner_user_id: string
          status?: string
          unlinked_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_self?: boolean
          linked_profile_id?: string | null
          name?: string
          owner_user_id?: string
          status?: string
          unlinked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          appearance: string
          avatar_url: string | null
          created_at: string
          currency: string
          display_name: string
          id: string
          language: string
          updated_at: string
        }
        Insert: {
          appearance?: string
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          id: string
          language?: string
          updated_at?: string
        }
        Update: {
          appearance?: string
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          from_person_id: string
          group_id: string
          id: string
          owner_user_id: string
          settled_at: string | null
          status: string
          to_person_id: string
        }
        Insert: {
          amount_minor?: number
          created_at?: string
          currency?: string
          from_person_id: string
          group_id: string
          id?: string
          owner_user_id: string
          settled_at?: string | null
          status?: string
          to_person_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          from_person_id?: string
          group_id?: string
          id?: string
          owner_user_id?: string
          settled_at?: string | null
          status?: string
          to_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_from_person_id_fkey"
            columns: ["from_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_person_id_fkey"
            columns: ["to_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_group_invitation: { Args: { _code: string }; Returns: string }
      can_read_expense_item: { Args: { _item_id: string }; Returns: boolean }
      claim_group_invitation: {
        Args: { _code: string }
        Returns: {
          group_id: string
          status: string
        }[]
      }
      create_group: {
        Args: {
          _default_split_type: string
          _name: string
          _percentages?: Json
          _person_names?: string[]
          _shares?: Json
        }
        Returns: string
      }
      delete_unused_group_placeholder: {
        Args: { _group_id: string; _person_id: string }
        Returns: boolean
      }
      get_invitation_preview: {
        Args: { _code: string }
        Returns: {
          group_name: string
          inviter_name: string
          member_count: number
          person_claimed: boolean
          person_id: string
          person_name: string
        }[]
      }
      group_invitation_fields_unchanged: {
        Args: {
          _group_id: string
          _id: string
          _join_code: string
          _owner_user_id: string
          _person_id: string
          _token: string
        }
        Returns: boolean
      }
      group_member_fields_unchanged: {
        Args: {
          _group_id: string
          _id: string
          _owner_user_id: string
          _person_id: string
          _role: string
        }
        Returns: boolean
      }
      group_owner_fields_unchanged: {
        Args: {
          _group_id: string
          _owner_person_id: string
          _owner_user_id: string
        }
        Returns: boolean
      }
      is_durable_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_participant: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_group_invitation: {
        Args: { _code: string }
        Returns: {
          group_id: string
          status: string
        }[]
      }
      rename_group_placeholder: {
        Args: { _group_id: string; _name: string; _person_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      transfer_group_ownership: {
        Args: { _group_id: string; _new_owner_person_id: string }
        Returns: string
      }
      update_my_people_name: {
        Args: { _name: string }
        Returns: {
          id: string
          name: string
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
