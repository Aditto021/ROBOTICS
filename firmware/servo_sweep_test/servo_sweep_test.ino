/*******************************************************************************
 * ResQBot - SERVO SWEEP TEST (no phone, no Bluetooth)  -> upload to MAIN ESP32
 * -----------------------------------------------------------------------------
 * Servo signal on GPIO 18 (D18), red to 5V, brown/black to GND.
 * The servo moves 0 -> 90 -> 180 -> 90 -> 0 degrees, 1.5 s per step, forever.
 * Open Serial Monitor at 115200 to see each step.
 *
 * Board: ESP32 Dev Module
 ******************************************************************************/
#include <Arduino.h>
#if __has_include("esp_arduino_version.h")
  #include "esp_arduino_version.h"
#endif
#ifndef ESP_ARDUINO_VERSION_MAJOR
  #define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#define SERVO_PIN   18     // change if the signal wire is on another pin
#define SERVO_CH    0
#define SERVO_FREQ  50     // standard servo frequency (20 ms period)
#define SERVO_RES   16     // 16-bit duty resolution

void servoAngle(int deg) {
  uint32_t us   = 500 + (uint32_t)deg * 2000 / 180;          // 0.5 - 2.5 ms
  uint32_t duty = (uint32_t)((uint64_t)us * 65535 / 20000);  // of 20 ms
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(SERVO_PIN, duty);
#else
  ledcWrite(SERVO_CH, duty);
#endif
  Serial.printf("%3d deg  (pulse %4u us)\n", deg, (unsigned)us);
}

void setup() {
  Serial.begin(115200);
  delay(500);
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  bool ok = ledcAttachChannel(SERVO_PIN, SERVO_FREQ, SERVO_RES, SERVO_CH);
#else
  bool ok = ledcSetup(SERVO_CH, SERVO_FREQ, SERVO_RES) > 0;
  ledcAttachPin(SERVO_PIN, SERVO_CH);
#endif
  Serial.printf("Servo test on GPIO %d at %d Hz: %s\n",
                SERVO_PIN, SERVO_FREQ, ok ? "PWM started" : "PWM FAILED");
}

void loop() {
  const int steps[] = {0, 90, 180, 90};
  for (int i = 0; i < 4; i++) {
    servoAngle(steps[i]);
    delay(1500);
  }
}
