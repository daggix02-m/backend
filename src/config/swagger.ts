import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PharmaCare API',
      version: '1.0.0',
      description: 'Multi-tenant Pharmacy SaaS Platform Backend API',
      contact: {
        name: 'PharmaCare Support',
        email: 'support@pharmacare.com',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.pharmacare.com',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Admin', description: 'Admin-only endpoints' },
      { name: 'Manager', description: 'Manager-only endpoints' },
      { name: 'Pharmacist', description: 'Pharmacist-only endpoints' },
      { name: 'Cashier', description: 'Cashier-only endpoints' },
      { name: 'Pharmacies', description: 'Pharmacy management' },
      { name: 'Users', description: 'User management' },
      { name: 'Inventory', description: 'Inventory management' },
      { name: 'Sales', description: 'Sales management' },
      { name: 'Payments', description: 'Payment processing' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            isActive: {
              type: 'boolean',
              description: 'User active status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp',
            },
          },
        },
        Pharmacy: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Pharmacy ID',
            },
            name: {
              type: 'string',
              description: 'Pharmacy name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Pharmacy email address',
            },
            phone: {
              type: 'string',
              description: 'Pharmacy phone number',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Pharmacy creation timestamp',
            },
          },
        },
        Branch: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Branch ID',
            },
            pharmacyId: {
              type: 'integer',
              description: 'Pharmacy ID',
            },
            name: {
              type: 'string',
              description: 'Branch name',
            },
            location: {
              type: 'string',
              description: 'Branch location',
            },
            phone: {
              type: 'string',
              description: 'Branch phone number',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              description: 'Branch status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Branch creation timestamp',
            },
          },
        },
        Medicine: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Medicine ID',
            },
            branchId: {
              type: 'integer',
              description: 'Branch ID',
            },
            name: {
              type: 'string',
              description: 'Medicine name',
            },
            categoryId: {
              type: 'integer',
              description: 'Category ID',
            },
            unitPrice: {
              type: 'number',
              format: 'decimal',
              description: 'Unit price',
            },
            minStockLevel: {
              type: 'integer',
              description: 'Minimum stock level',
            },
            isDeleted: {
              type: 'boolean',
              description: 'Deletion status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        Sale: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Sale ID',
            },
            branchId: {
              type: 'integer',
              description: 'Branch ID',
            },
            pharmacistId: {
              type: 'integer',
              description: 'Pharmacist ID',
            },
            cashierId: {
              type: 'integer',
              description: 'Cashier ID',
            },
            shiftId: {
              type: 'integer',
              description: 'Shift ID',
            },
            status: {
              type: 'string',
              enum: ['pending_payment', 'COMPLETED', 'FAILED'],
              description: 'Sale status',
            },
            subtotal: {
              type: 'number',
              format: 'decimal',
              description: 'Subtotal amount',
            },
            vatAmount: {
              type: 'number',
              format: 'decimal',
              description: 'VAT amount',
            },
            totalAmount: {
              type: 'number',
              format: 'decimal',
              description: 'Total amount',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        Refund: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Refund ID',
            },
            saleId: {
              type: 'integer',
              description: 'Sale ID',
            },
            processedBy: {
              type: 'integer',
              description: 'User ID who processed the refund',
            },
            reason: {
              type: 'string',
              description: 'Refund reason',
            },
            totalAmount: {
              type: 'number',
              format: 'decimal',
              description: 'Total refund amount',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        CashierShift: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Shift ID',
            },
            userId: {
              type: 'integer',
              description: 'User ID',
            },
            branchId: {
              type: 'integer',
              description: 'Branch ID',
            },
            openedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Shift opening time',
            },
            closedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Shift closing time',
            },
            openingBalance: {
              type: 'number',
              format: 'decimal',
              description: 'Opening balance',
            },
            closingBalance: {
              type: 'number',
              format: 'decimal',
              description: 'Closing balance',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
