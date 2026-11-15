/* ResQBot AI Mission Control - front end.
   Polls api/state (300 ms) and api/history (2 s); draws AI overlays on the video. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- API
  const getJSON = u => fetch(u, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const postJSON = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
    .then(r => r.json());
  const api = {
    state: () => getJSON('api/state'),
    history: () => getJSON('api/history?s=300'),
    set: q => getJSON('api/set?' + q),
    post: (p, b) => postJSON(p, b),
  };

  // ---------------------------------------------------------------- constants
  const LV = {
    SAFE: { cls: 'good', icon: 'i-good', color: 'var(--good)' },
    CAUTION: { cls: 'warn', icon: 'i-warn', color: 'var(--warn)' },
    DANGER: { cls: 'serious', icon: 'i-warn', color: 'var(--serious)' },
    CRITICAL: { cls: 'crit', icon: 'i-crit', color: 'var(--crit)' },
  };
  const SEV = {
    info: { cls: 'info', icon: 'i-info', label: 'Info' },
    warning: { cls: 'warn', icon: 'i-warn', label: 'Warning' },
    danger: { cls: 'serious', icon: 'i-warn', label: 'Danger' },
    critical: { cls: 'crit', icon: 'i-crit', label: 'Critical' },
  };
  const CAT = {
    person: '#38bdf8', down: '#f43f5e', critical: '#f43f5e', hazard: '#fb8a4c',
    resource: '#2ed47a', obstacle: '#94a3b8', animal: '#a78bfa', object: '#94a3b8',
  };
  const CMD = { F: 'Forward', B: 'Backward', L: 'Spin left', R: 'Spin right', G: 'Forward-left',
    I: 'Forward-right', H: 'Back-left', J: 'Back-right', S: 'Stopped' };
  const PATH_TXT = { AHEAD: '▲ Ahead is clear', LEFT: '◄ Go left', RIGHT: 'Go right ►',
    REVERSE: '▼ Blocked - reverse', BLOCKED: '■ Obstacle ahead' };
  const VIEW_LBL = { raw: 'RAW', enhanced: 'ENHANCED', depth: 'DEPTH AI' };

  const icon = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const status = (cls, ic, text) => `<span class="st ${cls}">${icon(ic)}<span>${esc(text)}</span></span>`;
  const fmtDur = s => { s = Math.max(0, Math.floor(s)); return [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60].map(x => String(x).padStart(2, '0')).join(':'); };
  const pct = v => Math.round((v || 0) * 100) + '%';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rq.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('rq.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  let S = null, recvT = 0, view = 'raw', vidRetry = null;
  const lock = {};
  const locked = k => (lock[k] || 0) > Date.now();
  const hold = k => { lock[k] = Date.now() + 2500; };

  // ---------------------------------------------------------------- video
  const img = $('video'), frame = $('frame'), stage = $('stage'), ov = $('overlay');
  function startVideo() {
    clearTimeout(vidRetry);
    img.src = `video?mode=${view}&t=${Date.now()}`;
  }
  img.addEventListener('error', () => { clearTimeout(vidRetry); vidRetry = setTimeout(startVideo, 1500); });
  let lastAR = 0;
  function aspect() {
    if (img.naturalWidth && img.naturalHeight) return img.naturalWidth / img.naturalHeight;
    if (S && S.cam && S.cam.w && S.cam.h) return S.cam.w / S.cam.h;
    return 4 / 3;
  }
  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const ar = aspect();
    lastAR = ar;
    let w = W, h = W / ar;
    if (h > H) { h = H; w = H * ar; }
    frame.style.width = Math.floor(w) + 'px';
    frame.style.height = Math.floor(h) + 'px';
  }
  new ResizeObserver(fit).observe(stage);

  function setView(m) {
    view = m;
    document.querySelectorAll('#viewSeg button').forEach(b => {
      b.classList.toggle('on', b.dataset.mode === m);
      b.setAttribute('aria-selected', b.dataset.mode === m);
    });
    $('hudMode').textContent = VIEW_LBL[m];
    startVideo();
  }
  document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
  $('btnFull').addEventListener('click', toggleFull);
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
  }

  // AI overlay on the video (boxes, labels, skeleton)
  const SKEL = [[5, 7], [7, 9], [6, 8], [8, 10], [5, 6], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 1], [0, 2], [1, 3], [2, 4]];
  function drawOverlay() {
    requestAnimationFrame(drawOverlay);
    if (aspect() !== lastAR) fit();
    const w = frame.clientWidth, h = frame.clientHeight, dpr = window.devicePixelRatio || 1;
    if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); }
    const c = ov.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    if (!S || !$('ovBoxes').checked || view === 'depth') return;
    const r = S.ai && S.ai.result;
    if (!r || r.age === null || r.age === undefined) return;
    const age = r.age + (performance.now() - recvT) / 1000;
    if (age > 2.5) return;
    c.globalAlpha = age < 1 ? 1 : Math.max(0, 1 - (age - 1) / 1.5);
    c.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
    for (const o of r.objects || []) box(c, o.box, w, h, CAT[o.cat] || CAT.object, `${o.label} ${pct(o.conf)}`);
    for (const p of r.persons || []) {
      const col = p.posture === 'down' ? CAT.down : CAT.person;
      if (p.kps && p.kps.length) {
        c.strokeStyle = col; c.lineWidth = 2;
        for (const [a, b] of SKEL) {
          const A = p.kps[a], B = p.kps[b];
          if (A && B && A[2] > 0.4 && B[2] > 0.4) { c.beginPath(); c.moveTo(A[0] * w, A[1] * h); c.lineTo(B[0] * w, B[1] * h); c.stroke(); }
        }
        c.fillStyle = col;
        for (const k of p.kps) if (k[2] > 0.4) { c.beginPath(); c.arc(k[0] * w, k[1] * h, 2.5, 0, 7); c.fill(); }
      }
      box(c, p.box, w, h, col, `${p.posture === 'down' ? 'PERSON DOWN' : 'Person'} ${pct(p.conf)}`);
    }
    c.globalAlpha = 1;
  }
  function box(c, b, w, h, col, text) {
    const x1 = b[0] * w, y1 = b[1] * h, x2 = b[2] * w, y2 = b[3] * h;
    c.strokeStyle = col; c.lineWidth = 2;
    c.strokeRect(x1, y1, x2 - x1, y2 - y1);
    const tw = c.measureText(text).width + 16, th = 17, ly = y1 - th - 2 < 0 ? y1 + 2 : y1 - th - 2;
    c.fillStyle = 'rgba(3,10,18,.8)'; c.fillRect(x1, ly, tw, th);
    c.fillStyle = col; c.fillRect(x1, ly, 4, th);
    c.fillStyle = '#e8f3ff'; c.textBaseline = 'middle'; c.fillText(text, x1 + 9, ly + th / 2 + 0.5);
  }

  // ---------------------------------------------------------------- render
  function chip(id, cls, valId, val, title) {
    const el = $(id);
    el.className = 'chip ' + cls;
    if (valId) $(valId).textContent = val;
    el.title = title || '';
  }

  function render() {
    const tel = S.tel || {}, d = tel.data || {}, L = !!(tel.online && d.link), lim = S.limits || {};
    chip('chipCam', S.cam.online ? 'ok' : 'bad', 'chipCamV', S.cam.online ? `${S.cam.fps.toFixed(0)} fps` : 'offline', S.cam.error);
    chip('chipCar', L ? 'ok' : tel.online ? 'warn' : 'bad', null, null,
      tel.online ? (L ? 'Sensor data from the rover' : 'Camera reachable, rover link lost') : (tel.error || 'ESP32-CAM not reachable'));
    const ai = S.ai || {};
    chip('chipAi', ai.state === 'running' ? 'ok' : ai.state === 'unavailable' ? 'bad' : 'warn', 'chipAiV',
      ai.state === 'running' ? `${(ai.fps || 0).toFixed(1)} fps` : ai.state, ai.message);
    chip('chipLlm', S.llm.available ? 'ok' : 'warn', 'chipLlmV', S.llm.available ? 'online' : 'offline',
      S.llm.available ? S.llm.model + (S.llm.error ? ' - ' + S.llm.error : '') : S.llm.reason);
    $('missionTime').textContent = fmtDur(S.mission.elapsed);

    renderSensors(L, d, lim, tel);
    renderRover(L, d);
    renderControls(L, d);
    renderVideo(L, d);
    renderVision();
    renderTrends();
    renderAlerts();
    renderSnaps();
    renderMission();
  }

  function tile(k, value, stHtml, meterPct, meterColor) {
    $('v' + k).textContent = value;
    $('s' + k).innerHTML = stHtml;
    $('m' + k).style.width = Math.max(0, Math.min(100, meterPct)) + '%';
    $('m' + k).style.background = meterColor || 'var(--accent)';
  }
  function renderSensors(L, d, lim, tel) {
    $('envAge').textContent = L ? 'live' : tel.online ? 'rover link lost' : 'camera offline';
    if (!L) { ['T', 'H', 'G', 'D'].forEach(k => tile(k, '--', status('info', 'i-info', 'No data'), 0)); $('uD').textContent = 'cm'; return; }
    const t = d.t, h = d.h;
    if (t === null || t === undefined) tile('T', '--', status('warn', 'i-warn', 'Sensor error'), 0);
    else {
      const [c, i, x, col] = t >= lim.temp_alarm ? ['crit', 'i-crit', 'Critical', 'var(--crit)'] : t >= lim.temp_warn ? ['serious', 'i-warn', 'High', 'var(--serious)'] : ['good', 'i-good', 'Normal', 'var(--good)'];
      tile('T', t.toFixed(1), status(c, i, x), t / 60 * 100, col);
    }
    if (h === null || h === undefined) tile('H', '--', status('warn', 'i-warn', 'Sensor error'), 0);
    else {
      const ext = h < 20 || h > 90;
      tile('H', Math.round(h), ext ? status('warn', 'i-warn', 'Extreme') : status('good', 'i-good', 'Normal'), h, ext ? 'var(--warn)' : 'var(--accent)');
    }
    const g = d.gas;
    const [gc, gi, gt, gcol] = g >= lim.gas_alarm ? ['crit', 'i-crit', 'Alarm', 'var(--crit)'] : g >= lim.gas_warn ? ['warn', 'i-warn', 'Elevated', 'var(--warn)'] : ['good', 'i-good', 'Normal', 'var(--good)'];
    tile('G', g, status(gc, gi, gt), g / 4095 * 100, gcol);
    const dist = d.dist, trig = d.trig || 40;
    if (dist > 0) {
      $('uD').textContent = 'cm';
      const [dc, di, dt, dcol] = dist <= trig ? ['crit', 'i-crit', 'Too close - stop', 'var(--crit)'] : dist <= trig * 1.5 ? ['warn', 'i-warn', 'Close', 'var(--warn)'] : ['good', 'i-good', 'Clear', 'var(--good)'];
      tile('D', dist, status(dc, di, dt), dist / 200 * 100, dcol);
    } else {
      $('uD').textContent = '';
      tile('D', 'Clear', status('good', 'i-good', 'Nothing in range'), 100, 'var(--good)');
    }
  }

  function renderRover(L, d) {
    document.querySelectorAll('#dpad b').forEach(b => b.classList.toggle('on', L && b.dataset.c === d.cmd));
    $('vCmd').textContent = L ? (CMD[d.cmd] || d.cmd) : '--';
    const spd = L ? d.spd : 0;
    $('vSpd').textContent = L ? (spd >= 10 ? 'MAX' : `${spd} / 9`) : '--';
    document.querySelectorAll('#speedBar i').forEach((el, i) => el.classList.toggle('on', L && i < Math.min(spd, 9)));
    $('vRelay').innerHTML = !L ? '--' : d.shot ? status('good', 'i-good', 'ON') : 'Off';
    $('vBt').textContent = L ? (d.bt ? 'phone connected' : 'waiting for phone') : '--';
    $('vBrk').innerHTML = !L ? '--' : !d.son ? status('warn', 'i-warn', 'Off') : d.brk ? status('crit', 'i-crit', 'STOPPED') : status('good', 'i-good', 'On');
  }

  function renderControls(L, d) {
    if (L && !locked('son')) $('cSon').checked = !!d.son;
    if (L && !locked('trig')) { $('cTrig').value = d.trig; $('cTrigV').textContent = d.trig + ' cm'; }
    if (S.tel.online && !locked('cam')) {
      if (d.fs !== undefined) $('cFs').value = d.fs;
      if (d.q !== undefined) { $('cQ').value = d.q; $('cQV').textContent = d.q; }
      $('cVf').checked = !!d.vf; $('cHm').checked = !!d.hm;
    }
    if (S.tel.online && !locked('flash') && d.flash !== undefined) { $('cFl').value = d.flash; $('cFlV').textContent = d.flash; }
    $('camTag').textContent = S.tel.online ? (d.streaming ? `${(d.fps || 0).toFixed(0)} fps on camera` : 'idle') : 'offline';
  }

  function renderVideo(L, d) {
    const cam = S.cam, r = S.ai.result || {};
    $('hudFps').textContent = `${cam.fps.toFixed(0)} FPS`;
    $('noSignal').classList.toggle('show', !cam.online);
    if (!cam.online) {
      const w = cam.wifi;
      $('noSignalMsg').textContent = w === '' ? 'The laptop Wi-Fi is not connected. Connect it to "ResQBot-CAM" (password resqbot123).'
        : w && w !== 'ResQBot-CAM' ? `The laptop is on ${w === 'another network' ? 'another Wi-Fi network' : `the Wi-Fi "${w}"`}, not the rover. Switch the Wi-Fi to "ResQBot-CAM" - the video starts by itself.`
        : `Waiting for the ResQBot-CAM video stream${cam.error ? ' - ' + cam.error : ''}. Is the rover switched on?`;
    }
    $('vidInfo').textContent = cam.w ? `${cam.w}×${cam.h}` : '--';
    if (S.risk) {
      const lv = LV[S.risk.level], el = $('hudLevel');
      el.innerHTML = `${icon(lv.icon)}${S.risk.level}`;
      el.style.borderColor = lv.color; el.style.color = lv.color;
    }
    $('hudBrake').classList.toggle('show', L && !!d.son && !!d.brk);
    const p = S.path;
    $('hudPath').textContent = 'PATH ' + (p ? (PATH_TXT[p.advice] || p.advice).toUpperCase() : '--');
    $('hudDist').textContent = !L ? 'SONAR --' : d.dist > 0 ? `SONAR ${d.dist} CM` : 'SONAR CLEAR';
    const sum = S.summary || {}, fresh = r.age !== null && r.age !== undefined && r.age < 3, pills = [];
    if (fresh && sum.persons) pills.push(`${sum.persons} PERSON${sum.persons > 1 ? 'S' : ''}`);
    if (fresh && sum.down) pills.push(`${sum.down} DOWN`);
    if (fresh && sum.hazards) pills.push(`${sum.hazards} HAZARD${sum.hazards > 1 ? 'S' : ''}`);
    if (fresh && Math.max(sum.fire || 0, sum.smoke || 0) >= 0.35) pills.push('FIRE / SMOKE');
    const html = pills.map(t => `<span class="pill">${t}</span>`).join('');
    if ($('hudCounts').innerHTML !== html) $('hudCounts').innerHTML = html;
  }

  function renderMission() {
    const s = S.stats || {}, fmt = (v, u, dec = 0) => v === null || v === undefined ? '--' : `${(+v).toFixed(dec)}${u}`;
    const rows = [
      ['Most people seen', s.max_persons ?? 0], ['Person alerts', s.person_events ?? 0], ['Person down', s.down_events ?? 0],
      ['Fire alerts', s.fire_events ?? 0], ['Hazard alerts', s.hazard_events ?? 0], ['Brake stops', s.brake_events ?? 0],
      ['Max temperature', fmt(s.max_temp, ' °C', 1)], ['Max gas', fmt(s.max_gas, '')], ['Closest obstacle', fmt(s.min_dist, ' cm')],
      ['Time moving', fmtDur(s.moving_s || 0)], ['Highest threat', s.max_level || '--'], ['Snapshots', s.snapshots ?? 0],
    ];
    const html = rows.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('');
    if ($('stats').innerHTML !== html) $('stats').innerHTML = html;
    $('modelTag').textContent = S.model ? 'Threat model: ' + S.model : '';
  }

  async function loadReports() {
    const list = await getJSON('api/reports').catch(() => null);
    if (!list) return;
    $('replist').innerHTML = list.length ? list.map(r => `<li><a href="reports/${encodeURIComponent(r.file)}" target="_blank" rel="noopener">${esc(r.file)}</a><span class="muted">${esc(r.time)}</span></li>`).join('')
      : '<li class="muted">No reports yet - press "New report"</li>';
  }

  function renderVision() {
    const r = S.risk, sum = S.summary || {}, res = S.ai.result || {}, ai = S.ai;
    if (r) {
      const lv = LV[r.level], b = $('lvlBox');
      b.className = 'lvl ' + lv.cls;
      b.querySelector('use').setAttribute('href', '#' + lv.icon);
      $('lvlText').textContent = r.level;
      $('riskIdx').textContent = r.index;
      const arc = $('ringArc');
      arc.style.strokeDasharray = `${(197.9 * Math.max(0, Math.min(100, r.index)) / 100).toFixed(1)} 263.9`;
      arc.style.stroke = lv.color;
      arc.style.color = lv.color;
      const fs = r.factors || [];
      $('reason').textContent = fs.length ? fs.slice(0, 2).map(x => x.text).join(' · ') : 'All clear - no threats detected';
      $('reason').title = fs.map(x => x.text).join('\n');
      for (const k of Object.keys(LV)) {
        const p = (r.probs || {})[k] || 0;
        $('pr' + k).style.width = (p * 100).toFixed(1) + '%';
        $('pv' + k).textContent = pct(p);
      }
    }
    const set = (id, v, cls) => { const el = $(id); el.querySelector('b').textContent = v; el.className = 'cnt' + (cls ? ' ' + cls : ''); };
    set('kP', sum.persons || 0, sum.persons ? 'act' : '');
    set('kD', sum.down || 0, sum.down ? 'hot' : '');
    const fs = Math.max(sum.fire || 0, sum.smoke || 0);
    set('kF', fs >= 0.25 ? pct(fs) : '–', fs >= 0.35 ? 'hot' : fs >= 0.25 ? 'warm' : '');
    set('kH', sum.hazards || 0, sum.hazards ? 'warm' : '');
    $('aiTag').textContent = ai.state === 'running' ? `${(ai.fps || 0).toFixed(1)} fps` : ai.state === 'loading' ? 'loading...' : ai.state;
    $('aiTag').title = ai.message || '';

    const fresh = res.age !== null && res.age !== undefined && res.age < 3;
    const items = [];
    if (fresh) {
      for (const p of res.persons || []) items.push([p.posture === 'down' ? CAT.down : CAT.person, p.posture === 'down' ? 'Person - lying down' : `Person - ${p.posture}`, p.conf]);
      for (const o of res.objects || []) items.push([CAT[o.cat] || CAT.object, `${o.label[0].toUpperCase()}${o.label.slice(1)} - ${o.cat}`, o.conf]);
    }
    $('detList').innerHTML = items.length ? items.map(([c, t, v]) => `<li><i style="background:${c}"></i><span>${esc(t)}</span><em>${pct(v)}</em></li>`).join('')
      : `<li class="empty">${ai.state === 'running' ? 'Nothing detected' : esc(ai.message || 'Vision AI not running')}</li>`;

    const p = S.path;
    $('vPath').textContent = p ? (PATH_TXT[p.advice] || p.advice) : '--';
    $('vPath').title = p ? `From ${p.source}` : '';
    [['pbL', 'left'], ['pbC', 'center'], ['pbR', 'right']].forEach(([id, k]) => {
      const v = p ? p[k] : null, el = $(id);
      // bar height = free space (1 - nearness); red when that side is blocked
      const free = v === null || v === undefined ? (p && p.sonar_block && k === 'center' ? 0.05 : null) : 1 - v;
      el.style.height = free === null ? '2px' : Math.max(2, Math.round(free * 100)) + '%';
      el.classList.toggle('blk', free !== null && free < 0.28);
      el.style.opacity = free === null ? 0.3 : 1;
    });
    const li = res.light;
    $('vLight').innerHTML = !fresh || !li ? '--' : li.lowlight ? status('warn', 'i-warn', 'Low - AI enhanced') : status('good', 'i-good', 'Good');
  }

  function renderTrends() {
    const an = S.anomaly || {};
    if (!an.ready) { $('anV').innerHTML = status('info', 'i-info', 'Learning'); $('anD').textContent = `${an.samples || 0} / 45 samples`; }
    else if (an.anomaly) { $('anV').innerHTML = status('crit', 'i-crit', 'Unusual'); $('anD').textContent = (an.reasons || []).join(', ') || `score ${an.score}`; }
    else { $('anV').innerHTML = status('good', 'i-good', 'Normal'); $('anD').textContent = `score ${(an.score || 0).toFixed(2)}`; }
    const tr = S.trend || {}, g = tr.gas, t = tr.t;
    if (g && g.eta !== null && g.eta !== undefined) $('trV').innerHTML = status('warn', 'i-warn', `Gas alarm in ~${g.eta} s`);
    else if (t && t.eta !== null && t.eta !== undefined) $('trV').innerHTML = status('warn', 'i-warn', `Temp alarm in ~${t.eta} s`);
    else if (g) $('trV').innerHTML = status('good', 'i-good', 'Stable');
    else $('trV').innerHTML = status('info', 'i-info', 'Collecting');
    $('trD').textContent = g ? `gas ${g.slope_min >= 0 ? '+' : ''}${g.slope_min}/min` : 'last 90 s';
  }

  let lastEvTop = -1, voiceOn = store.get('voice', true), spokenId = null;
  function renderAlerts() {
    const ev = S.events || [];
    $('evCount').textContent = ev.length;
    const top = ev.length ? ev[0].id : 0;
    if (top === lastEvTop) return;
    lastEvTop = top;
    $('timeline').innerHTML = ev.length ? ev.map(e => {
      const s = SEV[e.severity] || SEV.info;
      return `<li class="${e.severity}"><time>${e.time}</time><span class="st ${s.cls}">${icon(s.icon)}</span>` +
        `<div class="msg">${esc(e.message)}<span class="sev">${s.label}</span></div>` +
        (e.snapshot ? `<button data-snap="${esc(e.snapshot)}" title="View snapshot" aria-label="View snapshot">${icon('i-cam')}</button>` : '<span></span>') + '</li>';
    }).join('') : '<li><span></span><span></span><div class="msg muted">No alerts yet</div><span></span></li>';
    if (spokenId === null) { spokenId = top; return; }
    const fresh = ev.filter(e => e.id > spokenId).reverse();
    spokenId = top;
    if (voiceOn && 'speechSynthesis' in window) {
      for (const e of fresh) {
        if (['critical', 'danger'].includes(e.severity) || ['PERSON', 'PERSON_DOWN', 'FIRE'].includes(e.kind)) {
          if (speechSynthesis.pending) speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(e.message.replace(/ - /g, '. '));
          u.rate = 1.05;
          speechSynthesis.speak(u);
        }
      }
    }
  }
  $('timeline').addEventListener('click', e => { const b = e.target.closest('[data-snap]'); if (b) openImage(b.dataset.snap); });

  let lastSnapKey = '';
  function renderSnaps() {
    const sn = S.snapshots || [];
    $('snapCount').textContent = sn.length;
    const key = sn.length + (sn[0] ? sn[0].url : '');
    if (key === lastSnapKey) return;
    lastSnapKey = key;
    $('snaps').innerHTML = sn.length ? sn.map(s => `<button data-snap="${esc(s.url)}" title="${esc(s.tag)} at ${s.time}"><img src="${esc(s.url)}" alt="Snapshot: ${esc(s.tag)} at ${s.time}" loading="lazy"><span>${s.time} · ${esc(s.tag)}</span></button>`).join('')
      : '<div class="empty-note">The AI saves a picture automatically when it sees a person, fire or a hazard.</div>';
  }
  $('snaps').addEventListener('click', e => { const b = e.target.closest('[data-snap]'); if (b) openImage(b.dataset.snap); });

  // ---------------------------------------------------------------- charts (Trends tab)
  const charts = {
    t: new LineChart($('chT'), { name: 'Temperature', unit: '°C', decimals: 1, minSpan: 4 }),
    gas: new LineChart($('chG'), { name: 'Gas', unit: '', decimals: 0, min: 0, minSpan: 800 }),
    dist: new LineChart($('chD'), { name: 'Distance', unit: 'cm', decimals: 0, min: 0, minSpan: 50 }),
    risk: new LineChart($('chR'), { name: 'Risk', unit: '', decimals: 0, min: 0, max: 100, minSpan: 100,
      thresholds: [{ v: 20, label: 'caution', color: '#fbbf24' }, { v: 52, label: 'danger', color: '#fb8a4c' }, { v: 82, label: 'critical', color: '#f43f5e' }] }),
  };
  async function loadHistory() {
    try {
      const h = await api.history();
      const now = Date.now() / 1000, lim = (S && S.limits) || {};
      charts.t.o.thresholds = lim.temp_warn ? [{ v: lim.temp_warn, label: 'high', color: '#fb8a4c' }, { v: lim.temp_alarm, label: 'critical', color: '#f43f5e' }] : [];
      charts.gas.o.thresholds = lim.gas_warn ? [{ v: lim.gas_warn, label: 'elevated', color: '#fbbf24' }, { v: lim.gas_alarm, label: 'alarm', color: '#f43f5e' }] : [];
      const d = S && S.tel && S.tel.data;
      charts.dist.o.thresholds = d && d.trig ? [{ v: d.trig, label: 'stop', color: '#f43f5e' }] : [];
      charts.t.set(h.map(x => ({ ts: x.ts, v: x.t })), now);
      charts.gas.set(h.map(x => ({ ts: x.ts, v: x.gas })), now);
      charts.dist.set(h.map(x => ({ ts: x.ts, v: x.dist })), now);
      charts.risk.set(h.map(x => ({ ts: x.ts, v: x.risk })), now);
      const last = k => { for (let i = h.length - 1; i >= 0; i--) if (h[i][k] !== null && h[i][k] !== undefined) return h[i][k]; return null; };
      const lt = last('t'), lg = last('gas'), ld = last('dist'), lr = last('risk');
      $('cvT').textContent = lt === null ? '--' : `${lt.toFixed(1)} °C`;
      $('cvG').textContent = lg === null ? '--' : `${Math.round(lg)}`;
      $('cvD').textContent = ld === null ? (h.length ? 'clear' : '--') : `${Math.round(ld)} cm`;
      $('cvR').textContent = lr === null ? '--' : `${lr}`;
    } catch { /* server offline - the state poll shows it */ }
  }

  // ---------------------------------------------------------------- controls
  const send = q => api.set(q).then(r => { if (r && r.ok === false) toast('Camera did not accept the setting'); })
    .catch(() => toast('Could not reach the camera'));
  $('cSon').addEventListener('change', e => { hold('son'); send('sonar=' + (e.target.checked ? 1 : 0)); });
  $('cTrig').addEventListener('input', e => { hold('trig'); $('cTrigV').textContent = e.target.value + ' cm'; });
  $('cTrig').addEventListener('change', e => { hold('trig'); send('dist=' + e.target.value); });
  $('cFs').addEventListener('change', e => { hold('cam'); send('fs=' + e.target.value); });
  $('cQ').addEventListener('input', e => { hold('cam'); $('cQV').textContent = e.target.value; });
  $('cQ').addEventListener('change', e => { hold('cam'); send('q=' + e.target.value); });
  $('cFl').addEventListener('input', e => { hold('flash'); $('cFlV').textContent = e.target.value; });
  $('cFl').addEventListener('change', e => { hold('flash'); send('flash=' + e.target.value); });
  $('cVf').addEventListener('change', e => { hold('cam'); send('vf=' + (e.target.checked ? 1 : 0)); });
  $('cHm').addEventListener('change', e => { hold('cam'); send('hm=' + (e.target.checked ? 1 : 0)); });

  function setVoice(on) {
    voiceOn = on; store.set('voice', on);
    const b = $('btnVoice');
    b.querySelector('use').setAttribute('href', on ? '#i-vol' : '#i-mute');
    b.setAttribute('aria-pressed', on);
    b.title = `Voice alerts ${on ? 'on' : 'off'} (V)`;
    b.classList.toggle('on', on);
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  }
  $('btnVoice').addEventListener('click', () => setVoice(!voiceOn));

  $('btnSnap').addEventListener('click', snapshot);
  async function snapshot() {
    const r = await api.post('api/snapshot').catch(() => null);
    toast(r && r.ok ? 'Snapshot saved' : 'No camera picture to save yet');
  }

  // tabs
  function showTab(id) {
    document.querySelectorAll('.tabs button').forEach(x => { const on = x.dataset.tab === id; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === id));
    store.set('tab', id);
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---------------------------------------------------------------- ask the rover
  const chatHist = [];
  function bubble(cls, html) {
    const el = document.createElement('div');
    el.className = 'msg-b ' + cls;
    el.innerHTML = html;
    $('chat').appendChild(el);
    el.scrollIntoView({ block: 'end' });
    return el;
  }
  async function ask(q) {
    q = q.trim();
    if (!q) return;
    bubble('user', esc(q));
    const pend = bubble('bot pending', 'Thinking...');
    const r = await api.post('api/ask', { question: q, history: chatHist.slice(-6) }).catch(() => null);
    pend.classList.remove('pending');
    if (!r || r.error) { pend.innerHTML = 'Could not reach the dashboard server.'; return; }
    const src = r.source === 'claude' ? `Claude · ${esc(r.model)}` : `Offline answer${r.note ? ' · ' + esc(r.note) : ''}`;
    pend.innerHTML = esc(r.answer) + `<span class="src">${src}</span>`;
    pend.scrollIntoView({ block: 'end' });
    chatHist.push({ role: 'user', text: q }, { role: 'assistant', text: r.answer });
  }
  $('askForm').addEventListener('submit', e => { e.preventDefault(); const v = $('askIn').value; $('askIn').value = ''; ask(v); });
  document.querySelectorAll('.quick button').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));

  // ---------------------------------------------------------------- report + dialogs
  async function report() {
    openModal('AI mission report', '<p class="muted">Analysing the mission and writing the report...</p>');
    const r = await api.post('api/report').catch(() => null);
    if (!r || !r.markdown) { $('modalBody').innerHTML = '<p>Could not create the report - is the dashboard server running?</p>'; return; }
    $('modalBody').innerHTML = `<div class="md">${md(r.markdown)}</div>`;
    $('modalActions').innerHTML = r.file ? `<a class="btn sm" href="reports/${encodeURIComponent(r.file)}?dl=1" download>Download</a> ` : '';
    if (r.note) toast('Offline report (' + r.note + ')');
    loadReports();
  }
  $('btnReport').addEventListener('click', report);
  $('btnReport2').addEventListener('click', report);

  let lastFocus = null, openDlg = null;
  function showDlg(el, focusEl) {
    lastFocus = document.activeElement;
    el.classList.add('show');
    openDlg = el;
    (focusEl || el.querySelector('[data-close]')).focus();
  }
  function closeDlg() {
    if (!openDlg) return;
    openDlg.classList.remove('show');
    openDlg = null;
    if (lastFocus) lastFocus.focus();
  }
  function openModal(title, html, imgMode) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modalBody').className = 'modal-body' + (imgMode ? ' pic' : '');
    $('modalBox').className = 'modal-box' + (imgMode ? ' img' : '');
    $('modalActions').innerHTML = '';
    showDlg($('modal'));
  }
  function openImage(url) {
    openModal('Snapshot · ' + url.split('/').pop(), `<img src="${esc(url)}" alt="AI snapshot">`, true);
    $('modalActions').innerHTML = `<a class="btn sm" href="${esc(url)}" download>Download</a> `;
  }
  $('btnCamSet').addEventListener('click', () => showDlg($('camDlg'), $('cFs')));
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeDlg(); });
  });

  let toastT = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // minimal Markdown -> HTML (headings, lists, bold, code, tables, paragraphs)
  function md(src) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const lines = String(src).replace(/\r/g, '').split('\n');
    let html = '', list = null, para = [];
    const flushP = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const flushL = () => { if (list) { html += `</${list}>`; list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let m;
      if (!l.trim()) { flushP(); flushL(); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { flushP(); flushL(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
      if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { flushP(); if (list !== 'ul') { flushL(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; continue; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (list !== 'ol') { flushL(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; continue; }
      if (/^\s*\|/.test(l)) {
        flushP(); flushL();
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i]); i++; }
        i--;
        html += '<table>' + rows.map((r, k) => '<tr>' + r.trim().replace(/^\||\|$/g, '').split('|').map(c => k ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`).join('') + '</tr>').join('') + '</table>';
        continue;
      }
      flushL(); para.push(l.trim());
    }
    flushP(); flushL();
    return html;
  }

  // ---------------------------------------------------------------- keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openDlg) { closeDlg(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === '1') setView('raw'); else if (k === '2') setView('enhanced'); else if (k === '3') setView('depth');
    else if (k === 's') snapshot(); else if (k === 'f') toggleFull(); else if (k === 'v') setVoice(!voiceOn);
  });

  // ---------------------------------------------------------------- polling
  let busy = false, fails = 0;
  async function poll() {
    if (busy) return;
    busy = true;
    try {
      S = await api.state();
      recvT = performance.now();
      fails = 0;
      render();
    } catch {
      if (++fails === 3) serverDown();
    }
    busy = false;
  }
  function serverDown() {
    ['chipCam', 'chipCar', 'chipAi'].forEach(id => { $(id).className = 'chip bad'; });
    $('noSignal').classList.add('show');
    $('noSignalMsg').textContent = 'The dashboard server is not running. Start it with start.bat.';
  }
  const tick = () => { $('clock').textContent = new Date().toLocaleTimeString([], { hour12: false }); };
  setInterval(tick, 1000);
  tick();

  setVoice(voiceOn);
  const savedTab = store.get('tab', 'tAlerts');
  if ($(savedTab) && $(savedTab).classList.contains('tab')) showTab(savedTab);

  setView('raw');
  fit();
  requestAnimationFrame(drawOverlay);
  poll();
  setInterval(poll, 300);
  loadHistory();
  setInterval(loadHistory, 2000);
  loadReports();
})();
