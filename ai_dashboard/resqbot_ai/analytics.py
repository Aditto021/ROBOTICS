"""Machine-learning analytics on the fused sensor + vision data.

  * HazardModel     - Random-Forest classifier: SAFE / CAUTION / DANGER / CRITICAL
                      (trained at start-up on 6 000 synthetic, expert-rule-labelled
                      situations; explanations come from the same expert rules)
  * AnomalyDetector - Isolation Forest on the live temperature / humidity / gas
                      stream + z-scores that say WHICH sensor is unusual
  * trend()         - linear regression over the last 90 s -> slope, value in 60 s,
                      time until the alarm threshold is reached
"""
import collections
import time

import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split

from . import config

LEVELS = ["SAFE", "CAUTION", "DANGER", "CRITICAL"]
LEVEL_INDEX = [5, 35, 70, 95]          # risk index (0-100) attached to each level
FEATURES = ["temp", "hum", "gas", "near", "persons", "down", "fire", "smoke",
            "flame", "hazards", "anomaly"]


def rule_factors(f):
    """Expert rules -> list of (points, explanation)."""
    out = []
    if f["fire"] >= 0.35:
        out.append((4.0, f"Fire detected by camera ({f['fire']:.0%})"))
    elif f["fire"] >= 0.25:
        out.append((2.0, f"Possible fire ({f['fire']:.0%})"))
    if f["smoke"] >= 0.35:
        out.append((2.5, f"Smoke detected ({f['smoke']:.0%})"))
    elif f["smoke"] >= 0.25:
        out.append((1.2, f"Possible smoke ({f['smoke']:.0%})"))
    if f["down"]:
        out.append((3.0, "Person down - possible casualty"))
    if f["persons"] > 0:
        out.append((1.0, f"{int(f['persons'])} person(s) in view"))
    if f["gas"] >= config.GAS_ALARM:
        out.append((3.0, f"Gas at alarm level ({int(f['gas'])})"))
    elif f["gas"] >= config.GAS_WARN:
        out.append((1.5, f"Gas elevated ({int(f['gas'])})"))
    if f["temp"] >= config.TEMP_ALARM:
        out.append((3.0, f"Temperature critical ({f['temp']:.1f} C)"))
    elif f["temp"] >= config.TEMP_WARN:
        out.append((1.5, f"Temperature high ({f['temp']:.1f} C)"))
    if f["hum"] < 20 or f["hum"] > 90:
        out.append((0.5, f"Humidity extreme ({f['hum']:.0f} %)"))
    if f["flame"] >= 0.08:
        out.append((1.0, f"Flame-coloured area {f['flame']:.0%} of view"))
    if f["hazards"] > 0:
        out.append((min(f["hazards"], 2) * 0.75, f"{int(f['hazards'])} hazardous object(s)"))
    if f["near"]:
        out.append((0.5, "Obstacle very close"))
    if f["anomaly"]:
        out.append((1.5, "Sensor anomaly detected"))
    out.sort(key=lambda x: -x[0])
    return out


def rule_score(f):
    return sum(p for p, _ in rule_factors(f))


class HazardModel:
    def __init__(self, seed=7, n=6000):
        rng = np.random.default_rng(seed)
        mix = lambda p, a, b: np.where(rng.random(n) < p, a, b)  # noqa: E731
        persons = rng.choice([0, 0, 0, 1, 1, 2, 3], n)
        cols = {
            "temp": mix(0.75, rng.uniform(15, 38, n), rng.uniform(35, 60, n)),
            "hum": rng.uniform(10, 100, n),
            "gas": mix(0.6, rng.uniform(0, 1400, n), rng.uniform(1000, 4095, n)),
            "near": (rng.random(n) < 0.2).astype(float),
            "persons": persons.astype(float),
            "down": ((rng.random(n) < 0.25) & (persons > 0)).astype(float),
            "fire": mix(0.85, rng.uniform(0, 0.2, n), rng.uniform(0.2, 0.95, n)),
            "smoke": mix(0.85, rng.uniform(0, 0.2, n), rng.uniform(0.2, 0.95, n)),
            "flame": mix(0.85, rng.uniform(0, 0.05, n), rng.uniform(0.03, 0.3, n)),
            "hazards": rng.choice([0, 0, 0, 1, 1, 2, 3], n).astype(float),
            "anomaly": (rng.random(n) < 0.1).astype(float),
        }
        X = np.column_stack([cols[k] for k in FEATURES])
        scores = np.array([rule_score(dict(zip(FEATURES, row))) for row in X])
        scores = scores + rng.normal(0, 0.35, n)              # soft class borders
        y = np.digitize(scores, [1.0, 3.0, 5.5])
        Xtr, Xva, ytr, yva = train_test_split(X, y, test_size=0.2, random_state=seed, stratify=y)
        self.clf = RandomForestClassifier(n_estimators=120, max_depth=10, min_samples_leaf=3,
                                          random_state=seed, n_jobs=1)
        self.clf.fit(Xtr, ytr)
        self.accuracy = float(self.clf.score(Xva, yva))
        self.clf.fit(X, y)
        self.importances = {k: round(float(v), 3)
                            for k, v in zip(FEATURES, self.clf.feature_importances_)}
        self.description = (f"Random Forest - 120 trees, {len(FEATURES)} features, "
                            f"validation accuracy {self.accuracy:.0%}")

    def assess(self, f):
        x = np.array([[float(f[k]) for k in FEATURES]])
        p = self.clf.predict_proba(x)[0]
        probs = {lvl: 0.0 for lvl in LEVELS}
        for cls, pv in zip(self.clf.classes_, p):
            probs[LEVELS[int(cls)]] = round(float(pv), 3)
        idx = int(np.argmax([probs[lvl] for lvl in LEVELS]))
        index = sum(probs[lvl] * LEVEL_INDEX[i] for i, lvl in enumerate(LEVELS))
        factors = [{"text": t, "points": round(pts, 2)} for pts, t in rule_factors(f)[:5]]
        return {"level": LEVELS[idx], "level_idx": idx, "index": int(round(index)),
                "probs": probs, "factors": factors}


class AnomalyDetector:
    NAMES = ["Temperature", "Humidity", "Gas"]
    FLOORS = np.array([0.5, 2.0, 40.0])      # minimum spread per sensor (noise floor)

    def __init__(self):
        self.buf = collections.deque(maxlen=600)
        self.model = None
        self.last_fit = 0.0

    def add(self, vec):
        self.buf.append([float(v) for v in vec])

    def evaluate(self):
        n = len(self.buf)
        if n < 45:
            return {"ready": False, "samples": n, "score": 0.0, "anomaly": False, "reasons": []}
        X = np.array(self.buf, float)
        ref = X[-301:-1]
        now = time.time()
        if self.model is None or now - self.last_fit > 30:
            self.model = IsolationForest(n_estimators=100, contamination="auto",
                                         random_state=0).fit(ref)
            self.last_fit = now
        x = X[-1:]
        d = float(self.model.decision_function(x)[0])
        mu = ref.mean(axis=0)
        sd = np.maximum(ref.std(axis=0), self.FLOORS)
        z = (x[0] - mu) / sd
        zmax = float(np.abs(z).max())
        reasons = [f"{self.NAMES[i]} {'+' if z[i] > 0 else '-'}{abs(z[i]):.1f} sigma"
                   for i in np.argsort(-np.abs(z)) if abs(z[i]) > 2.5]
        anomaly = (d < -0.05 and zmax > 2.5) or zmax > 4.0
        return {"ready": True, "samples": n, "score": round(float(np.clip(0.5 - d, 0, 1)), 3),
                "anomaly": bool(anomaly), "reasons": reasons, "zmax": round(zmax, 2)}


def trend(history, key, threshold, window=90.0, horizon=60.0):
    now = time.time()
    pts = [(s["ts"], s[key]) for s in history if s.get(key) is not None and s["ts"] >= now - window]
    if len(pts) < 15:
        return None
    t = np.array([p[0] for p in pts]) - now
    y = np.array([p[1] for p in pts], float)
    slope, icpt = np.polyfit(t, y, 1)
    fit = slope * t + icpt
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1.0 - float(((y - fit) ** 2).sum()) / ss_tot if ss_tot > 1e-9 else 0.0
    eta = None
    if slope > 1e-6 and icpt < threshold:
        e = (threshold - icpt) / slope
        if e <= 600:
            eta = round(float(e))
    return {"now": round(float(y[-1]), 1), "slope_min": round(float(slope * 60), 2),
            "pred": round(float(icpt + slope * horizon), 1), "r2": round(max(r2, 0.0), 2),
            "eta": eta, "threshold": threshold}


class EventLog:
    def __init__(self):
        self.events = collections.deque(maxlen=500)
        self.next_id = 1
        self._last = {}

    def add(self, kind, severity, message, key=None, cooldown=15.0, snapshot=None, force=False):
        key = key or kind
        now = time.time()
        if not force and now - self._last.get(key, 0.0) < cooldown:
            return None
        self._last[key] = now
        if callable(snapshot):          # only take the picture when the event is logged
            try:
                snapshot = snapshot()
            except Exception:
                snapshot = None
        ev = {"id": self.next_id, "ts": now, "time": time.strftime("%H:%M:%S"),
              "kind": kind, "severity": severity, "message": message, "snapshot": snapshot}
        self.next_id += 1
        self.events.append(ev)
        return ev

    def recent(self, n=60):
        return list(self.events)[-n:][::-1]
