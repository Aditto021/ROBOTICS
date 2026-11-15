/*******************************************************************************
 * ResQBot - ESP32-CAM (AI-Thinker) : Wi-Fi hotspot + live video + dashboard
 * -----------------------------------------------------------------------------
 *  - Creates its own Wi-Fi:  SSID "ResQBot-CAM"   password "resqbot123"
 *  - Open  http://192.168.4.1  on the laptop after connecting to that Wi-Fi
 *  - Live MJPEG stream on port 81 (dashboard shows it automatically)
 *  - Shows DHT11 / gas / sonar / car status received from the main ESP32
 *  - Safety-brake on/off + trigger distance are sent back to the main ESP32
 *  - Resolution / quality / flash / flip settings (saved in flash)
 *
 * Board      : "AI Thinker ESP32-CAM"
 * PSRAM      : Enabled (default for this board)
 * Partition  : "Huge APP (3MB No OTA/1MB SPIFFS)"
 * Core       : esp32 by Espressif 2.0.x or 3.x (tested to compile on 3.3.12)
 * Libraries  : none
 *
 * Link wiring:  CAM GPIO13 (RX) <- main ESP32 GPIO32 (TX)
 *               CAM GPIO15 (TX) -> main ESP32 GPIO33 (RX)
 *               CAM GND        <-> main ESP32 GND   (must be shared)
 ******************************************************************************/

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"
#include "lwip/sockets.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#if __has_include("esp_arduino_version.h")
  #include "esp_arduino_version.h"
#endif
#ifndef ESP_ARDUINO_VERSION_MAJOR
  #define ESP_ARDUINO_VERSION_MAJOR 2
#endif

// ============================== SETTINGS ====================================
#define AP_SSID       "ResQBot-CAM"
#define AP_PASS       "resqbot123"     // at least 8 characters
#define AP_CHANNEL    6

#define LINK_RX_PIN   13               // <- main ESP32 GPIO32
#define LINK_TX_PIN   15               // -> main ESP32 GPIO33
#define LINK_BAUD     115200
#define LINK_TIMEOUT  1500             // ms without data = "car link lost"

#define FLASH_PIN     4                // on-board white LED
#define FLASH_CH      7                // LEDC timer 3 (camera uses timer 0)

#define DEFAULT_FS    FRAMESIZE_VGA    // 640x480 = best quality/FPS balance
#define DEFAULT_Q     12               // JPEG quality 8 (best) .. 40

// ======================= AI-THINKER CAMERA PINS =============================
#define PWDN_GPIO_NUM   32
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM   26
#define SIOC_GPIO_NUM   27
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     21
#define Y4_GPIO_NUM     19
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

// ================================ STATE =====================================
struct Telemetry {
  float t = NAN, h = NAN;
  int gas = 0, dist = -1, son = 0, trig = 0, brk = 0, spd = 0, bt = 0, shot = 0;
  char cmd = 'S';
};
struct Pending { int val = -1; uint8_t tries = 0; uint32_t last = 0; };

static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
Telemetry tel;
uint32_t  telMs = 0;
bool      telValid = false;
Pending   pendSon, pendDist;

volatile float streamFps = 0;
volatile bool  streaming = false;
int            flashVal = 0;
framesize_t    maxFs = FRAMESIZE_UXGA;
Preferences    prefs;

// ======================= ESP32 <-> ESP32-CAM LINK ===========================
// Frame format:  $<payload>*<XOR checksum, 2 hex>\n   (bad frames are dropped)
void sendFrame(const char *payload) {
  uint8_t cs = 0;
  for (const char *p = payload; *p; p++) cs ^= (uint8_t)*p;
  char buf[64];
  int n = snprintf(buf, sizeof(buf), "$%s*%02X\n", payload, cs);
  if (n > 0 && n < (int)sizeof(buf)) Serial1.write((const uint8_t *)buf, n);
}

class FrameParser {
  char buf[128];
  uint8_t len = 0;
  bool active = false;
 public:
  bool feed(char c, char *out, size_t outSize) {
    if (c == '$') { active = true; len = 0; return false; }
    if (!active) return false;
    if (c == '\n' || c == '\r') {
      active = false;
      buf[len] = '\0';
      char *star = strrchr(buf, '*');
      if (!star || (buf + len) - star != 3) return false;
      if (!isxdigit((uint8_t)star[1]) || !isxdigit((uint8_t)star[2])) return false;
      *star = '\0';
      uint8_t cs = 0;
      for (char *p = buf; *p; p++) cs ^= (uint8_t)*p;
      if ((uint8_t)strtoul(star + 1, nullptr, 16) != cs) return false;
      strncpy(out, buf, outSize - 1);
      out[outSize - 1] = '\0';
      return true;
    }
    if (len >= sizeof(buf) - 1) { active = false; return false; }
    buf[len++] = c;
    return false;
  }
};
FrameParser linkParser;

// T,temp,hum,gas,dist,sonarOn,trigger,brake,speed,cmd,bt,shooting
void handleLine(char *p) {
  if (p[0] != 'T' || p[1] != ',') return;
  char *f[14];
  int n = 0;
  char *save = nullptr;
  for (char *tok = strtok_r(p, ",", &save); tok && n < 14; tok = strtok_r(nullptr, ",", &save))
    f[n++] = tok;
  if (n != 12) return;

  Telemetry x;
  x.t    = strtof(f[1], nullptr);
  x.h    = strtof(f[2], nullptr);
  x.gas  = atoi(f[3]);
  x.dist = atoi(f[4]);
  x.son  = atoi(f[5]);
  x.trig = atoi(f[6]);
  x.brk  = atoi(f[7]);
  x.spd  = atoi(f[8]);
  x.cmd  = f[9][0];
  x.bt   = atoi(f[10]);
  x.shot = atoi(f[11]);

  uint32_t now = millis();
  portENTER_CRITICAL(&mux);
  tel = x; telMs = now; telValid = true;
  portEXIT_CRITICAL(&mux);
}

// Dashboard requests are queued here and sent by loop() (single UART writer).
// They are re-sent every 250 ms until the car's telemetry confirms them.
void queuePending(Pending &pd, int val) {
  portENTER_CRITICAL(&mux);
  pd.val = val; pd.tries = 0; pd.last = 0;
  portEXIT_CRITICAL(&mux);
}

void servicePending(Pending &pd, char key, int current, bool valid, uint32_t telTime) {
  int val; uint8_t tries; uint32_t last;
  portENTER_CRITICAL(&mux);
  val = pd.val; tries = pd.tries; last = pd.last;
  portEXIT_CRITICAL(&mux);
  if (val < 0) return;

  uint32_t now = millis();
  bool confirmed = tries > 0 && valid && current == val && (int32_t)(telTime - last) > 0;
  bool giveUp = tries >= 10 && now - last >= 250;
  if (confirmed || giveUp) {
    portENTER_CRITICAL(&mux);
    if (pd.val == val) pd.val = -1;
    portEXIT_CRITICAL(&mux);
    return;
  }
  if (tries > 0 && now - last < 250) return;

  char p[16];
  snprintf(p, sizeof(p), "%c,%d", key, val);
  sendFrame(p);
  portENTER_CRITICAL(&mux);
  if (pd.val == val) { pd.tries = tries + 1; pd.last = now; }
  portEXIT_CRITICAL(&mux);
}

// ================================ FLASH LED =================================
void flashWrite(int v) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(FLASH_PIN, v);
#else
  ledcWrite(FLASH_CH, v);
#endif
}

void flashInit() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttachChannel(FLASH_PIN, 5000, 8, FLASH_CH);
#else
  ledcSetup(FLASH_CH, 5000, 8);
  ledcAttachPin(FLASH_PIN, FLASH_CH);
#endif
  flashWrite(0);
}

// ================================ DASHBOARD =================================
static const char INDEX_HTML[] = R"rawliteral(<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ResQBot Dashboard</title>
<style>
:root{--bg:#0e1116;--card:#171b22;--line:#272c36;--txt:#e8eaef;--mut:#8a93a5;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444;--acc:#3b82f6}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}
.pills{display:flex;gap:6px;flex-wrap:wrap}
.pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#2a2f3a;color:var(--mut)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--ok)}
.pill.warn{background:rgba(245,158,11,.15);color:var(--warn)}
.pill.bad{background:rgba(239,68,68,.15);color:var(--bad)}
main{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;padding:16px;max-width:1500px;margin:auto}
@media(max-width:960px){main{grid-template-columns:1fr}}
.video{position:relative;background:#000;border-radius:12px;overflow:hidden;border:1px solid var(--line);min-height:240px}
.video img{display:block;width:100%;height:auto}
.ov{position:absolute;top:10px;left:10px;display:flex;gap:6px}
.ov span{background:rgba(0,0,0,.65);padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600}
#brake{display:none;position:absolute;left:0;right:0;bottom:0;padding:12px;text-align:center;font-weight:800;font-size:20px;letter-spacing:.06em;background:rgba(239,68,68,.88);color:#fff}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px}
.card h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin:0 0 10px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.k{color:var(--mut);font-size:12px}
.v{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
.v small{font-size:13px;color:var(--mut);font-weight:500}
.bar{height:8px;background:#262b35;border-radius:4px;overflow:hidden;margin-top:6px}
.bar i{display:block;height:100%;width:0;background:var(--acc);transition:width .25s,background .25s}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0}
input[type=range]{width:100%;accent-color:var(--acc)}
select{background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:5px 8px}
.sw{position:relative;width:46px;height:26px;flex:none}
.sw input{opacity:0;width:0;height:0}
.sw span{position:absolute;inset:0;background:#3a404c;border-radius:99px;cursor:pointer;transition:.2s}
.sw span:before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.sw input:checked+span{background:var(--ok)}
.sw input:checked+span:before{transform:translateX(20px)}
.note{font-size:12px;color:var(--mut);margin-top:6px}
</style></head><body>
<header><h1>ResQBot Dashboard</h1>
<div class="pills"><span id="pLink" class="pill">Car link: --</span><span id="pBt" class="pill">Bluetooth: --</span><span id="pCam" class="pill">Camera: --</span></div></header>
<main>
<section>
 <div class="video"><img id="cam" alt="Live camera feed">
  <div class="ov"><span id="fps">-- FPS</span><span id="res">--</span></div>
  <div id="brake">SAFETY BRAKE &mdash; OBSTACLE AHEAD</div>
 </div>
 <div class="card" style="margin-top:14px"><h2>Camera</h2>
  <div class="row"><span>Resolution</span><select id="fs">
   <option value="5">QVGA 320&times;240 (fastest)</option>
   <option value="6">CIF 400&times;296</option>
   <option value="8">VGA 640&times;480 (recommended)</option>
   <option value="9">SVGA 800&times;600</option>
   <option value="10">XGA 1024&times;768</option>
   <option value="11">HD 1280&times;720</option>
   <option value="12">SXGA 1280&times;1024</option>
   <option value="13">UXGA 1600&times;1200</option>
  </select></div>
  <div class="row"><span>JPEG quality <span class="k">(lower = sharper)</span></span><b id="qv">--</b></div>
  <input type="range" id="q" min="8" max="40" step="1">
  <div class="row"><span>Flash LED</span><b id="flv">0</b></div>
  <input type="range" id="fl" min="0" max="255" step="5" value="0">
  <div class="row"><span>Flip vertical</span><label class="sw"><input type="checkbox" id="vf"><span></span></label></div>
  <div class="row"><span>Mirror</span><label class="sw"><input type="checkbox" id="hm"><span></span></label></div>
 </div>
</section>
<aside>
 <div class="card"><h2>Environment (DHT11)</h2><div class="g2">
  <div><div class="k">Temperature</div><div class="v" id="t">--</div></div>
  <div><div class="k">Humidity</div><div class="v" id="h">--</div></div></div></div>
 <div class="card"><h2>Gas sensor</h2>
  <div class="row"><div class="v" id="gas">--</div><span id="gasS" class="pill">--</span></div>
  <div class="bar"><i id="gasB"></i></div>
  <div class="note">Raw ADC 0&ndash;4095. MQ sensors need a few minutes to warm up.</div></div>
 <div class="card"><h2>Distance (sonar)</h2>
  <div class="v" id="dist">--</div><div class="bar"><i id="distB"></i></div></div>
 <div class="card"><h2>Safety brake</h2>
  <div class="row"><span>Enabled</span><label class="sw"><input type="checkbox" id="son"><span></span></label></div>
  <div class="row"><span>Trigger distance</span><b id="trv">--</b></div>
  <input type="range" id="tr" min="5" max="200" step="1">
  <div class="note">While moving forward the car stops if an obstacle is closer than this.</div></div>
 <div class="card"><h2>Car</h2><div class="g2">
  <div><div class="k">Command</div><div class="v" id="cmd" style="font-size:20px">--</div></div>
  <div><div class="k">Speed</div><div class="v" id="spd">--</div></div>
  <div><div class="k">Shooter</div><div class="v" id="shot" style="font-size:20px">--</div></div></div></div>
</aside></main>
<script>
const $=id=>document.getElementById(id);
const CMD={F:'Forward',B:'Backward',L:'Spin left',R:'Spin right',G:'Fwd-left',I:'Fwd-right',H:'Back-left',J:'Back-right',S:'Stopped'};
const FS={5:'320\u00d7240',6:'400\u00d7296',8:'640\u00d7480',9:'800\u00d7600',10:'1024\u00d7768',11:'1280\u00d7720',12:'1280\u00d71024',13:'1600\u00d71200'};
const GAS_WARN=1500,GAS_ALARM=2500;
const lock={};
const locked=k=>(lock[k]||0)>Date.now();
const hold=k=>{lock[k]=Date.now()+2500;};
function send(q){fetch('/set?'+q,{cache:'no-store'}).catch(()=>{});}
function pill(el,txt,cls){el.textContent=txt;el.className='pill'+(cls?' '+cls:'');}

const cam=$('cam');let camRetry=null,noStreamSince=0,camInit=false,busy=false;
function startStream(){clearTimeout(camRetry);cam.src='http://'+location.hostname+':81/stream?_='+Date.now();}
cam.onerror=()=>{clearTimeout(camRetry);camRetry=setTimeout(startStream,1500);};
startStream();

function render(d){
 const now=Date.now(),L=!!d.link;
 pill($('pLink'),L?'Car link: OK':'Car link: LOST',L?'ok':'bad');
 pill($('pBt'),!L?'Bluetooth: --':(d.bt?'Bluetooth: connected':'Bluetooth: waiting'),!L?'':(d.bt?'ok':'warn'));
 pill($('pCam'),d.streaming?'Camera: live':'Camera: connecting',d.streaming?'ok':'warn');
 $('fps').textContent=(d.streaming?d.fps.toFixed(1):'0')+' FPS';
 $('res').textContent=FS[d.fs]||'';
 if(!d.streaming){if(!noStreamSince)noStreamSince=now;else if(now-noStreamSince>3000){noStreamSince=0;startStream();}}else noStreamSince=0;

 if(!camInit||!locked('cam')){$('fs').value=d.fs;$('q').value=d.q;$('qv').textContent=d.q;$('vf').checked=!!d.vf;$('hm').checked=!!d.hm;}
 if(!camInit){$('fl').value=d.flash;$('flv').textContent=d.flash;camInit=true;}

 $('t').innerHTML=L&&d.t!==null?d.t.toFixed(1)+'<small> \u00b0C</small>':'--';
 $('h').innerHTML=L&&d.h!==null?Math.round(d.h)+'<small> %</small>':'--';

 const gb=$('gasB');
 if(L){
  $('gas').textContent=d.gas;
  gb.style.width=Math.min(100,d.gas/4095*100)+'%';
  const lv=d.gas>=GAS_ALARM?['HIGH','bad','var(--bad)']:d.gas>=GAS_WARN?['Elevated','warn','var(--warn)']:['Normal','ok','var(--ok)'];
  pill($('gasS'),lv[0],lv[1]);gb.style.background=lv[2];
 }else{$('gas').textContent='--';pill($('gasS'),'--');gb.style.width='0';}

 const db=$('distB');
 if(L&&d.dist>0){
  $('dist').innerHTML=d.dist+'<small> cm</small>';
  db.style.width=Math.min(100,d.dist/200*100)+'%';
  db.style.background=d.dist<=d.trig?'var(--bad)':d.dist<=d.trig*2?'var(--warn)':'var(--ok)';
 }else{
  $('dist').innerHTML=L?'Clear<small> (nothing in range)</small>':'--';
  db.style.width=L?'100%':'0';db.style.background='var(--ok)';
 }

 if(L&&!locked('son'))$('son').checked=!!d.son;
 if(L&&!locked('tr')){$('tr').value=d.trig;$('trv').textContent=d.trig+' cm';}
 $('brake').style.display=L&&d.son&&d.brk?'block':'none';
 $('cmd').textContent=L?(CMD[d.cmd]||d.cmd):'--';
 $('spd').innerHTML=L?(d.spd>=10?'MAX':d.spd+'<small> / 9</small>'):'--';
 $('shot').textContent=L?(d.shot?'Firing':'Ready'):'--';
}

async function poll(){
 if(busy)return;busy=true;
 try{const r=await fetch('/data',{cache:'no-store'});render(await r.json());}
 catch(e){pill($('pLink'),'Dashboard offline','bad');}
 busy=false;
}
setInterval(poll,250);poll();

$('son').onchange=e=>{hold('son');send('sonar='+(e.target.checked?1:0));};
$('tr').oninput=e=>{hold('tr');$('trv').textContent=e.target.value+' cm';};
$('tr').onchange=e=>{hold('tr');send('dist='+e.target.value);};
$('fs').onchange=e=>{hold('cam');send('fs='+e.target.value);};
$('q').oninput=e=>{hold('cam');$('qv').textContent=e.target.value;};
$('q').onchange=e=>{hold('cam');send('q='+e.target.value);};
$('fl').oninput=e=>{$('flv').textContent=e.target.value;};
$('fl').onchange=e=>{send('flash='+e.target.value);};
$('vf').onchange=e=>{hold('cam');send('vf='+(e.target.checked?1:0));};
$('hm').onchange=e=>{hold('cam');send('hm='+(e.target.checked?1:0));};
</script></body></html>)rawliteral";

// ============================== HTTP HANDLERS ===============================
#define PART_BOUNDARY "resqbotframe"
static const char *STREAM_TYPE  = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char *STREAM_BOUND = "\r\n--" PART_BOUNDARY "\r\n";
static const char *STREAM_PART  = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t indexHandler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  return httpd_resp_send(req, INDEX_HTML, strlen(INDEX_HTML));
}

static void fmtFloat(char *b, size_t n, float v, int dec) {
  if (isnan(v) || isinf(v)) snprintf(b, n, "null");
  else snprintf(b, n, "%.*f", dec, (double)v);
}

static esp_err_t dataHandler(httpd_req_t *req) {
  Telemetry x; uint32_t tm; bool valid;
  portENTER_CRITICAL(&mux);
  x = tel; tm = telMs; valid = telValid;
  portEXIT_CRITICAL(&mux);
  bool link = valid && (millis() - tm) < LINK_TIMEOUT;

  char ts[16], hs[16];
  fmtFloat(ts, sizeof(ts), x.t, 1);
  fmtFloat(hs, sizeof(hs), x.h, 0);
  char cmd = isalpha((uint8_t)x.cmd) ? x.cmd : '?';

  int fs = DEFAULT_FS, q = DEFAULT_Q, vf = 0, hm = 0;
  sensor_t *s = esp_camera_sensor_get();
  if (s) { fs = s->status.framesize; q = s->status.quality; vf = s->status.vflip; hm = s->status.hmirror; }
  bool live = streaming;

  char json[480];
  int n = snprintf(json, sizeof(json),
    "{\"link\":%d,\"t\":%s,\"h\":%s,\"gas\":%d,\"dist\":%d,\"son\":%d,\"trig\":%d,"
    "\"brk\":%d,\"spd\":%d,\"cmd\":\"%c\",\"bt\":%d,\"shot\":%d,"
    "\"streaming\":%d,\"fps\":%.1f,\"fs\":%d,\"q\":%d,\"flash\":%d,\"vf\":%d,\"hm\":%d}",
    link ? 1 : 0, ts, hs, x.gas, x.dist, x.son, x.trig, x.brk, x.spd, cmd, x.bt, x.shot,
    live ? 1 : 0, live ? (double)streamFps : 0.0, fs, q, flashVal, vf, hm);
  if (n < 0 || n >= (int)sizeof(json)) return httpd_resp_send_500(req);

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  return httpd_resp_send(req, json, n);
}

static esp_err_t setHandler(httpd_req_t *req) {
  char q[160], v[12];
  if (httpd_req_get_url_query_str(req, q, sizeof(q)) != ESP_OK)
    return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "missing query");

  if (httpd_query_key_value(q, "sonar", v, sizeof(v)) == ESP_OK)
    queuePending(pendSon, atoi(v) ? 1 : 0);

  if (httpd_query_key_value(q, "dist", v, sizeof(v)) == ESP_OK) {
    int d = atoi(v);
    if (d < 5) d = 5;
    if (d > 300) d = 300;
    queuePending(pendDist, d);
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s && httpd_query_key_value(q, "fs", v, sizeof(v)) == ESP_OK) {
    int fs = atoi(v);
    if (fs >= FRAMESIZE_QVGA && fs <= maxFs) {
      s->set_framesize(s, (framesize_t)fs);
      prefs.putUChar("fs", (uint8_t)fs);
    }
  }
  if (s && httpd_query_key_value(q, "q", v, sizeof(v)) == ESP_OK) {
    int qq = atoi(v);
    if (qq >= 8 && qq <= 40) { s->set_quality(s, qq); prefs.putUChar("q", (uint8_t)qq); }
  }
  if (s && httpd_query_key_value(q, "vf", v, sizeof(v)) == ESP_OK) {
    int x = atoi(v) ? 1 : 0;
    s->set_vflip(s, x); prefs.putUChar("vf", (uint8_t)x);
  }
  if (s && httpd_query_key_value(q, "hm", v, sizeof(v)) == ESP_OK) {
    int x = atoi(v) ? 1 : 0;
    s->set_hmirror(s, x); prefs.putUChar("hm", (uint8_t)x);
  }
  if (httpd_query_key_value(q, "flash", v, sizeof(v)) == ESP_OK) {
    int x = atoi(v);
    if (x < 0) x = 0;
    if (x > 255) x = 255;
    flashVal = x;
    flashWrite(x);
  }

  httpd_resp_set_type(req, "text/plain");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  return httpd_resp_send(req, "OK", 2);
}

static esp_err_t streamHandler(httpd_req_t *req) {
  esp_err_t res = httpd_resp_set_type(req, STREAM_TYPE);
  if (res != ESP_OK) return res;
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");

  int fd = httpd_req_to_sockfd(req);                  // send frames immediately
  int one = 1;
  setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));

  streaming = true;
  streamFps = 0;
  int64_t last = esp_timer_get_time();
  char part[64];
  int fails = 0;

  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      if (++fails > 50) { res = ESP_FAIL; break; }
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    fails = 0;
    if (fb->format != PIXFORMAT_JPEG) { esp_camera_fb_return(fb); continue; }

    res = httpd_resp_send_chunk(req, STREAM_BOUND, strlen(STREAM_BOUND));
    if (res == ESP_OK) {
      int hl = snprintf(part, sizeof(part), STREAM_PART, (unsigned)fb->len);
      res = httpd_resp_send_chunk(req, part, hl);
    }
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (res != ESP_OK) break;                         // viewer closed the page

    int64_t now = esp_timer_get_time();
    int64_t dt = now - last;
    last = now;
    if (dt > 0) {
      float inst = 1000000.0f / (float)dt;
      streamFps = (streamFps <= 0) ? inst : streamFps * 0.9f + inst * 0.1f;
    }
  }
  streaming = false;
  streamFps = 0;
  return res;
}

static void addRoute(httpd_handle_t srv, const char *uri, esp_err_t (*fn)(httpd_req_t *)) {
  httpd_uri_t u;
  memset(&u, 0, sizeof(u));
  u.uri = uri;
  u.method = HTTP_GET;
  u.handler = fn;
  u.user_ctx = nullptr;
  httpd_register_uri_handler(srv, &u);
}

void startServers() {
  httpd_config_t web = HTTPD_DEFAULT_CONFIG();
  web.server_port = 80;
  web.ctrl_port = 32768;
  web.max_uri_handlers = 8;
  web.stack_size = 6144;
  web.lru_purge_enable = true;
  httpd_handle_t webSrv = nullptr;
  if (httpd_start(&webSrv, &web) == ESP_OK) {
    addRoute(webSrv, "/", indexHandler);
    addRoute(webSrv, "/data", dataHandler);
    addRoute(webSrv, "/set", setHandler);
  } else {
    Serial.println("Web server failed to start");
  }

  httpd_config_t st = HTTPD_DEFAULT_CONFIG();
  st.server_port = 81;                 // separate server: video never blocks the dashboard
  st.ctrl_port = 32769;
  st.max_uri_handlers = 2;
  st.stack_size = 6144;
  st.lru_purge_enable = true;
  httpd_handle_t streamSrv = nullptr;
  if (httpd_start(&streamSrv, &st) == ESP_OK) {
    addRoute(streamSrv, "/stream", streamHandler);
  } else {
    Serial.println("Stream server failed to start");
  }
}

// ================================ CAMERA ====================================
bool cameraInit() {
  camera_config_t c;
  memset(&c, 0, sizeof(c));
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer   = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM;  c.pin_d1 = Y3_GPIO_NUM;  c.pin_d2 = Y4_GPIO_NUM;  c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM;  c.pin_d5 = Y7_GPIO_NUM;  c.pin_d6 = Y8_GPIO_NUM;  c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM;   c.pin_pclk = PCLK_GPIO_NUM;
  c.pin_vsync = VSYNC_GPIO_NUM; c.pin_href = HREF_GPIO_NUM;
  c.pin_sccb_sda = SIOD_GPIO_NUM; c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM;   c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    // allocate buffers for the largest size so the resolution can be
    // changed later from the dashboard without overflowing
    c.frame_size  = FRAMESIZE_UXGA;
    c.jpeg_quality = 10;
    c.fb_count    = 2;                       // double buffer = higher FPS
    c.fb_location = CAMERA_FB_IN_PSRAM;
    c.grab_mode   = CAMERA_GRAB_LATEST;      // always the newest frame = low lag
    maxFs = FRAMESIZE_UXGA;
  } else {
    c.frame_size  = FRAMESIZE_VGA;
    c.jpeg_quality = 12;
    c.fb_count    = 1;
    c.fb_location = CAMERA_FB_IN_DRAM;
    c.grab_mode   = CAMERA_GRAB_WHEN_EMPTY;
    maxFs = FRAMESIZE_VGA;
  }

  if (esp_camera_init(&c) != ESP_OK) return false;

  sensor_t *s = esp_camera_sensor_get();
  if (!s) return false;
  int fs = prefs.getUChar("fs", DEFAULT_FS);
  int q  = prefs.getUChar("q", DEFAULT_Q);
  if (fs < FRAMESIZE_QVGA || fs > maxFs) fs = (DEFAULT_FS <= maxFs) ? DEFAULT_FS : maxFs;
  if (q < 8 || q > 40) q = DEFAULT_Q;
  s->set_framesize(s, (framesize_t)fs);
  s->set_quality(s, q);
  s->set_vflip(s, prefs.getUChar("vf", 0) ? 1 : 0);
  s->set_hmirror(s, prefs.getUChar("hm", 0) ? 1 : 0);
  return true;
}

// ================================ SETUP =====================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);   // avoid resets from Wi-Fi current spikes
  Serial.begin(115200);
  Serial.println();

  Serial1.setRxBufferSize(1024);
  Serial1.begin(LINK_BAUD, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN);

  prefs.begin("cam", false);
  flashInit();

  if (!cameraInit()) {
    Serial.println("Camera init FAILED - check the ribbon cable and 5V 2A power. Restarting...");
    delay(3000);
    ESP.restart();
  }

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS, AP_CHANNEL, 0, 4);
  WiFi.setSleep(false);                        // no power save = smooth video
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  startServers();
  Serial.printf("Connect to Wi-Fi \"%s\" (password \"%s\") and open http://%s\n",
                AP_SSID, AP_PASS, WiFi.softAPIP().toString().c_str());
}

// ================================= LOOP =====================================
void loop() {
  static char line[128];
  while (Serial1.available()) {
    if (linkParser.feed((char)Serial1.read(), line, sizeof(line))) handleLine(line);
  }

  int son, trig; bool valid; uint32_t tm;
  portENTER_CRITICAL(&mux);
  son = tel.son; trig = tel.trig; valid = telValid; tm = telMs;
  portEXIT_CRITICAL(&mux);
  servicePending(pendSon,  'E', son,  valid, tm);
  servicePending(pendDist, 'D', trig, valid, tm);

  delay(1);
}