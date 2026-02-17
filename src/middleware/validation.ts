import { Request, Response, NextFunction } from 'express';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Email validation regex
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation regex
 * At least 8 characters, one uppercase, one lowercase, one number, one special character
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[@$!%*?&]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
  }
  return { valid: true };
};

/**
 * Validate required fields in request body
 */
export const validateRequiredFields = (body: any, requiredFields: string[]): void => {
  const missingFields = requiredFields.filter(field => !body[field]);
  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
  }
};

/**
 * Validate field types
 */
export const validateFieldTypes = (
  body: any,
  fields: { [key: string]: 'string' | 'number' | 'boolean' | 'array' | 'object' }
): void => {
  for (const [field, expectedType] of Object.entries(fields)) {
    if (body[field] !== undefined) {
      const actualType = Array.isArray(body[field]) ? 'array' : typeof body[field];
      if (actualType !== expectedType) {
        throw new ValidationError(`Field '${field}' must be of type ${expectedType}`);
      }
    }
  }
};

/**
 * Middleware to validate registration data
 */
export const validateRegistration = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { email, password, fullName, pharmacyId } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['email', 'password', 'fullName', 'pharmacyId']);

    // Validate email
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.message || 'Invalid password');
    }

    // Validate pharmacyId is a number
    if (typeof pharmacyId !== 'number') {
      throw new ValidationError('pharmacyId must be a number');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * Middleware to validate login data
 */
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['email', 'password']);

    // Validate email
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * Middleware to validate password change data
 */
export const validatePasswordChange = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['currentPassword', 'newPassword']);

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.message || 'Invalid password');
    }

    // Ensure new password is different from current
    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * Middleware to validate sale creation data
 */
export const validateSaleCreation = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { branchId, items, paymentMethodId } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['branchId', 'items', 'paymentMethodId']);

    // Validate items is an array and not empty
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items must be a non-empty array');
    }

    // Validate each item
    items.forEach((item: any, index: number) => {
      if (!item.medicineId || !item.quantity || !item.unitPrice) {
        throw new ValidationError(`Item at index ${index} is missing required fields (medicineId, quantity, unitPrice)`);
      }
      if (item.quantity <= 0) {
        throw new ValidationError(`Item at index ${index} has invalid quantity (must be greater than 0)`);
      }
      if (item.unitPrice <= 0) {
        throw new ValidationError(`Item at index ${index} has invalid unitPrice (must be greater than 0)`);
      }
    });

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * Middleware to validate refund creation data
 */
export const validateRefundCreation = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { saleId, items } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['saleId', 'items']);

    // Validate items is an array and not empty
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items must be a non-empty array');
    }

    // Validate each item
    items.forEach((item: any, index: number) => {
      if (!item.medicineId || !item.quantity || !item.unitPrice) {
        throw new ValidationError(`Item at index ${index} is missing required fields (medicineId, quantity, unitPrice)`);
      }
      if (item.quantity <= 0) {
        throw new ValidationError(`Item at index ${index} has invalid quantity (must be greater than 0)`);
      }
    });

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};
