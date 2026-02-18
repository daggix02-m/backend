import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Optimize for serverless - connect on first use in production
if (process.env.NODE_ENV === 'production') {
  prisma.$connect().catch((error: unknown) => {
    console.error('Failed to connect to database:', error);
  });
}

export default prisma;

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
