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
- **Real-time WebSocket updates** - Changes sync instantly without page refresh
- Add items with auto-generated barcodes (ITEM-YYYY-##### pattern)
- Category combobox with existing categories dropdown
- Inventory management with search and category filtering
- Edit item quantities and original stock directly from inventory
- Download barcode as PNG image
- Export inventory to Excel spreadsheet
- ESP32 REST API for barcode scanning
- **Scanner Mode** - Three scanning modes (INCREMENT, DECREMENT, VIEW) with configurable quantities
- **Transaction History** - Real-time log of all inventory changes (ADD/DEDUCT/VIEW) with color-coded badges
- **Print All Barcodes** - Generate a printable document with all inventory barcodes
- Stock status: Healthy (>=31%), Low (1-30%), Out of Stock (0%)

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
      "action": "ADD|DEDUCT|VIEW",
      "quantity": 5,
      "timestamp": 1700000000
    }
  },
  "scannerMode": {
    "mode": "INCREMENT|DECREMENT|DETAILS",
    "quantity": 1
  }
}
```

## Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── pages/    # Dashboard, Inventory, AddItem, Transactions, PrintBarcodes, ScannerMode
│       ├── hooks/
│       │   └── use-websocket.ts  # WebSocket hook for real-time updates
│       ├── components/
│       │   └── barcode-display.tsx  # Barcode generator with download
│       └── lib/
│           └── api.ts  # API client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API endpoints with WebSocket broadcasts
│   └── firebase.ts   # Firebase Realtime Database configuration
└── shared/           # Shared schemas
```

## API Endpoints

### ESP32 Integration
- `POST /api/scan` - Scan barcode, handles action based on scanner mode (INCREMENT/DECREMENT/DETAILS)
- `GET /api/item/:barcode` - Get item details by barcode

### Scanner Mode
- `GET /api/scanner-mode` - Get current scanner mode and quantity
- `PUT /api/scanner-mode` - Update scanner mode (mode: INCREMENT|DECREMENT|DETAILS, quantity: number)

### CRUD Operations
- `GET /api/items` - Get all items
- `POST /api/items` - Create new item (keyed by barcode)
- `PATCH /api/items/:id` - Update item quantity
- `DELETE /api/items/:id` - Delete item

### Transactions
- `GET /api/transactions` - Get recent scan transactions (enriched with item names and categories)

### WebSocket Events
- `items_update` - Broadcasts when inventory items change
- `transaction_added` - Broadcasts when a new transaction is recorded (real-time deduction alerts)
- `mode_update` - Broadcasts when scanner mode changes

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
