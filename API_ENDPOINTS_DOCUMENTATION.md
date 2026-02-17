# PharmaCare Backend API Endpoints Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000/api` (Development)  
**Base URL:** `https://backend-21.vercel.app/api` (Production)  
**Last Updated:** 2026-02-17

---

## Table of Contents

1. [Authentication](#authentication)
2. [Inventory Management](#inventory-management)
3. [Payments](#payments)
4. [Pharmacies](#pharmacies)
5. [Refunds & Stock Movements](#refunds--stock-movements)
6. [Sales](#sales)
7. [Shifts](#shifts)
8. [Users](#users)

---

## Authentication

### POST /auth/register
Register a new user account.

**Access Level:** Public

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "fullName": "string (required)",
  "pharmacyId": "number (required)",
  "roles": ["string"] (optional, default: ["pharmacist"])
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "string",
  "user": {
    "id": "number",
    "email": "string",
    "fullName": "string",
    "pharmacyId": "number",
    "roles": ["string"]
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or user already exists
- `404 Not Found` - Pharmacy not found
- `500 Internal Server Error` - Server error

---

### POST /auth/login
Authenticate a user and receive an access token.

**Access Level:** Public

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "string",
  "user": {
    "id": "number",
    "email": "string",
    "fullName": "string",
    "pharmacyId": "number",
    "roles": ["string"],
    "mustChangePassword": "boolean"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Email and password required
- `401 Unauthorized` - Invalid credentials or inactive account
- `500 Internal Server Error` - Server error

---

### POST /auth/change-password
Change the authenticated user's password.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Current and new passwords required
- `401 Unauthorized` - Not authenticated or current password incorrect
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

### GET /auth/me
Get the current authenticated user's details.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "number",
  "email": "string",
  "fullName": "string",
  "pharmacyId": "number",
  "roles": ["string"],
  "branches": [
    {
      "id": "number",
      "name": "string",
      "location": "string"
    }
  ],
  "isActive": "boolean",
  "mustChangePassword": "boolean"
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## Inventory Management

### GET /inventory/categories
Get all medicine categories.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "name": "string",
    "description": "string"
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### GET /inventory/medicines
Get all medicines in the pharmacy.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "name": "string",
    "genericName": "string",
    "brandName": "string",
    "categoryId": "number",
    "category": {
      "id": "number",
      "name": "string"
    },
    "sku": "string",
    "unitType": "string",
    "strength": "string",
    "manufacturer": "string",
    "description": "string",
    "minStockLevel": "number",
    "requiresPrescription": "boolean",
    "pharmacyId": "number"
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### POST /inventory/medicines
Add a new medicine to the inventory.

**Access Level:** Private (Admin/Manager/Pharmacist)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "string (required)",
  "genericName": "string (optional)",
  "brandName": "string (optional)",
  "categoryId": "number (required)",
  "sku": "string (optional)",
  "unitType": "string (required)",
  "strength": "string (optional)",
  "manufacturer": "string (optional)",
  "description": "string (optional)",
  "minStockLevel": "number (optional, default: 10)",
  "requiresPrescription": "boolean (optional, default: false)"
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "name": "string",
  "genericName": "string",
  "brandName": "string",
  "categoryId": "number",
  "sku": "string",
  "unitType": "string",
  "strength": "string",
  "manufacturer": "string",
  "description": "string",
  "minStockLevel": "number",
  "requiresPrescription": "boolean",
  "pharmacyId": "number"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Server error

---

### GET /inventory/stocks
Get stock levels for all branches or a specific branch.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `branchId` (optional) - Filter by specific branch ID

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "medicineId": "number",
    "branchId": "number",
    "quantity": "number",
    "lastRestocked": "datetime",
    "medicine": {
      "id": "number",
      "name": "string"
    },
    "branch": {
      "id": "number",
      "name": "string"
    }
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### POST /inventory/batches
Receive new stock (create a batch).

**Access Level:** Private (Admin/Manager/Pharmacist)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "medicineId": "number (required)",
  "branchId": "number (required)",
  "batchNumber": "string (required)",
  "expiryDate": "date (required, ISO format)",
  "quantityReceived": "number (required)",
  "costPrice": "number (optional)",
  "sellingPrice": "number (optional)"
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "medicineId": "number",
  "branchId": "number",
  "batchNumber": "string",
  "expiryDate": "datetime",
  "quantityReceived": "number",
  "quantityRemaining": "number",
  "costPrice": "number",
  "sellingPrice": "number"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Server error

---

## Payments

### POST /payments/chapa/initialize
Initialize a Chapa payment for a sale.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "saleId": "number (required)",
  "customerEmail": "string (required)",
  "customerFirstName": "string (required)",
  "customerLastName": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "checkout_url": "string",
  "tx_ref": "string"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or sale already completed
- `403 Forbidden` - Access denied
- `404 Not Found` - Sale not found
- `500 Internal Server Error` - Server error

---

### GET /payments/chapa/verify/:txRef
Verify a Chapa payment transaction.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `txRef` (required) - Transaction reference

**Response (200 OK):**
```json
{
  "status": "string",
  "message": "string",
  "data": {
    "amount": "number",
    "currency": "string",
    "tx_ref": "string",
    "flw_ref": "string"
  }
}
```

**Error Responses:**
- `403 Forbidden` - Access denied
- `404 Not Found` - Transaction not found
- `500 Internal Server Error` - Server error

---

### POST /payments/chapa/webhook
Handle Chapa webhook events.

**Access Level:** Public (Secured with signature)

**Headers:**
```
chapa-signature: <signature>
```

**Request Body:** (Chapa webhook payload)

**Response (200 OK):**
```json
{
  "received": true
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid signature
- `404 Not Found` - Transaction not found
- `500 Internal Server Error` - Server error

---

### GET /payments/chapa/callback
Handle Chapa callback (redirect after payment).

**Access Level:** Public

**Query Parameters:**
- `tx_ref` (required) - Transaction reference

**Response:** Redirects to frontend with payment status

**Error Responses:**
- `400 Bad Request` - Missing transaction reference
- `404 Not Found` - Transaction not found

---

### GET /payments/chapa/return
Handle Chapa return (user returns from payment page).

**Access Level:** Public

**Query Parameters:**
- `tx_ref` (required) - Transaction reference

**Response:** Redirects to frontend for processing

**Error Responses:**
- `400 Bad Request` - Missing transaction reference

---

### GET /payments/transactions
Get payment transactions for a sale.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `saleId` (optional) - Filter by specific sale ID

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "paymentId": "number",
    "provider": "string",
    "txRef": "string",
    "verified": "boolean",
    "rawResponse": "object",
    "createdAt": "datetime",
    "payment": {
      "id": "number",
      "sale": {
        "id": "number",
        "branch": {
          "name": "string"
        }
      },
      "paymentMethod": {
        "id": "number",
        "name": "string"
      }
    }
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

## Pharmacies

### GET /pharmacies
Get all pharmacies (Super Admin only).

**Access Level:** Private (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "name": "string",
    "licenseNumber": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "tin": "string",
    "logoUrl": "string",
    "website": "string"
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### GET /pharmacies/my
Get current user's pharmacy details.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "number",
  "name": "string",
  "licenseNumber": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "tin": "string",
  "logoUrl": "string",
  "website": "string",
  "branches": [
    {
      "id": "number",
      "name": "string",
      "location": "string"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Pharmacy not found
- `500 Internal Server Error` - Server error

---

### PUT /pharmacies/my
Update current user's pharmacy details.

**Access Level:** Private (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "string (optional)",
  "licenseNumber": "string (optional)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "tin": "string (optional)",
  "logoUrl": "string (optional)",
  "website": "string (optional)"
}
```

**Response (200 OK):**
```json
{
  "id": "number",
  "name": "string",
  "licenseNumber": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "tin": "string",
  "logoUrl": "string",
  "website": "string"
}
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### GET /pharmacies/branches
Get all branches of the current pharmacy.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "name": "string",
    "location": "string",
    "phone": "string",
    "email": "string",
    "isMainBranch": "boolean",
    "isActive": "boolean",
    "pharmacyId": "number"
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### POST /pharmacies/branches
Create a new branch.

**Access Level:** Private (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "string (required)",
  "location": "string (required)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "isMainBranch": "boolean (optional, default: false)"
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "name": "string",
  "location": "string",
  "phone": "string",
  "email": "string",
  "isMainBranch": "boolean",
  "isActive": "boolean",
  "pharmacyId": "number"
}
```

**Error Responses:**
- `400 Bad Request` - Name and location are required
- `500 Internal Server Error` - Server error

---

### PUT /pharmacies/branches/:id
Update a branch.

**Access Level:** Private (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (required) - Branch ID

**Request Body:**
```json
{
  "name": "string (optional)",
  "location": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "isMainBranch": "boolean (optional)",
  "isActive": "boolean (optional)"
}
```

**Response (200 OK):**
```json
{
  "id": "number",
  "name": "string",
  "location": "string",
  "phone": "string",
  "email": "string",
  "isMainBranch": "boolean",
  "isActive": "boolean",
  "pharmacyId": "number"
}
```

**Error Responses:**
- `404 Not Found` - Branch not found or unauthorized
- `500 Internal Server Error` - Server error

---

## Refunds & Stock Movements

### POST /refunds
Create a refund for a sale.

**Access Level:** Private (Admin/Manager/Pharmacist)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "saleId": "number (required)",
  "reason": "string (optional)",
  "items": [
    {
      "medicineId": "number (required)",
      "quantity": "number (required)",
      "unitPrice": "number (required)"
    }
  ] (required, at least one item)
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "saleId": "number",
  "pharmacyId": "number",
  "branchId": "number",
  "userId": "number",
  "reason": "string",
  "refundAmount": "number",
  "status": "COMPLETED",
  "createdAt": "datetime"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Sale not found
- `500 Internal Server Error` - Server error

---

### POST /inventory/movements
Record a stock movement (adjustment/transfer).

**Access Level:** Private (Admin/Manager/Pharmacist)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "medicineId": "number (required)",
  "branchId": "number (required)",
  "quantity": "number (required)",
  "type": "string (required, enum: 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')",
  "reason": "string (optional)",
  "targetBranchId": "number (optional, required for TRANSFER type)"
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "medicineId": "number",
  "branchId": "number",
  "userId": "number",
  "quantity": "number",
  "type": "string",
  "reason": "string",
  "targetBranchId": "number",
  "createdAt": "datetime"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Server error

---

## Sales

### GET /sales/payment-methods
Get available payment methods.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "name": "string",
    "description": "string"
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### POST /sales
Create a new sale.

**Access Level:** Private (Admin/Manager/Pharmacist/Cashier)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "branchId": "number (required)",
  "customerName": "string (optional)",
  "customerPhone": "string (optional)",
  "items": [
    {
      "medicineId": "number (required)",
      "quantity": "number (required)",
      "unitPrice": "number (required)"
    }
  ] (required, at least one item),
  "paymentMethodId": "number (required)",
  "discountAmount": "number (optional, default: 0)",
  "taxAmount": "number (optional, default: 0)",
  "isChapaPayment": "boolean (optional, default: false)"
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "pharmacyId": "number",
  "branchId": "number",
  "userId": "number",
  "customerName": "string",
  "customerPhone": "string",
  "totalAmount": "number",
  "discountAmount": "number",
  "taxAmount": "number",
  "finalAmount": "number",
  "status": "string",
  "paymentMethodId": "number",
  "createdAt": "datetime"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Server error

---

### GET /sales
Get sales history.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `branchId` (optional) - Filter by specific branch ID
- `startDate` (optional) - Filter by start date (ISO format)
- `endDate` (optional) - Filter by end date (ISO format)

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "pharmacyId": "number",
    "branchId": "number",
    "userId": "number",
    "customerName": "string",
    "customerPhone": "string",
    "totalAmount": "number",
    "discountAmount": "number",
    "taxAmount": "number",
    "finalAmount": "number",
    "status": "string",
    "paymentMethodId": "number",
    "createdAt": "datetime",
    "saleItems": [
      {
        "id": "number",
        "medicineId": "number",
        "quantity": "number",
        "unitPrice": "number",
        "totalPrice": "number",
        "medicine": {
          "id": "number",
          "name": "string"
        }
      }
    ],
    "paymentMethod": {
      "id": "number",
      "name": "string"
    },
    "user": {
      "fullName": "string"
    },
    "branch": {
      "name": "string"
    }
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

## Shifts

### POST /shifts/start
Start a new cashier shift.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "branchId": "number (required)",
  "openingBalance": "number (required)"
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "userId": "number",
  "branchId": "number",
  "startTime": "datetime",
  "openingBalance": "number",
  "status": "OPEN"
}
```

**Error Responses:**
- `400 Bad Request` - Branch and opening balance required, or user already has an active shift
- `500 Internal Server Error` - Server error

---

### POST /shifts/end
End the current cashier shift.

**Access Level:** Private (Requires Authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "closingBalance": "number (required)",
  "notes": "string (optional)"
}
```

**Response (200 OK):**
```json
{
  "shift": {
    "id": "number",
    "userId": "number",
    "branchId": "number",
    "startTime": "datetime",
    "endTime": "datetime",
    "openingBalance": "number",
    "closingBalance": "number",
    "actualSales": "number",
    "status": "CLOSED",
    "notes": "string"
  },
  "summary": {
    "openingBalance": "number",
    "totalSales": "number",
    "expectedBalance": "number",
    "closingBalance": "number",
    "difference": "number"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Closing balance required
- `404 Not Found` - No active shift found
- `500 Internal Server Error` - Server error

---

## Users

### GET /users
Get all users in the pharmacy.

**Access Level:** Private (Admin/Manager only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "number",
    "email": "string",
    "fullName": "string",
    "isActive": "boolean",
    "mustChangePassword": "boolean",
    "roles": ["string"],
    "branches": [
      {
        "id": "number",
        "name": "string"
      }
    ]
  }
]
```

**Error Responses:**
- `500 Internal Server Error` - Server error

---

### POST /users
Create a new user.

**Access Level:** Private (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "fullName": "string (required)",
  "roles": ["string"] (required, at least one role),
  "branchIds": ["number"] (optional)
}
```

**Response (201 Created):**
```json
{
  "id": "number",
  "email": "string",
  "fullName": "string",
  "message": "User created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or email already in use
- `500 Internal Server Error` - Server error

---

### PUT /users/:id
Update a user.

**Access Level:** Private (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (required) - User ID

**Request Body:**
```json
{
  "fullName": "string (optional)",
  "isActive": "boolean (optional)",
  "roles": ["string"] (optional)",
  "branchIds": ["number"] (optional)
}
```

**Response (200 OK):**
```json
{
  "message": "User updated successfully"
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## User Roles

The following user roles are supported in the system:

| Role | Description |
|------|-------------|
| `admin` | Full system access, can manage all resources |
| `manager` | Can manage inventory, sales, refunds, and users |
| `pharmacist` | Can manage inventory, process sales, handle refunds |
| `cashier` | Can process sales and manage shifts |

## Common Error Responses

All endpoints may return the following common error responses:

- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Unexpected server error

## Authentication

Most endpoints require authentication using a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained through the [`POST /auth/login`](#post-authlogin) endpoint.

## Pagination & Filtering

Some endpoints support query parameters for filtering and pagination. Refer to individual endpoint documentation for available parameters.

## Rate Limiting

The API implements rate limiting to prevent abuse. Exceeding rate limits will result in `429 Too Many Requests` responses.

## CORS

The API supports Cross-Origin Resource Sharing (CORS). The allowed origins are configured in the server configuration.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-02-17  
**Contact:** For API support, contact the development team
