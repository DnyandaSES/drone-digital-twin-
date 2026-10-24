#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <math.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <esp_system.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "SparkFun_ACS37800_Arduino_Library.h"

// =====================================================
//           AEROTWIN - SECONDARY PCB CONTROLLER
//             HARDWARE CONTROLLER FIRMWARE
// =====================================================
// 
// Hardware features on this PCB:
//  - ESC PWM Output: GPIO 9 (50 Hz, 1000 - 2000 us)
//  - I2C Bus: SDA = GPIO 36, SCL = GPIO 38
//  - Solenoid Valve: GPIO 8
//  - SPI MCP4261 Digipots: SCK=4, MISO=5, MOSI=6, CS1=16, CS2=18
//  - ACS37800 Sensors: Battery 0x60, Fuel Cell 0x63, Common Bus 0x6C
//
// Ground Control Station (AeroTwin) UDP Protocol:
//  - Port 8888 (TX): JSON Telemetry Broadcast (5 Hz)
//  - Port 8889 (RX): Throttle & Control Commands
//    * Binary [1, throttle%]: Main Throttle
//    * Binary [3, throttle%]: Dedicated Separate Throttle Bar for this PCB
//    * Binary [2, 4]: EMERGENCY STOP (instant PWM cutoff)
//    * Text strings: "START", "STOP", "VALVE ON", "VALVE OFF", "ZERO", etc.
// =====================================================

// =====================================================
//                 WIFI / UDP (HMI LINK)
// =====================================================

const char* ssid     = "OnePlus";
const char* password = "123456789";

IPAddress broadcastIP;        // Subnet broadcast address
IPAddress remoteGcsIP;        // Captured ground station IP
bool hasRemoteGcs = false;

const int telePort     = 8888; // Telemetry broadcast port
const int throttlePort = 8889; // Throttle & command receive port

WiFiUDP telemetry;
WiFiUDP throttle;

bool udpStarted = false;

// Telemetry interval (200 ms = 5 Hz for responsive dashboard rendering)
#define TELEMETRY_INTERVAL_MS 200

// =====================================================
//                     I2C PINS
// =====================================================

#define SDA_PIN 36
#define SCL_PIN 38

// =====================================================
//                 ACS37800 I2C ADDRESSES
// =====================================================

#define BATTERY_ADDR    0x60
#define FUEL_CELL_ADDR  0x63
#define COMMON_BUS_ADDR 0x6C

// =====================================================
//                  ACS37800 OBJECTS
// =====================================================

ACS37800 BatteryACS;
ACS37800 FuelCellACS;
ACS37800 CommonBusACS;

float currentRangeA[3] = {90.0f, 90.0f, 90.0f};

bool Battery_OK   = false;
bool FuelCell_OK  = false;
bool CommonBus_OK = false;

int i2cFailCount = 0;

// Serial debug output
unsigned long printIntervalMs = 250;
bool plotMode = false;
bool busMode  = false;

// =====================================================
//                 REAR ESC (GPIO 9)
// =====================================================

#define ESC_PIN          9
#define ESC_MIN_US       1000
#define ESC_MAX_US       2000
#define ESC_ARM_TIME_MS  3000
#define ESC_FREQ_HZ      50
#define ESC_RES_BITS     14
#define ESC_LEDC_CH      0

bool escReady    = false;
bool pwmEnabled  = false;
int throttlePercent = 0;
int escPulseUs   = ESC_MIN_US;
unsigned long escStartTime = 0;

void escBegin()
{
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    escReady = ledcAttach(ESC_PIN, ESC_FREQ_HZ, ESC_RES_BITS);
#else
    ledcSetup(ESC_LEDC_CH, ESC_FREQ_HZ, ESC_RES_BITS);
    ledcAttachPin(ESC_PIN, ESC_LEDC_CH);
    escReady = true;
#endif
}

void escWriteUs(int us)
{
    if (!escReady) return;

    us = constrain(us, ESC_MIN_US, ESC_MAX_US);
    uint32_t duty = ((uint32_t)us * (1UL << ESC_RES_BITS)) / (1000000UL / ESC_FREQ_HZ);

#if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(ESC_PIN, duty);
#else
    ledcWrite(ESC_LEDC_CH, duty);
#endif
}

void setThrottle(int percent)
{
    percent = constrain(percent, 0, 100);

    if (!escReady && percent > 0)
    {
        escBegin();
    }

    escPulseUs = map(percent, 0, 100, ESC_MIN_US, ESC_MAX_US);
    escWriteUs(escPulseUs);
    throttlePercent = percent;
}

void startPWM()
{
    Serial.println("# [ESC] START/ARM REQUESTED");

    if (!escReady)
    {
        Serial.println("# [ESC] Initializing PWM on GPIO 9...");
        escBegin();
        delay(50);
        escWriteUs(ESC_MIN_US);
    }

    pwmEnabled = true;
    setThrottle(0);
    escStartTime = millis();

    Serial.println("# [ESC] PWM ARMED (Holding 1000 us)");
}

void stopPWM()
{
    if (escReady)
    {
        escWriteUs(ESC_MIN_US);
    }

    pwmEnabled = false;
    throttlePercent = 0;
    escPulseUs = ESC_MIN_US;

    Serial.println("# [ESC] PWM STOPPED (0% / 1000 us)");
}

// =====================================================
//                  SOLENOID VALVE
// =====================================================

#define VALVE_PIN 8

bool valveOpen = false;
bool valveAuto = false;

unsigned long valveOnTimeMs   = 10000;
unsigned long valveOffTimeMs  = 10000;
unsigned long valveLastToggle = 0;

void setValve(bool open)
{
    valveOpen = open;
    digitalWrite(VALVE_PIN, open ? HIGH : LOW);
    valveLastToggle = millis();
}

void updateValve()
{
    if (!valveAuto) return;

    unsigned long interval = valveOpen ? valveOnTimeMs : valveOffTimeMs;
    if (millis() - valveLastToggle >= interval)
    {
        setValve(!valveOpen);
    }
}

// =====================================================
//                     SPI PINS
// =====================================================

#define PIN_SCK   4
#define PIN_MOSI  6
#define PIN_MISO  5

#define CS_IC1    16
#define CS_IC2    18

#define WIPER_MAX 255

// =====================================================
//                MCP4261 CALIBRATION
// =====================================================

const uint8_t IC1_Wiper[] = {0, 1, 2, 3, 4, 5, 6};
const float   IC1_Res[]   = {62.0f, 79.0f, 81.0f, 95.0f, 105.0f, 113.0f, 116.0f};
const int IC1_POINTS = sizeof(IC1_Wiper) / sizeof(IC1_Wiper[0]);

const uint8_t IC2_Wiper[] = {0, 1, 2, 3, 4, 5, 6};
const float   IC2_Res[]   = {60.0f, 70.0f, 79.0f, 88.0f, 96.0f, 105.0f, 113.0f};
const int IC2_POINTS = sizeof(IC2_Wiper) / sizeof(IC2_Wiper[0]);

uint8_t wiperIC1 = 0;
uint8_t wiperIC2 = 0;

float getCalibratedResistance(
    uint8_t wiper,
    const uint8_t *tableWiper,
    const float *tableRes,
    int numberOfPoints)
{
    if (wiper <= tableWiper[0]) return tableRes[0];

    for (int i = 0; i < numberOfPoints - 1; i++)
    {
        uint8_t W1 = tableWiper[i];
        uint8_t W2 = tableWiper[i + 1];

        if (wiper >= W1 && wiper <= W2)
        {
            float R1 = tableRes[i];
            float R2 = tableRes[i + 1];
            float ratio = (float)(wiper - W1) / (float)(W2 - W1);
            return R1 + ((R2 - R1) * ratio);
        }
    }

    int last = numberOfPoints - 1;
    float R1 = tableRes[last - 1];
    float R2 = tableRes[last];
    float W1 = tableWiper[last - 1];
    float W2 = tableWiper[last];
    float slope = (R2 - R1) / (W2 - W1);
    return R2 + slope * ((float)wiper - W2);
}

float calculateIC1Parallel(uint8_t wiper)
{
    return getCalibratedResistance(wiper, IC1_Wiper, IC1_Res, IC1_POINTS);
}

float calculateIC2Parallel(uint8_t wiper)
{
    return getCalibratedResistance(wiper, IC2_Wiper, IC2_Res, IC2_POINTS);
}

void writeMCP4261(uint8_t csPin, uint8_t address, uint8_t value)
{
    uint8_t command = (address << 4);
    SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
    digitalWrite(csPin, LOW);
    SPI.transfer(command);
    SPI.transfer(value);
    digitalWrite(csPin, HIGH);
    SPI.endTransaction();
}

void setIC1_CH0(uint8_t value) { writeMCP4261(CS_IC1, 0x00, value); }
void setIC1_CH1(uint8_t value) { writeMCP4261(CS_IC1, 0x01, value); }
void setIC2_CH0(uint8_t value) { writeMCP4261(CS_IC2, 0x00, value); }
void setIC2_CH1(uint8_t value) { writeMCP4261(CS_IC2, 0x01, value); }

void setIC1(uint8_t wiper)
{
    setIC1_CH0(wiper);
    delay(2);
    setIC1_CH1(wiper);
    delay(2);
    wiperIC1 = wiper;
}

void setIC2(uint8_t wiper)
{
    setIC2_CH0(wiper);
    delay(2);
    setIC2_CH1(wiper);
    delay(2);
    wiperIC2 = wiper;
}

void setBoth(uint8_t wiper)
{
    setIC1(wiper);
    delay(2);
    setIC2(wiper);
    delay(2);
}

uint8_t resistanceToWiperIC1(float target)
{
    float bestDifference = 999999.0f;
    uint8_t bestWiper = 0;
    for (int w = 0; w <= WIPER_MAX; w++)
    {
        float difference = fabs(calculateIC1Parallel((uint8_t)w) - target);
        if (difference < bestDifference)
        {
            bestDifference = difference;
            bestWiper = (uint8_t)w;
        }
    }
    return bestWiper;
}

uint8_t resistanceToWiperIC2(float target)
{
    float bestDifference = 999999.0f;
    uint8_t bestWiper = 0;
    for (int w = 0; w <= WIPER_MAX; w++)
    {
        float difference = fabs(calculateIC2Parallel((uint8_t)w) - target);
        if (difference < bestDifference)
        {
            bestDifference = difference;
            bestWiper = (uint8_t)w;
        }
    }
    return bestWiper;
}

// =====================================================
//                   I2C SCANNER
// =====================================================

void scanI2C()
{
    Serial.println();
    Serial.println("# =============================");
    Serial.println("# I2C BUS SCAN (SDA 36, SCL 38)");
    Serial.println("# =============================");

    int devices = 0;
    for (byte address = 1; address < 127; address++)
    {
        Wire.beginTransmission(address);
        byte error = Wire.endTransmission();
        if (error == 0)
        {
            Serial.print("# Device found at 0x");
            if (address < 0x10) Serial.print("0");
            Serial.println(address, HEX);
            devices++;
        }
    }

    if (devices == 0)
    {
        Serial.println("# NO I2C DEVICES FOUND");
    }
    Serial.println("# =============================");
}

void recoverI2C()
{
    Serial.println("# I2C RECOVERY: RESTARTING BUS");
    Wire.end();
    delay(5);
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setTimeOut(100);
    i2cFailCount = 0;
}

// =====================================================
//               INITIALIZE ACS37800
// =====================================================

void configureACS(ACS37800 &sensor, int idx)
{
    sensor.setNumberOfSamples(1023, false);
    sensor.setBypassNenable(true, false);
    sensor.setCurrentRange(currentRangeA[idx]);
}

void initializeACS()
{
    Battery_OK   = BatteryACS.begin(BATTERY_ADDR, Wire);
    FuelCell_OK  = FuelCellACS.begin(FUEL_CELL_ADDR, Wire);
    CommonBus_OK = CommonBusACS.begin(COMMON_BUS_ADDR, Wire);

    if (Battery_OK)   configureACS(BatteryACS, 0);
    if (FuelCell_OK)  configureACS(FuelCellACS, 1);
    if (CommonBus_OK) configureACS(CommonBusACS, 2);
}

// =====================================================
//    CURRENT MEASUREMENT: ZERO OFFSET AND GAIN
// =====================================================

float offsetI[3] = {0.0f, 0.0f, 0.0f};
float gainI[3]   = {1.0f, 1.0f, 1.0f};

bool readAveraged(
    ACS37800 &sensor,
    int samples,
    float &voltage,
    float &current,
    float &power)
{
    float sumV = 0.0f;
    float sumI = 0.0f;
    float sumP = 0.0f;
    int good = 0;

    for (int k = 0; k < samples; k++)
    {
        float v = 0.0f, i = 0.0f, p = 0.0f;
        if (sensor.readInstantaneous(&v, &i, &p) == ACS37800_SUCCESS)
        {
            sumV += v;
            sumI += i;
            sumP += p;
            good++;
        }
        delayMicroseconds(500);
    }

    if (good == 0) return false;

    voltage = sumV / good;
    current = sumI / good;
    power   = sumP / good;
    return true;
}

// =====================================================
//             REAL-TIME SENSOR ENGINE
// =====================================================

#define SENSOR_INTERVAL_MS 10
float filterAlpha = 0.35f;

float senV[3] = {NAN, NAN, NAN};
float senI[3] = {NAN, NAN, NAN};
float senP[3] = {NAN, NAN, NAN};
bool senInit[3] = {false, false, false};
int senFail[3] = {0, 0, 0};
unsigned long lastSensorUpdate = 0;

bool readOne(ACS37800 &sensor, int idx)
{
    float v = 0.0f, i = 0.0f, p = 0.0f;
    if (sensor.readInstantaneous(&v, &i, &p) != ACS37800_SUCCESS)
    {
        return false;
    }

    i = (i - offsetI[idx]) * gainI[idx];
    p = v * i;

    if (!senInit[idx] || filterAlpha >= 1.0f)
    {
        senV[idx] = v;
        senI[idx] = i;
        senP[idx] = p;
        senInit[idx] = true;
    }
    else
    {
        senV[idx] += filterAlpha * (v - senV[idx]);
        senI[idx] += filterAlpha * (i - senI[idx]);
        senP[idx] += filterAlpha * (p - senP[idx]);
    }

    return true;
}

void markFailed(int idx)
{
    senFail[idx]++;
    if (senFail[idx] >= 5)
    {
        senV[idx] = NAN;
        senI[idx] = NAN;
        senP[idx] = NAN;
        senInit[idx] = false;
    }
}

void updateSensors()
{
    unsigned long now = millis();
    if (now - lastSensorUpdate < SENSOR_INTERVAL_MS) return;
    lastSensorUpdate = now;

    int enabledSensors = 0;
    int failedSensors  = 0;

    if (Battery_OK)
    {
        enabledSensors++;
        if (readOne(BatteryACS, 0)) senFail[0] = 0;
        else { markFailed(0); failedSensors++; }
    }

    if (FuelCell_OK)
    {
        enabledSensors++;
        if (readOne(FuelCellACS, 1)) senFail[1] = 0;
        else { markFailed(1); failedSensors++; }
    }

    if (CommonBus_OK)
    {
        enabledSensors++;
        if (readOne(CommonBusACS, 2)) senFail[2] = 0;
        else { markFailed(2); failedSensors++; }
    }

    if (enabledSensors > 0 && failedSensors == enabledSensors)
    {
        i2cFailCount++;
        if (i2cFailCount >= 20)
        {
            recoverI2C();
        }
    }
    else
    {
        i2cFailCount = 0;
    }
}

// =====================================================
//        AEROTWIN COMPATIBLE JSON TELEMETRY BROADCAST
// =====================================================
//
// Replaces the legacy 16-byte raw binary packet with
// standard JSON formatted for AeroTwin's UDP parser:
//   vB, iB, pB  : Battery (V, A, W)
//   vF, iF, pF  : Fuel Cell (V, A, W)
//   vC, iC, pC  : Common Bus (V, A, W)
//   thr, rearThr: ESC throttle %
//   pcb         : "Rear Thruster PCB (GPIO 9)"
//   vlv         : Solenoid valve state (1 or 0)
//   r1, r2      : MCP4261 resistances (Ohm)
//   battPct     : Computed Battery SOC %
//   rssi        : WiFi signal strength dBm
// =====================================================

void broadcastTelemetry()
{
    // Clean NaN to 0.0 for JSON serialization
    float vB = isnan(senV[0]) ? 0.0f : senV[0];
    float iB = isnan(senI[0]) ? 0.0f : senI[0];
    float pB = isnan(senP[0]) ? 0.0f : senP[0];

    float vF = isnan(senV[1]) ? 0.0f : senV[1];
    float iF = isnan(senI[1]) ? 0.0f : senI[1];
    float pF = isnan(senP[1]) ? 0.0f : senP[1];

    float vC = isnan(senV[2]) ? 0.0f : senV[2];
    float iC = isnan(senI[2]) ? 0.0f : senI[2];
    float pC = isnan(senP[2]) ? 0.0f : senP[2];

    int rssi = WiFi.RSSI();

    // Compute Battery State of Charge percentage (supports 6S LiPo 20-25.2V or default)
    int battPct = 100;
    if (vB > 18.0f)
    {
        battPct = constrain((int)(((vB - 20.0f) / (25.2f - 20.0f)) * 100.0f), 0, 100);
    }
    else if (vB > 10.0f)
    {
        battPct = constrain((int)(((vB - 10.5f) / (16.8f - 10.5f)) * 100.0f), 0, 100);
    }

    float r1 = calculateIC1Parallel(wiperIC1);
    float r2 = calculateIC2Parallel(wiperIC2);

    int activeThr = pwmEnabled ? throttlePercent : 0;

    // Build standard JSON string
    char jsonBuffer[384];
    snprintf(
        jsonBuffer,
        sizeof(jsonBuffer),
        "{\"vB\":%.2f,\"iB\":%.2f,\"pB\":%.1f,"
        "\"vF\":%.2f,\"iF\":%.2f,\"pF\":%.1f,"
        "\"vC\":%.2f,\"iC\":%.2f,\"pC\":%.1f,"
        "\"thr\":%d,\"rearThr\":%d,\"rssi\":%d,\"battPct\":%d,"
        "\"vlv\":%d,\"r1\":%.1f,\"r2\":%.1f,"
        "\"pcb\":\"Secondary PCB (GPIO 9)\"}",
        vB, iB, pB,
        vF, iF, pF,
        vC, iC, pC,
        activeThr, activeThr, rssi, battPct,
        valveOpen ? 1 : 0, r1, r2
    );

    // 1. Send subnet broadcast on port 8888
    telemetry.beginPacket(broadcastIP, telePort);
    telemetry.print(jsonBuffer);
    telemetry.endPacket();

    // 2. Also unicast directly to GCS IP if recorded
    if (hasRemoteGcs && remoteGcsIP != broadcastIP && remoteGcsIP != IPAddress(0, 0, 0, 0))
    {
        telemetry.beginPacket(remoteGcsIP, telePort);
        telemetry.print(jsonBuffer);
        telemetry.endPacket();
    }
}

// Forward declaration
void processCommand(String command);

// =====================================================
//            THROTTLE & COMMANDS (UDP 8889)
// =====================================================
//
// Handles both binary packets and text commands:
//  [1, val]    : Main Throttle command from GCS
//  [3, val]    : Dedicated Rear Throttle bar command from GCS
//  [2, 4]      : Emergency Stop command
//  Text command: START, STOP, VALVE ON/OFF/AUTO, ZERO, etc.
// =====================================================

void receiveThrottle()
{
    int packetSize = throttle.parsePacket();
    if (packetSize <= 0) return;

    // Capture sender ground station IP address
    IPAddress sender = throttle.remoteIP();
    if (sender != IPAddress(0, 0, 0, 0))
    {
        remoteGcsIP = sender;
        hasRemoteGcs = true;
    }

    if (packetSize == 2)
    {
        uint8_t data[2];
        throttle.read(data, 2);

        // data[1] = throttle percent
        // data[0] == 1: General/Main throttle
        // data[0] == 3: Dedicated Rear Throttle bar for this PCB
        if (data[0] == 1 || data[0] == 3)
        {
            if (data[1] == 0)
            {
                stopPWM();
            }
            else
            {
                pwmEnabled = true;
                setThrottle(data[1]);

                Serial.print(data[0] == 3 ? "# [UDP] Dedicated PCB Throttle: " : "# [UDP] Throttle: ");
                Serial.print(data[1]);
                Serial.println(" %");
            }
        }
        else if (data[0] == 2 && data[1] == 4)
        {
            Serial.println("# [UDP] 🚨 EMERGENCY STOP RECEIVED");
            stopPWM();
        }
    }
    else
    {
        // Text command packet from GCS
        char cmdBuf[64];
        int len = throttle.read(cmdBuf, sizeof(cmdBuf) - 1);
        if (len > 0)
        {
            cmdBuf[len] = '\0';
            String cmdStr = String(cmdBuf);
            cmdStr.trim();
            Serial.print("# [UDP Command]: ");
            Serial.println(cmdStr);
            processCommand(cmdStr);
        }
    }
}

// =====================================================
//                     CSV OUTPUT
// =====================================================

void printCSVHeader()
{
    Serial.println();
    Serial.println(
        "Time_ms,ESC_PWM,ESC_Throttle_pct,ESC_Pulse_us,"
        "Battery_Status,Battery_V,Battery_mA,Battery_W,"
        "FuelCell_Status,FuelCell_V,FuelCell_mA,FuelCell_W,"
        "CommonBus_Status,CommonBus_V,CommonBus_mA,CommonBus_W,"
        "IC1_Step,IC1_Res_Ohm,IC2_Step,IC2_Res_Ohm,Valve_State"
    );
    Serial.println();
}

void printCSV()
{
    Serial.print(millis());
    Serial.print(",");
    Serial.print(pwmEnabled ? "ON" : "OFF");
    Serial.print(",");
    Serial.print(throttlePercent);
    Serial.print(",");
    Serial.print(escPulseUs);
    Serial.print(",");
    Serial.print(Battery_OK ? "OK" : "ERR");
    Serial.print(",");
    Serial.print(senV[0], 2);
    Serial.print(",");
    Serial.print(senI[0] * 1000.0f, 1);
    Serial.print(",");
    Serial.print(senP[0], 1);
    Serial.print(",");
    Serial.print(FuelCell_OK ? "OK" : "ERR");
    Serial.print(",");
    Serial.print(senV[1], 2);
    Serial.print(",");
    Serial.print(senI[1] * 1000.0f, 1);
    Serial.print(",");
    Serial.print(senP[1], 1);
    Serial.print(",");
    Serial.print(CommonBus_OK ? "OK" : "ERR");
    Serial.print(",");
    Serial.print(senV[2], 2);
    Serial.print(",");
    Serial.print(senI[2] * 1000.0f, 1);
    Serial.print(",");
    Serial.print(senP[2], 1);
    Serial.print(",");
    Serial.print(wiperIC1);
    Serial.print(",");
    Serial.print(calculateIC1Parallel(wiperIC1), 1);
    Serial.print(",");
    Serial.print(wiperIC2);
    Serial.print(",");
    Serial.print(calculateIC2Parallel(wiperIC2), 1);
    Serial.print(",");
    Serial.println(valveOpen ? "OPEN" : "CLOSED");
}

void printPlot()
{
    Serial.print("Battery_mA:");
    Serial.print(isnan(senI[0]) ? 0.0f : senI[0] * 1000.0f, 2);
    Serial.print(",FuelCell_mA:");
    Serial.print(isnan(senI[1]) ? 0.0f : senI[1] * 1000.0f, 2);
    Serial.print(",Bus_mA:");
    Serial.println(isnan(senI[2]) ? 0.0f : senI[2] * 1000.0f, 2);
}

void printBus()
{
    Serial.print("BUS  ");
    Serial.print(senV[2], 2);
    Serial.print(" V   ");
    Serial.print(senI[2] * 1000.0f, 1);
    Serial.print(" mA   ");
    Serial.print(senP[2], 1);
    Serial.println(" W");
}

// =====================================================
//               PROCESS COMMAND
// =====================================================

void processCommand(String command)
{
    command.trim();
    command.toUpperCase();

    if (command.length() == 0) return;

    if (command == "START")
    {
        startPWM();
        return;
    }

    if (command == "STOP")
    {
        stopPWM();
        return;
    }

    if (command == "STATUS")
    {
        Serial.println();
        Serial.println("# =============================");
        Serial.println("# SYSTEM STATUS - REAR PCB");
        Serial.println("# =============================");
        Serial.print("# WiFi: ");
        Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
        Serial.print("# IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("# ESC PWM: ");
        Serial.println(pwmEnabled ? "ON" : "OFF");
        Serial.print("# ESC Throttle: ");
        Serial.print(throttlePercent);
        Serial.println(" %");
        Serial.print("# ESC Pulse: ");
        Serial.print(escPulseUs);
        Serial.println(" us");
        Serial.print("# Battery ACS (0x60): ");
        Serial.println(Battery_OK ? "OK" : "ERROR");
        Serial.print("# Fuel Cell ACS (0x63): ");
        Serial.println(FuelCell_OK ? "OK" : "ERROR");
        Serial.print("# Common Bus ACS (0x6C): ");
        Serial.println(CommonBus_OK ? "OK" : "ERROR");
        Serial.print("# Valve (GPIO 8): ");
        Serial.println(valveOpen ? "OPEN" : "CLOSED");
        Serial.print("# Digipot R1: ");
        Serial.print(calculateIC1Parallel(wiperIC1), 1);
        Serial.println(" Ohm");
        Serial.print("# Digipot R2: ");
        Serial.print(calculateIC2Parallel(wiperIC2), 1);
        Serial.println(" Ohm");
        Serial.println("# =============================");
        return;
    }

    if (command == "ZERO")
    {
        float v = 0.0f, i = 0.0f, p = 0.0f;
        if (readAveraged(BatteryACS,   200, v, i, p)) offsetI[0] = i;
        if (readAveraged(FuelCellACS,  200, v, i, p)) offsetI[1] = i;
        if (readAveraged(CommonBusACS, 200, v, i, p)) offsetI[2] = i;

        for (int k = 0; k < 3; k++) senInit[k] = false;

        Serial.println("# CURRENT OFFSETS ZEROED (NO LOAD)");
        return;
    }

    if (command.startsWith("RANGE"))
    {
        float r = command.substring(5).toFloat();
        if (r >= 5.0f && r <= 200.0f)
        {
            for (int k = 0; k < 3; k++) currentRangeA[k] = r;
            if (Battery_OK)   BatteryACS.setCurrentRange(r);
            if (FuelCell_OK)  FuelCellACS.setCurrentRange(r);
            if (CommonBus_OK) CommonBusACS.setCurrentRange(r);
            Serial.print("# CURRENT RANGE = ");
            Serial.print(r, 0);
            Serial.println(" A");
        }
        return;
    }

    if (command.startsWith("VALVE"))
    {
        String arg = command.substring(5);
        arg.trim();
        if (arg == "ON")
        {
            valveAuto = false;
            setValve(true);
            Serial.println("# VALVE OPEN");
        }
        else if (arg == "OFF")
        {
            valveAuto = false;
            setValve(false);
            Serial.println("# VALVE CLOSED");
        }
        else if (arg == "AUTO")
        {
            valveAuto = true;
            setValve(true);
            Serial.println("# VALVE AUTO CYCLE");
        }
        return;
    }

    // Pure number = ESC Throttle %
    bool numericCommand = true;
    for (unsigned int i = 0; i < command.length(); i++)
    {
        if (!isDigit(command[i])) { numericCommand = false; break; }
    }

    if (numericCommand)
    {
        int thr = command.toInt();
        if (thr >= 0 && thr <= 100)
        {
            if (!pwmEnabled) startPWM();
            setThrottle(thr);
            Serial.print("# Rear ESC Throttle = ");
            Serial.print(thr);
            Serial.println(" %");
        }
        return;
    }

    // Digipot commands: W, I1, I2, R1, R2
    int spaceIndex = command.indexOf(' ');
    if (spaceIndex != -1)
    {
        String type = command.substring(0, spaceIndex);
        float value = command.substring(spaceIndex + 1).toFloat();

        if (type == "W")  { setBoth((uint8_t)value); return; }
        if (type == "I1") { setIC1((uint8_t)value); return; }
        if (type == "I2") { setIC2((uint8_t)value); return; }
        if (type == "R1") { setIC1(resistanceToWiperIC1(value)); return; }
        if (type == "R2") { setIC2(resistanceToWiperIC2(value)); return; }
    }

    if (command == "MODE CSV")  { plotMode = false; busMode = false; printCSVHeader(); return; }
    if (command == "MODE PLOT") { plotMode = true; busMode = false; return; }
    if (command == "MODE BUS")  { busMode = true; plotMode = false; return; }
}

const char *resetReasonText(esp_reset_reason_t reason)
{
    switch (reason)
    {
        case ESP_RST_POWERON:   return "POWER ON";
        case ESP_RST_SW:        return "SOFTWARE RESET";
        case ESP_RST_PANIC:     return "CRASH (PANIC)";
        case ESP_RST_INT_WDT:   return "INTERRUPT WATCHDOG";
        case ESP_RST_TASK_WDT:  return "TASK WATCHDOG";
        case ESP_RST_BROWNOUT:  return "BROWNOUT (POWER DIP)";
        case ESP_RST_DEEPSLEEP: return "DEEP SLEEP WAKE";
        default:                return "UNKNOWN";
    }
}

// =====================================================
//                       SETUP
// =====================================================

void setup()
{
    // Temporarily soften hardware brownout detector during initial RF startup
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(115200);
    Serial.setTimeout(50);
    delay(200);

    Serial.println();
    Serial.println("==================================================");
    Serial.println("🚁 AEROTWIN - ESP32 REAR THRUSTER PCB FIRMWARE");
    Serial.println("==================================================");
    Serial.print("# Reset Reason: ");
    Serial.println(resetReasonText(esp_reset_reason()));

    // Valve GPIO 8
    pinMode(VALVE_PIN, OUTPUT);
    digitalWrite(VALVE_PIN, LOW);
    Serial.println("# [1] Valve Pin GPIO 8 Configured (LOW)");

    // I2C: SDA 36, SCL 38
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setTimeOut(100);
    Serial.println("# [2] I2C Started on SDA 36, SCL 38");

    // SPI for MCP4261
    pinMode(CS_IC1, OUTPUT);
    pinMode(CS_IC2, OUTPUT);
    digitalWrite(CS_IC1, HIGH);
    digitalWrite(CS_IC2, HIGH);
    SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI);
    setBoth(0);
    Serial.println("# [3] SPI Started (SCK 4, MISO 5, MOSI 6, CS 16/18)");

    // I2C Devices
    scanI2C();
    initializeACS();
    Serial.println("# [4] ACS37800 Sensors Initialized (0x60, 0x63, 0x6C)");

    // ESC PWM on GPIO 9 (Initialized, held safely at 1000 us)
    escBegin();
    escWriteUs(ESC_MIN_US);
    pwmEnabled = false;
    throttlePercent = 0;
    escPulseUs = ESC_MIN_US;
    Serial.println("# [5] ESC PWM Pin GPIO 9 Configured (Holding 1000 us)");

    // WiFi
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false); // Disable WiFi power saving for ultra-low latency UDP
    WiFi.begin(ssid, password);
    Serial.println("# [6] WiFi Connecting in Background...");

    // Re-enable brownout detector after RF init
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

    printCSVHeader();
}

// =====================================================
//                       LOOP
// =====================================================

unsigned long lastMeasurement = 0;
unsigned long lastTelemetry   = 0;

void loop()
{
    // 1. Process Serial CLI commands
    if (Serial.available())
    {
        String command = Serial.readStringUntil('\n');
        processCommand(command);
    }

    // 2. Solenoid valve non-blocking cycle
    updateValve();

    // 3. Sensor sampling every 10 ms
    updateSensors();

    // 4. Ground Station UDP Link
    if (WiFi.status() == WL_CONNECTED)
    {
        if (!udpStarted)
        {
            telemetry.begin(telePort);
            throttle.begin(throttlePort);
            udpStarted = true;

            broadcastIP = WiFi.broadcastIP();
            if (broadcastIP == IPAddress(0, 0, 0, 0))
            {
                broadcastIP = IPAddress(255, 255, 255, 255);
            }

            Serial.println();
            Serial.println("# ──────────────────────────────────────");
            Serial.println("# ✅ WIFI CONNECTED - AEROTWIN LINK READY");
            Serial.print("# IP Address: ");
            Serial.println(WiFi.localIP());
            Serial.print("# Broadcast:  ");
            Serial.println(broadcastIP);
            Serial.println("# ──────────────────────────────────────");
        }

        // Receive Throttle commands & text commands on UDP 8889
        receiveThrottle();

        // Broadcast JSON telemetry on UDP 8888 (every 200 ms / 5 Hz)
        if (millis() - lastTelemetry >= TELEMETRY_INTERVAL_MS)
        {
            lastTelemetry = millis();
            broadcastTelemetry();
        }
    }
    else
    {
        udpStarted = false;
    }

    // 5. Serial Debug Print
    unsigned long now = millis();
    if (now - lastMeasurement >= printIntervalMs)
    {
        lastMeasurement = now;
        if (busMode)       printBus();
        else if (plotMode) printPlot();
        else               printCSV();
    }
}
