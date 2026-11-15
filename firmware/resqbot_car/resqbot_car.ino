/*******************************************************************************
 * ResQBot - MAIN ESP32 (car brain)
 * -----------------------------------------------------------------------------
 *  - Bluetooth Classic RC car control (Arduino tank / Bluetooth RC apps)
 *  - Speed control 0-9 (and 'q' = 100 %)
 *  - Sonar safety brake (enable/disable + trigger distance set from the
 *    ESP32-CAM web dashboard, saved in flash)
 *  - DHT11 + MQ gas + HC-SR04 readings sent to the ESP32-CAM over UART
 *  - Passive buzzer horn, relay motor, gate servo
 *
 * Board      : "ESP32 Dev Module"  (classic ESP32 - Bluetooth Classic needed)
 * Partition  : "Huge APP (3MB No OTA/1MB SPIFFS)"
 * Core       : esp32 by Espressif 2.0.x or 3.x (tested to compile on 3.3.12)
 * Libraries  : none (DHT11 driver is built in, no library needed)
 *
 * App commands (one character each):
 *   F B L R          forward / back / spin left / spin right
 *   G I H J          forward-left / forward-right / back-left / back-right
 *   S                stop (app sends this when no button is pressed)
 *   0-9, q           speed (q = full speed)
 *   W / w            relay motor ON / OFF
 *   U / u            gate servo OPEN / CLOSE
 *   V / v            horn on / off
 *   D                stop everything (wheels + relay motor + horn)
 ******************************************************************************/

#include <Arduino.h>
#include <BluetoothSerial.h>
#include <Preferences.h>
#include "soc/soc.h"
#include "soc/gpio_reg.h"
#if __has_include("esp_arduino_version.h")
  #include "esp_arduino_version.h"
#endif
#ifndef ESP_ARDUINO_VERSION_MAJOR
  #define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
  #error "Bluetooth Classic not available - select the board 'ESP32 Dev Module'."
#endif

// =============================== PIN MAP ====================================
// (final tested wiring: DHT 4, gas 34, servo 25, buzzer 18, relay 26,
//  L298 ENA/IN1/IN2 = 27/16/17, ENB/IN3/IN4 = 22/19/21, sonar 23/35)
#define ENA_PIN      27   // L298 channel A PWM   (remove the ENA jumper cap)
#define IN1_PIN      16
#define IN2_PIN      17
#define ENB_PIN      22   // L298 channel B PWM   (remove the ENB jumper cap)
#define IN3_PIN      19
#define IN4_PIN      21

#define SERVO_PIN    25   // gate servo
#define BUZZER_PIN   18   // passive buzzer
#define RELAY_PIN    26   // NPN -> low-level relay. HIGH = relay motor ON

#define DHT_PIN       4   // DHT11 data
#define GAS_PIN      34   // MQ AO (through the 10k/20k divider), ADC1 only
#define TRIG_PIN     23   // HC-SR04 TRIG
#define ECHO_PIN     35   // HC-SR04 ECHO (input-only pin, 5V -> divider)

#define LINK_TX_PIN  32   // -> ESP32-CAM GPIO13 (its RX)
#define LINK_RX_PIN  33   // <- ESP32-CAM GPIO15 (its TX)

// ============================ MOTOR MAPPING =================================
// Set from your test with the Arduino tank app (before this fix: Up turned
// right, Down turned left, Left went back, Right went forward = the right
// side was running backwards). If one side ever turns the wrong way again,
// flip its INVERT flag. If left/right are swapped, flip LEFT_ON_B.
const bool LEFT_ON_B    = true;
const bool INVERT_LEFT  = true;
const bool INVERT_RIGHT = true;

// ============================== SETTINGS ====================================
#define BT_NAME            "RC_CAR"
#define MIN_PWM            90      // lowest duty that still turns the motors
#define MAX_PWM            255
#define TURN_SCALE         40      // inner wheel % of speed for G/I/H/J
#define CMD_TIMEOUT_MS     0       // >0: stop if no byte arrives for this long
                                   // (only use with apps that stream commands)
#define LINK_BAUD          115200
#define TELEMETRY_MS       100     // sensor packet to the CAM every 100 ms
#define SONAR_PERIOD_MS    40      // one ping every 40 ms (25 Hz)
#define SONAR_WAIT_MS      60      // no echo after this = nothing in range
#define SONAR_FRESH_MS     300     // older readings are ignored
#define BRAKE_HYST_CM      3       // must back off this far past the trigger
#define TRIG_MIN_CM        5
#define TRIG_MAX_CM        300
#define DEFAULT_TRIG_CM    25
#define HORN_HZ            2000
#define BRAKE_BEEP_HZ      2800
#define BRAKE_BEEP_MS      250
#define GATE_CLOSED_DEG    90      // gate servo angle when closed (reversed)
#define GATE_OPEN_DEG      0       // gate servo angle when open   (reversed)

// ============================ LEDC (PWM) PLAN ===============================
// Channels are paired on timers: 0-1 -> T0, 2-3 -> T1, 4-5 -> T2, 6-7 -> T3.
// Each device group gets its own timer so nothing ever changes another's
// frequency (no servo jitter, no motor glitches when the horn sounds).
#define CH_SERVO     0   // timer 0 : 50 Hz, 14-bit
#define CH_MOTOR_A   2   // timer 1 : 1 kHz, 8-bit
#define CH_MOTOR_B   3   // timer 1 : 1 kHz, 8-bit (same settings - safe)
#define CH_BUZZER    4   // timer 2 : variable tone (channel 5 left unused)
#define MOTOR_FREQ   1000
#define MOTOR_RES    8
#define SERVO_FREQ   50
#define SERVO_RES    14

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  #define PWM_ATTACH(pin, ch, f, r) ledcAttachChannel(pin, f, r, ch)
  #define PWM_WRITE(pin, ch, duty)  ledcWrite(pin, duty)
  #define PWM_TONE(pin, ch, hz)     ledcWriteTone(pin, hz)
#else
  #define PWM_ATTACH(pin, ch, f, r) do { ledcSetup(ch, f, r); ledcAttachPin(pin, ch); } while (0)
  #define PWM_WRITE(pin, ch, duty)  ledcWrite(ch, duty)
  #define PWM_TONE(pin, ch, hz)     ledcWriteTone(ch, hz)
#endif

// Fast pin reads (safe inside ISRs / critical sections)
#define PIN_LEVEL(p) ((p) < 32 ? ((REG_READ(GPIO_IN_REG) >> (p)) & 1U) \
                               : ((REG_READ(GPIO_IN1_REG) >> ((p) - 32)) & 1U))

// ================================ GLOBALS ===================================
BluetoothSerial SerialBT;
Preferences prefs;

char     moveCmd      = 'S';   // movement currently applied
int      speedLevel   = 5;     // 0-9, 10 = 'q'
bool     sonarEnabled = true;
int      triggerCm    = DEFAULT_TRIG_CM;
bool     brakeActive  = false;
bool     btConnected  = false;
bool     hornOn       = false;
bool     relayOn      = false;
bool     gateOpen     = false;
uint32_t beepUntil    = 0;
uint32_t lastByteMs   = 0;
int      gasRaw       = 0;

// =============================== MOTORS =====================================
int levelToDuty(int level) {
  if (level >= 10) return MAX_PWM;
  if (level <= 0)  return 0;
  return MIN_PWM + (MAX_PWM - MIN_PWM) * (level - 1) / 8;   // 1..9 -> MIN..MAX
}

// dir: 1 forward, -1 reverse, 0 brake
void driveChannel(bool chB, int dir, int duty) {
  int a = chB ? IN3_PIN : IN1_PIN;
  int b = chB ? IN4_PIN : IN2_PIN;
  if (dir == 0) {                       // active brake: both LOW, EN high
    digitalWrite(a, LOW); digitalWrite(b, LOW);
    duty = MAX_PWM;
  } else {
    digitalWrite(a, dir > 0 ? HIGH : LOW);
    digitalWrite(b, dir > 0 ? LOW : HIGH);
  }
  if (chB) PWM_WRITE(ENB_PIN, CH_MOTOR_B, duty);
  else     PWM_WRITE(ENA_PIN, CH_MOTOR_A, duty);
}

void setLeft(int dir, int scale) {
  if (INVERT_LEFT) dir = -dir;
  driveChannel(LEFT_ON_B, dir, levelToDuty(speedLevel) * scale / 100);
}

void setRight(int dir, int scale) {
  if (INVERT_RIGHT) dir = -dir;
  driveChannel(!LEFT_ON_B, dir, levelToDuty(speedLevel) * scale / 100);
}

void applyDrive() {
  switch (moveCmd) {
    case 'F': setLeft( 1, 100);        setRight( 1, 100);        break;
    case 'B': setLeft(-1, 100);        setRight(-1, 100);        break;
    case 'L': setLeft(-1, 100);        setRight( 1, 100);        break;
    case 'R': setLeft( 1, 100);        setRight(-1, 100);        break;
    case 'G': setLeft( 1, TURN_SCALE); setRight( 1, 100);        break;
    case 'I': setLeft( 1, 100);        setRight( 1, TURN_SCALE); break;
    case 'H': setLeft(-1, TURN_SCALE); setRight(-1, 100);        break;
    case 'J': setLeft(-1, 100);        setRight(-1, TURN_SCALE); break;
    default:  driveChannel(false, 0, 0); driveChannel(true, 0, 0); break;   // 'S'
  }
}

// ================================ SONAR =====================================
// Interrupt-timed echo: the loop never waits for the sensor.
static portMUX_TYPE sonarMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t echoRiseUs = 0, echoWidthUs = 0;
volatile bool     echoHigh = false, echoReady = false;
volatile uint32_t dhtSeq = 0;      // odd while the DHT11 is being read

int      distanceCm = -1;          // -1 = nothing in range
uint32_t lastDistMs = 0;
bool     pingActive = false;
uint32_t pingMs = 0, pingSeq = 0;

void IRAM_ATTR echoISR() {
  uint32_t now = micros();
  bool level = PIN_LEVEL(ECHO_PIN);
  portENTER_CRITICAL_ISR(&sonarMux);
  if (level) { echoRiseUs = now; echoHigh = true; }
  else if (echoHigh) { echoWidthUs = now - echoRiseUs; echoHigh = false; echoReady = true; }
  portEXIT_CRITICAL_ISR(&sonarMux);
}

void sonarUpdate() {
  uint32_t now = millis();

  if (pingActive) {
    bool ready; uint32_t width;
    portENTER_CRITICAL(&sonarMux);
    ready = echoReady; width = echoWidthUs; echoReady = false;
    portEXIT_CRITICAL(&sonarMux);

    if (ready) {
      pingActive = false;
      if (dhtSeq == pingSeq) {                 // not disturbed by a DHT read
        float cm = width / 58.0f;
        distanceCm = (cm >= 2.0f && cm <= 400.0f) ? (int)(cm + 0.5f) : -1;
        lastDistMs = now;
      }
    } else if (now - pingMs > SONAR_WAIT_MS) { // no echo = nothing in range
      pingActive = false;
      distanceCm = -1;
      lastDistMs = now;
    }
  }

  if (!pingActive && now - pingMs >= SONAR_PERIOD_MS &&
      !PIN_LEVEL(ECHO_PIN) && !(dhtSeq & 1U)) {
    portENTER_CRITICAL(&sonarMux);
    echoHigh = false; echoReady = false;
    portEXIT_CRITICAL(&sonarMux);
    pingSeq = dhtSeq;
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    pingMs = now;
    pingActive = true;
  }
}

int currentDistance() {
  return (millis() - lastDistMs < SONAR_FRESH_MS) ? distanceCm : -1;
}

bool obstacleWithin(int cm) {
  int d = currentDistance();
  return d > 0 && d <= cm;
}

// ============================ SAFETY BRAKE ==================================
bool isForward(char c) { return c == 'F' || c == 'G' || c == 'I'; }

void triggerBrake() {
  if (!brakeActive) beepUntil = millis() + BRAKE_BEEP_MS;
  brakeActive = true;
}

void setMove(char c) {
  if (isForward(c) && sonarEnabled) {
    int limit = brakeActive ? triggerCm + BRAKE_HYST_CM : triggerCm;
    if (obstacleWithin(limit)) { triggerBrake(); c = 'S'; }
  }
  if (c == moveCmd) return;
  moveCmd = c;
  applyDrive();
}

void safetyCheck() {
  if (!sonarEnabled) { brakeActive = false; return; }
  if (isForward(moveCmd) && obstacleWithin(triggerCm)) {
    triggerBrake();
    moveCmd = 'S';
    applyDrive();
    return;
  }
  if (brakeActive && !obstacleWithin(triggerCm + BRAKE_HYST_CM)) brakeActive = false;
}

void setSonar(bool on) {
  if (on == sonarEnabled) return;
  sonarEnabled = on;
  if (!on) brakeActive = false;
  prefs.putBool("son", on);
}

void setTrigger(int cm) {
  if (cm < TRIG_MIN_CM) cm = TRIG_MIN_CM;
  if (cm > TRIG_MAX_CM) cm = TRIG_MAX_CM;
  if (cm == triggerCm) return;
  triggerCm = cm;
  prefs.putUShort("trig", (uint16_t)cm);
}

// ================================ BUZZER ====================================
void buzzerUpdate() {
  static uint32_t lastHz = 0xFFFFFFFF;
  uint32_t hz = hornOn ? HORN_HZ
              : ((int32_t)(beepUntil - millis()) > 0 ? BRAKE_BEEP_HZ : 0);
  if (hz == lastHz) return;
  lastHz = hz;
  PWM_TONE(BUZZER_PIN, CH_BUZZER, hz);
}

// ========================= RELAY MOTOR + GATE SERVO =========================
void setRelay(bool on) {
  relayOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
}

void servoWrite(int deg) {
  if (deg < 0) deg = 0;
  if (deg > 180) deg = 180;
  uint32_t us = 500 + (uint32_t)deg * 2000 / 180;           // 0.5-2.5 ms
  uint32_t duty = us * ((1UL << SERVO_RES) - 1) / 20000;    // 20 ms period
  PWM_WRITE(SERVO_PIN, CH_SERVO, duty);
}

void setGate(bool open) {
  gateOpen = open;
  servoWrite(open ? GATE_OPEN_DEG : GATE_CLOSED_DEG);
}

// ========================= DHT11 (built-in driver) ==========================
volatile float g_temp = NAN, g_hum = NAN;
static portMUX_TYPE dhtMux = portMUX_INITIALIZER_UNLOCKED;

// waits while the pin is at `level`; returns microseconds waited or -1
static inline int32_t dhtWait(uint32_t level, uint32_t timeoutUs) {
  uint32_t start = micros();
  while (PIN_LEVEL(DHT_PIN) == level) {
    if (micros() - start > timeoutUs) return -1;
  }
  return (int32_t)(micros() - start);
}

bool dhtRead(float &t, float &h) {
  uint8_t d[5] = {0, 0, 0, 0, 0};
  bool ok = true;

  pinMode(DHT_PIN, OUTPUT);
  digitalWrite(DHT_PIN, LOW);
  vTaskDelay(pdMS_TO_TICKS(20));            // start signal (>= 18 ms)
  pinMode(DHT_PIN, INPUT_PULLUP);           // release the line

  portENTER_CRITICAL(&dhtMux);              // ~4 ms of precise timing
  if (dhtWait(1, 200) < 0 || dhtWait(0, 120) < 0 || dhtWait(1, 120) < 0) {
    ok = false;                             // no response from the sensor
  } else {
    for (int i = 0; i < 40; i++) {
      if (dhtWait(0, 90) < 0) { ok = false; break; }        // 50 us low
      int32_t high = dhtWait(1, 110);                       // 26-28 / 70 us
      if (high < 0) { ok = false; break; }
      d[i / 8] <<= 1;
      if (high > 45) d[i / 8] |= 1;
    }
  }
  portEXIT_CRITICAL(&dhtMux);

  if (!ok) return false;
  if ((uint8_t)(d[0] + d[1] + d[2] + d[3]) != d[4]) return false;
  h = d[0] + d[1] * 0.1f;
  t = (d[2] & 0x7F) + (d[3] & 0x0F) * 0.1f;
  if (d[2] & 0x80) t = -t;
  return h <= 100.0f;
}

void dhtTask(void *) {
  uint8_t fails = 0;
  vTaskDelay(pdMS_TO_TICKS(1500));          // sensor power-up time
  for (;;) {
    float t, h;
    dhtSeq = dhtSeq + 1;                    // odd: reading in progress
    bool ok = dhtRead(t, h);
    dhtSeq = dhtSeq + 1;                    // even: done
    if (ok) { g_temp = t; g_hum = h; fails = 0; }
    else if (++fails >= 3) { g_temp = NAN; g_hum = NAN; fails = 3; }
    vTaskDelay(pdMS_TO_TICKS(2000));        // DHT11 max rate ~1 Hz
  }
}

// ================================= GAS ======================================
void gasUpdate() {
  static uint32_t t = 0;
  if (millis() - t < 200) return;
  t = millis();
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(GAS_PIN);
  gasRaw = sum / 16;
}

// ======================= ESP32 <-> ESP32-CAM LINK ===========================
// Frame format:  $<payload>*<XOR checksum, 2 hex>\n   (bad frames are dropped)
void sendFrame(const char *payload) {
  uint8_t cs = 0;
  for (const char *p = payload; *p; p++) cs ^= (uint8_t)*p;
  char buf[160];
  int n = snprintf(buf, sizeof(buf), "$%s*%02X\n", payload, cs);
  if (n > 0 && n < (int)sizeof(buf)) Serial2.write((const uint8_t *)buf, n);
}

class FrameParser {
  char buf[96];
  uint8_t len = 0;
  bool active = false;
 public:
  bool feed(char c, char *out, size_t outSize) {
    if (c == '$') { active = true; len = 0; return false; }
    if (!active) return false;
    if (c == '\n' || c == '\r') {
      active = false;
      buf[len] = '\0';
      char *star = strrchr(buf, '*');
      if (!star || (buf + len) - star != 3) return false;
      if (!isxdigit((uint8_t)star[1]) || !isxdigit((uint8_t)star[2])) return false;
      *star = '\0';
      uint8_t cs = 0;
      for (char *p = buf; *p; p++) cs ^= (uint8_t)*p;
      if ((uint8_t)strtoul(star + 1, nullptr, 16) != cs) return false;
      strncpy(out, buf, outSize - 1);
      out[outSize - 1] = '\0';
      return true;
    }
    if (len >= sizeof(buf) - 1) { active = false; return false; }
    buf[len++] = c;
    return false;
  }
};
FrameParser linkParser;

void handleLink(const char *p) {
  if (p[0] == 'E' && p[1] == ',') setSonar(atoi(p + 2) != 0);       // E,1 / E,0
  else if (p[0] == 'D' && p[1] == ',') setTrigger(atoi(p + 2));     // D,<cm>
}

void sendTelemetry() {
  static uint32_t t = 0;
  if (millis() - t < TELEMETRY_MS) return;
  t = millis();
  char p[128];
  // T,temp,hum,gas,dist,sonarOn,trigger,brake,speed,cmd,bt,relayMotor
  snprintf(p, sizeof(p), "T,%.1f,%.1f,%d,%d,%d,%d,%d,%d,%c,%d,%d",
           (double)g_temp, (double)g_hum, gasRaw, currentDistance(),
           sonarEnabled ? 1 : 0, triggerCm, brakeActive ? 1 : 0, speedLevel,
           moveCmd, btConnected ? 1 : 0, relayOn ? 1 : 0);
  sendFrame(p);
}

// ============================ APP COMMANDS ==================================
void stopAll() {
  setMove('S');
  hornOn = false;
  setRelay(false);
}

void handleCmd(char c) {
  switch (c) {
    case 'F': case 'B': case 'L': case 'R':
    case 'G': case 'I': case 'H': case 'J': case 'S':
      setMove(c);
      break;
    case '0' ... '9':
      if (speedLevel != c - '0') { speedLevel = c - '0'; if (moveCmd != 'S') applyDrive(); }
      break;
    case 'q':
      if (speedLevel != 10) { speedLevel = 10; if (moveCmd != 'S') applyDrive(); }
      break;
    case 'W': setRelay(true);   break;    // relay motor ON
    case 'w': setRelay(false);  break;    // relay motor OFF
    case 'U': setGate(true);    break;    // gate servo OPEN
    case 'u': setGate(false);   break;    // gate servo CLOSE
    case 'V': hornOn = true;    break;
    case 'v': hornOn = false;   break;
    case 'D': stopAll();        break;
    default: break;                       // anything else ('\r', '\n' ...) ignored
  }
}

// ================================ SETUP =====================================
void setup() {
  Serial.begin(115200);

  // outputs to a safe state first
  pinMode(IN1_PIN, OUTPUT); pinMode(IN2_PIN, OUTPUT);
  pinMode(IN3_PIN, OUTPUT); pinMode(IN4_PIN, OUTPUT);
  digitalWrite(IN1_PIN, LOW); digitalWrite(IN2_PIN, LOW);
  digitalWrite(IN3_PIN, LOW); digitalWrite(IN4_PIN, LOW);
  pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, LOW);
  pinMode(TRIG_PIN, OUTPUT);  digitalWrite(TRIG_PIN, LOW);
  pinMode(ECHO_PIN, INPUT);

  PWM_ATTACH(SERVO_PIN,  CH_SERVO,   SERVO_FREQ, SERVO_RES);
  PWM_ATTACH(ENA_PIN,    CH_MOTOR_A, MOTOR_FREQ, MOTOR_RES);
  PWM_ATTACH(ENB_PIN,    CH_MOTOR_B, MOTOR_FREQ, MOTOR_RES);
  PWM_ATTACH(BUZZER_PIN, CH_BUZZER,  2000,       10);
  PWM_TONE(BUZZER_PIN, CH_BUZZER, 0);
  setGate(false);                          // gate closed at power-up
  setRelay(false);                         // relay motor off at power-up
  applyDrive();                            // 'S' = braked

  prefs.begin("car", false);
  sonarEnabled = prefs.getBool("son", true);
  int t = prefs.getUShort("trig", DEFAULT_TRIG_CM);
  triggerCm = (t < TRIG_MIN_CM || t > TRIG_MAX_CM) ? DEFAULT_TRIG_CM : t;

  analogReadResolution(12);
  attachInterrupt(digitalPinToInterrupt(ECHO_PIN), echoISR, CHANGE);
  xTaskCreatePinnedToCore(dhtTask, "dht11", 3072, nullptr, 2, nullptr, 1);

  Serial2.setRxBufferSize(512);
  Serial2.begin(LINK_BAUD, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN);

  SerialBT.begin(BT_NAME);
  Serial.println("ResQBot car ready - pair with \"" BT_NAME "\"");
}

// ================================= LOOP =====================================
void loop() {
  // Bluetooth: stop everything the moment the phone disconnects
  bool conn = SerialBT.hasClient();
  if (conn != btConnected) {
    btConnected = conn;
    if (!conn) stopAll();
  }
  while (SerialBT.available()) {
    int c = SerialBT.read();
    if (c < 0) break;
    lastByteMs = millis();
    handleCmd((char)c);
  }
#if CMD_TIMEOUT_MS > 0
  if (moveCmd != 'S' && millis() - lastByteMs > CMD_TIMEOUT_MS) setMove('S');
#endif

  // commands from the ESP32-CAM dashboard
  static char line[96];
  while (Serial2.available()) {
    if (linkParser.feed((char)Serial2.read(), line, sizeof(line))) handleLink(line);
  }

  sonarUpdate();
  safetyCheck();
  buzzerUpdate();
  gasUpdate();
  sendTelemetry();
}
