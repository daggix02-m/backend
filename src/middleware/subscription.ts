import { Response, NextFunction } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest } from './auth';

const supabase = supabaseClient as any;

export interface SubscriptionInfo {
  planId: number;
  planName: string;
  status: string;
  maxBranches: number;
  maxStaffPerBranch: number;
  maxMedicines: number;
  maxImportRows: number;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
}

export const getActiveSubscription = async (pharmacyId: number): Promise<SubscriptionInfo | null> => {
  const { data: subscription, error } = await supabase
    .from('pharmacy_subscriptions')
    .select(`
      id,
      status,
      trial_ends_at,
      grace_ends_at,
      plan_id,
      subscription_plans (
        id,
        name,
        max_branches,
        max_staff_per_branch,
        max_medicines,
        max_import_rows
      )
    `)
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !subscription) {
    return null;
  }

  const plan = subscription.subscription_plans as any;
  
  return {
    planId: plan?.id || 0,
    planName: plan?.name || 'Unknown',
    status: subscription.status,
    maxBranches: plan?.max_branches || 1,
    maxStaffPerBranch: plan?.max_staff_per_branch || 5,
    maxMedicines: plan?.max_medicines || 100,
    maxImportRows: plan?.max_import_rows || 100,
    trialEndsAt: subscription.trial_ends_at,
    graceEndsAt: subscription.grace_ends_at,
  };
};

export const checkSubscriptionActive = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const subscription = await getActiveSubscription(req.user.pharmacyId);

    if (!subscription) {
      return res.status(403).json({ 
        error: 'No active subscription',
        code: 'NO_SUBSCRIPTION'
      });
    }

    const now = new Date();
    
    if (subscription.status === 'expired') {
      return res.status(403).json({ 
        error: 'Subscription has expired',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    if (subscription.status === 'grace' && subscription.graceEndsAt) {
      if (new Date(subscription.graceEndsAt) < now) {
        return res.status(403).json({ 
          error: 'Grace period has ended',
          code: 'GRACE_PERIOD_ENDED'
        });
      }
    }

    if (subscription.status === 'trial' && subscription.trialEndsAt) {
      if (new Date(subscription.trialEndsAt) < now) {
        return res.status(403).json({ 
          error: 'Trial period has ended',
          code: 'TRIAL_ENDED'
        });
      }
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkImportLimit = (rowCount: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const subscription = await getActiveSubscription(req.user.pharmacyId);

      if (!subscription) {
        return res.status(403).json({ 
          error: 'No active subscription',
          code: 'NO_SUBSCRIPTION'
        });
      }

      if (rowCount > subscription.maxImportRows) {
        return res.status(400).json({ 
          error: `Import limit exceeded. Your plan allows up to ${subscription.maxImportRows} rows. You are trying to import ${rowCount} rows.`,
          code: 'IMPORT_LIMIT_EXCEEDED',
          maxAllowed: subscription.maxImportRows,
          attempted: rowCount
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Import limit check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

declare module 'express' {
  interface Request {
    subscription?: SubscriptionInfo;
  }
}
