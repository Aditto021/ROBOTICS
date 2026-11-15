"""Mission brain: fuses telemetry + vision twice a second.

Produces the threat level, anomaly and trend analysis, free-path advice,
the detection timeline (events) with automatic snapshots, mission statistics
and the context that is given to the LLM.
"""
import collections
import re
import threading
import time
import traceback

import cv2
import numpy as np

from . import config
from .analytics import LEVEL_INDEX, LEVELS, AnomalyDetector, EventLog, HazardModel, trend

CMD_NAMES = {"F": "Forward", "B": "Backward", "L": "Spin left", "R": "Spin right",
             "G": "Forward-left", "I": "Forward-right", "H": "Back-left", "J": "Back-right",
             "S": "Stopped"}
PATH_BLOCK = 0.72   # relative nearness (0-1) above which a depth sector counts as blocked


def _num(v):
    try:
        if v is None:
            return None
        x = float(v)
        return None if np.isnan(x) else x
    except (TypeError, ValueError):
        return None


def _slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:24] or "snap"


def _fmt_dur(s):
    s = int(s)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


class MissionBrain(threading.Thread):
    def __init__(self, cam, tel, vision):
        super().__init__(daemon=True, name="brain")
        self.cam, self.tel, self.vision = cam, tel, vision
        self.lock = threading.Lock()
        self.hazard = HazardModel()
        self.anomaly = AnomalyDetector()
        self.events = EventLog()
        self.history = collections.deque(maxlen=900)          # 15 min at 1 Hz
        self.snapshots = collections.deque(maxlen=60)
        self.start_ts = time.time()
        self.mission_id = time.strftime("%Y%m%d_%H%M%S")
        self.snap_dir = config.SNAP_DIR / self.mission_id
        self._snap_n = 0
        self._down_hist = collections.deque(maxlen=6)
        self._probs = None
        self._last_hist = 0.0
        self._last_tick = time.time()
        self._risk_text = ""
        self._brake_ok = config.BRAKE_CM <= 0
        self._brake_try = 0.0
        self._cam_ok = config.CAM_FS <= 0
        self._cam_try = 0.0
        self.prev = {"level_idx": 0, "persons": 0, "down": False, "brk": 0,
                     "cam": None, "link": None, "anomaly": False}
        self.stats = {"max_persons": 0, "person_events": 0, "down_events": 0, "fire_events": 0,
                      "hazard_events": 0, "brake_events": 0, "max_temp": None, "max_gas": None,
                      "min_dist": None, "moving_s": 0.0, "max_level": "SAFE", "snapshots": 0}
        self.state = {}

    # ------------------------------------------------------------------ loop
    def run(self):
        self.events.add("SYSTEM", "info", "Mission started - AI dashboard online", force=True)
        while True:
            try:
                self.tick()
            except Exception:
                traceback.print_exc()
            time.sleep(0.5)

    def tick(self):
        now = time.time()
        dt = min(now - self._last_tick, 2.0)
        self._last_tick = now

        tel, _ = self.tel.snapshot()
        tel_online = self.tel.online and tel is not None
        link = bool(tel_online and tel.get("link"))
        d = tel if link else {}
        t, h = _num(d.get("t")), _num(d.get("h"))
        gas = _num(d.get("gas"))
        dist = _num(d.get("dist"))
        trig = _num(d.get("trig")) or 20.0
        if link and not self._brake_ok:
            self._apply_brake(d)
        if tel_online and not self._cam_ok:
            self._apply_camera(tel)

        vis = self.vision.get_result()
        fresh = now - vis.get("ts", 0.0) < 3.0
        persons = vis["persons"] if fresh else []
        objects = vis["objects"] if fresh else []
        n_down = sum(1 for p in persons if p["posture"] == "down")
        self._down_hist.append(n_down > 0)
        person_down = sum(self._down_hist) >= 3
        fire = max([o["conf"] for o in objects if o["label"] == "fire"], default=0.0)
        smoke = max([o["conf"] for o in objects if o["label"] == "smoke"], default=0.0)
        hazards = [o for o in objects if o["cat"] == "hazard"]
        resources = [o for o in objects if o["cat"] in ("resource", "animal")]
        flame = vis["flame_ratio"] if fresh else 0.0

        an = self.anomaly.evaluate()
        hist = list(self.history)
        trends = {"t": trend(hist, "t", config.TEMP_ALARM), "gas": trend(hist, "gas", config.GAS_ALARM)}

        feats = {
            "temp": t if t is not None else 25.0, "hum": h if h is not None else 50.0,
            "gas": gas if gas is not None else 0.0,
            "near": 1.0 if dist is not None and 0 < dist < 20 else 0.0,
            "persons": float(len(persons)), "down": 1.0 if person_down else 0.0,
            "fire": fire, "smoke": smoke, "flame": flame, "hazards": float(len(hazards)),
            "anomaly": 1.0 if an["anomaly"] else 0.0,
        }
        risk = self._smooth(self.hazard.assess(feats))
        self._risk_text = f'{risk["level"]} {risk["index"]}'
        path = self._path(vis.get("depth") if fresh else None, dist, trig)

        if now - self._last_hist >= 1.0:
            self._last_hist = now
            self.history.append({"ts": now, "t": t, "h": h, "gas": gas,
                                 "dist": dist if dist is not None and dist > 0 else None,
                                 "risk": risk["index"]})
            if t is not None and h is not None and gas is not None:
                self.anomaly.add([t, h, gas])

        self._update_stats(dt, link, d, t, gas, dist, persons, risk)
        self._make_events(link, d, t, gas, persons, person_down, fire, smoke, hazards,
                          resources, risk, an, trends, vis.get("light") if fresh else None)

        summary = {"persons": len(persons), "down": n_down, "down_confirmed": person_down,
                   "fire": round(fire, 2), "smoke": round(smoke, 2), "hazards": len(hazards),
                   "resources": len(resources), "flame": flame}
        with self.lock:
            self.state = {"risk": risk, "anomaly": an, "trend": trends, "path": path,
                          "summary": summary, "model": self.hazard.description}

    # ------------------------------------------------------------------ parts
    def _apply_brake(self, d):
        """Once per start: brake ON with the configured stop distance (default 40 cm)."""
        if int(d.get("son") or 0) == 1 and int(d.get("trig") or 0) == config.BRAKE_CM:
            self._brake_ok = True
            self.events.add("CONTROL", "info",
                            f"Safety brake on - rover stops {config.BRAKE_CM} cm before obstacles",
                            force=True)
        elif time.time() - self._brake_try > 5.0:          # retry until the car confirms
            self._brake_try = time.time()
            self.tel.send({"sonar": 1, "dist": config.BRAKE_CM})

    def _apply_camera(self, d):
        """Once per start: 30 fps video size + sharp JPEG quality (can be changed later in the gear dialog)."""
        if int(d.get("fs") or 0) == config.CAM_FS and int(d.get("q") or 0) == config.CAM_Q:
            self._cam_ok = True
            self.events.add("CONTROL", "info", "Camera set to 400x296 sharp - 30 fps video", force=True)
        elif time.time() - self._cam_try > 5.0:
            self._cam_try = time.time()
            self.tel.send({"fs": config.CAM_FS, "q": config.CAM_Q})

    def _smooth(self, risk):
        p = np.array([risk["probs"][lvl] for lvl in LEVELS])
        self._probs = p if self._probs is None else 0.55 * self._probs + 0.45 * p
        sp = self._probs / max(self._probs.sum(), 1e-9)
        idx = int(np.argmax(sp))
        risk["probs"] = {lvl: round(float(v), 3) for lvl, v in zip(LEVELS, sp)}
        risk["level_idx"] = idx
        risk["level"] = LEVELS[idx]
        risk["index"] = int(round(float(np.dot(sp, LEVEL_INDEX))))
        return risk

    def _path(self, depth, dist, trig):
        sonar = dist is not None and dist > 0
        sonar_block = sonar and dist <= max(trig, 10.0) + 10.0
        if depth is None:
            if dist is None:
                return None
            return {"left": None, "center": None, "right": None, "source": "sonar",
                    "advice": "BLOCKED" if sonar_block else "AHEAD", "sonar_block": sonar_block}
        l, c, r = depth["left"], depth["center"], depth["right"]
        if c < PATH_BLOCK and not sonar_block:
            advice = "AHEAD"
        elif min(l, r) < PATH_BLOCK:
            advice = "LEFT" if l <= r else "RIGHT"
        else:
            advice = "REVERSE"
        return {"left": l, "center": c, "right": r, "advice": advice, "sonar_block": sonar_block,
                "source": "depth AI + sonar" if dist is not None else "depth AI"}

    def _update_stats(self, dt, link, d, t, gas, dist, persons, risk):
        s = self.stats
        if link and d.get("cmd") not in (None, "S", "?") and (d.get("spd") or 0) > 0:
            s["moving_s"] += dt
        s["max_persons"] = max(s["max_persons"], len(persons))
        if t is not None:
            s["max_temp"] = t if s["max_temp"] is None else max(s["max_temp"], t)
        if gas is not None:
            s["max_gas"] = gas if s["max_gas"] is None else max(s["max_gas"], gas)
        if dist is not None and dist > 0:
            s["min_dist"] = dist if s["min_dist"] is None else min(s["min_dist"], dist)
        if LEVELS.index(risk["level"]) > LEVELS.index(s["max_level"]):
            s["max_level"] = risk["level"]

    def _make_events(self, link, d, t, gas, persons, person_down, fire, smoke, hazards,
                     resources, risk, an, trends, light):
        E, s = self.events, self.stats

        def snap(tag):
            return lambda: self._save_snapshot(tag)

        cam_online = self.cam.online
        if self.prev["cam"] is not None and cam_online != self.prev["cam"]:
            E.add("LINK", "info" if cam_online else "warning",
                  "Camera stream restored" if cam_online else "Camera stream lost",
                  key="cam", force=True)
        self.prev["cam"] = cam_online
        if self.prev["link"] is not None and link != self.prev["link"]:
            E.add("LINK", "info" if link else "warning",
                  "Rover telemetry link restored" if link else "Rover telemetry link lost",
                  key="link", force=True)
        self.prev["link"] = link

        n = len(persons)
        if n > 0 and self.prev["persons"] == 0:
            if E.add("PERSON", "warning", f"{n} person(s) detected - possible victim",
                     key="person", cooldown=20, snapshot=snap("person")):
                s["person_events"] += 1
        self.prev["persons"] = n
        if person_down and not self.prev["down"]:
            if E.add("PERSON_DOWN", "critical", "Person down - possible casualty, check immediately",
                     key="down", cooldown=20, snapshot=snap("person-down")):
                s["down_events"] += 1
        self.prev["down"] = person_down

        if fire >= 0.35 and E.add("FIRE", "critical", f"Fire detected by camera ({fire:.0%})",
                                  key="fire", cooldown=20, snapshot=snap("fire")):
            s["fire_events"] += 1
        if smoke >= 0.35:
            E.add("SMOKE", "danger", f"Smoke detected ({smoke:.0%})", key="smoke", cooldown=20,
                  snapshot=snap("smoke"))
        for o in hazards:
            if E.add("HAZARD", "warning", f"Hazard: {o['label']} ({o['conf']:.0%})",
                     key="hz:" + o["label"], cooldown=30, snapshot=snap(o["label"])):
                s["hazard_events"] += 1
        for o in resources:
            E.add("OBJECT", "info", f"Spotted: {o['label']} ({o['conf']:.0%})",
                  key="ob:" + o["label"], cooldown=60, snapshot=snap(o["label"]))

        if gas is not None:
            if gas >= config.GAS_ALARM:
                E.add("GAS", "critical", f"Gas alarm: {gas:.0f} (alarm level {config.GAS_ALARM})",
                      key="gas-alarm", cooldown=30)
            elif gas >= config.GAS_WARN:
                E.add("GAS", "warning", f"Gas elevated: {gas:.0f} (warning level {config.GAS_WARN})",
                      key="gas-warn", cooldown=30)
        if t is not None:
            if t >= config.TEMP_ALARM:
                E.add("TEMP", "danger", f"Temperature critical: {t:.1f} C", key="temp-alarm", cooldown=30)
            elif t >= config.TEMP_WARN:
                E.add("TEMP", "warning", f"Temperature high: {t:.1f} C", key="temp-warn", cooldown=30)

        if an["anomaly"] and not self.prev["anomaly"]:
            why = ", ".join(an["reasons"]) or "unusual sensor pattern"
            E.add("ANOMALY", "warning", f"Sensor anomaly: {why}", key="anomaly", cooldown=30)
        self.prev["anomaly"] = an["anomaly"]
        for key, name in (("gas", "Gas"), ("t", "Temperature")):
            x = trends.get(key)
            if x and x["eta"] is not None and x["eta"] <= 120 and x["r2"] >= 0.5:
                E.add("TREND", "warning",
                      f"{name} rising {x['slope_min']:+g}/min - alarm level in about {x['eta']} s",
                      key="trend-" + key, cooldown=60)

        brk = int(d.get("brk") or 0) if link else 0
        if brk and not self.prev["brk"]:
            if E.add("BRAKE", "warning", f"Safety brake stopped the rover (obstacle {d.get('dist')} cm)",
                     key="brake", cooldown=5):
                s["brake_events"] += 1
        self.prev["brk"] = brk

        li = risk["level_idx"]
        if li != self.prev["level_idx"]:
            up = li > self.prev["level_idx"]
            sev = ["info", "warning", "danger", "critical"][li] if up else "info"
            E.add("LEVEL", sev, f"Threat level {'raised' if up else 'lowered'} to {risk['level']}",
                  key="level", cooldown=8,
                  snapshot=snap("level-" + risk["level"].lower()) if up and li >= 2 else None)
            self.prev["level_idx"] = li

        if light and light.get("lowlight"):
            E.add("LIGHT", "info", "Low light - AI image enhancement switched on", key="light",
                  cooldown=300)

    # ------------------------------------------------------------------ snapshots
    def _save_snapshot(self, tag):
        img = self.vision.snapshot_image(header=f"{tag.upper()}   risk {self._risk_text}")
        if img is None:
            return None
        self.snap_dir.mkdir(parents=True, exist_ok=True)
        self._snap_n += 1
        name = f"{time.strftime('%H%M%S')}_{self._snap_n:03d}_{_slug(tag)}.jpg"
        cv2.imwrite(str(self.snap_dir / name), img, [cv2.IMWRITE_JPEG_QUALITY, 88])
        url = f"snapshots/{self.mission_id}/{name}"
        self.snapshots.append({"url": url, "ts": time.time(), "time": time.strftime("%H:%M:%S"),
                               "tag": tag})
        self.stats["snapshots"] += 1
        return url

    def manual_snapshot(self):
        url = self._save_snapshot("manual")
        if url:
            self.events.add("SNAPSHOT", "info", "Snapshot saved by operator", force=True, snapshot=url)
        return url

    # ------------------------------------------------------------------ outputs
    def public_state(self):
        with self.lock:
            st = dict(self.state)
        st["events"] = self.events.recent(60)
        st["snapshots"] = list(self.snapshots)[::-1][:30]
        st["stats"] = dict(self.stats)
        st["mission"] = {"id": self.mission_id, "start": self.start_ts,
                         "elapsed": time.time() - self.start_ts}
        return st

    def history_series(self, seconds=300):
        cut = time.time() - seconds
        return [x for x in self.history if x["ts"] >= cut]

    def llm_context(self):
        """Compact, factual mission picture for the LLM."""
        tel, _ = self.tel.snapshot()
        link = bool(self.tel.online and tel and tel.get("link"))
        d = tel if link else {}
        st = self.public_state()
        vis = self.vision.get_result()
        fresh = time.time() - vis.get("ts", 0) < 3
        dist = _num(d.get("dist"))
        s = st["stats"]
        return {
            "mission_id": st["mission"]["id"],
            "mission_elapsed": _fmt_dur(st["mission"]["elapsed"]),
            "local_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "connections": {"camera_stream": self.cam.online, "rover_telemetry": link,
                            "phone_bluetooth": bool(d.get("bt")) if link else None,
                            "vision_ai": self.vision.state},
            "current_readings": None if not link else {
                "temperature_c": _num(d.get("t")), "humidity_pct": _num(d.get("h")),
                "gas_raw_adc": d.get("gas"),
                "gas_levels": {"warning": config.GAS_WARN, "alarm": config.GAS_ALARM},
                "sonar_distance_cm": dist if dist and dist > 0 else "nothing in range",
                "safety_brake": {"enabled": bool(d.get("son")), "trigger_cm": d.get("trig"),
                                 "engaged_now": bool(d.get("brk"))},
                "drive_command": CMD_NAMES.get(d.get("cmd"), d.get("cmd")),
                "speed_0_to_9": d.get("spd"), "relay_motor_on": bool(d.get("shot")),
            },
            "camera_ai_now": None if not fresh else {
                "persons": [{"posture": p["posture"], "confidence": p["conf"]} for p in vis["persons"]],
                "objects": [{"label": o["label"], "category": o["cat"], "confidence": o["conf"]}
                            for o in vis["objects"]],
                "low_light": (vis.get("light") or {}).get("lowlight"),
            },
            "threat_assessment": st.get("risk"),
            "threat_model": st.get("model"),
            "sensor_anomaly": st.get("anomaly"),
            "trends": st.get("trend"),
            "path_advice": st.get("path"),
            "mission_stats": {**s, "moving_time": _fmt_dur(s["moving_s"])},
            "timeline": [{"time": e["time"], "severity": e["severity"], "event": e["message"]}
                         for e in st["events"][:40][::-1]],
        }
