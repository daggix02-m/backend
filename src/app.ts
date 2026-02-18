import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/auth';
import pharmacyRoutes from './routes/pharmacies';
import userRoutes from './routes/users';
import inventoryRoutes from './routes/inventory';
import salesRoutes from './routes/sales';
import refundRoutes from './routes/refunds';
import shiftRoutes from './routes/shifts';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import adminSubscriptionsRoutes from './routes/admin/subscriptions';
import adminDocumentsRoutes from './routes/admin/documents';
import managerRoutes from './routes/manager';
import pharmacistRoutes from './routes/pharmacist';
import cashierRoutes from './routes/cashier';
import importRoutes from './routes/import';
import uploadRoutes from './routes/upload';
import { authenticate } from './middleware/auth';
import { authRateLimiter } from './middleware/rateLimit';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { prisma, supabase } from './lib/prisma';

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    
    if (error) throw error;
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed'
    });
  }
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'PharmaCare API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
  },
}));

// API JSON spec
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/payments', paymentRoutes);

// Role-based API Routes (for frontend integration)
app.use('/api/admin', adminRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);
app.use('/api/admin/documents', adminDocumentsRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/pharmacist', pharmacistRoutes);
app.use('/api/cashier', cashierRoutes);

// Import routes (accessible by manager and pharmacist)
app.use('/api/import', importRoutes);

// Upload routes
app.use('/api/upload', uploadRoutes);

// Apply rate limiting to sensitive endpoints
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// Protected route example
app.get('/api/protected', authenticate, (req: Request, res: Response) => {
  res.json({ message: 'This is a protected route' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

export default app;
