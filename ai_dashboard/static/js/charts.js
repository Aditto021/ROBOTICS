/* Small canvas line chart: single series, recessive grid, threshold lines,
   gaps for missing data, crosshair + tooltip on hover. No external libraries. */
(function () {
  'use strict';
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function niceStep(span, n) {
    const raw = span / Math.max(n, 1);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  class LineChart {
    constructor(host, opts) {
      this.host = host;
      this.o = Object.assign({
        min: null, max: null, floor: null, minSpan: 1, decimals: 1, unit: '',
        window: 300, thresholds: [], name: ''
      }, opts || {});
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('role', 'img');
      this.canvas.setAttribute('aria-label', (this.o.name || 'chart') + ', last 5 minutes');
      this.tip = document.createElement('div');
      this.tip.className = 'ctip';
      host.append(this.canvas, this.tip);
      this.data = [];
      this.now = Date.now() / 1000;
      this.hoverX = null;
      new ResizeObserver(() => this.draw()).observe(host);
      this.canvas.addEventListener('mousemove', e => {
        this.hoverX = e.clientX - this.canvas.getBoundingClientRect().left;
        this.draw();
      });
      this.canvas.addEventListener('mouseleave', () => { this.hoverX = null; this.draw(); });
    }

    set(points, now) {           // points: [{ts, v}] with v === null for gaps
      this.data = points;
      this.now = now || Date.now() / 1000;
      this.draw();
    }

    draw() {
      const o = this.o, w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
      }
      const c = this.canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      const colLine = tok('--accent'), grid = tok('--line'), base = tok('--line-2'), muted = tok('--muted'),
        ink = tok('--ink'), surface = tok('--panel');
      const pad = { l: 36, r: 10, t: 8, b: 17 };
      const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
      if (pw < 20 || ph < 20) return;
      const x0 = this.now - o.window;
      const pts = this.data.filter(p => p.ts >= x0 - 2);
      const vals = pts.filter(p => p.v !== null && p.v !== undefined).map(p => p.v);

      let lo = o.min, hi = o.max;
      if (lo === null) lo = vals.length ? Math.min(...vals) : 0;
      if (hi === null) hi = vals.length ? Math.max(...vals) : lo + o.minSpan;
      if (o.floor !== null) lo = Math.min(lo, o.floor);
      if (hi - lo < o.minSpan) { const m = (hi + lo) / 2; lo = m - o.minSpan / 2; hi = m + o.minSpan / 2; }
      if (o.min === null || o.max === null) {
        const step = niceStep(hi - lo, 2);
        if (o.min === null) lo = Math.floor(lo / step) * step;
        if (o.max === null) hi = Math.ceil((hi + step * 0.15) / step) * step;
      }
      if (o.min !== null) lo = Math.max(lo, o.min);
      const X = t => pad.l + (t - x0) / o.window * pw;
      const Y = v => pad.t + (1 - (v - lo) / (hi - lo || 1)) * ph;

      // grid + y labels
      c.font = '10px ' + tok('--sans');
      c.textBaseline = 'middle';
      c.fillStyle = muted;
      c.lineWidth = 1;
      const step = niceStep(hi - lo, 2);
      for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
        const y = Math.round(Y(v)) + 0.5;
        c.strokeStyle = Math.abs(v - lo) < 1e-9 ? base : grid;
        c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke();
        c.textAlign = 'right';
        c.fillText(Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : +v.toFixed(2), pad.l - 5, y);
      }
      // x labels
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left'; c.fillText('-5 min', pad.l, h - 4);
      c.textAlign = 'right'; c.fillText('now', w - pad.r, h - 4);

      // thresholds (dashed hairlines in status colour, label in muted ink)
      for (const th of o.thresholds) {
        if (th.v < lo || th.v > hi) continue;
        const y = Math.round(Y(th.v)) + 0.5;
        c.strokeStyle = th.color; c.setLineDash([4, 3]);
        c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke();
        c.setLineDash([]);
        c.fillStyle = muted; c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.fillText(th.label, w - pad.r - 2, y - 2);
      }

      // series: area + 2px line, broken at gaps
      const segs = [];
      let cur = [];
      for (const p of pts) {
        if (p.v === null || p.v === undefined) { if (cur.length) segs.push(cur); cur = []; continue; }
        if (cur.length && p.ts - cur[cur.length - 1].ts > 5) { segs.push(cur); cur = []; }
        cur.push(p);
      }
      if (cur.length) segs.push(cur);
      c.save();
      c.beginPath(); c.rect(pad.l, pad.t - 2, pw, ph + 4); c.clip();
      for (const s of segs) {
        c.beginPath();
        s.forEach((p, i) => i ? c.lineTo(X(p.ts), Y(p.v)) : c.moveTo(X(p.ts), Y(p.v)));
        c.lineTo(X(s[s.length - 1].ts), Y(lo)); c.lineTo(X(s[0].ts), Y(lo)); c.closePath();
        c.globalAlpha = 0.12; c.fillStyle = colLine; c.fill(); c.globalAlpha = 1;
        c.beginPath();
        s.forEach((p, i) => i ? c.lineTo(X(p.ts), Y(p.v)) : c.moveTo(X(p.ts), Y(p.v)));
        c.strokeStyle = colLine; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
      }
      c.restore();
      const last = segs.length ? segs[segs.length - 1].slice(-1)[0] : null;
      if (last) this._dot(c, X(last.ts), Y(last.v), 3, colLine, surface);

      // hover
      this.tip.style.display = 'none';
      if (this.hoverX !== null && pts.length) {
        const t = x0 + (this.hoverX - pad.l) / pw * o.window;
        let best = null;
        for (const p of pts) if (p.v !== null && p.v !== undefined && (!best || Math.abs(p.ts - t) < Math.abs(best.ts - t))) best = p;
        if (best && Math.abs(best.ts - t) < 10) {
          const x = Math.round(X(best.ts)) + 0.5;
          c.strokeStyle = base; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x, pad.t); c.lineTo(x, pad.t + ph); c.stroke();
          this._dot(c, X(best.ts), Y(best.v), 4, colLine, surface);
          const time = new Date(best.ts * 1000).toLocaleTimeString([], { hour12: false });
          this.tip.innerHTML = `<span>${time}</span>${best.v.toFixed(o.decimals)} ${o.unit}`;
          this.tip.style.display = 'block';
          const tw = this.tip.offsetWidth;
          this.tip.style.left = Math.min(Math.max(x - tw / 2, 0), w - tw) + 'px';
          this.tip.style.top = '2px';
        }
      }
      void ink;
    }

    _dot(c, x, y, r, fill, ring) {
      c.beginPath(); c.arc(x, y, r + 2, 0, Math.PI * 2); c.fillStyle = ring; c.fill();
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
    }
  }

  window.LineChart = LineChart;
})();
