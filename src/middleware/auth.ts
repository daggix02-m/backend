import { Request, Response, NextFunction } from 'express';
import { AuthUtils, TokenPayload } from '../lib/auth';
import { supabase as supabaseClient } from '../lib/supabase';

const supabase = supabaseClient as any;

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = AuthUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const payload = AuthUtils.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasRole = allowedRoles.some(role => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const isManager = req.user.roles.includes('manager');
    if (!isManager) {
      res.status(403).json({ error: 'Only pharmacy managers can perform this action' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('is_owner')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      res.status(500).json({ error: 'Failed to verify owner status' });
      return;
    }

    if (!user.is_owner) {
      res.status(403).json({ error: 'Only the pharmacy owner can perform this action' });
      return;
    }

    next();
  } catch (error) {
    console.error('Owner check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const ensureTenantAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  next();
};

export const checkIsOwner = async (userId: number): Promise<boolean> => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('is_owner')
      .eq('id', userId)
      .single();
    
    return (user as any)?.is_owner || false;
  } catch {
    return false;
  }
};
