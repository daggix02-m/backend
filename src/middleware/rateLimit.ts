import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter
 * NOTE: For production, install express-rate-limit package:
 * npm install express-rate-limit
 * npm install --save-dev @types/express-rate-limit
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Rate limiting middleware configuration
 */
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    // Initialize or get current rate limit data
    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      // Check if window has expired
      if (now > store[key].resetTime) {
        store[key] = {
          count: 1,
          resetTime: now + windowMs,
        };
      } else {
        store[key].count++;
      }
    }
    
    // Check if limit exceeded
    if (store[key].count > max) {
      const resetTime = Math.ceil((store[key].resetTime - now) / 1000);
      res.setHeader('Retry-After', resetTime.toString());
      res.status(429).json({ 
        error: message,
        retryAfter: resetTime 
      });
      return;
    }
    
    next();
  };
};

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes
 */
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5,
  'Too many authentication attempts, please try again later'
);

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes
 */
export const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100,
  'Too many requests, please try again later'
);

/**
 * Rate limiter for webhook endpoints
 * 50 requests per minute
 */
export const webhookRateLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  50,
  'Too many webhook requests'
);
