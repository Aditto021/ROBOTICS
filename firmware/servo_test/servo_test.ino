/*******************************************************************************
 * ResQBot - GATE SERVO + BLUETOOTH TEST  (upload to the MAIN ESP32)
 * -----------------------------------------------------------------------------
 * 1. On power-up the servo moves 0 -> 90 -> 180 -> 0 degrees by itself.
 *    If it does NOT move here, the problem is wiring/power, not the app.
 * 2. Then connect the Arduino tank app (device "RC_CAR") and press the gate
 *    button. Open Serial Monitor at 115200 to see exactly which characters
 *    the app sends. 'U' moves the servo to 90, 'u' moves it to 0.
 *
 * Board: ESP32 Dev Module, Partition: Huge APP
 ******************************************************************************/
#include <Arduino.h>
#include <BluetoothSerial.h>
#if __has_include("esp_arduino_version.h")
  #include "esp_arduino_version.h"
#endif
#ifndef ESP_ARDUINO_VERSION_MAJOR
  #define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#define SERVO_PIN  18
#define CH_SERVO   0
#define SERVO_FREQ 50
#define SERVO_RES  14

BluetoothSerial SerialBT;

void servoWrite(int deg) {
  if (deg < 0) deg = 0;
  if (deg > 180) deg = 180;
  uint32_t us = 500 + (uint32_t)deg * 2000 / 180;
  uint32_t duty = us * ((1UL << SERVO_RES) - 1) / 20000;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(SERVO_PIN, duty);
#else
  ledcWrite(CH_SERVO, duty);
#endif
  Serial.printf("servo -> %d deg\n", deg);
}

void setup() {
  Serial.begin(115200);
  delay(500);
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  bool ok = ledcAttachChannel(SERVO_PIN, SERVO_FREQ, SERVO_RES, CH_SERVO);
  Serial.printf("servo PWM attach: %s\n", ok ? "OK" : "FAILED");
#else
  ledcSetup(CH_SERVO, SERVO_FREQ, SERVO_RES);
  ledcAttachPin(SERVO_PIN, CH_SERVO);
#endif

  Serial.println("Self test: sweeping the servo...");
  servoWrite(0);   delay(1000);
  servoWrite(90);  delay(1000);
  servoWrite(180); delay(1000);
  servoWrite(0);   delay(1000);

  SerialBT.begin("RC_CAR");
  Serial.println("Now connect the app to RC_CAR and press the gate button.");
}

void loop() {
  static int last = -1;
  while (SerialBT.available()) {
    int c = SerialBT.read();
    if (c < 0 || c == '\r' || c == '\n') continue;
    if (c != last) {                       // print only changes (apps repeat 'S')
      Serial.printf("app sent '%c'  (code %d)\n", (char)c, c);
      last = c;
    }
    if (c == 'U') servoWrite(90);
    if (c == 'u') servoWrite(0);
  }
}
