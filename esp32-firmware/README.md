# ESP32-S3 Inventory Scanner Firmware

This firmware connects a USB barcode scanner to your Inventory Management System via WiFi. When a barcode is scanned, it:

1. Sends the barcode to your web app's `/api/scan` endpoint
2. Displays the result on an OLED screen (SSD1306 128x64)
3. Shows item details or error messages

## Features

- **USB HID Host** - Reads barcodes from USB barcode scanners
- **WiFi Connectivity** - Connects to your inventory management API
- **OLED Display** - Shows scan results in real-time
- **3 Scan Scenarios**:
  - Barcode not found → Shows "NOT FOUND" with barcode
  - Out of stock → Shows item name, category, "OUT OF STOCK"
  - Success → Shows item name, category, new stock count

## Hardware Requirements

- ESP32-S3 development board (with USB OTG support)
- USB barcode scanner (HID keyboard mode)
- SSD1306 OLED display (128x64, I2C)
- USB OTG adapter/cable

## Wiring

### OLED Display (I2C)
| OLED Pin | ESP32-S3 Pin |
|----------|--------------|
| VCC      | 3.3V         |
| GND      | GND          |
| SDA      | GPIO 8       |
| SCL      | GPIO 9       |

### USB Scanner
Connect the USB barcode scanner to the ESP32-S3's USB port (USB OTG).

## Configuration

Edit these values in `main/main.c`:

```c
// WiFi Configuration
#define WIFI_SSID           "YOUR_WIFI_SSID"
#define WIFI_PASSWORD       "YOUR_WIFI_PASSWORD"

// API Configuration - Your deployed Replit app URL
#define API_BASE_URL        "https://YOUR-APP.replit.app"

// OLED Pins (change if using different GPIO)
#define I2C_MASTER_SCL_IO   9
#define I2C_MASTER_SDA_IO   8
```

## Building & Flashing

### Prerequisites
- ESP-IDF v5.3.1 or later installed (tested with v5.3.1)
- ESP32-S3 USB drivers

### Important: Full Clean Build Required
After making changes to sdkconfig.defaults, you must do a full clean build:

### Build Commands

```bash
# IMPORTANT: Full clean build (required after changing sdkconfig.defaults)
idf.py fullclean

# Set target to ESP32-S3
idf.py set-target esp32s3

# Build the project
idf.py build

# Flash to device (use your actual COM port)
idf.py -p COM3 flash    # Windows
idf.py -p /dev/ttyUSB0 flash  # Linux

# Monitor serial output
idf.py -p COM3 monitor  # Windows
idf.py -p /dev/ttyUSB0 monitor  # Linux
```

### All-in-one command:
```bash
# Windows
idf.py -p COM3 flash monitor

# Linux
idf.py -p /dev/ttyUSB0 flash monitor
```

### If you get crashes or boot loops:
1. Run `idf.py fullclean` to delete all build artifacts
2. Run `idf.py set-target esp32s3` to reconfigure
3. Run `idf.py build` to rebuild from scratch
4. Flash again

## OLED Display Screens

### Startup Screen
```
┌──────────────────────┐
│     INVENTORY        │
│      SCANNER         │
│                      │
│   Ready to scan...   │
└──────────────────────┘
```

### Scanning Screen
```
┌──────────────────────┐
│     SCANNING         │
│                      │
│ Barcode:             │
│ ITEM-2025-12345      │
│   Please wait...     │
└──────────────────────┘
```

### Not Found Screen
```
┌──────────────────────┐
│    NOT FOUND         │
│                      │
│ Barcode:             │
│ UNKNOWN-123          │
│ Not in database!     │
└──────────────────────┘
```

### Out of Stock Screen
```
┌──────────────────────┐
│   OUT OF STOCK       │
│                      │
│ Arduino Uno          │
│ Cat: Microcontroller │
│ Stock: 0             │
└──────────────────────┘
```

### Success Screen
```
┌──────────────────────┐
│     SCANNED!         │
│                      │
│ Arduino Uno          │
│ Cat: Microcontroller │
│ New Stock: 49        │
└──────────────────────┘
```

## Troubleshooting

### WiFi Connection Issues
- Check SSID and password in the code
- Ensure router is in range
- Check serial monitor for connection status

### OLED Not Displaying
- Verify I2C wiring (SDA/SCL not swapped)
- Check OLED address (default 0x3C, some use 0x3D)
- Ensure 3.3V power supply

### USB Scanner Not Detected
- Ensure scanner is in HID keyboard mode
- Some scanners need USB OTG adapter
- Check USB cable supports data (not charge-only)

### API Connection Errors
- Verify your app URL is correct and deployed
- Check HTTPS certificate (uses ESP certificate bundle)
- Ensure API is accessible from your network

## API Response Format

The firmware expects this JSON response from `/api/scan`:

**Success (200):**
```json
{
  "success": true,
  "name": "Arduino Uno",
  "category": "Microcontroller",
  "newStock": 49,
  "message": "Stock decreased successfully"
}
```

**Out of Stock (200):**
```json
{
  "success": false,
  "item": {
    "name": "Arduino Uno",
    "category": "Microcontroller",
    "quantity": 0
  },
  "message": "Item is out of stock"
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": "Item not found"
}
```

## License

MIT License - Feel free to modify for your projects!
