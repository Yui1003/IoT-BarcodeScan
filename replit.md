# IoT-Enabled Inventory Management System

## Overview
A full-stack inventory management system designed for ESP32 barcode scanner integration. Tracks inventory levels in real-time with Firebase Realtime Database backend.

## Tech Stack
- **Frontend**: React + Vite, TailwindCSS, Recharts
- **Backend**: Node.js + Express
- **Database**: Firebase Realtime Database
- **Barcode**: JSBarcode for generation
- **Export**: XLSX for Excel export

## Features
- Real-time dashboard with stock health analytics and charts
- Add items with auto-generated barcodes (ITEM-YYYY-##### pattern)
- Category combobox with existing categories dropdown
- Inventory management with search and category filtering
- Edit item quantities directly from inventory
- Download barcode as PNG image
- Export inventory to Excel spreadsheet
- ESP32 REST API for barcode scanning
- Transaction logging for all scan operations
- Stock status: Healthy (>=50%), Low (1-49%), Out of Stock (0)

## Database Structure (Realtime Database)
```json
{
  "items": {
    "ITEM-2025-12345": {
      "name": "Arduino Uno",
      "quantity": 50,
      "category": "Microcontroller",
      "originalStock": 50,
      "createdAt": "2025-12-11T05:19:29.243Z"
    }
  },
  "transactions": {
    "-Nx123abc": {
      "barcode": "ITEM-2025-12345",
      "action": "DEDUCT",
      "timestamp": 1700000000
    }
  }
}
```

## Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── pages/    # Dashboard, Inventory, AddItem, Login
│       ├── components/
│       │   └── barcode-display.tsx  # Barcode generator with download
│       └── lib/
│           └── api.ts  # API client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API endpoints
│   └── firebase.ts   # Firebase Realtime Database configuration
└── shared/           # Shared schemas
```

## API Endpoints

### ESP32 Integration
- `POST /api/scan` - Scan barcode, decreases stock by 1, logs transaction
- `GET /api/item/:barcode` - Get item details by barcode

### CRUD Operations
- `GET /api/items` - Get all items
- `POST /api/items` - Create new item (keyed by barcode)
- `PATCH /api/items/:id` - Update item quantity
- `DELETE /api/items/:id` - Delete item

### Transactions
- `GET /api/transactions` - Get recent scan transactions

## Firebase Setup (IMPORTANT for new imports)

When you import this project to a new Replit account, you need to set up Firebase credentials.

### Option 1: Credentials File (Quick Setup)
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" and download the JSON file
3. Save the file as `server/firebase-credentials.json`
4. The app will automatically use this file

### Option 2: Environment Variables (Production)
Set these in Replit Secrets:
- **FIREBASE_PROJECT_ID** - Your Firebase project ID
- **FIREBASE_CLIENT_EMAIL** - Service account email
- **FIREBASE_PRIVATE_KEY** - Private key from service account JSON

Note: The credentials file is automatically excluded from git for security.

## Running the App
The app runs on port 5000 with `npm run dev` command.

## User Preferences
- Category input uses combobox with existing categories dropdown + free typing
- Barcode download uses PNG format
- Excel export includes all item details
