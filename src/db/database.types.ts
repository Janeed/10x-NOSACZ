export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      adherence_metrics: {
        Row: {
          backfilled_payment_count: number;
          overpayment_executed_count: number;
          overpayment_skipped_count: number;
          paid_payment_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          backfilled_payment_count?: number;
          overpayment_executed_count?: number;
          overpayment_skipped_count?: number;
          paid_payment_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          backfilled_payment_count?: number;
          overpayment_executed_count?: number;
          overpayment_skipped_count?: number;
          paid_payment_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      loan_change_events: {
        Row: {
          change_type: Database["public"]["Enums"]["loan_change_type"];
          created_at: string;
          effective_month: string;
          id: string;
          loan_id: string;
          new_annual_rate: number | null;
          new_principal: number | null;
          new_remaining_balance: number | null;
          new_term_months: number | null;
          notes: string | null;
          old_annual_rate: number | null;
          old_principal: number | null;
          old_remaining_balance: number | null;
          old_term_months: number | null;
          user_id: string;
        };
        Insert: {
          change_type: Database["public"]["Enums"]["loan_change_type"];
          created_at?: string;
          effective_month: string;
          id?: string;
          loan_id: string;
          new_annual_rate?: number | null;
          new_principal?: number | null;
          new_remaining_balance?: number | null;
          new_term_months?: number | null;
          notes?: string | null;
          old_annual_rate?: number | null;
          old_principal?: number | null;
          old_remaining_balance?: number | null;
          old_term_months?: number | null;
          user_id: string;
        };
        Update: {
          change_type?: Database["public"]["Enums"]["loan_change_type"];
          created_at?: string;
          effective_month?: string;
          id?: string;
          loan_id?: string;
          new_annual_rate?: number | null;
          new_principal?: number | null;
          new_remaining_balance?: number | null;
          new_term_months?: number | null;
          notes?: string | null;
          old_annual_rate?: number | null;
          old_principal?: number | null;
          old_remaining_balance?: number | null;
          old_term_months?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loan_change_events_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
        ];
      };
      loans: {
        Row: {
          annual_rate: number;
          closed_month: string | null;
          created_at: string;
          id: string;
          is_closed: boolean;
          original_term_months: number;
          principal: number;
          remaining_balance: number;
          start_month: string;
          term_months: number;
          user_id: string;
        };
        Insert: {
          annual_rate: number;
          closed_month?: string | null;
          created_at?: string;
          id?: string;
          is_closed?: boolean;
          original_term_months: number;
          principal: number;
          remaining_balance: number;
          start_month?: string;
          term_months: number;
          user_id: string;
        };
        Update: {
          annual_rate?: number;
          closed_month?: string | null;
          created_at?: string;
          id?: string;
          is_closed?: boolean;
          original_term_months?: number;
          principal?: number;
          remaining_balance?: number;
          start_month?: string;
          term_months?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      monthly_execution_logs: {
        Row: {
          actual_overpayment_amount: number | null;
          created_at: string;
          id: string;
          interest_portion: number | null;
          loan_id: string;
          month_start: string;
          overpayment_executed_at: string | null;
          overpayment_status: Database["public"]["Enums"]["overpayment_status"];
          payment_executed_at: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          principal_portion: number | null;
          reason_code: string | null;
          remaining_balance_after: number | null;
          scheduled_overpayment_amount: number | null;
          user_id: string;
        };
        Insert: {
          actual_overpayment_amount?: number | null;
          created_at?: string;
          id?: string;
          interest_portion?: number | null;
          loan_id: string;
          month_start: string;
          overpayment_executed_at?: string | null;
          overpayment_status?: Database["public"]["Enums"]["overpayment_status"];
          payment_executed_at?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          principal_portion?: number | null;
          reason_code?: string | null;
          remaining_balance_after?: number | null;
          scheduled_overpayment_amount?: number | null;
          user_id: string;
        };
        Update: {
          actual_overpayment_amount?: number | null;
          created_at?: string;
          id?: string;
          interest_portion?: number | null;
          loan_id?: string;
          month_start?: string;
          overpayment_executed_at?: string | null;
          overpayment_status?: Database["public"]["Enums"]["overpayment_status"];
          payment_executed_at?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          principal_portion?: number | null;
          reason_code?: string | null;
          remaining_balance_after?: number | null;
          scheduled_overpayment_amount?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_execution_logs_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
        ];
      };
      simulation_history_metrics: {
        Row: {
          baseline_interest: number | null;
          captured_at: string;
          goal: Database["public"]["Enums"]["goal_type"];
          id: string;
          monthly_payment_total: number | null;
          months_to_payoff: number | null;
          payoff_month: string | null;
          simulation_id: string;
          strategy: string;
          total_interest_saved: number | null;
          user_id: string;
        };
        Insert: {
          baseline_interest?: number | null;
          captured_at?: string;
          goal: Database["public"]["Enums"]["goal_type"];
          id?: string;
          monthly_payment_total?: number | null;
          months_to_payoff?: number | null;
          payoff_month?: string | null;
          simulation_id: string;
          strategy: string;
          total_interest_saved?: number | null;
          user_id: string;
        };
        Update: {
          baseline_interest?: number | null;
          captured_at?: string;
          goal?: Database["public"]["Enums"]["goal_type"];
          id?: string;
          monthly_payment_total?: number | null;
          months_to_payoff?: number | null;
          payoff_month?: string | null;
          simulation_id?: string;
          strategy?: string;
          total_interest_saved?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulation_history_metrics_simulation_id_fkey";
            columns: ["simulation_id"];
            isOneToOne: false;
            referencedRelation: "simulations";
            referencedColumns: ["id"];
          },
        ];
      };
      simulation_loan_snapshots: {
        Row: {
          id: string;
          loan_id: string;
          remaining_term_months: number;
          simulation_id: string;
          starting_balance: number;
          starting_month: string;
          starting_rate: number;
          user_id: string;
        };
        Insert: {
          id?: string;
          loan_id: string;
          remaining_term_months: number;
          simulation_id: string;
          starting_balance: number;
          starting_month: string;
          starting_rate: number;
          user_id: string;
        };
        Update: {
          id?: string;
          loan_id?: string;
          remaining_term_months?: number;
          simulation_id?: string;
          starting_balance?: number;
          starting_month?: string;
          starting_rate?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulation_loan_snapshots_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulation_loan_snapshots_simulation_id_fkey";
            columns: ["simulation_id"];
            isOneToOne: false;
            referencedRelation: "simulations";
            referencedColumns: ["id"];
          },
        ];
      };
      simulations: {
        Row: {
          baseline_interest: number | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          goal: Database["public"]["Enums"]["goal_type"];
          id: string;
          is_active: boolean;
          monthly_overpayment_limit: number;
          notes: string | null;
          payment_reduction_target: number | null;
          projected_months_to_payoff: number | null;
          projected_payoff_month: string | null;
          reinvest_reduced_payments: boolean;
          stale: boolean;
          started_at: string | null;
          status: Database["public"]["Enums"]["simulation_status"];
          strategy: string;
          total_interest_saved: number | null;
          user_id: string;
        };
        Insert: {
          baseline_interest?: number | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          goal: Database["public"]["Enums"]["goal_type"];
          id?: string;
          is_active?: boolean;
          monthly_overpayment_limit: number;
          notes?: string | null;
          payment_reduction_target?: number | null;
          projected_months_to_payoff?: number | null;
          projected_payoff_month?: string | null;
          reinvest_reduced_payments?: boolean;
          stale?: boolean;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["simulation_status"];
          strategy: string;
          total_interest_saved?: number | null;
          user_id: string;
        };
        Update: {
          baseline_interest?: number | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          goal?: Database["public"]["Enums"]["goal_type"];
          id?: string;
          is_active?: boolean;
          monthly_overpayment_limit?: number;
          notes?: string | null;
          payment_reduction_target?: number | null;
          projected_months_to_payoff?: number | null;
          projected_payoff_month?: string | null;
          reinvest_reduced_payments?: boolean;
          stale?: boolean;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["simulation_status"];
          strategy?: string;
          total_interest_saved?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          monthly_overpayment_limit: number;
          reinvest_reduced_payments: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          monthly_overpayment_limit?: number;
          reinvest_reduced_payments?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          monthly_overpayment_limit?: number;
          reinvest_reduced_payments?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      goal_type: "fastest_payoff" | "payment_reduction";
      loan_change_type:
        | "rate_change"
        | "balance_adjustment"
        | "term_adjustment"
        | "principal_correction";
      overpayment_status: "scheduled" | "executed" | "skipped" | "backfilled";
      payment_status: "pending" | "paid" | "backfilled";
      simulation_status:
        | "running"
        | "active"
        | "completed"
        | "stale"
        | "cancelled";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      goal_type: ["fastest_payoff", "payment_reduction"],
      loan_change_type: [
        "rate_change",
        "balance_adjustment",
        "term_adjustment",
        "principal_correction",
      ],
      overpayment_status: ["scheduled", "executed", "skipped", "backfilled"],
      payment_status: ["pending", "paid", "backfilled"],
      simulation_status: [
        "running",
        "active",
        "completed",
        "stale",
        "cancelled",
      ],
    },
  },
} as const;
