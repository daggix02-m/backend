# PharmaCare Backend

A multi-tenant Pharmacy SaaS Platform Backend built with TypeScript, Express.js, and PostgreSQL. This backend provides comprehensive pharmacy management capabilities including inventory tracking, sales processing, payment integration, and user management.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

PharmaCare Backend is a robust, scalable backend solution designed for pharmacy management systems. It supports multi-tenant architecture, allowing multiple pharmacies to use the same platform while maintaining complete data isolation. The system integrates with Chapa payment gateway for seamless payment processing and provides comprehensive inventory management, sales tracking, and user administration features.

## ✨ Features

### Core Functionality
- **Multi-Tenant Architecture**: Support for multiple pharmacies with complete data isolation
- **User Management**: Role-based access control (Admin, Manager, Pharmacist, Cashier)
- **Authentication & Authorization**: JWT-based authentication with secure password handling
- **Inventory Management**: Track medicines, batches, categories, and stock levels
- **Sales Processing**: Complete sales workflow with pharmacist and cashier roles
- **Payment Integration**: Chapa payment gateway integration with webhook support
- **Refund Management**: Process refunds with proper stock restoration
- **Cashier Shifts**: Track cashier shifts with opening/closing balances
- **Stock Movements**: Track all stock movements (restock, transfer, adjustment, etc.)

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **Express.js**: Fast and minimal web framework
- **Prisma ORM**: Type-safe database access with PostgreSQL
- **Swagger/OpenAPI**: Interactive API documentation
- **Rate Limiting**: Protect against brute force attacks
- **Input Validation**: Comprehensive request validation
- **Security**: Helmet.js for security headers, CORS configuration
- **Logging**: Morgan for HTTP request logging
- **Graceful Shutdown**: Proper handling of SIGTERM and SIGINT signals

## 🛠 Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Runtime** | Node.js | - |
| **Language** | TypeScript | - |
| **Framework** | Express.js | ^5.2.1 |
| **Database** | PostgreSQL | - |
| **ORM** | Prisma | ^7.4.0 |
| **Authentication** | JWT (jsonwebtoken) | ^9.0.3 |
| **Password Hashing** | bcryptjs | ^3.0.3 |
| **Payment Gateway** | Chapa | - |
| **API Documentation** | Swagger UI | ^5.0.1 |
| **Security** | Helmet | ^8.1.0 |
| **CORS** | cors | ^2.8.6 |
| **Logging** | Morgan | ^1.10.1 |
| **HTTP Client** | Axios | ^1.13.5 |
| **Environment** | dotenv | ^17.3.1 |

## 📁 Project Structure

```
pharmacare-backend/
├── prisma/
│   └── schema.prisma          # Database schema definition
├── src/
│   ├── config/
│   │   ├── index.ts           # Application configuration
│   │   └── swagger.ts         # Swagger/OpenAPI configuration
│   ├── lib/
│   │   ├── auth.ts            # Authentication utilities
│   │   ├── chapa.ts           # Chapa payment integration
│   │   └── prisma.ts          # Prisma client instance
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication middleware
│   │   ├── rateLimit.ts       # Rate limiting middleware
│   │   └── validation.ts     # Input validation schemas
│   ├── routes/
│   │   ├── auth.ts            # Authentication routes
│   │   ├── pharmacies.ts     # Pharmacy management routes
│   │   ├── users.ts           # User management routes
│   │   ├── inventory.ts       # Inventory management routes
│   │   ├── sales.ts           # Sales processing routes
│   │   ├── refunds.ts         # Refund processing routes
│   │   ├── shifts.ts          # Cashier shift routes
│   │   └── payments.ts        # Payment processing routes
│   ├── app.ts                 # Express application setup
│   └── server.ts              # Server entry point
├── .env                       # Environment variables (not in git)
├── .gitignore                 # Git ignore rules
├── package.json               # Project dependencies
├── tsconfig.json              # TypeScript configuration
├── vercel.json                # Vercel deployment configuration
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn package manager
- Chapa account (for payment integration)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pharmacare-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with ts-node |
| `npm run build` | Generate Prisma client |
| `npm start` | Start production server |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio for database management |

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pharmacare

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# Chapa Payment Gateway
CHAPA_SECRET_KEY=your_chapa_secret_key
CHAPA_WEBHOOK_SECRET=your_chapa_webhook_secret

# CORS
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

### Environment Variable Descriptions

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | - |
| `JWT_SECRET` | Yes | Secret key for JWT token signing | - |
| `JWT_EXPIRES_IN` | No | JWT token expiration time | `7d` |
| `PORT` | No | Server port number | `3000` |
| `NODE_ENV` | No | Environment (development/production) | `development` |
| `CHAPA_SECRET_KEY` | Yes | Chapa API secret key | - |
| `CHAPA_WEBHOOK_SECRET` | Yes | Chapa webhook secret | - |
| `CORS_ORIGIN` | No | Allowed CORS origins | `*` |
| `LOG_LEVEL` | No | Logging level | `info` |

## 🗄 Database Schema

The database uses Prisma ORM with PostgreSQL. The schema includes the following main entities:

### Core Models

1. **Pharmacy** - Multi-tenant pharmacy organization
2. **Branch** - Pharmacy branches/locations
3. **User** - System users with roles
4. **Role** - User roles (Admin, Manager, Pharmacist, Cashier)
5. **UserRole** - Many-to-many relationship between users and roles
6. **UserBranch** - Many-to-many relationship between users and branches

### Inventory Models

7. **MedicineCategory** - Medicine categories
8. **Medicine** - Medicine catalog
9. **MedicineBatch** - Medicine batches with expiry tracking
10. **Stock** - Current stock levels per medicine per branch
11. **StockMovement** - Stock movement history

### Sales & Payment Models

12. **PaymentMethod** - Available payment methods
13. **CashierShift** - Cashier shift tracking
14. **Sale** - Sales transactions
15. **SaleItem** - Individual items in a sale
16. **Payment** - Payment records
17. **PaymentTransaction** - Payment provider transactions

### Refund Models

18. **Refund** - Refund records
19. **RefundItem** - Individual items in a refund

For detailed schema information, see [`prisma/schema.prisma`](prisma/schema.prisma)

## 📚 API Documentation

### Base URLs
- **Development**: `http://localhost:3000/api`
- **Production**: `https://backend-21.vercel.app/api`

### Interactive Documentation
Access the interactive Swagger UI documentation at:
- **Development**: `http://localhost:3000/api-docs`
- **Production**: `https://backend-21.vercel.app/api-docs`

### API Endpoints Summary

#### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | User login | No |
| POST | `/auth/change-password` | Change password | Yes |
| GET | `/auth/me` | Get current user | Yes |

#### Pharmacies
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/pharmacies` | Get all pharmacies | No |
| GET | `/pharmacies/:id` | Get pharmacy by ID | No |
| POST | `/pharmacies` | Create new pharmacy | Yes |
| PUT | `/pharmacies/:id` | Update pharmacy | Yes |
| DELETE | `/pharmacies/:id` | Delete pharmacy | Yes |
| GET | `/pharmacies/:id/branches` | Get pharmacy branches | No |

#### Users
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | Get all users | Yes |
| GET | `/users/:id` | Get user by ID | Yes |
| PUT | `/users/:id` | Update user | Yes |
| DELETE | `/users/:id` | Delete user | Yes |
| GET | `/users/:id/branches` | Get user branches | Yes |
| POST | `/users/:id/branches` | Assign branch to user | Yes |
| DELETE | `/users/:id/branches/:branchId` | Remove branch from user | Yes |

#### Inventory
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/inventory/categories` | Get all categories | Yes |
| POST | `/inventory/categories` | Create category | Yes |
| GET | `/inventory/medicines` | Get all medicines | Yes |
| POST | `/inventory/medicines` | Add medicine | Yes |
| PUT | `/inventory/medicines/:id` | Update medicine | Yes |
| DELETE | `/inventory/medicines/:id` | Delete medicine | Yes |
| GET | `/inventory/stocks` | Get stock levels | Yes |
| POST | `/inventory/batches` | Receive new stock | Yes |
| GET | `/inventory/movements` | Get stock movements | Yes |
| POST | `/inventory/transfer` | Transfer stock between branches | Yes |

#### Sales
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/sales` | Get all sales | Yes |
| GET | `/sales/:id` | Get sale by ID | Yes |
| POST | `/sales` | Create new sale | Yes |
| PUT | `/sales/:id` | Update sale | Yes |
| DELETE | `/sales/:id` | Delete sale | Yes |
| GET | `/sales/daily` | Get daily sales report | Yes |

#### Payments
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/chapa/initialize` | Initialize Chapa payment | Yes |
| GET | `/payments/chapa/verify/:txRef` | Verify Chapa payment | Yes |
| POST | `/payments/chapa/webhook` | Chapa webhook handler | No* |
| GET | `/payments/chapa/callback` | Chapa callback handler | No |
| GET | `/payments/chapa/return` | Chapa return handler | No |

*Webhook is secured with signature verification

#### Refunds
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/refunds` | Get all refunds | Yes |
| GET | `/refunds/:id` | Get refund by ID | Yes |
| POST | `/refunds` | Create refund | Yes |
| PUT | `/refunds/:id` | Update refund | Yes |
| DELETE | `/refunds/:id` | Delete refund | Yes |

#### Shifts
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/shifts` | Get all shifts | Yes |
| GET | `/shifts/:id` | Get shift by ID | Yes |
| POST | `/shifts` | Create shift | Yes |
| PUT | `/shifts/:id` | Update shift | Yes |
| DELETE | `/shifts/:id` | Delete shift | Yes |
| POST | `/shifts/:id/close` | Close shift | Yes |

For detailed API documentation with request/response examples, see [`API_ENDPOINTS_DOCUMENTATION.md`](API_ENDPOINTS_DOCUMENTATION.md)

## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Here's how to use it:

### Login Flow

1. **Register a user** (if not already registered)
   ```bash
   POST /api/auth/register
   {
     "email": "user@example.com",
     "password": "securePassword123",
     "fullName": "John Doe",
     "pharmacyId": 1,
     "roles": ["pharmacist"]
   }
   ```

2. **Login to get a token**
   ```bash
   POST /api/auth/login
   {
     "email": "user@example.com",
     "password": "securePassword123"
   }
   ```

   Response:
   ```json
   {
     "message": "Login successful",
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": 1,
       "email": "user@example.com",
       "fullName": "John Doe",
       "pharmacyId": 1,
       "roles": ["pharmacist"]
     }
   }
   ```

3. **Use the token for authenticated requests**
   ```bash
   GET /api/users
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Token Expiration

- Default token expiration: 7 days
- Tokens should be stored securely (e.g., httpOnly cookies or secure storage)
- Implement token refresh logic in your frontend application

### Role-Based Access Control

The system supports the following roles:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all resources and settings |
| **Manager** | Manage inventory, users, and view reports |
| **Pharmacist** | Process sales, manage inventory, view reports |
| **Cashier** | Process sales, manage shifts |

## 🚢 Deployment

### Vercel Deployment

The project is configured for Vercel deployment. To deploy:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Set environment variables in Vercel dashboard**
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CHAPA_SECRET_KEY`
   - `CHAPA_WEBHOOK_SECRET`
   - And other required variables

### Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `CORS_ORIGIN`
- [ ] Set up production database
- [ ] Run database migrations
- [ ] Configure Chapa webhook URL
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Review security headers
- [ ] Test all API endpoints

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Write clean, maintainable code
- Follow the existing project structure

### Testing

Before submitting a PR, ensure:
- All tests pass
- Code follows the project style
- New features include tests
- Documentation is updated

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

For support, please contact:
- Email: support@pharmacare.com
- Issues: [GitHub Issues](https://github.com/your-repo/pharmacare-backend/issues)

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Database powered by [Prisma](https://www.prisma.io/)
- Payment integration by [Chapa](https://chapa.co/)
- API documentation with [Swagger](https://swagger.io/)

---

**Note**: This is the backend API. For the frontend application, please refer to the separate frontend repository.

**Last Updated**: 2026-02-17
**Version**: 1.0.0
