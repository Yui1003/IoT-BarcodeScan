/*
 * ESP-IDF v5.3.1
 * USB HID Host Barcode Scanner with WiFi, OLED Display & Inventory API
 * 
 * FIXED VERSION - Compatible with ESP-IDF v5.3.x
 * 
 * Features:
 * - USB barcode scanner via HID Host
 * - WiFi connectivity
 * - SSD1306 OLED display (128x64, I2C)
 * - Sends scanned barcodes to inventory management API
 * - Displays item details or error messages on OLED
 */

#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <time.h>
#include <stdlib.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/event_groups.h"
#include "freertos/semphr.h"

#include "esp_log.h"
#include "esp_err.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "nvs_flash.h"
#include "driver/i2c_master.h"
#include "driver/gpio.h"

#include "usb/usb_host.h"
#include "usb/hid_host.h"
#include "usb/hid_usage_keyboard.h"

/* ================= CONFIGURATION ================= */

// WiFi Configuration - UPDATE THESE
#define WIFI_SSID           "Del Rosario Family"
#define WIFI_PASSWORD       "Shinzou13579"
#define WIFI_MAXIMUM_RETRY  5

// Inventory API Configuration - UPDATE THIS TO YOUR DEPLOYED APP URL
#define API_BASE_URL        "https://2e24d76c-8ed7-4b89-905e-4f7b25356eb3-00-2b2ix61djlegz.sisko.replit.dev"
#define API_SCAN_ENDPOINT   "/api/scan"

// OLED Display Configuration (SSD1306 128x64)
#define I2C_MASTER_SCL_IO   9
#define I2C_MASTER_SDA_IO   8
#define I2C_MASTER_FREQ_HZ  400000
#define OLED_ADDR           0x3C

// Barcode Settings
#define BARCODE_MAX_LEN     64
#define HTTP_RESPONSE_MAX   1024

// Task Stack Sizes (increased for stability)
#define USB_HOST_TASK_STACK_SIZE    8192
#define API_TASK_STACK_SIZE         12288
#define HID_TASK_STACK_SIZE         8192

static const char *TAG = "INVENTORY_SCANNER";

/* ================= I2C MASTER HANDLE ================= */

static i2c_master_bus_handle_t i2c_bus_handle = NULL;
static i2c_master_dev_handle_t oled_dev_handle = NULL;
static bool oled_ready = false;  // Only true after full successful init

/* ================= OLED DISPLAY COMMANDS ================= */

#define OLED_CMD_DISPLAY_OFF        0xAE
#define OLED_CMD_DISPLAY_ON         0xAF
#define OLED_CMD_SET_MUX_RATIO      0xA8
#define OLED_CMD_SET_DISPLAY_OFFSET 0xD3
#define OLED_CMD_SET_START_LINE     0x40
#define OLED_CMD_SET_SEG_REMAP      0xA1
#define OLED_CMD_SET_COM_SCAN_DEC   0xC8
#define OLED_CMD_SET_COM_PINS       0xDA
#define OLED_CMD_SET_CONTRAST       0x81
#define OLED_CMD_ENTIRE_DISPLAY_ON  0xA4
#define OLED_CMD_SET_NORMAL_DISPLAY 0xA6
#define OLED_CMD_SET_OSC_FREQ       0xD5
#define OLED_CMD_SET_CHARGE_PUMP    0x8D
#define OLED_CMD_SET_MEMORY_MODE    0x20
#define OLED_CMD_SET_COL_ADDR       0x21
#define OLED_CMD_SET_PAGE_ADDR      0x22

/* ================= 5x7 FONT ================= */

static const uint8_t font5x7[][5] = {
    {0x00, 0x00, 0x00, 0x00, 0x00}, // Space
    {0x00, 0x00, 0x5F, 0x00, 0x00}, // !
    {0x00, 0x07, 0x00, 0x07, 0x00}, // "
    {0x14, 0x7F, 0x14, 0x7F, 0x14}, // #
    {0x24, 0x2A, 0x7F, 0x2A, 0x12}, // $
    {0x23, 0x13, 0x08, 0x64, 0x62}, // %
    {0x36, 0x49, 0x55, 0x22, 0x50}, // &
    {0x00, 0x05, 0x03, 0x00, 0x00}, // '
    {0x00, 0x1C, 0x22, 0x41, 0x00}, // (
    {0x00, 0x41, 0x22, 0x1C, 0x00}, // )
    {0x08, 0x2A, 0x1C, 0x2A, 0x08}, // *
    {0x08, 0x08, 0x3E, 0x08, 0x08}, // +
    {0x00, 0x50, 0x30, 0x00, 0x00}, // ,
    {0x08, 0x08, 0x08, 0x08, 0x08}, // -
    {0x00, 0x60, 0x60, 0x00, 0x00}, // .
    {0x20, 0x10, 0x08, 0x04, 0x02}, // /
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, // 0
    {0x00, 0x42, 0x7F, 0x40, 0x00}, // 1
    {0x42, 0x61, 0x51, 0x49, 0x46}, // 2
    {0x21, 0x41, 0x45, 0x4B, 0x31}, // 3
    {0x18, 0x14, 0x12, 0x7F, 0x10}, // 4
    {0x27, 0x45, 0x45, 0x45, 0x39}, // 5
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, // 6
    {0x01, 0x71, 0x09, 0x05, 0x03}, // 7
    {0x36, 0x49, 0x49, 0x49, 0x36}, // 8
    {0x06, 0x49, 0x49, 0x29, 0x1E}, // 9
    {0x00, 0x36, 0x36, 0x00, 0x00}, // :
    {0x00, 0x56, 0x36, 0x00, 0x00}, // ;
    {0x00, 0x08, 0x14, 0x22, 0x41}, // <
    {0x14, 0x14, 0x14, 0x14, 0x14}, // =
    {0x41, 0x22, 0x14, 0x08, 0x00}, // >
    {0x02, 0x01, 0x51, 0x09, 0x06}, // ?
    {0x32, 0x49, 0x79, 0x41, 0x3E}, // @
    {0x7E, 0x11, 0x11, 0x11, 0x7E}, // A
    {0x7F, 0x49, 0x49, 0x49, 0x36}, // B
    {0x3E, 0x41, 0x41, 0x41, 0x22}, // C
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, // D
    {0x7F, 0x49, 0x49, 0x49, 0x41}, // E
    {0x7F, 0x09, 0x09, 0x01, 0x01}, // F
    {0x3E, 0x41, 0x41, 0x51, 0x32}, // G
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, // H
    {0x00, 0x41, 0x7F, 0x41, 0x00}, // I
    {0x20, 0x40, 0x41, 0x3F, 0x01}, // J
    {0x7F, 0x08, 0x14, 0x22, 0x41}, // K
    {0x7F, 0x40, 0x40, 0x40, 0x40}, // L
    {0x7F, 0x02, 0x04, 0x02, 0x7F}, // M
    {0x7F, 0x04, 0x08, 0x10, 0x7F}, // N
    {0x3E, 0x41, 0x41, 0x41, 0x3E}, // O
    {0x7F, 0x09, 0x09, 0x09, 0x06}, // P
    {0x3E, 0x41, 0x51, 0x21, 0x5E}, // Q
    {0x7F, 0x09, 0x19, 0x29, 0x46}, // R
    {0x46, 0x49, 0x49, 0x49, 0x31}, // S
    {0x01, 0x01, 0x7F, 0x01, 0x01}, // T
    {0x3F, 0x40, 0x40, 0x40, 0x3F}, // U
    {0x1F, 0x20, 0x40, 0x20, 0x1F}, // V
    {0x7F, 0x20, 0x18, 0x20, 0x7F}, // W
    {0x63, 0x14, 0x08, 0x14, 0x63}, // X
    {0x03, 0x04, 0x78, 0x04, 0x03}, // Y
    {0x61, 0x51, 0x49, 0x45, 0x43}, // Z
    {0x00, 0x00, 0x7F, 0x41, 0x41}, // [
    {0x02, 0x04, 0x08, 0x10, 0x20}, // backslash
    {0x41, 0x41, 0x7F, 0x00, 0x00}, // ]
    {0x04, 0x02, 0x01, 0x02, 0x04}, // ^
    {0x40, 0x40, 0x40, 0x40, 0x40}, // _
    {0x00, 0x01, 0x02, 0x04, 0x00}, // `
    {0x20, 0x54, 0x54, 0x54, 0x78}, // a
    {0x7F, 0x48, 0x44, 0x44, 0x38}, // b
    {0x38, 0x44, 0x44, 0x44, 0x20}, // c
    {0x38, 0x44, 0x44, 0x48, 0x7F}, // d
    {0x38, 0x54, 0x54, 0x54, 0x18}, // e
    {0x08, 0x7E, 0x09, 0x01, 0x02}, // f
    {0x08, 0x14, 0x54, 0x54, 0x3C}, // g
    {0x7F, 0x08, 0x04, 0x04, 0x78}, // h
    {0x00, 0x44, 0x7D, 0x40, 0x00}, // i
    {0x20, 0x40, 0x44, 0x3D, 0x00}, // j
    {0x00, 0x7F, 0x10, 0x28, 0x44}, // k
    {0x00, 0x41, 0x7F, 0x40, 0x00}, // l
    {0x7C, 0x04, 0x18, 0x04, 0x78}, // m
    {0x7C, 0x08, 0x04, 0x04, 0x78}, // n
    {0x38, 0x44, 0x44, 0x44, 0x38}, // o
    {0x7C, 0x14, 0x14, 0x14, 0x08}, // p
    {0x08, 0x14, 0x14, 0x18, 0x7C}, // q
    {0x7C, 0x08, 0x04, 0x04, 0x08}, // r
    {0x48, 0x54, 0x54, 0x54, 0x20}, // s
    {0x04, 0x3F, 0x44, 0x40, 0x20}, // t
    {0x3C, 0x40, 0x40, 0x20, 0x7C}, // u
    {0x1C, 0x20, 0x40, 0x20, 0x1C}, // v
    {0x3C, 0x40, 0x30, 0x40, 0x3C}, // w
    {0x44, 0x28, 0x10, 0x28, 0x44}, // x
    {0x0C, 0x50, 0x50, 0x50, 0x3C}, // y
    {0x44, 0x64, 0x54, 0x4C, 0x44}, // z
};

/* ================= OLED FRAME BUFFER ================= */

static uint8_t oled_buffer[128 * 8];

/* ================= WIFI EVENT GROUP ================= */

static EventGroupHandle_t s_wifi_event_group = NULL;
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1

static int s_retry_num = 0;

/* ================= BARCODE BUFFER & SYNC ================= */

static char barcode_buf[BARCODE_MAX_LEN];
static int barcode_len = 0;

static char api_barcode[BARCODE_MAX_LEN];
static SemaphoreHandle_t api_semaphore = NULL;

/* ================= HTTP RESPONSE BUFFER ================= */

static char http_response[HTTP_RESPONSE_MAX];
static int http_response_len = 0;

/* ================= SCAN RESULT STRUCTURE ================= */

typedef struct {
    bool success;
    bool found;
    char name[64];
    char category[32];
    int quantity;
    int new_stock;
    char message[64];
} scan_result_t;

/* ================= I2C CLEANUP ================= */

static void i2c_cleanup(void)
{
    if (oled_dev_handle != NULL) {
        i2c_master_bus_rm_device(oled_dev_handle);
        oled_dev_handle = NULL;
    }
    if (i2c_bus_handle != NULL) {
        i2c_del_master_bus(i2c_bus_handle);
        i2c_bus_handle = NULL;
    }
    oled_ready = false;
}

/* ================= I2C INIT (NEW API for ESP-IDF v5.x) ================= */

static esp_err_t i2c_master_init(void)
{
    ESP_LOGI(TAG, "Initializing I2C master bus...");
    
    i2c_cleanup();
    
    i2c_master_bus_config_t bus_config = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_NUM_0,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    
    esp_err_t err = i2c_new_master_bus(&bus_config, &i2c_bus_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create I2C master bus: %s", esp_err_to_name(err));
        i2c_bus_handle = NULL;
        return err;
    }
    
    i2c_device_config_t dev_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = OLED_ADDR,
        .scl_speed_hz = I2C_MASTER_FREQ_HZ,
    };
    
    err = i2c_master_bus_add_device(i2c_bus_handle, &dev_config, &oled_dev_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to add OLED device: %s", esp_err_to_name(err));
        i2c_del_master_bus(i2c_bus_handle);
        i2c_bus_handle = NULL;
        oled_dev_handle = NULL;
        return err;
    }
    
    ESP_LOGI(TAG, "I2C master initialized successfully");
    return ESP_OK;
}

/* ================= OLED COMMANDS (NEW API) ================= */

static esp_err_t oled_send_cmd(uint8_t cmd)
{
    uint8_t data[2] = {0x00, cmd};
    return i2c_master_transmit(oled_dev_handle, data, 2, 100);
}

static esp_err_t oled_send_data(uint8_t *data, size_t len)
{
    uint8_t *buffer = malloc(len + 1);
    if (!buffer) return ESP_ERR_NO_MEM;
    buffer[0] = 0x40;
    memcpy(buffer + 1, data, len);
    esp_err_t err = i2c_master_transmit(oled_dev_handle, buffer, len + 1, 100);
    free(buffer);
    return err;
}

/* ================= OLED INIT ================= */

static esp_err_t oled_init(void)
{
    esp_err_t err;
    
    oled_ready = false;
    
    ESP_LOGI(TAG, "Initializing OLED display...");
    
    vTaskDelay(pdMS_TO_TICKS(100));
    
    err = oled_send_cmd(OLED_CMD_DISPLAY_OFF);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "OLED not responding - check wiring!");
        i2c_cleanup();
        return err;
    }
    
    err = oled_send_cmd(OLED_CMD_SET_MUX_RATIO);
    if (err != ESP_OK) goto cleanup_fail;
    err = oled_send_cmd(0x3F);
    if (err != ESP_OK) goto cleanup_fail;
    
    err = oled_send_cmd(OLED_CMD_SET_DISPLAY_OFFSET);
    if (err != ESP_OK) goto cleanup_fail;
    err = oled_send_cmd(0x00);
    if (err != ESP_OK) goto cleanup_fail;
    
    oled_send_cmd(OLED_CMD_SET_START_LINE | 0x00);
    oled_send_cmd(OLED_CMD_SET_SEG_REMAP);
    oled_send_cmd(OLED_CMD_SET_COM_SCAN_DEC);
    
    oled_send_cmd(OLED_CMD_SET_COM_PINS);
    oled_send_cmd(0x12);
    
    oled_send_cmd(OLED_CMD_SET_CONTRAST);
    oled_send_cmd(0xCF);
    
    oled_send_cmd(OLED_CMD_ENTIRE_DISPLAY_ON);
    oled_send_cmd(OLED_CMD_SET_NORMAL_DISPLAY);
    
    oled_send_cmd(OLED_CMD_SET_OSC_FREQ);
    oled_send_cmd(0x80);
    
    oled_send_cmd(OLED_CMD_SET_CHARGE_PUMP);
    oled_send_cmd(0x14);
    
    oled_send_cmd(OLED_CMD_SET_MEMORY_MODE);
    oled_send_cmd(0x00);
    
    err = oled_send_cmd(OLED_CMD_DISPLAY_ON);
    if (err != ESP_OK) goto cleanup_fail;
    
    memset(oled_buffer, 0, sizeof(oled_buffer));
    
    oled_ready = true;
    ESP_LOGI(TAG, "OLED initialized successfully");
    return ESP_OK;

cleanup_fail:
    ESP_LOGE(TAG, "OLED init failed during command sequence");
    i2c_cleanup();
    return err;
}

/* ================= OLED DISPLAY FUNCTIONS ================= */

static void oled_clear(void)
{
    memset(oled_buffer, 0, sizeof(oled_buffer));
}

static void oled_update(void)
{
    oled_send_cmd(OLED_CMD_SET_COL_ADDR);
    oled_send_cmd(0);
    oled_send_cmd(127);
    
    oled_send_cmd(OLED_CMD_SET_PAGE_ADDR);
    oled_send_cmd(0);
    oled_send_cmd(7);
    
    oled_send_data(oled_buffer, sizeof(oled_buffer));
}

static void oled_set_pixel(int x, int y, bool on)
{
    if (x < 0 || x >= 128 || y < 0 || y >= 64) return;
    
    int page = y / 8;
    int bit = y % 8;
    int index = page * 128 + x;
    
    if (on) {
        oled_buffer[index] |= (1 << bit);
    } else {
        oled_buffer[index] &= ~(1 << bit);
    }
}

static void oled_draw_char(int x, int y, char c)
{
    if (c < 32 || c > 122) c = ' ';
    int index = c - 32;
    
    for (int col = 0; col < 5; col++) {
        uint8_t line = font5x7[index][col];
        for (int row = 0; row < 7; row++) {
            if (line & (1 << row)) {
                oled_set_pixel(x + col, y + row, true);
            }
        }
    }
}

static void oled_draw_string(int x, int y, const char *str)
{
    while (*str) {
        oled_draw_char(x, y, *str);
        x += 6;
        str++;
        if (x >= 128) break;
    }
}

static void oled_draw_string_large(int x, int y, const char *str)
{
    while (*str) {
        if (x >= 128) break;
        
        if (*str >= 32 && *str <= 122) {
            int index = *str - 32;
            for (int col = 0; col < 5; col++) {
                uint8_t line = font5x7[index][col];
                for (int row = 0; row < 7; row++) {
                    if (line & (1 << row)) {
                        oled_set_pixel(x + col*2, y + row*2, true);
                        oled_set_pixel(x + col*2 + 1, y + row*2, true);
                        oled_set_pixel(x + col*2, y + row*2 + 1, true);
                        oled_set_pixel(x + col*2 + 1, y + row*2 + 1, true);
                    }
                }
            }
        }
        x += 12;
        str++;
    }
}

/* ================= DISPLAY SCREENS ================= */

static void display_startup(void)
{
    oled_clear();
    oled_draw_string_large(10, 10, "INVENTORY");
    oled_draw_string_large(15, 30, "SCANNER");
    oled_draw_string(30, 55, "Ready to scan...");
    oled_update();
}

static void display_scanning(const char *barcode)
{
    oled_clear();
    oled_draw_string_large(10, 5, "SCANNING");
    oled_draw_string(10, 30, "Barcode:");
    oled_draw_string(10, 42, barcode);
    oled_draw_string(25, 55, "Please wait...");
    oled_update();
}

static void display_not_found(const char *barcode)
{
    oled_clear();
    oled_draw_string_large(5, 0, "NOT FOUND");
    oled_draw_string(5, 25, "Barcode:");
    oled_draw_string(5, 37, barcode);
    oled_draw_string(5, 52, "Not in database!");
    oled_update();
}

static void display_out_of_stock(const char *name, const char *category)
{
    oled_clear();
    oled_draw_string_large(0, 0, "OUT OF STOCK");
    
    char name_line[22];
    snprintf(name_line, sizeof(name_line), "%.21s", name);
    oled_draw_string(0, 22, name_line);
    
    char cat_line[22];
    snprintf(cat_line, sizeof(cat_line), "Cat: %.16s", category);
    oled_draw_string(0, 34, cat_line);
    
    oled_draw_string(0, 50, "Stock: 0");
    oled_update();
}

static void display_success(const char *name, const char *category, int new_stock)
{
    oled_clear();
    oled_draw_string_large(10, 0, "SCANNED!");
    
    char name_line[22];
    snprintf(name_line, sizeof(name_line), "%.21s", name);
    oled_draw_string(0, 20, name_line);
    
    char cat_line[22];
    snprintf(cat_line, sizeof(cat_line), "Cat: %.16s", category);
    oled_draw_string(0, 32, cat_line);
    
    char stock_line[22];
    snprintf(stock_line, sizeof(stock_line), "New Stock: %d", new_stock);
    oled_draw_string(0, 48, stock_line);
    
    oled_update();
}

static void display_error(const char *message)
{
    oled_clear();
    oled_draw_string_large(20, 10, "ERROR");
    oled_draw_string(5, 40, message);
    oled_update();
}

static void display_wifi_connecting(void)
{
    oled_clear();
    oled_draw_string_large(5, 15, "CONNECTING");
    oled_draw_string(25, 40, "to WiFi...");
    oled_update();
}

static void display_wifi_connected(void)
{
    oled_clear();
    oled_draw_string_large(10, 15, "CONNECTED");
    oled_draw_string(30, 45, "WiFi OK!");
    oled_update();
}

static void display_no_oled(void)
{
    ESP_LOGW(TAG, "OLED display not available");
}

/* ================= WIFI EVENT HANDLER ================= */

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                               int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < WIFI_MAXIMUM_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "Retrying WiFi... (%d/%d)", s_retry_num, WIFI_MAXIMUM_RETRY);
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            ESP_LOGE(TAG, "WiFi connection failed");
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Connected! IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

/* ================= WIFI INIT ================= */

static void wifi_init_sta(void)
{
    s_wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    if (oled_ready) {
        display_wifi_connecting();
    }

    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
            WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
            pdFALSE,
            pdFALSE,
            portMAX_DELAY);

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "WiFi connected successfully");
        if (oled_ready) {
            display_wifi_connected();
            vTaskDelay(pdMS_TO_TICKS(1500));
        }
    } else if (bits & WIFI_FAIL_BIT) {
        ESP_LOGE(TAG, "WiFi connection failed");
        if (oled_ready) {
            display_error("WiFi Failed!");
        }
    }
}

/* ================= HTTP EVENT HANDLER ================= */

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch(evt->event_id) {
        case HTTP_EVENT_ON_DATA:
            if (http_response_len + evt->data_len < HTTP_RESPONSE_MAX - 1) {
                memcpy(http_response + http_response_len, evt->data, evt->data_len);
                http_response_len += evt->data_len;
                http_response[http_response_len] = '\0';
            }
            break;
        default:
            break;
    }
    return ESP_OK;
}

/* ================= SIMPLE JSON PARSER ================= */

static bool json_get_bool(const char *json, const char *key)
{
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":", key);
    char *pos = strstr(json, search);
    if (!pos) return false;
    pos += strlen(search);
    while (*pos == ' ') pos++;
    return strncmp(pos, "true", 4) == 0;
}

static int json_get_int(const char *json, const char *key)
{
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":", key);
    char *pos = strstr(json, search);
    if (!pos) return 0;
    pos += strlen(search);
    while (*pos == ' ') pos++;
    return atoi(pos);
}

static void json_get_string(const char *json, const char *key, char *out, size_t max_len)
{
    out[0] = '\0';
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":\"", key);
    char *pos = strstr(json, search);
    if (!pos) return;
    pos += strlen(search);
    
    size_t i = 0;
    while (*pos && *pos != '"' && i < max_len - 1) {
        out[i++] = *pos++;
    }
    out[i] = '\0';
}

/* ================= API SCAN REQUEST ================= */

static scan_result_t send_scan_request(const char *barcode)
{
    scan_result_t result = {0};
    
    if (!s_wifi_event_group) {
        ESP_LOGE(TAG, "WiFi not initialized");
        strcpy(result.message, "WiFi error");
        return result;
    }
    
    EventBits_t bits = xEventGroupGetBits(s_wifi_event_group);
    if (!(bits & WIFI_CONNECTED_BIT)) {
        ESP_LOGE(TAG, "WiFi not connected");
        strcpy(result.message, "WiFi error");
        return result;
    }

    char url[256];
    snprintf(url, sizeof(url), "%s%s", API_BASE_URL, API_SCAN_ENDPOINT);

    char post_data[128];
    snprintf(post_data, sizeof(post_data), "{\"barcode\":\"%s\"}", barcode);

    ESP_LOGI(TAG, "Sending to API: %s", post_data);

    http_response_len = 0;
    memset(http_response, 0, sizeof(http_response));

    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 15000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .transport_type = HTTP_TRANSPORT_OVER_SSL,
        .buffer_size = 2048,
        .buffer_size_tx = 1024,
        .event_handler = http_event_handler,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to init HTTP client");
        strcpy(result.message, "HTTP error");
        return result;
    }
    
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTP Status: %d", status_code);
        ESP_LOGI(TAG, "Response: %s", http_response);
        
        if (status_code == 404) {
            result.found = false;
            strcpy(result.message, "Not found");
        } else if (status_code == 200) {
            result.found = true;
            result.success = json_get_bool(http_response, "success");
            result.new_stock = json_get_int(http_response, "newStock");
            json_get_string(http_response, "name", result.name, sizeof(result.name));
            json_get_string(http_response, "category", result.category, sizeof(result.category));
            json_get_string(http_response, "message", result.message, sizeof(result.message));
            
            if (result.name[0] == '\0') {
                char *item_pos = strstr(http_response, "\"item\":");
                if (item_pos) {
                    json_get_string(item_pos, "name", result.name, sizeof(result.name));
                    json_get_string(item_pos, "category", result.category, sizeof(result.category));
                    result.quantity = json_get_int(item_pos, "quantity");
                }
            }
        } else {
            strcpy(result.message, "Server error");
        }
    } else {
        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
        strcpy(result.message, "Network error");
    }

    esp_http_client_cleanup(client);
    return result;
}

/* ================= API TASK ================= */

static void api_task(void *arg)
{
    ESP_LOGI(TAG, "API task started");
    
    while (1) {
        if (xSemaphoreTake(api_semaphore, portMAX_DELAY) == pdTRUE) {
            ESP_LOGI(TAG, "Processing barcode: %s", api_barcode);
            
            if (oled_ready) {
                display_scanning(api_barcode);
            }
            
            scan_result_t result = send_scan_request(api_barcode);
            
            if (oled_ready) {
                if (!result.found) {
                    ESP_LOGI(TAG, "Barcode not found in database");
                    display_not_found(api_barcode);
                } else if (!result.success) {
                    ESP_LOGI(TAG, "Item out of stock: %s", result.name);
                    display_out_of_stock(result.name, result.category);
                } else {
                    ESP_LOGI(TAG, "Scan success: %s, new stock: %d", result.name, result.new_stock);
                    display_success(result.name, result.category, result.new_stock);
                }
            }
            
            memset(api_barcode, 0, sizeof(api_barcode));
            
            vTaskDelay(pdMS_TO_TICKS(3000));
            if (oled_ready) {
                display_startup();
            }
        }
    }
}

/* ================= KEYCODE TO ASCII ================= */

static char keycode_to_ascii(uint8_t keycode)
{
    if (keycode >= HID_KEY_A && keycode <= HID_KEY_Z) {
        return 'A' + (keycode - HID_KEY_A);
    }
    if (keycode >= HID_KEY_1 && keycode <= HID_KEY_9) {
        return '1' + (keycode - HID_KEY_1);
    }
    if (keycode == HID_KEY_0) return '0';
    if (keycode == HID_KEY_MINUS) return '-';
    if (keycode == HID_KEY_ENTER) return '\n';
    return 0;
}

/* ================= KEYBOARD REPORT HANDLER ================= */

static void handle_keyboard_report(const uint8_t *data, int length)
{
    if (length < 8) return;

    uint8_t keycode = data[2];
    char c = keycode_to_ascii(keycode);

    if (!c) return;

    if (c == '\n') {
        barcode_buf[barcode_len] = '\0';

        if (barcode_len > 0) {
            ESP_LOGI(TAG, "=====================================");
            ESP_LOGI(TAG, "Scanned barcode: %s", barcode_buf);
            ESP_LOGI(TAG, "=====================================");
            
            strncpy(api_barcode, barcode_buf, BARCODE_MAX_LEN - 1);
            api_barcode[BARCODE_MAX_LEN - 1] = '\0';
            
            xSemaphoreGive(api_semaphore);
        }

        barcode_len = 0;
        memset(barcode_buf, 0, sizeof(barcode_buf));
        return;
    }

    if (barcode_len < BARCODE_MAX_LEN - 1) {
        barcode_buf[barcode_len++] = c;
    }
}

/* ================= HID INTERFACE CALLBACK ================= */

static void hid_interface_callback(
    hid_host_device_handle_t hid_device_handle,
    hid_host_interface_event_t event,
    void *arg)
{
    if (event != HID_HOST_INTERFACE_EVENT_INPUT_REPORT) return;

    uint8_t data[64];
    size_t data_len = sizeof(data);

    esp_err_t err = hid_host_device_get_raw_input_report_data(
        hid_device_handle,
        data,
        64,
        &data_len
    );
    
    if (err == ESP_OK) {
        handle_keyboard_report(data, data_len);
    }
}

/* ================= HID DEVICE EVENT ================= */

static void hid_device_event(
    hid_host_device_handle_t hid_device_handle,
    hid_host_driver_event_t event,
    void *arg)
{
    if (event == HID_HOST_DRIVER_EVENT_CONNECTED) {

        hid_host_dev_params_t params;
        hid_host_device_get_params(hid_device_handle, &params);

        ESP_LOGI(TAG, "HID device connected (%s)",
                 params.proto == HID_PROTOCOL_KEYBOARD ? "Keyboard" : "Other");

        const hid_host_device_config_t dev_cfg = {
            .callback = hid_interface_callback,
            .callback_arg = NULL
        };

        esp_err_t err = hid_host_device_open(hid_device_handle, &dev_cfg);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to open HID device: %s", esp_err_to_name(err));
            return;
        }

        if (params.sub_class == HID_SUBCLASS_BOOT_INTERFACE &&
            params.proto == HID_PROTOCOL_KEYBOARD) {
            hid_class_request_set_protocol(hid_device_handle,
                                           HID_REPORT_PROTOCOL_BOOT);
            hid_class_request_set_idle(hid_device_handle, 0, 0);
        }

        hid_host_device_start(hid_device_handle);
    }
}

/* ================= USB HOST TASK ================= */

static void usb_host_task(void *arg)
{
    ESP_LOGI(TAG, "USB Host task starting...");
    
    vTaskDelay(pdMS_TO_TICKS(500));
    
    usb_host_config_t host_cfg = {
        .skip_phy_setup = false,
        .intr_flags = ESP_INTR_FLAG_LEVEL1
    };

    esp_err_t err = usb_host_install(&host_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to install USB host: %s", esp_err_to_name(err));
        vTaskDelete(NULL);
        return;
    }

    hid_host_driver_config_t hid_cfg = {
        .create_background_task = true,
        .task_priority = 5,
        .stack_size = HID_TASK_STACK_SIZE,
        .core_id = 0,
        .callback = hid_device_event,
        .callback_arg = NULL
    };

    err = hid_host_install(&hid_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to install HID host: %s", esp_err_to_name(err));
        usb_host_uninstall();
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "USB HID Host ready - connect your barcode scanner");

    while (1) {
        uint32_t events;
        usb_host_lib_handle_events(portMAX_DELAY, &events);
    }
}

/* ================= APP MAIN ================= */

void app_main(void)
{
    ESP_LOGI(TAG, "=========================================");
    ESP_LOGI(TAG, "  Inventory Management Scanner v2.0");
    ESP_LOGI(TAG, "  ESP32-S3 + USB Scanner + OLED");
    ESP_LOGI(TAG, "  ESP-IDF v5.3.x Compatible");
    ESP_LOGI(TAG, "=========================================");

    vTaskDelay(pdMS_TO_TICKS(100));

    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS partition needs erase...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    ESP_LOGI(TAG, "NVS Flash initialized");

    vTaskDelay(pdMS_TO_TICKS(100));

    ret = i2c_master_init();
    if (ret == ESP_OK) {
        ret = oled_init();
        if (ret == ESP_OK) {
            display_startup();
        } else {
            ESP_LOGW(TAG, "OLED init failed - continuing without display");
        }
    } else {
        ESP_LOGW(TAG, "I2C init failed - continuing without OLED");
    }
    
    vTaskDelay(pdMS_TO_TICKS(500));

    api_semaphore = xSemaphoreCreateBinary();
    if (api_semaphore == NULL) {
        ESP_LOGE(TAG, "Failed to create semaphore!");
        return;
    }

    wifi_init_sta();

    vTaskDelay(pdMS_TO_TICKS(500));

    BaseType_t xReturned;
    
    xReturned = xTaskCreatePinnedToCore(
        usb_host_task,
        "usb_host",
        USB_HOST_TASK_STACK_SIZE,
        NULL,
        5,
        NULL,
        0
    );
    if (xReturned != pdPASS) {
        ESP_LOGE(TAG, "Failed to create USB host task!");
    }
    
    xReturned = xTaskCreatePinnedToCore(
        api_task,
        "api_task",
        API_TASK_STACK_SIZE,
        NULL,
        4,
        NULL,
        1
    );
    if (xReturned != pdPASS) {
        ESP_LOGE(TAG, "Failed to create API task!");
    }

    if (oled_ready) {
        display_startup();
    }

    ESP_LOGI(TAG, "=========================================");
    ESP_LOGI(TAG, "  System ready - waiting for scans");
    ESP_LOGI(TAG, "=========================================");
}
