import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Chapa Payment Gateway
  chapaSecretKey: process.env.CHAPA_SECRET_KEY || '',
  chapaWebhookSecret: process.env.CHAPA_WEBHOOK_SECRET || '',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};
