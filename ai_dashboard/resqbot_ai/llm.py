"""LLM features: AI mission report and "Ask the rover".

Uses Claude through the official Anthropic SDK when an API key is set
(environment variable ANTHROPIC_API_KEY, or the file api_key.txt) and the
laptop has internet. Otherwise both features fall back to an offline,
rule-based answer so the dashboard always works in the field.
"""
import json
import os
import time

from . import config

try:
    import anthropic
except Exception:  # SDK not installed
    anthropic = None

ASK_SYSTEM = (
    "You are the onboard assistant of ResQBot, a small search-and-rescue rover with a camera, "
    "a DHT11 temperature/humidity sensor, an MQ gas sensor (raw ADC 0-4095), an ultrasonic sonar "
    "with an automatic safety brake, a relay-driven motor and a servo gate. A rescue operator asks "
    "you questions during a mission. Answer ONLY from the JSON mission data in the message; if "
    "something is not in the data, say you do not know. Be brief: at most four short sentences or "
    "bullets, plain language, numbers with units. When people or hazards are involved, end with one "
    "clear safety recommendation for the human rescue team."
)

REPORT_SYSTEM = (
    "You write post-mission reports for ResQBot, a search-and-rescue rover. Use ONLY the JSON "
    "mission data provided; never invent detections or readings. Write in Markdown using '##' "
    "headings and '-' bullet lists (no tables). Sections, in order: Summary (3-4 sentences), "
    "Victims and people, Environmental hazards, Detection timeline highlights (most important "
    "events with times), AI assessment (threat level, anomalies, trends), Rover status, "
    "Recommendations for the rescue team. Keep it under 450 words."
)


def _load_key():
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key and config.API_KEY_FILE.exists():
        key = config.API_KEY_FILE.read_text(encoding="utf-8").strip()
    return key or None


class RoverLLM:
    def __init__(self):
        self.model = config.LLM_MODEL
        self.key = _load_key()
        self.client = None
        if anthropic is not None and self.key:
            self.client = anthropic.Anthropic(api_key=self.key, timeout=90.0, max_retries=1)
        self.last_error = ""

    @property
    def available(self):
        return self.client is not None

    def info(self):
        return {"available": self.available, "model": self.model if self.available else None,
                "error": self.last_error,
                "reason": None if self.available else
                ("anthropic package missing" if anthropic is None else "no API key - offline answers")}

    # ------------------------------------------------------------------ Claude call
    def _call(self, system, user_text, effort):
        resp = self.client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            system=system,
            output_config={"effort": effort},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": user_text}],
        )
        if resp.stop_reason == "refusal":
            raise RuntimeError("the model declined this request")
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
        if not text:
            raise RuntimeError("empty answer")
        return text

    def _try(self, system, user_text, effort):
        """Returns (text or None, error text)."""
        if not self.available:
            return None, ""
        try:
            text = self._call(system, user_text, effort)
            self.last_error = ""
            return text, ""
        except anthropic.AuthenticationError:
            err = "API key rejected"
        except anthropic.PermissionDeniedError:
            err = "API key has no access to this model"
        except anthropic.RateLimitError:
            err = "rate limited - try again in a minute"
        except anthropic.APIConnectionError:
            err = "no internet connection"
        except anthropic.APIStatusError as e:
            err = f"API error {e.status_code}"
        except Exception as e:  # refusal, empty answer, ...
            err = str(e)[:120]
        self.last_error = err
        return None, err

    # ------------------------------------------------------------------ features
    def ask(self, question, ctx, history=None):
        convo = ""
        for h in (history or [])[-6:]:
            who = "Operator" if h.get("role") == "user" else "Rover"
            convo += f"{who}: {str(h.get('text', ''))[:600]}\n"
        user = (f"Mission data (JSON):\n{json.dumps(ctx, default=str)}\n\n"
                + (f"Earlier in this chat:\n{convo}\n" if convo else "")
                + f"Operator question: {question}")
        text, err = self._try(ASK_SYSTEM, user, "low")
        if text:
            return {"answer": text, "source": "claude", "model": self.model}
        return {"answer": offline_answer(question, ctx), "source": "offline", "note": err}

    def report(self, ctx):
        user = f"Mission data (JSON):\n{json.dumps(ctx, default=str)}\n\nWrite the mission report."
        text, err = self._try(REPORT_SYSTEM, user, "medium")
        source = "claude"
        if not text:
            text, source = offline_report(ctx), "offline"
        header = (f"# ResQBot Mission Report\n\nMission {ctx['mission_id']} - generated "
                  f"{ctx['local_time']} - duration {ctx['mission_elapsed']} - "
                  f"{'written by ' + self.model if source == 'claude' else 'offline summary (no LLM)'}\n\n")
        md = header + text.strip() + "\n"
        name = f"mission_{ctx['mission_id']}_{time.strftime('%H%M%S')}.md"
        (config.REPORT_DIR / name).write_text(md, encoding="utf-8")
        return {"markdown": md, "file": name, "source": source, "note": err}


# ---------------------------------------------------------------------- offline fallbacks
def _risk_line(ctx):
    r = ctx.get("threat_assessment") or {}
    if not r:
        return "Threat level: not available yet."
    return f"Threat level {r.get('level')} (risk index {r.get('index')}/100)."


def offline_answer(question, ctx):
    q = question.lower()
    cur = ctx.get("current_readings")
    cam = ctx.get("camera_ai_now") or {}
    parts = []
    if any(k in q for k in ("temp", "hot", "heat", "humid")):
        parts.append("No sensor data right now." if not cur else
                     f"Temperature {cur['temperature_c']} C, humidity {cur['humidity_pct']} %.")
    if any(k in q for k in ("gas", "smoke", "air", "toxic")):
        if cur:
            g = cur["gas_raw_adc"]
            lv = cur["gas_levels"]
            state = "ALARM" if g >= lv["alarm"] else "elevated" if g >= lv["warning"] else "normal"
            parts.append(f"Gas reading {g} ({state}).")
        if cam.get("objects"):
            sm = [o for o in cam["objects"] if o["label"] in ("smoke", "fire")]
            if sm:
                parts.append("Camera sees: " + ", ".join(o["label"] for o in sm) + ".")
    if any(k in q for k in ("person", "people", "victim", "human", "someone", "survivor")):
        ps = cam.get("persons") or []
        if ps:
            down = sum(1 for p in ps if p["posture"] == "down")
            parts.append(f"{len(ps)} person(s) in view" + (f", {down} lying down - possible casualty." if down else "."))
        else:
            parts.append("No person in the camera view right now.")
        parts.append(f"Persons seen this mission: up to {ctx['mission_stats']['max_persons']} at once.")
    if any(k in q for k in ("obstacle", "path", "way", "distance", "move", "drive")):
        p = ctx.get("path_advice")
        if p:
            parts.append(f"Path advice: {p['advice'].lower()} ({p['source']}).")
        if cur:
            parts.append(f"Sonar: {cur['sonar_distance_cm']}.")
    if not parts or any(k in q for k in ("safe", "status", "summary", "situation", "danger", "risk")):
        parts.insert(0, _risk_line(ctx))
        f = (ctx.get("threat_assessment") or {}).get("factors") or []
        if f:
            parts.append("Main factors: " + "; ".join(x["text"] for x in f[:3]) + ".")
    return " ".join(parts) + "  (offline answer - connect the internet and set an API key for Claude)"


def offline_report(ctx):
    s = ctx["mission_stats"]
    r = ctx.get("threat_assessment") or {}
    cur = ctx.get("current_readings") or {}
    tl = ctx.get("timeline") or []
    important = [e for e in tl if e["severity"] in ("critical", "danger", "warning")]
    lines = ["## Summary",
             f"Mission ran for {ctx['mission_elapsed']}. Highest threat level reached: "
             f"{s['max_level']}. Current: {_risk_line(ctx)}",
             "", "## Victims and people",
             f"- Up to {s['max_persons']} person(s) seen at once; {s['person_events']} detection event(s).",
             f"- Person-down (possible casualty) alerts: {s['down_events']}.",
             "", "## Environmental hazards",
             f"- Max temperature: {s['max_temp']} C; max gas reading: {s['max_gas']}.",
             f"- Fire alerts: {s['fire_events']}; hazardous object alerts: {s['hazard_events']}.",
             f"- Closest obstacle: {s['min_dist']} cm; safety-brake stops: {s['brake_events']}.",
             "", "## Detection timeline highlights"]
    lines += [f"- {e['time']} - {e['event']} ({e['severity']})" for e in important[-12:]] or ["- No warnings."]
    lines += ["", "## Rover status",
              f"- Drive time: {s['moving_time']}; snapshots saved: {s['snapshots']}.",
              f"- Latest readings: {json.dumps(cur) if cur else 'telemetry offline'}.",
              "", "## Recommendations"]
    rec = []
    if s["down_events"]:
        rec.append("Send a medical team to the location of the person-down alert first.")
    if s["fire_events"] or (s["max_gas"] or 0) >= config.GAS_ALARM:
        rec.append("Use breathing protection and fire equipment before entry.")
    if r.get("level") in ("DANGER", "CRITICAL"):
        rec.append("Do not enter without protective equipment; keep the rover as forward observer.")
    rec.append("Review the saved snapshots for exact victim and hazard positions.")
    lines += [f"- {x}" for x in rec]
    return "\n".join(lines)
