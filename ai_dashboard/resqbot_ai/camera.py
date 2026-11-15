"""Reads the ESP32-CAM MJPEG stream and the /data telemetry.

The ESP32-CAM allows only ONE stream viewer, so this app is that viewer and
re-serves the frames to any number of browser tabs (FrameHub).
"""
import collections
import re
import threading
import time

import requests

_LEN_RE = re.compile(rb"content-length:\s*(\d+)", re.I)


class FrameHub:
    """Latest JPEG per view mode ("raw", "enhanced", "depth") with wake-ups."""

    def __init__(self):
        self._cond = threading.Condition()
        self._frames = {}  # mode -> (id, jpeg, timestamp)

    def publish(self, mode, jpeg):
        with self._cond:
            fid = self._frames.get(mode, (0, None, 0.0))[0] + 1
            self._frames[mode] = (fid, jpeg, time.time())
            self._cond.notify_all()

    def get(self, mode):
        with self._cond:
            return self._frames.get(mode, (0, None, 0.0))

    def wait(self, mode, last_id, timeout):
        """Block until a frame newer than last_id arrives (or timeout)."""
        end = time.time() + timeout
        with self._cond:
            while True:
                fid, jpeg, ts = self._frames.get(mode, (0, None, 0.0))
                if jpeg is not None and fid != last_id:
                    return fid, jpeg, ts
                remaining = end - time.time()
                if remaining <= 0:
                    return fid, jpeg, ts
                self._cond.wait(remaining)


class CameraReader(threading.Thread):
    def __init__(self, url, hub):
        super().__init__(daemon=True, name="camera")
        self.url = url
        self.hub = hub
        self.frames = 0
        self.last_ts = 0.0
        self.error = "connecting"
        self.width = 0
        self.height = 0
        self._times = collections.deque(maxlen=40)
        self._session = requests.Session()

    @property
    def online(self):
        return time.time() - self.last_ts < 3.0

    @property
    def fps(self):
        t = list(self._times)
        if len(t) < 2 or time.time() - t[-1] > 2.0:
            return 0.0
        return (len(t) - 1) / max(t[-1] - t[0], 1e-6)

    def run(self):
        backoff = 1.0
        while True:
            try:
                with self._session.get(self.url, stream=True, timeout=(4, 8)) as r:
                    r.raise_for_status()
                    self.error = ""
                    backoff = 1.0
                    self._consume(r)
                self.error = "stream ended"
            except Exception as e:  # network errors, camera busy, ...
                self.error = _short(e)
            time.sleep(backoff)
            backoff = min(backoff * 1.5, 5.0)

    def _consume(self, r):
        buf = bytearray()
        for chunk in r.iter_content(chunk_size=8192):
            if not chunk:
                continue
            buf += chunk
            while True:
                jpeg, used = _extract(buf)
                if used == 0:
                    break
                del buf[:used]
                if jpeg:
                    self._publish(jpeg)
            if len(buf) > 4_000_000:  # garbage, resync
                buf.clear()

    def _publish(self, jpeg):
        now = time.time()
        self.frames += 1
        self.last_ts = now
        self._times.append(now)
        size = _jpeg_size(jpeg)
        if size:
            self.width, self.height = size
        self.hub.publish("raw", jpeg)


def _extract(buf):
    """Return (jpeg bytes or None, bytes consumed). consumed == 0 -> need more data."""
    soi = buf.find(b"\xff\xd8")
    if soi < 0:
        return None, 0
    m = None
    for m in _LEN_RE.finditer(bytes(buf[:soi])):
        pass
    if m:
        n = int(m.group(1))
        if len(buf) < soi + n:
            return None, 0
        return bytes(buf[soi:soi + n]), soi + n
    eoi = buf.find(b"\xff\xd9", soi + 2)
    if eoi < 0:
        return None, 0
    return bytes(buf[soi:eoi + 2]), eoi + 2


def _jpeg_size(jpeg):
    """Read width/height from the JPEG SOF marker without decoding."""
    i, n = 2, len(jpeg)
    while i + 9 < n:
        if jpeg[i] != 0xFF:
            i += 1
            continue
        marker = jpeg[i + 1]
        if marker == 0xFF:  # fill byte
            i += 1
            continue
        if marker in (0xC0, 0xC1, 0xC2):
            h = (jpeg[i + 5] << 8) | jpeg[i + 6]
            w = (jpeg[i + 7] << 8) | jpeg[i + 8]
            return w, h
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seg = (jpeg[i + 2] << 8) | jpeg[i + 3]
        i += 2 + seg
    return None


class TelemetryPoller(threading.Thread):
    """Polls the CAM's /data JSON and forwards settings to /set."""

    def __init__(self, data_url, set_url, interval=0.4):
        super().__init__(daemon=True, name="telemetry")
        self.data_url = data_url
        self.set_url = set_url
        self.interval = interval
        self.lock = threading.Lock()
        self.data = None
        self.ts = 0.0
        self.error = "connecting"
        self._session = requests.Session()

    @property
    def online(self):
        return time.time() - self.ts < 3.0

    def snapshot(self):
        with self.lock:
            return (dict(self.data) if self.data else None), self.ts

    def run(self):
        while True:
            t0 = time.time()
            try:
                r = self._session.get(self.data_url, timeout=1.5)
                r.raise_for_status()
                d = r.json()
                with self.lock:
                    self.data = d
                    self.ts = time.time()
                self.error = ""
            except Exception as e:
                self.error = _short(e)
            time.sleep(max(0.05, self.interval - (time.time() - t0)))

    def send(self, params):
        try:
            r = self._session.get(self.set_url, params=params, timeout=2.5)
            return r.ok, r.text[:80]
        except Exception as e:
            return False, _short(e)


def _short(e):
    s = str(e) or e.__class__.__name__
    if "Max retries" in s or "ConnectTimeout" in s or "NewConnectionError" in s:
        return "camera not reachable"
    if "Read timed out" in s:
        return "camera not responding"
    return s[:120]
