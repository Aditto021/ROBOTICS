# ResQBot AI Mission Control

A one-screen control dashboard with AI for the ResQBot rover. It runs on the laptop and
uses the ESP32-CAM exactly as it is. **The ESP32 and ESP32-CAM firmware is not changed.**

```
ESP32 (car) --UART--> ESP32-CAM --Wi-Fi "ResQBot-CAM"--> laptop: app.py (AI) --> browser dashboard
                        :81/stream  video                  YOLO / MiDaS / scikit-learn / Claude
                        :80/data    sensors                http://127.0.0.1:5000
                        :80/set     brake + camera settings
```

## AI features

| Feature | How it works |
| --- | --- |
| Victim / person detection | YOLO11n-pose finds people and 17 body keypoints (skeleton on the video) |
| "Person down" alert | Torso angle from the keypoints + box shape -> upright / down; confirmed over 3 of 6 frames |
| Fire and smoke detection | YOLO-World v2 (open vocabulary) with the classes "fire" and "smoke" + a flame-colour index |
| Hazard and resource objects | YOLO-World: gas cylinder, knife, broken glass, electric cable, fire extinguisher, first aid kit, ... (`resqbot_ai/vocab.py`) |
| Free-path / obstacle depth | MiDaS v2.1 small (ONNX) depth map -> left / centre / right nearness, fused with the sonar -> steering advice |
| Low-light enhancement | CLAHE + gamma + sharpening; the AI runs on the enhanced image automatically when it is dark |
| Threat level classifier | Random Forest (scikit-learn): SAFE / CAUTION / DANGER / CRITICAL with class probabilities and the main factors |
| Sensor anomaly detection | Isolation Forest on temperature, humidity and gas + z-scores that name the unusual sensor |
| Trend prediction | Linear regression over 90 s: slope, value in 60 s, seconds until the alarm level |
| Detection timeline | Every alert with time and severity; automatic snapshots with the detections drawn in |
| Voice alerts | The browser reads critical alerts aloud (offline Windows voices); toggle with the speaker button or V |
| AI mission report | Claude writes a structured report from the mission data (offline summary if there is no internet) |
| Ask the rover | Chat with Claude about the live mission data (offline keyword answers if there is no internet) |

About the threat model: it is trained at start-up on 6 000 synthetic situations labelled by
expert safety rules (fire, gas, temperature, people down, ...). It learns those rules into a
probabilistic classifier, so it gives smooth probabilities instead of hard thresholds. The
validation accuracy is shown on the dashboard.

## 1. One-time setup (needs internet, about 1.5 GB)

Double-click **`setup.bat`**. Everything is installed into `D:\Softwares\resqbot-ai`
(Python 3.12, PyTorch CPU, Ultralytics, ONNX Runtime, OpenCV, scikit-learn, Flask, Anthropic SDK)
and the models are downloaded into `ai_dashboard\models`. Nothing is written to drive C:.
If a step fails (internet), just run it again.

## Automatic start (nothing to double-click)

The dashboard starts by itself, hidden, every time you sign in to Windows, and works fully
offline. Just open **<http://127.0.0.1:5000>** in the browser (bookmark it). If the rover is not
on yet it shows NO SIGNAL and connects by itself as soon as the laptop Wi-Fi is on ResQBot-CAM.

* `autostart.vbs` - starts `server.bat` with no window (skips if it is already running)
* `server.bat` - runs the dashboard offline and restarts it if it ever stops
  (log: `mission_data\server.log`)
* `stop_dashboard.bat` - stops it until the next sign-in
* The sign-in entry is the registry value `ResQBotDashboard` under
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. Remove it with:
  `reg delete HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v ResQBotDashboard /f`

## 2. Run it by hand with the robot

1. Power the rover. Connect the laptop Wi-Fi to **ResQBot-CAM** (password `resqbot123`).
2. Double-click **`start.bat`**. The dashboard opens at <http://127.0.0.1:5000>.
3. Drive with the Arduino tank app on the phone as before.

Do **not** open the old page at 192.168.4.1 at the same time: the ESP32-CAM can only send
video to one viewer, and the AI dashboard is that viewer (it then shares the video with any
number of browser tabs).

## 3. Claude (mission report + Ask the rover)

1. Put your Anthropic API key in a file named `api_key.txt` in this folder
   (or set the `ANTHROPIC_API_KEY` environment variable). The file is ignored by git.
2. The laptop needs internet *while* its Wi-Fi is on ResQBot-CAM: use USB tethering from a
   phone or an Ethernet cable.

Without a key or internet both features still work with offline, rule-based answers.
The model is `claude-opus-5-5`; change it with the `RESQBOT_LLM_MODEL` environment variable.

## Test without the robot

* **`start_mock.bat`** - simulated ESP32-CAM: laptop webcam (or a synthetic scene) and
  simulated sensors with a gas spike and heat event every 2.5 minutes. Stand in front of the
  webcam to test person detection; lie down to test the "person down" alert.
  `start_mock.bat my_video.mp4` uses a video file instead.

## Using the dashboard

* The whole dashboard fits one screen (tested 1280x609 up to 1920x969) - no page scrolling.
* **Left:** big live video with the AI overlay (boxes, labels, skeleton) and a HUD: FPS, view,
  threat level, free-path advice, sonar distance, what is in view, and a red banner when the
  safety brake stops the rover. The gear button opens the camera settings (resolution, quality,
  flash, flip, mirror).
* **Right:** sensors, rover (drive command, speed, relay, sonar brake), camera vision AI
  (risk gauge, threat level with class probabilities, people / down / fire / hazard counters,
  detections, free path), and tabs for Alerts, Trends (anomaly, forecast, 4 live charts),
  Snapshots, Ask AI and Mission (statistics and saved reports).
* Video views: **Live**, **Enhanced** (low-light AI), **Depth** (AI depth map). Keys: 1 / 2 / 3.
* S = snapshot, F = full-screen video, V = voice alerts on/off, Esc = close a dialog.

## Sonar safety stop (40 cm)

When the dashboard connects to the rover it switches the sonar brake on and sets the stop
distance to **40 cm** (it retries until the car confirms). The car then refuses to drive
forward, and stops if it is already moving, when something is closer than 40 cm. Reverse
and spinning still work, so you can back away. The car keeps the setting in its flash memory.
Change it any time with the **Stop at** slider, or set `RESQBOT_BRAKE_CM` (0 = leave it alone).
This uses the brake that is already in the car firmware - the firmware is not changed.
* Saved files: `mission_data/snapshots/<mission>/` and `mission_data/reports/`.

## Settings (environment variables, optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `RESQBOT_CAM` | `192.168.4.1` | camera address |
| `RESQBOT_AI_IMGSZ` | `320` | AI input size; 416 or 480 is more accurate but slower |
| `RESQBOT_CAM_FS` / `RESQBOT_CAM_Q` | `6` / `10` | camera size (6 = 400x296) and JPEG quality set on connect; `RESQBOT_CAM_FS=0` = don't change |
| `RESQBOT_VIDEO_FPS` | `30` | frame rate sent to the browser |
| `RESQBOT_AI_THREADS` | `0` | CPU threads for the AI (0 = half) |
| `RESQBOT_GAS_WARN` / `RESQBOT_GAS_ALARM` | `1500` / `2500` | gas levels (raw ADC) |
| `RESQBOT_TEMP_WARN` / `RESQBOT_TEMP_ALARM` | `38` / `45` | temperature levels (C) |
| `RESQBOT_BRAKE_CM` | `40` | sonar stop distance set when the dashboard connects (0 = don't change) |
| `RESQBOT_PORT` | `5000` | dashboard port |

## Performance

* **Video: steady 30 fps.** When the dashboard connects it sets the camera once to
  400x296 (CIF) at JPEG quality 10 - the largest size the OV2640 sensor delivers at 30+ fps
  (640x480 tops out around 20-25 fps). The dashboard sends the video to the browser at a
  fixed 30 fps. You can still pick another size in the camera settings (gear button).
* **AI on the laptop CPU** (Intel i3-6100U, no GPU): about 1 analysis per second. People are
  checked every analysis, fire/hazards every 2nd, depth every 3rd; results carry over so the
  boxes never blink. The AI uses half the CPU threads so the video always stays smooth.
* The **Enhanced** view is made from the live video at full frame rate.
* Black video with "The laptop is on the Wi-Fi ..." = Windows switched to another network
  (ResQBot-CAM has no internet). For the presentation, turn off "Connect automatically" for your other
  Wi-Fi networks and turn it on for ResQBot-CAM.

## Files

```
app.py               web server + API
resqbot_ai/camera.py MJPEG stream reader, telemetry poller
resqbot_ai/vision.py YOLO pose, YOLO-World, MiDaS depth, enhancement
resqbot_ai/analytics.py  Random Forest, Isolation Forest, trends, event log
resqbot_ai/brain.py  sensor + vision fusion, alerts, snapshots, mission stats
resqbot_ai/llm.py    Claude report / chat with offline fallback
resqbot_ai/vocab.py  YOLO-World classes and categories
static/              dashboard (HTML, CSS, JS - works offline, no CDN)
mock_cam.py          ESP32-CAM simulator
setup.bat / start.bat / start_mock.bat / env.bat
```
