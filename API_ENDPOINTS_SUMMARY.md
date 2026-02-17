# API Endpoints Summary - Quick Reference

**Base URL:** `http://localhost:3000/api`

---

## Endpoints by Category

### 🔐 Authentication (4 endpoints)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | Public | Register a new user |
| POST | `/auth/login` | Public | Login and get token |
| POST | `/auth/change-password` | Private | Change user password |
| GET | `/auth/me` | Private | Get current user info |

---

### 💊 Inventory Management (5 endpoints)
| Method | Endpoint | Access | Roles | Description |
|--------|----------|--------|-------|-------------|
| GET | `/inventory/categories` | Private | All | Get all medicine categories |
| GET | `/inventory/medicines` | Private | All | Get all medicines |
| POST | `/inventory/medicines` | Private | Admin/Manager/Pharmacist | Add new medicine |
| GET | `/inventory/stocks` | Private | All | Get stock levels |
| POST | `/inventory/batches` | Private | Admin/Manager/Pharmacist | Receive new stock batch |

---

### 💳 Payments (6 endpoints)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/payments/chapa/initialize` | Private | Initialize Chapa payment |
| GET | `/payments/chapa/verify/:txRef` | Private | Verify payment transaction |
| POST | `/payments/chapa/webhook` | Public | Handle Chapa webhook |
| GET | `/payments/chapa/callback` | Public | Handle payment callback |
| GET | `/payments/chapa/return` | Public | Handle payment return |
| GET | `/payments/transactions` | Private | Get payment transactions |

---

### 🏥 Pharmacies (6 endpoints)
| Method | Endpoint | Access | Roles | Description |
|--------|----------|--------|-------|-------------|
| GET | `/pharmacies` | Private | Admin | Get all pharmacies |
| GET | `/pharmacies/my` | Private | All | Get my pharmacy details |
| PUT | `/pharmacies/my` | Private | Admin | Update pharmacy details |
| GET | `/pharmacies/branches` | Private | All | Get pharmacy branches |
| POST | `/pharmacies/branches` | Private | Admin | Create new branch |
| PUT | `/pharmacies/branches/:id` | Private | Admin | Update branch |

---

### 🔄 Refunds & Stock Movements (2 endpoints)
| Method | Endpoint | Access | Roles | Description |
|--------|----------|--------|-------|-------------|
| POST | `/refunds` | Private | Admin/Manager/Pharmacist | Create refund |
| POST | `/inventory/movements` | Private | Admin/Manager/Pharmacist | Record stock movement |

---

### 🛒 Sales (3 endpoints)
| Method | Endpoint | Access | Roles | Description |
|--------|----------|--------|-------|-------------|
| GET | `/sales/payment-methods` | Private | All | Get payment methods |
| POST | `/sales` | Private | Admin/Manager/Pharmacist/Cashier | Create sale |
| GET | `/sales` | Private | All | Get sales history |

---

### ⏰ Shifts (2 endpoints)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/shifts/start` | Private | Start cashier shift |
| POST | `/shifts/end` | Private | End cashier shift |

---

### 👥 Users (3 endpoints)
| Method | Endpoint | Access | Roles | Description |
|--------|----------|--------|-------|-------------|
| GET | `/users` | Private | Admin/Manager | Get all users |
| POST | `/users` | Private | Admin | Create new user |
| PUT | `/users/:id` | Private | Admin | Update user |

---

## Endpoints by Role

### 🔓 Public Access (5 endpoints)
- `POST /auth/register`
- `POST /auth/login`
- `POST /payments/chapa/webhook`
- `GET /payments/chapa/callback`
- `GET /payments/chapa/return`

### 🔒 All Authenticated Users (14 endpoints)
- `GET /inventory/categories`
- `GET /inventory/medicines`
- `GET /inventory/stocks`
- `GET /pharmacies/my`
- `GET /pharmacies/branches`
- `GET /sales/payment-methods`
- `GET /sales`
- `POST /shifts/start`
- `POST /shifts/end`
- `GET /payments/chapa/initialize`
- `GET /payments/chapa/verify/:txRef`
- `GET /payments/transactions`
- `POST /auth/change-password`
- `GET /auth/me`

### 👑 Admin Only (7 endpoints)
- `GET /pharmacies`
- `PUT /pharmacies/my`
- `POST /pharmacies/branches`
- `PUT /pharmacies/branches/:id`
- `GET /users`
- `POST /users`
- `PUT /users/:id`

### 📋 Admin & Manager (2 endpoints)
- `GET /users`

### 💼 Admin, Manager, Pharmacist (5 endpoints)
- `POST /inventory/medicines`
- `POST /inventory/batches`
- `POST /refunds`
- `POST /inventory/movements`
- `POST /sales`

### 🧾 Admin, Manager, Pharmacist, Cashier (1 endpoint)
- `POST /sales`

---

## HTTP Method Distribution

| Method | Count | Percentage |
|--------|-------|------------|
| GET | 13 | 43% |
| POST | 16 | 53% |
| PUT | 2 | 4% |
| **Total** | **31** | **100%** |

---

## Quick Integration Guide

### 1. Authentication Flow
```javascript
// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
// Returns: { token, user }

// Use token in subsequent requests
Authorization: Bearer <token>
```

### 2. Sale Flow
```javascript
// Create sale
POST /api/sales
{
  "branchId": 1,
  "items": [
    { "medicineId": 1, "quantity": 2, "unitPrice": 50 }
  ],
  "paymentMethodId": 1
}
```

### 3. Payment Flow (Chapa)
```javascript
// Initialize payment
POST /api/payments/chapa/initialize
{
  "saleId": 123,
  "customerEmail": "customer@email.com",
  "customerFirstName": "John",
  "customerLastName": "Doe"
}
// Returns: { checkout_url, tx_ref }

// Verify payment
GET /api/payments/chapa/verify/:txRef
```

### 4. Inventory Management
```javascript
// Add medicine
POST /api/inventory/medicines
{
  "name": "Paracetamol",
  "categoryId": 1,
  "unitType": "tablets"
}

// Receive stock
POST /api/inventory/batches
{
  "medicineId": 1,
  "branchId": 1,
  "batchNumber": "B001",
  "expiryDate": "2025-12-31",
  "quantityReceived": 100
}
```

### 5. Shift Management
```javascript
// Start shift
POST /api/shifts/start
{
  "branchId": 1,
  "openingBalance": 1000
}

// End shift
POST /api/shifts/end
{
  "closingBalance": 5000,
  "notes": "Shift completed successfully"
}
```

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## User Roles Reference

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all resources, user management, pharmacy settings |
| **Manager** | Manage inventory, sales, refunds, view users |
| **Pharmacist** | Manage inventory, process sales, handle refunds |
| **Cashier** | Process sales, manage shifts only |

---

## Testing Endpoints

### Using cURL
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get medicines (with token)
curl -X GET http://localhost:3000/api/inventory/medicines \
  -H "Authorization: Bearer <token>"
```

### Using JavaScript/Fetch
```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});
const { token } = await loginResponse.json();

// Get medicines
const medicinesResponse = await fetch('http://localhost:3000/api/inventory/medicines', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const medicines = await medicinesResponse.json();
```

---

**Total Endpoints:** 31  
**Categories:** 8  
**User Roles:** 4  
**Document Version:** 1.0.0
