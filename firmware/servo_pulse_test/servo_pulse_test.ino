/*******************************************************************************
 * ResQBot - RAW SERVO PULSE TEST  (upload to the MAIN ESP32)
 * -----------------------------------------------------------------------------
 * Drives the servo with plain digitalWrite pulses - no PWM hardware, no
 * libraries, no Bluetooth. It swings between 0 and 180 degrees every 2 s.
 *
 *   - Servo moves here      -> servo + wiring are fine (tell Claude)
 *   - Servo still dead here -> it is power, wiring or a broken servo
 *
 * Change SERVO_PIN to try another pin (e.g. 13 or 14) with the signal wire.
 * Board: ESP32 Dev Module
 ******************************************************************************/
#include <Arduino.h>

#define SERVO_PIN 18

void pulseFor(int us, int ms) {           // send 50 Hz pulses for `ms`
  uint32_t start = millis();
  while (millis() - start < (uint32_t)ms) {
    digitalWrite(SERVO_PIN, HIGH);
    delayMicroseconds(us);
    digitalWrite(SERVO_PIN, LOW);
    delayMicroseconds(20000 - us);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(SERVO_PIN, OUTPUT);
  digitalWrite(SERVO_PIN, LOW);
  Serial.printf("Raw pulse test on GPIO %d\n", SERVO_PIN);
}

void loop() {
  Serial.println("0 deg");
  pulseFor(500, 2000);
  Serial.println("90 deg");
  pulseFor(1500, 2000);
  Serial.println("180 deg");
  pulseFor(2500, 2000);
}
