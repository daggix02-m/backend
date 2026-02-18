import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';

export interface TokenPayload {
  userId: number;
  pharmacyId: number;
  email: string;
  roles: string[];
  isOwner?: boolean;
}

export class AuthUtils {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare a plain password with a hashed password
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token
   */
  static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify a JWT token
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  static generatePasswordResetToken(payload: { userId: number; email: string }): string {
    return jwt.sign({ ...payload, type: 'password_reset' }, config.jwtSecret, {
      expiresIn: '1h',
    } as jwt.SignOptions);
  }

  static verifyPasswordResetToken(token: string): { userId: number; email: string } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }
      return { userId: decoded.userId, email: decoded.email };
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }
  }
}
