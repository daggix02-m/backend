export interface Database {
  public: {
    Tables: {
      user: {
        Row: {
          id: number;
          email: string;
          passwordHash: string;
          fullName: string;
          pharmacyId: number;
          isActive: boolean;
          mustChangePassword: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          email: string;
          passwordHash: string;
          fullName: string;
          pharmacyId: number;
          isActive?: boolean;
          mustChangePassword?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          email?: string;
          passwordHash?: string;
          fullName?: string;
          pharmacyId?: number;
          isActive?: boolean;
          mustChangePassword?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      pharmacy: {
        Row: {
          id: number;
          name: string;
          address: string;
          phone: string;
          email: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          name: string;
          address: string;
          phone: string;
          email: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          name?: string;
          address?: string;
          phone?: string;
          email?: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      branch: {
        Row: {
          id: number;
          pharmacyId: number;
          name: string;
          address: string;
          phone: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          pharmacyId: number;
          name: string;
          address: string;
          phone: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          pharmacyId?: number;
          name?: string;
          address?: string;
          phone?: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      role: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          createdAt: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          createdAt?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          createdAt?: string;
        };
      };
      user_role: {
        Row: {
          id: number;
          userId: number;
          roleId: number;
          createdAt: string;
        };
        Insert: {
          id?: number;
          userId: number;
          roleId: number;
          createdAt?: string;
        };
        Update: {
          id?: number;
          userId?: number;
          roleId?: number;
          createdAt?: string;
        };
      };
      user_branch: {
        Row: {
          id: number;
          userId: number;
          branchId: number;
          createdAt: string;
        };
        Insert: {
          id?: number;
          userId: number;
          branchId: number;
          createdAt?: string;
        };
        Update: {
          id?: number;
          userId?: number;
          branchId?: number;
          createdAt?: string;
        };
      };
      sale: {
        Row: {
          id: number;
          branchId: number;
          pharmacyId: number;
          cashierId: number;
          totalAmount: number;
          status: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          branchId: number;
          pharmacyId: number;
          cashierId: number;
          totalAmount: number;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          branchId?: number;
          pharmacyId?: number;
          cashierId?: number;
          totalAmount?: number;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      payment: {
        Row: {
          id: number;
          saleId: number;
          pharmacyId: number;
          amount: number;
          method: string;
          status: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          saleId: number;
          pharmacyId: number;
          amount: number;
          method: string;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          saleId?: number;
          pharmacyId?: number;
          amount?: number;
          method?: string;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      payment_transaction: {
        Row: {
          id: number;
          paymentId: number;
          provider: string;
          txRef: string;
          verified: boolean;
          rawResponse: any;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          paymentId: number;
          provider: string;
          txRef: string;
          verified?: boolean;
          rawResponse?: any;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          paymentId?: number;
          provider?: string;
          txRef?: string;
          verified?: boolean;
          rawResponse?: any;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      cashier_shift: {
        Row: {
          id: number;
          userId: number;
          branchId: number;
          openedAt: string;
          closedAt: string | null;
          openingBalance: number;
          closingBalance: number | null;
          status: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          userId: number;
          branchId: number;
          openedAt?: string;
          closedAt?: string | null;
          openingBalance: number;
          closingBalance?: number | null;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          userId?: number;
          branchId?: number;
          openedAt?: string;
          closedAt?: string | null;
          openingBalance?: number;
          closingBalance?: number | null;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
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
