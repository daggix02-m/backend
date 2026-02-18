import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

type Supabase = SupabaseClient<Database>;

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertToSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertToSnakeCase);
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = typeof value === 'object' && value !== null ? convertToSnakeCase(value) : value;
  }
  return result;
}

type WhereInput<T> = Partial<T> & {
  id?: number;
};

type IncludeInput = Record<string, boolean | { include?: IncludeInput } | { select?: Record<string, boolean> }>;

interface QueryOptions {
  where?: WhereInput<any>;
  include?: IncludeInput;
  select?: Record<string, boolean>;
  orderBy?: Record<string, 'asc' | 'desc'> | { [key: string]: 'asc' | 'desc' };
  skip?: number;
  take?: number;
}

interface FindUniqueOptions {
  where: { id: number } | { email?: string } | { txRef?: string } | { name?: string };
  include?: IncludeInput;
}

interface FindManyOptions {
  where?: WhereInput<any>;
  include?: IncludeInput;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
}

interface CreateOptions<T> {
  data: T;
}

interface UpdateOptions<T = any> {
  where: { id: number } | { txRef?: string };
  data: Partial<T>;
}

interface UpdateManyOptions<T = any> {
  where: WhereInput<any>;
  data: Partial<T>;
}

interface DeleteOptions {
  where: { id: number };
}

function getTableName(modelName: string): string {
  const mapping: Record<string, string> = {
    user: 'users',
    pharmacy: 'pharmacies',
    branch: 'branches',
    role: 'roles',
    userRole: 'user_roles',
    userBranch: 'user_branches',
    sale: 'sales',
    payment: 'payments',
    paymentTransaction: 'payment_transactions',
    cashierShift: 'cashier_shifts',
    stock: 'stocks',
    medicine: 'medicines',
    medicineCategory: 'medicine_categories',
    medicineBatch: 'medicine_batches',
    saleItem: 'sale_items',
    refund: 'refunds',
    refundItem: 'refund_items',
    stockMovement: 'stock_movements',
    paymentMethod: 'payment_methods',
    subscriptionPlan: 'subscription_plans',
    pharmacySubscription: 'pharmacy_subscriptions',
    pharmacyDocument: 'pharmacy_documents',
    registrationApplication: 'registration_applications',
    passwordResetToken: 'password_reset_tokens',
    restockRequest: 'restock_requests',
  };
  return mapping[modelName] || modelName;
}

function buildIncludes(client: Supabase, tableName: string, include?: IncludeInput) {
  if (!include) return {};
  
  const select: Record<string, boolean | { columns?: string[] }> = {};
  
  for (const [key, value] of Object.entries(include)) {
    if (value === true) {
      select[key] = true;
    } else if (typeof value === 'object' && value !== null) {
      if ('include' in value && value.include) {
        select[key] = { columns: Object.keys(value.include) };
      } else if ('select' in value && value.select) {
        select[key] = { columns: Object.keys(value.select) };
      } else {
        select[key] = true;
      }
    }
  }
  
  return select;
}

function createModelHandler(client: Supabase, modelName: string) {
  const tableName = getTableName(modelName);

  return {
    findUnique: async <T = any>(options: FindUniqueOptions): Promise<T | null> => {
      let selectStr = '*';
      if (options.include) {
        selectStr = `*, ${Object.keys(options.include).map(k => `${k} (*)`).join(', ')}`;
      }
      
      let query = client.from(tableName as any).select(selectStr);
      
      const where = options.where as any;
      if ('id' in where && where.id !== undefined) {
        query = query.eq('id', where.id);
      } else if ('email' in where && where.email !== undefined) {
        query = query.eq('email', where.email);
      } else if ('txRef' in where && where.txRef !== undefined) {
        query = query.eq('txRef', where.txRef);
      } else if ('name' in where && where.name !== undefined) {
        query = query.eq('name', where.name);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as T | null;
    },

    findFirst: async <T = any>(options: FindManyOptions): Promise<T | null> => {
      let query = client.from(tableName as any).select('*');
      
      if (options.where) {
        const snakeWhere = convertToSnakeCase(options.where);
        for (const [key, value] of Object.entries(snakeWhere)) {
          if (value !== undefined) {
            query = query.eq(key, value);
          }
        }
      }

      if (options.include) {
        query = client.from(tableName as any).select(
          `*, ${Object.keys(options.include).map(k => `${k} (*)`).join(', ')}`
        );
        if (options.where) {
          const snakeWhere = convertToSnakeCase(options.where);
          for (const [key, value] of Object.entries(snakeWhere)) {
            if (value !== undefined) {
              query = query.eq(key, value);
            }
          }
        }
      }

      if (options.orderBy) {
        const [column, direction] = Object.entries(options.orderBy)[0];
        query = query.order(camelToSnake(column), { ascending: direction === 'asc' });
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data as T | null;
    },

    findMany: async <T = any>(options: FindManyOptions = {}): Promise<T[]> => {
      let selectStr = '*';
      if (options.include) {
        selectStr = `*, ${Object.keys(options.include).map(k => `${k} (*)`).join(', ')}`;
      }
      
      let query = client.from(tableName as any).select(selectStr);
      
      if (options.where) {
        const snakeWhere = convertToSnakeCase(options.where);
        for (const [key, value] of Object.entries(snakeWhere)) {
          if (value !== undefined && value !== null) {
            if (typeof value === 'object' && !Array.isArray(value)) {
              for (const [subKey, subValue] of Object.entries(value)) {
                if (subValue !== undefined && subValue !== null) {
                  query = query.eq(`${key}.${subKey}`, subValue);
                }
              }
            } else {
              query = query.eq(key, value);
            }
          }
        }
      }

      if (options.orderBy) {
        const [column, direction] = Object.entries(options.orderBy)[0];
        query = query.order(camelToSnake(column), { ascending: direction === 'asc' });
      }

      if (options.skip) {
        query = query.range(options.skip, options.skip + (options.take || 100) - 1);
      } else if (options.take) {
        query = query.limit(options.take);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as T[];
    },

    create: async <T = any>(options: CreateOptions<any>): Promise<T> => {
      const { data, error } = await client
        .from(tableName as any)
        .insert(convertToSnakeCase(options.data))
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },

    update: async <T = any>(options: UpdateOptions<any>): Promise<T> => {
      const tableClient = (client as any).from(tableName);
      let query = tableClient.update(convertToSnakeCase(options.data));
      
      if ('id' in options.where) {
        query = query.eq('id', options.where.id);
      } else if ('txRef' in options.where && options.where.txRef) {
        query = query.eq('tx_ref', options.where.txRef);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      return data as T;
    },

    updateMany: async <T = any>(options: UpdateManyOptions<T>): Promise<{ count: number }> => {
      const tableClient = (client as any).from(tableName);
      let query = tableClient.update(convertToSnakeCase(options.data));
      
      if (options.where) {
        const snakeWhere = convertToSnakeCase(options.where);
        for (const [key, value] of Object.entries(snakeWhere)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }

      const { data, error } = await query.select();
      if (error) throw error;
      return { count: data?.length || 0 };
    },

    delete: async <T = any>(options: DeleteOptions): Promise<T> => {
      const { data, error } = await client
        .from(tableName as any)
        .delete()
        .eq('id', options.where.id)
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },

    deleteMany: async (options: { where: WhereInput<any> }): Promise<{ count: number }> => {
      let query = client.from(tableName as any).delete();
      
      if (options.where) {
        const snakeWhere = convertToSnakeCase(options.where);
        for (const [key, value] of Object.entries(snakeWhere)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }

      const { data, error } = await query.select();
      if (error) throw error;
      return { count: data?.length || 0 };
    },

    count: async (options: { where?: WhereInput<any> } = {}): Promise<number> => {
      let query = client.from(tableName as any).select('*', { count: 'exact', head: true });
      
      if (options.where) {
        const snakeWhere = convertToSnakeCase(options.where);
        for (const [key, value] of Object.entries(snakeWhere)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  };
}

function createPrismaLikeClient(client: Supabase) {
  const models = [
    'user',
    'pharmacy',
    'branch',
    'role',
    'userRole',
    'userBranch',
    'sale',
    'payment',
    'paymentTransaction',
    'cashierShift',
    'stock',
    'medicine',
    'medicineCategory',
    'medicineBatch',
    'saleItem',
    'refund',
    'refundItem',
    'stockMovement',
    'paymentMethod',
    'subscriptionPlan',
    'pharmacySubscription',
    'pharmacyDocument',
    'registrationApplication',
    'passwordResetToken',
    'restockRequest',
  ];

  const prismaLike = {} as any;

  for (const model of models) {
    prismaLike[model] = createModelHandler(client, model);
  }
  
  prismaLike.$transaction = async (fn: (tx: any) => Promise<any>) => {
    return fn(prismaLike);
  };

  return prismaLike;
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://qclrrjhynjdnkrbhvmrb.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbHJyamh5bmpkbmtyYmh2bXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjA5MzAsImV4cCI6MjA4Njg5NjkzMH0.TIhEM-17PDQmtTzCixcWK_PEiEh3yQNRN7wdd2sGpSI';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const prisma = createPrismaLikeClient(supabase);

export default supabase;
