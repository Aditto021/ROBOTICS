# ResQBot firmware

Two Arduino sketches:

| Folder | Board | What it does |
| --- | --- | --- |
| `resqbot_car/` | ESP32 DevKit ("ESP32 Dev Module") | Bluetooth car control, speed, sonar safety brake, DHT11, gas, horn, ball shooter. Sends sensor data to the CAM. |
| `resqbot_cam/` | ESP32-CAM ("AI Thinker ESP32-CAM") | Wi-Fi hotspot, live video, web dashboard. Sends brake settings back to the car. |

Arduino IDE settings for both: **Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)**.
No extra libraries are needed. Both compile on esp32 core 3.3.12 (2.0.x also supported).

## Wiring – main ESP32

| Part | ESP32 pin |
| --- | --- |
| L298 ENA / IN1 / IN2 | GPIO 27 / 16 / 17 (remove ENA jumper) |
| L298 ENB / IN3 / IN4 | GPIO 22 / 19 / 21 (remove ENB jumper) |
| DHT11 data | GPIO 4 |
| Gas sensor AO (10k/20k divider) | GPIO 34 |
| Gate servo signal | GPIO 25 (D25) |
| Passive buzzer | GPIO 18 (D18) |
| Relay (via NPN, HIGH = on) | GPIO 26 |
| HC-SR04 TRIG | GPIO 23 |
| HC-SR04 ECHO (1k/2k divider) | GPIO 35 |
| Link TX → CAM GPIO 13 | GPIO 32 |
| Link RX ← CAM GPIO 15 | GPIO 33 |

## Wiring – ESP32-CAM

| ESP32-CAM | Connect to |
| --- | --- |
| GPIO 13 (RX) | main ESP32 GPIO 32 |
| GPIO 15 (TX) | main ESP32 GPIO 33 |
| GND | main ESP32 GND (**must be shared**) |
| 5V | separate 5V 2A supply (not the ESP32 3.3V pin) |

The link does not use the CAM's U0R/U0T pins, so you can leave it connected while flashing.

## Using it

1. Pair the phone with Bluetooth device **RC_CAR** and connect from the RC car app.
2. Connect the laptop to Wi-Fi **ResQBot-CAM** (password `resqbot123`).
3. Open **http://192.168.4.1** – live video, sensors, safety brake controls, camera settings.

### App commands

| Key | Action |
| --- | --- |
| F B L R | forward, back, spin left, spin right |
| G I H J | forward-left, forward-right, back-left, back-right |
| S | stop (sent by the app when nothing is pressed) |
| 0–9, q | speed (0 = stopped, 1 = slowest, 9 / q = full) |
| W / w | relay motor on / off |
| U / u | gate servo open / close |
| V / v | horn on / off |
| D | stop everything (wheels, relay motor, horn) |

### Safety brake

When enabled, the car refuses or stops any forward move (F, G, I) if the sonar sees an
obstacle closer than the trigger distance, and beeps once. Reverse and spins still work so
you can back away. Forward is allowed again once the obstacle is 3 cm past the trigger.
The on/off state and the distance are saved in the car's flash and survive power-off.

### Things you may need to adjust (top of `resqbot_car.ino`)

* `LEFT_ON_B`, `INVERT_LEFT`, `INVERT_RIGHT` – motor directions (set from the Arduino tank app test).
* `MIN_PWM` – lowest duty that still turns the motors.
* `GATE_CLOSED_DEG`, `GATE_OPEN_DEG` – gate servo angles.
* `CMD_TIMEOUT_MS` – set to e.g. `1000` to auto-stop if the app stops sending (only for apps
  that send commands continuously).

### Video quality vs FPS

VGA (640×480) at quality 12 is the default and gives the best smoothness (~20–25 FPS).
SVGA/HD look sharper but run slower. QVGA/CIF are the fastest. The live FPS is shown on the video.
Only one browser tab can watch the stream at a time.
