export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          email: string;
          password_hash: string;
          full_name: string;
          pharmacy_id: number;
          is_active: boolean;
          is_owner: boolean;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          email: string;
          password_hash: string;
          full_name: string;
          pharmacy_id: number;
          is_active?: boolean;
          is_owner?: boolean;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          email?: string;
          password_hash?: string;
          full_name?: string;
          pharmacy_id?: number;
          is_active?: boolean;
          is_owner?: boolean;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      pharmacies: {
        Row: {
          id: number;
          name: string;
          address: string;
          phone: string;
          email: string;
          license_number: string | null;
          tin_number: string | null;
          owner_id: number | null;
          verification_status: string;
          subscription_status: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          address: string;
          phone: string;
          email: string;
          license_number?: string | null;
          tin_number?: string | null;
          owner_id?: number | null;
          verification_status?: string;
          subscription_status?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          address?: string;
          phone?: string;
          email?: string;
          license_number?: string | null;
          tin_number?: string | null;
          owner_id?: number | null;
          verification_status?: string;
          subscription_status?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      branches: {
        Row: {
          id: number;
          pharmacy_id: number;
          name: string;
          location: string;
          phone: string;
          email: string;
          is_active: boolean;
          is_main_branch: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          pharmacy_id: number;
          name: string;
          location: string;
          phone?: string;
          email?: string;
          is_active?: boolean;
          is_main_branch?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          pharmacy_id?: number;
          name?: string;
          location?: string;
          phone?: string;
          email?: string;
          is_active?: boolean;
          is_main_branch?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: number;
          user_id: number;
          role_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          role_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          role_id?: number;
          created_at?: string;
        };
      };
      user_branches: {
        Row: {
          id: number;
          user_id: number;
          branch_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          branch_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          branch_id?: number;
          created_at?: string;
        };
      };
      subscription_plans: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          price: number;
          currency: string;
          billing_cycle: string;
          max_branches: number;
          max_staff_per_branch: number;
          max_medicines: number;
          max_import_rows: number;
          features: any;
          is_active: boolean;
          is_popular: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          price: number;
          currency?: string;
          billing_cycle?: string;
          max_branches?: number;
          max_staff_per_branch?: number;
          max_medicines?: number;
          max_import_rows?: number;
          features?: any;
          is_active?: boolean;
          is_popular?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          price?: number;
          currency?: string;
          billing_cycle?: string;
          max_branches?: number;
          max_staff_per_branch?: number;
          max_medicines?: number;
          max_import_rows?: number;
          features?: any;
          is_active?: boolean;
          is_popular?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      pharmacy_subscriptions: {
        Row: {
          id: number;
          pharmacy_id: number;
          plan_id: number;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          trial_ends_at: string | null;
          grace_ends_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          pharmacy_id: number;
          plan_id: number;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          trial_ends_at?: string | null;
          grace_ends_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          pharmacy_id?: number;
          plan_id?: number;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          trial_ends_at?: string | null;
          grace_ends_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      pharmacy_documents: {
        Row: {
          id: number;
          pharmacy_id: number;
          document_type: string;
          file_url: string;
          file_name: string | null;
          file_size: number | null;
          mime_type: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: number | null;
          rejection_reason: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: number;
          pharmacy_id: number;
          document_type: string;
          file_url: string;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: number | null;
          rejection_reason?: string | null;
          uploaded_at?: string;
        };
        Update: {
          id?: number;
          pharmacy_id?: number;
          document_type?: string;
          file_url?: string;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: number | null;
          rejection_reason?: string | null;
          uploaded_at?: string;
        };
      };
      registration_applications: {
        Row: {
          id: number;
          email: string;
          password_hash: string | null;
          full_name: string | null;
          phone: string | null;
          pharmacy_name: string | null;
          pharmacy_address: string | null;
          pharmacy_phone: string | null;
          pharmacy_email: string | null;
          license_number: string | null;
          tin_number: string | null;
          license_document_url: string | null;
          fyda_document_url: string | null;
          selected_plan_id: number | null;
          current_step: number;
          status: string;
          reviewed_by: number | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          submitted_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: number;
          email: string;
          password_hash?: string | null;
          full_name?: string | null;
          phone?: string | null;
          pharmacy_name?: string | null;
          pharmacy_address?: string | null;
          pharmacy_phone?: string | null;
          pharmacy_email?: string | null;
          license_number?: string | null;
          tin_number?: string | null;
          license_document_url?: string | null;
          fyda_document_url?: string | null;
          selected_plan_id?: number | null;
          current_step?: number;
          status?: string;
          reviewed_by?: number | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: number;
          email?: string;
          password_hash?: string | null;
          full_name?: string | null;
          phone?: string | null;
          pharmacy_name?: string | null;
          pharmacy_address?: string | null;
          pharmacy_phone?: string | null;
          pharmacy_email?: string | null;
          license_number?: string | null;
          tin_number?: string | null;
          license_document_url?: string | null;
          fyda_document_url?: string | null;
          selected_plan_id?: number | null;
          current_step?: number;
          status?: string;
          reviewed_by?: number | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          completed_at?: string | null;
        };
      };
      password_reset_tokens: {
        Row: {
          id: number;
          user_id: number;
          token: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          token: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          token?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
      };
      medicines: {
        Row: {
          id: number;
          name: string;
          generic_name: string | null;
          brand_name: string | null;
          sku: string | null;
          unit_type: string;
          strength: string | null;
          manufacturer: string | null;
          description: string | null;
          min_stock_level: number;
          requires_prescription: boolean;
          unit_price: number;
          category_id: number | null;
          branch_id: number;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          generic_name?: string | null;
          brand_name?: string | null;
          sku?: string | null;
          unit_type: string;
          strength?: string | null;
          manufacturer?: string | null;
          description?: string | null;
          min_stock_level?: number;
          requires_prescription?: boolean;
          unit_price?: number;
          category_id?: number | null;
          branch_id: number;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          generic_name?: string | null;
          brand_name?: string | null;
          sku?: string | null;
          unit_type?: string;
          strength?: string | null;
          manufacturer?: string | null;
          description?: string | null;
          min_stock_level?: number;
          requires_prescription?: boolean;
          unit_price?: number;
          category_id?: number | null;
          branch_id?: number;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      medicine_categories: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      medicine_batches: {
        Row: {
          id: number;
          medicine_id: number;
          batch_number: string;
          expiry_date: string;
          quantity: number;
          cost_price: number | null;
          selling_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          medicine_id: number;
          batch_number: string;
          expiry_date: string;
          quantity: number;
          cost_price?: number | null;
          selling_price?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          medicine_id?: number;
          batch_number?: string;
          expiry_date?: string;
          quantity?: number;
          cost_price?: number | null;
          selling_price?: number | null;
          created_at?: string;
        };
      };
      stocks: {
        Row: {
          id: number;
          medicine_id: number;
          branch_id: number;
          pharmacy_id: number;
          quantity: number;
          last_restocked: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          medicine_id: number;
          branch_id: number;
          pharmacy_id: number;
          quantity: number;
          last_restocked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          medicine_id?: number;
          branch_id?: number;
          pharmacy_id?: number;
          quantity?: number;
          last_restocked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: number;
          branch_id: number;
          pharmacy_id: number;
          user_id: number;
          pharmacist_id: number | null;
          cashier_id: number | null;
          customer_name: string | null;
          customer_phone: string | null;
          total_amount: number;
          discount_amount: number;
          tax_amount: number;
          final_amount: number;
          status: string;
          payment_status: string | null;
          payment_method_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          branch_id: number;
          pharmacy_id: number;
          user_id: number;
          pharmacist_id?: number | null;
          cashier_id?: number | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          total_amount: number;
          discount_amount?: number;
          tax_amount?: number;
          final_amount: number;
          status?: string;
          payment_status?: string | null;
          payment_method_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          branch_id?: number;
          pharmacy_id?: number;
          user_id?: number;
          pharmacist_id?: number | null;
          cashier_id?: number | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          total_amount?: number;
          discount_amount?: number;
          tax_amount?: number;
          final_amount?: number;
          status?: string;
          payment_status?: string | null;
          payment_method_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sale_items: {
        Row: {
          id: number;
          sale_id: number;
          medicine_id: number;
          batch_id: number | null;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Insert: {
          id?: number;
          sale_id: number;
          medicine_id: number;
          batch_id?: number | null;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Update: {
          id?: number;
          sale_id?: number;
          medicine_id?: number;
          batch_id?: number | null;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
        };
      };
      payments: {
        Row: {
          id: number;
          sale_id: number;
          pharmacy_id: number;
          amount: number;
          payment_method_id: number | null;
          status: string;
          processed_by: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          sale_id: number;
          pharmacy_id: number;
          amount: number;
          payment_method_id?: number | null;
          status?: string;
          processed_by?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          sale_id?: number;
          pharmacy_id?: number;
          amount?: number;
          payment_method_id?: number | null;
          status?: string;
          processed_by?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_methods: {
        Row: {
          id: number;
          name: string;
          code: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          code: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          code?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      payment_transactions: {
        Row: {
          id: number;
          payment_id: number;
          provider: string;
          tx_ref: string;
          verified: boolean;
          raw_response: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          payment_id: number;
          provider: string;
          tx_ref: string;
          verified?: boolean;
          raw_response?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          payment_id?: number;
          provider?: string;
          tx_ref?: string;
          verified?: boolean;
          raw_response?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      refunds: {
        Row: {
          id: number;
          sale_id: number;
          pharmacy_id: number;
          amount: number;
          reason: string | null;
          status: string;
          processed_by: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          sale_id: number;
          pharmacy_id: number;
          amount: number;
          reason?: string | null;
          status?: string;
          processed_by?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          sale_id?: number;
          pharmacy_id?: number;
          amount?: number;
          reason?: string | null;
          status?: string;
          processed_by?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cashier_shifts: {
        Row: {
          id: number;
          user_id: number;
          branch_id: number;
          opened_at: string;
          closed_at: string | null;
          opening_balance: number;
          closing_balance: number | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          branch_id: number;
          opened_at?: string;
          closed_at?: string | null;
          opening_balance: number;
          closing_balance?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          branch_id?: number;
          opened_at?: string;
          closed_at?: string | null;
          opening_balance?: number;
          closing_balance?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      restock_requests: {
        Row: {
          id: number;
          medicine_id: number;
          branch_id: number;
          pharmacy_id: number;
          requested_by: number;
          quantity: number;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          medicine_id: number;
          branch_id: number;
          pharmacy_id: number;
          requested_by: number;
          quantity: number;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          medicine_id?: number;
          branch_id?: number;
          pharmacy_id?: number;
          requested_by?: number;
          quantity?: number;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
