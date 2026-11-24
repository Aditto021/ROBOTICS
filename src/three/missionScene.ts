/**
 * Real-time 3D simulation of the ResQBot mission sequence.
 *
 * One persistent WebGL scene with a model of the built prototype (foam-board
 * tray chassis, yellow-rim wheels, camera tower that doubles as the ball
 * magazine, servo gate, flywheel launcher with a clear guide, HC-SR04 sonar).
 * Each mission stage has its own looping animation; the rover, camera and
 * effects ease between stages so nothing ever jumps.
 *
 * Loaded lazily (dynamic import) by MissionScene3D, so three.js stays out of
 * the main bundle.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type SceneTheme = "dark" | "light";

export interface MissionSceneOptions {
  theme: SceneTheme;
  reducedMotion: boolean;
  stage: number;
}

export interface MissionSceneHandle {
  setStage(stage: number): void;
  setTheme(theme: SceneTheme): void;
  setReducedMotion(reduced: boolean): void;
  setActive(active: boolean): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/* Palette (taken from the physical prototype)                         */
/* ------------------------------------------------------------------ */
const FOAM = 0xece7db;
const FOAM_SIDE = 0xd6cfbf;
const TIRE = 0x15181d;
const RIM = 0xf2c418;
const ORANGE = 0xff7a29;
const TT_YELLOW = 0xf5c20f;

const THEME = {
  dark: { cyan: 0x2be3ff, grid: 0x2be3ff, gridAlpha: 0.5, shadow: 0.42, exposure: 1.05 },
  light: { cyan: 0x0b8ea8, grid: 0x24344a, gridAlpha: 0.32, shadow: 0.2, exposure: 1.0 },
} as const;

/* ------------------------------------------------------------------ */
/* Geometry constants (rover-local units, +x = forward)                */
/* ------------------------------------------------------------------ */
const BALL_R = 0.1;
const TOWER_X = -0.36;
const TOWER_W = 0.3; // outer
const TOWER_Y0 = 0.535;
const TOWER_Y1 = 1.8;
const TOWER_FLOOR = 0.6;
const GATE_TOP = 0.83;
const SLOT_GAP = 0.004;
const slotY = (k: number) => TOWER_FLOOR + BALL_R + k * (2 * BALL_R + SLOT_GAP);

const WHEEL_R = 0.24;
const WHEEL_X = 0.55;
const WHEEL_Z = 0.53;
const SONAR_POS = new THREE.Vector3(0.8, 0.33, 0);
const LENS_POS = new THREE.Vector3(TOWER_X + 0.21, 1.86, 0);
const FLYWHEEL_POS = new THREE.Vector3(0.34, 0.965, 0);

const TARGET = new THREE.Vector3(5, 0, 0);
const START = { x: -3.2, z: 0.62 };
const APPROACH_YAW = Math.atan2(START.z, -START.x); // heading of the drive in

/** Path a released ball follows: magazine bottom -> launcher intake -> guide exit. */
const BALL_PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(TOWER_X, slotY(0), 0),
    new THREE.Vector3(TOWER_X + 0.2, 0.7, 0),
    new THREE.Vector3(0.0, 0.705, 0),
    new THREE.Vector3(0.25, 0.712, 0),
    new THREE.Vector3(0.5, 0.74, 0),
    new THREE.Vector3(0.72, 0.82, 0),
    new THREE.Vector3(0.9, 0.95, 0),
  ],
  false,
  "centripetal",
);
const U_INTAKE = 0.46;
const GUIDE_PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-0.17, 0.7, 0),
    new THREE.Vector3(0.0, 0.705, 0),
    new THREE.Vector3(0.25, 0.712, 0),
    new THREE.Vector3(0.5, 0.74, 0),
    new THREE.Vector3(0.72, 0.82, 0),
    new THREE.Vector3(0.92, 0.965, 0),
  ],
  false,
  "centripetal",
);

/* Stage loop lengths (seconds) */
const LOAD_P = 5.6;
const FEED_P = 2.9;
const LAUNCH_P = 3.2;
const FLIGHT_T0 = 0.8;
const FLIGHT_T = 0.86;
const IMPACT = FLIGHT_T0 + FLIGHT_T; // when the extinguisher ball reaches the fire
const GRAVITY = 8.6;

/** Frozen moment used for each stage when the visitor prefers reduced motion. */
const STILL_T = [4.3, 0.9, 6, 1.6, 1.05, 1.2, 15];

/* ------------------------------------------------------------------ */
/* Small maths helpers                                                 */
/* ------------------------------------------------------------------ */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const fract = (x: number) => x - Math.floor(x);

interface CamPreset {
  pos: [number, number, number];
  look: [number, number, number];
  follow: boolean; // offsets are relative to the rover
}

const CAMS: CamPreset[] = [
  { pos: [1.75, 2.3, 2.3], look: [-0.25, 1.02, 0], follow: true }, // load
  { pos: [2.55, 1.55, 2.75], look: [0.35, 0.62, 0.2], follow: true }, // deploy
  { pos: [-3.4, 2.15, 3.1], look: [2.0, 0.4, 0], follow: true }, // approach
  { pos: [-1.9, 2.75, 2.1], look: [2.6, 0.55, 0], follow: true }, // aim
  { pos: [1.15, 1.25, 2.0], look: [0.0, 0.74, 0], follow: true }, // feed
  { pos: [2.55, 2.5, 7.3], look: [2.55, 0.45, 0], follow: false }, // launch
  { pos: [2.6, 3.1, 7.0], look: [2.6, 0.35, 0], follow: false }, // evaluate (orbits)
];

/* ------------------------------------------------------------------ */
/* Textures drawn on a canvas (no image downloads)                     */
/* ------------------------------------------------------------------ */
function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.12)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function phoneScreenTexture(): THREE.Texture {
  const W = 256;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1626");
  bg.addColorStop(1, "#05080e");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "#2be3ff";
  g.font = "600 22px monospace";
  g.textAlign = "center";
  g.fillText("RESQBOT", W / 2, 62);
  g.font = "14px monospace";
  g.fillStyle = "#8a94a3";
  g.fillText("BLUETOOTH CONTROL", W / 2, 86);

  // connected pill
  g.strokeStyle = "#2be3ff";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(48, 108, W - 96, 34, 17);
  g.stroke();
  g.fillStyle = "#2be3ff";
  g.beginPath();
  g.arc(72, 125, 6, 0, Math.PI * 2);
  g.fill();
  g.font = "600 15px monospace";
  g.textAlign = "left";
  g.fillText("CONNECTED", 88, 130);

  // d-pad
  const cx = W / 2;
  const cy = 290;
  const arm = 62;
  g.fillStyle = "rgba(43,227,255,0.14)";
  g.strokeStyle = "rgba(43,227,255,0.85)";
  g.lineWidth = 2;
  const pad = (dx: number, dy: number, rot: number) => {
    g.save();
    g.translate(cx + dx, cy + dy);
    g.rotate(rot);
    g.beginPath();
    g.roundRect(-26, -26, 52, 52, 10);
    g.fill();
    g.stroke();
    g.fillStyle = "#2be3ff";
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(11, 8);
    g.lineTo(-11, 8);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(43,227,255,0.14)";
    g.restore();
  };
  pad(0, -arm, 0);
  pad(arm, 0, Math.PI / 2);
  pad(0, arm, Math.PI);
  pad(-arm, 0, -Math.PI / 2);

  // fire button
  g.fillStyle = "#ff7a29";
  g.beginPath();
  g.arc(cx, 438, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#05070a";
  g.font = "700 16px monospace";
  g.textAlign = "center";
  g.fillText("FIRE", cx, 444);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function lipoLabelTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 104;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1d2530";
  g.fillRect(0, 0, 256, 104);
  g.fillStyle = "#f2c418";
  g.fillRect(0, 0, 256, 10);
  g.fillRect(0, 94, 256, 10);
  g.fillStyle = "#ffffff";
  g.font = "700 30px sans-serif";
  g.fillText("LiPo", 14, 50);
  g.fillStyle = "#ff7a29";
  g.font = "700 26px sans-serif";
  g.fillText("3S", 100, 50);
  g.fillStyle = "#c9d1db";
  g.font = "500 17px sans-serif";
  g.fillText("11.1V  LITHIUM POLYMER", 14, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Floating AR-style label ("PERSON 0.93") used over detections in the 3D scene. */
function tagTexture(text: string, color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 112;
  const g = c.getContext("2d")!;
  g.font = "700 46px monospace";
  const w = Math.min(500, g.measureText(text).width + 56);
  const x = (512 - w) / 2;
  g.fillStyle = "rgba(5,8,14,0.82)";
  g.beginPath();
  g.roundRect(x, 10, w, 76, 10);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = color;
  g.textAlign = "center";
  g.fillText(text, 256, 64);
  g.beginPath();
  g.moveTo(244, 86);
  g.lineTo(256, 104);
  g.lineTo(268, 86);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Animated flame sheet (fbm noise scrolling upward), used on crossed quads. */
function flameMaterial(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uSeed: { value: seed } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAlpha;
      uniform float uSeed;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 uv = vUv;
        float n = fbm(vec2(uv.x * 3.2 + uSeed * 7.0, uv.y * 2.4 - uTime * 1.7 + uSeed));
        float x = (uv.x - 0.5) * 2.0;
        float width = max(0.05, 0.95 - uv.y * 0.8);
        float shape = 1.0 - smoothstep(0.35, 1.0, abs(x + (n - 0.5) * 0.35 * uv.y) / width);
        float h = uv.y + (n - 0.5) * 0.6;
        float body = shape * (1.0 - smoothstep(0.2, 0.92, h)) * smoothstep(0.0, 0.1, uv.y);
        float t = clamp(body * 1.7, 0.0, 1.0);
        vec3 col = mix(vec3(0.75, 0.1, 0.02), vec3(1.0, 0.5, 0.07), smoothstep(0.12, 0.5, t));
        col = mix(col, vec3(1.0, 0.92, 0.62), smoothstep(0.62, 0.97, t));
        float a = smoothstep(0.04, 0.35, body) * uAlpha;
        gl_FragColor = vec4(col * 1.5, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Ground grid shader                                                  */
/* ------------------------------------------------------------------ */
function gridMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x2be3ff) },
      uAlpha: { value: 0.5 },
      uCenter: { value: new THREE.Vector2() },
      uRadius: { value: 7.5 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      uniform vec2 uCenter;
      uniform float uRadius;
      varying vec3 vWorld;
      float gridLine(vec2 p, float scale, float width) {
        vec2 c = p / scale;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        return 1.0 - min(min(g.x, g.y) / width, 1.0);
      }
      void main() {
        float minor = gridLine(vWorld.xz, 0.5, 1.0);
        float major = gridLine(vWorld.xz, 2.5, 1.3);
        float d = length(vWorld.xz - uCenter);
        float fade = 1.0 - smoothstep(uRadius * 0.3, uRadius, d);
        float a = (minor * 0.28 + major * 0.75) * fade * uAlpha;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Vertical light beam: alpha fades towards the top. */
function beamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(ORANGE) }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float a = pow(1.0 - vUv.y, 2.2) * uAlpha;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Open half-pipe (lower half of a tube) along a curve that lies in the x-y plane. */
function halfPipe(curve: THREE.Curve<THREE.Vector3>, radius: number, segs = 64, around = 14) {
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    const ux = -t.y;
    const uy = t.x;
    for (let j = 0; j <= around; j++) {
      const a = Math.PI * 0.92 + (j / around) * Math.PI * 1.16;
      const s = Math.sin(a);
      const c = Math.cos(a);
      pos.push(p.x + ux * radius * s, p.y + uy * radius * s, p.z + radius * c);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j;
      const b = a + around + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Scene factory                                                       */
/* ------------------------------------------------------------------ */
export function createMissionScene(host: HTMLElement, opts: MissionSceneOptions): MissionSceneHandle {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;
  let dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 60);

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0xe6efff, 0x1a1f2a, 0.65);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(3.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x7fe9ff, 1.1);
  rim.position.set(-4, 3, -3.5);
  scene.add(rim);
  const targetLight = new THREE.PointLight(ORANGE, 0, 3.5, 2);
  targetLight.position.set(TARGET.x, 0.5, TARGET.z);
  scene.add(targetLight);

  /* ---------------- shared resources ---------------- */
  const glowTex = glowTexture();
  const fxMats: THREE.Material[] = []; // blending/colour follow the theme
  const cyanMats: (THREE.MeshBasicMaterial | THREE.SpriteMaterial | THREE.LineBasicMaterial)[] = [];

  const fxMat = (color: number, cyan = false) => {
    const m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    fxMats.push(m);
    if (cyan) cyanMats.push(m);
    return m;
  };
  const glowSprite = (color: number, cyan = false) => {
    const m = new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    fxMats.push(m);
    if (cyan) cyanMats.push(m);
    return new THREE.Sprite(m);
  };
  const lineMat = (color: number, cyan = false) => {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    fxMats.push(m);
    if (cyan) cyanMats.push(m);
    return m;
  };

  const std = (color: number, roughness = 0.85, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

  const M = {
    foam: std(FOAM, 0.88),
    foamSide: std(FOAM_SIDE, 0.92),
    tire: std(TIRE, 0.78),
    rim: std(RIM, 0.45, 0.05),
    hub: std(0x2a2e35, 0.5, 0.3),
    tt: std(TT_YELLOW, 0.55),
    metal: std(0xc3c8cf, 0.28, 0.9),
    darkMetal: std(0x3a4049, 0.4, 0.8),
    pcbNavy: std(0x1b2a44, 0.55, 0.1),
    pcbGreen: std(0x1f6b3a, 0.6, 0.05),
    pcbRed: std(0xb3261e, 0.55, 0.05),
    pcbBlue: std(0x1d4f91, 0.55, 0.05),
    black: std(0x101318, 0.6, 0.2),
    battery: std(0x1d2530, 0.42, 0.15),
    xt60: std(0xf2c418, 0.5),
    servo: std(0x1e3fa6, 0.5, 0.05),
    horn: std(0xf4f4f4, 0.6),
    acrylic: new THREE.MeshStandardMaterial({
      color: 0xd8f6ff,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    wireRed: std(0xd63a2f, 0.5),
    wireYellow: std(0xe8c020, 0.5),
    wireBlack: std(0x1a1a1a, 0.5),
    wireOrange: std(0xff8a3d, 0.5),
    lens: std(0x0a0d12, 0.15, 0.6),
  };

  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, r = 0.008) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /* ---------------- ground ---------------- */
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), gridMaterial());
  grid.rotation.x = -Math.PI / 2;
  grid.renderOrder = -2;
  scene.add(grid);
  const gridU = (grid.material as THREE.ShaderMaterial).uniforms;

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.4, depthWrite: false });
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), shadowMat);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.001;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = -1;
  scene.add(shadowCatcher);

  /* ---------------- rover ---------------- */
  const rover = new THREE.Group();
  scene.add(rover);

  // tray chassis
  rover.add(box(1.56, 0.025, 0.86, M.foam, 0, 0.2, 0));
  rover.add(box(1.56, 0.2, 0.025, M.foam, 0, 0.3, 0.43));
  rover.add(box(1.56, 0.2, 0.025, M.foam, 0, 0.3, -0.43));
  rover.add(box(0.025, 0.2, 0.86, M.foam, -0.78, 0.3, 0));
  rover.add(box(0.025, 0.2, 0.86, M.foam, 0.78, 0.3, 0));
  for (const [x, z] of [
    [-0.74, 0.39],
    [-0.74, -0.39],
    [0.1, 0.39],
    [0.1, -0.39],
    [0.7, 0.39],
    [0.7, -0.39],
  ]) {
    rover.add(box(0.04, 0.14, 0.04, M.foamSide, x, 0.46, z));
  }
  // upper deck
  rover.add(box(1.5, 0.03, 0.82, M.foam, -0.02, 0.52, 0));

  // TT gear motors (yellow) at each wheel
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      rover.add(box(0.22, 0.09, 0.09, M.tt, sx * WHEEL_X, WHEEL_R, sz * 0.36, 0.01));
    }
  }

  // wheels
  const wheels: { g: THREE.Group; z: number }[] = [];
  {
    const tireProfile: THREE.Vector2[] = [];
    const w = 0.085;
    const rr = 0.04;
    tireProfile.push(new THREE.Vector2(0.16, -w));
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
      tireProfile.push(new THREE.Vector2(WHEEL_R - rr + Math.cos(a) * rr, -w + rr + Math.sin(a) * rr));
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      tireProfile.push(new THREE.Vector2(WHEEL_R - rr + Math.cos(a) * rr, w - rr + Math.sin(a) * rr));
    }
    tireProfile.push(new THREE.Vector2(0.16, w));
    const tireGeo = new THREE.LatheGeometry(tireProfile, 48);
    tireGeo.rotateX(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.162, 0.162, 0.13, 40);
    rimGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 20);
    hubGeo.rotateX(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.15, 0.035, 0.02);
    const innerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.135, 32);
    innerGeo.rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(sx * WHEEL_X, WHEEL_R, sz * WHEEL_Z);
        const tire = new THREE.Mesh(tireGeo, M.tire);
        tire.castShadow = true;
        g.add(tire);
        const rimM = new THREE.Mesh(rimGeo, M.rim);
        g.add(rimM);
        const inner = new THREE.Mesh(innerGeo, M.black);
        g.add(inner);
        const hub = new THREE.Mesh(hubGeo, M.rim);
        g.add(hub);
        for (let i = 0; i < 6; i++) {
          const s = new THREE.Mesh(spokeGeo, M.rim);
          s.rotation.z = (i / 6) * Math.PI * 2;
          s.position.set(Math.cos(s.rotation.z) * 0.06, Math.sin(s.rotation.z) * 0.06, sz * 0.058);
          g.add(s);
        }
        rover.add(g);
        wheels.push({ g, z: sz * WHEEL_Z });
      }
    }
  }

  // electronics in the tray
  // 3S LiPo pack: flat soft-wrapped brick with printed label, XT60 and balance lead
  {
    const pack = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.075, 0.15, 3, 0.022), M.battery);
    pack.position.set(-0.48, 0.252, 0.1);
    pack.castShadow = true;
    pack.receiveShadow = true;
    rover.add(pack);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.29, 0.12),
      new THREE.MeshStandardMaterial({ map: lipoLabelTexture(), roughness: 0.5 }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(-0.48, 0.2902, 0.1);
    rover.add(label);
    rover.add(box(0.045, 0.03, 0.03, M.xt60, -0.27, 0.24, 0.05, 0.004)); // XT60
    rover.add(box(0.03, 0.012, 0.022, M.horn, -0.3, 0.232, 0.17, 0.003)); // balance plug
  }
  rover.add(box(0.12, 0.012, 0.08, M.pcbGreen, -0.5, 0.22, -0.22)); // BMS
  rover.add(box(0.26, 0.016, 0.11, M.pcbNavy, 0.25, 0.225, 0.2)); // ESP32
  rover.add(box(0.09, 0.016, 0.08, M.metal, 0.3, 0.24, 0.2, 0.004));
  rover.add(box(0.17, 0.016, 0.17, M.pcbRed, -0.05, 0.222, -0.2)); // L298N
  {
    const hs = new THREE.Group();
    for (let i = 0; i < 6; i++) hs.add(box(0.008, 0.08, 0.12, M.black, -0.1 + i * 0.02, 0.27, -0.2, 0.002));
    rover.add(hs);
  }
  rover.add(box(0.22, 0.014, 0.26, M.pcbGreen, 0.5, 0.222, -0.08)); // proto board
  // voltmeter on deck
  rover.add(box(0.13, 0.04, 0.07, M.black, -0.02, 0.555, 0.3, 0.006));
  const voltDigits = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.035),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }),
  );
  voltDigits.rotation.x = -Math.PI / 2;
  voltDigits.position.set(-0.02, 0.5765, 0.3);
  rover.add(voltDigits);

  // status LEDs
  const ledGeo = new THREE.SphereGeometry(0.012, 10, 8);
  const espLedMat = new THREE.MeshBasicMaterial({ color: 0x3aa0ff, toneMapped: false });
  const espLed = new THREE.Mesh(ledGeo, espLedMat);
  espLed.position.set(0.16, 0.24, 0.24);
  rover.add(espLed);
  const espGlow = glowSprite(0x3aa0ff);
  espGlow.position.copy(espLed.position);
  espGlow.scale.setScalar(0.18);
  rover.add(espGlow);
  const protoLed = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0x31ff6a, toneMapped: false }));
  protoLed.position.set(0.45, 0.236, 0.02);
  rover.add(protoLed);
  const protoGlow = glowSprite(0x31ff6a);
  protoGlow.position.copy(protoLed.position);
  protoGlow.scale.setScalar(0.26);
  rover.add(protoGlow);

  // wires (gentle curves from the boards up to the tower / launcher)
  const wire = (pts: number[][], mat: THREE.Material) => {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 28, 0.007, 5), mat);
    m.castShadow = true;
    rover.add(m);
  };
  wire([[0.2, 0.24, 0.18], [0.0, 0.4, 0.3], [-0.2, 0.62, 0.22], [-0.26, 0.82, 0.17]], M.wireYellow);
  wire([[0.22, 0.24, 0.16], [0.05, 0.42, 0.27], [-0.18, 0.66, 0.2], [-0.25, 0.84, 0.17]], M.wireRed);
  wire([[-0.05, 0.24, -0.15], [0.15, 0.45, -0.25], [0.3, 0.7, -0.24], [0.34, 0.97, -0.2]], M.wireRed);
  wire([[-0.03, 0.24, -0.13], [0.2, 0.42, -0.2], [0.36, 0.68, -0.26], [0.36, 0.93, -0.21]], M.wireBlack);
  wire([[0.3, 0.24, 0.22], [0.0, 0.5, 0.25], [-0.3, 1.2, 0.18], [-0.24, 1.78, 0.06]], M.wireOrange);
  wire([[0.6, 0.23, -0.1], [0.72, 0.28, -0.05], [0.77, 0.32, -0.04]], M.wireYellow);
  // LiPo leads: XT60 power and balance plug
  wire([[-0.31, 0.25, 0.1], [-0.3, 0.24, 0.06], [-0.27, 0.24, 0.05]], M.wireRed);
  wire([[-0.31, 0.25, 0.12], [-0.31, 0.236, 0.16], [-0.3, 0.232, 0.17]], M.wireYellow);

  // HC-SR04 sonar
  rover.add(box(0.012, 0.09, 0.2, M.pcbBlue, 0.795, 0.33, 0, 0.003));
  for (const z of [-0.055, 0.055]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 24), M.metal);
    t.rotation.z = Math.PI / 2;
    t.position.set(0.82, 0.33, z);
    t.castShadow = true;
    rover.add(t);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), M.black);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(0.846, 0.33, z);
    rover.add(mesh);
  }

  // camera tower / ball magazine
  const th = TOWER_Y1 - TOWER_Y0;
  const tc = TOWER_Y0 + th / 2;
  const half = TOWER_W / 2;
  rover.add(box(0.03, th, TOWER_W, M.foam, TOWER_X - half + 0.015, tc, 0)); // back
  rover.add(box(TOWER_W, th, 0.03, M.foam, TOWER_X, tc, -half + 0.015)); // -z side
  // front (+x) acrylic above the feed opening, +z side acrylic
  const frontH = TOWER_Y1 - GATE_TOP;
  {
    const fa = new THREE.Mesh(new THREE.PlaneGeometry(TOWER_W - 0.03, frontH), M.acrylic);
    fa.rotation.y = Math.PI / 2;
    fa.position.set(TOWER_X + half - 0.008, GATE_TOP + frontH / 2, 0);
    rover.add(fa);
    const sa = new THREE.Mesh(new THREE.PlaneGeometry(TOWER_W - 0.03, th), M.acrylic);
    sa.position.set(TOWER_X, tc, half - 0.008);
    rover.add(sa);
  }
  // corner posts + rims to frame the acrylic
  rover.add(box(0.03, th, 0.03, M.foamSide, TOWER_X + half - 0.015, tc, half - 0.015));
  rover.add(box(0.03, th, 0.03, M.foamSide, TOWER_X + half - 0.015, tc, -half + 0.015));
  rover.add(box(0.03, th, 0.03, M.foamSide, TOWER_X - half + 0.015, tc, half - 0.015));
  rover.add(box(TOWER_W, 0.03, 0.03, M.foamSide, TOWER_X, TOWER_Y1 - 0.015, half - 0.015));
  rover.add(box(0.03, 0.03, TOWER_W, M.foamSide, TOWER_X + half - 0.015, TOWER_Y1 - 0.015, 0));
  rover.add(box(0.03, 0.03, TOWER_W, M.foamSide, TOWER_X + half - 0.015, GATE_TOP + 0.015, 0));
  rover.add(box(0.26, 0.03, 0.26, M.foamSide, TOWER_X, TOWER_FLOOR - 0.015, 0)); // magazine floor

  // ESP32-CAM on top
  rover.add(box(0.05, 0.08, 0.16, M.foamSide, TOWER_X + 0.15, 1.84, 0, 0.006));
  rover.add(box(0.016, 0.12, 0.1, M.pcbNavy, TOWER_X + 0.182, 1.86, 0, 0.004));
  {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.04, 24), M.lens);
    lens.rotation.z = Math.PI / 2;
    lens.position.copy(LENS_POS);
    rover.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 24), M.metal);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(LENS_POS.x + 0.02, LENS_POS.y, LENS_POS.z);
    rover.add(ring);
  }
  const camLedMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d, toneMapped: false });
  const camLed = new THREE.Mesh(ledGeo, camLedMat);
  camLed.position.set(TOWER_X + 0.192, 1.905, 0.035);
  rover.add(camLed);
  const camGlow = glowSprite(0xff3b3b);
  camGlow.position.copy(camLed.position);
  camGlow.scale.setScalar(0.12);
  rover.add(camGlow);

  // servo gate: plate hinged at the top of the feed opening
  const gatePivot = new THREE.Group();
  gatePivot.position.set(TOWER_X + half + 0.012, GATE_TOP, 0);
  {
    const plate = box(0.016, GATE_TOP - TOWER_FLOOR + 0.01, 0.24, M.foamSide, 0, -(GATE_TOP - TOWER_FLOOR) / 2, 0, 0.004);
    gatePivot.add(plate);
  }
  rover.add(gatePivot);
  rover.add(box(0.12, 0.11, 0.05, M.servo, TOWER_X + 0.07, GATE_TOP + 0.05, half + 0.03, 0.006));
  const horn = new THREE.Group();
  horn.position.set(TOWER_X + 0.11, GATE_TOP + 0.06, half + 0.062);
  horn.add(box(0.11, 0.018, 0.01, M.horn, 0.04, 0, 0, 0.004));
  rover.add(horn);

  // launcher: A-frame, motor, flywheel, clear guide
  for (const z of [-0.22, 0.22]) {
    const a1 = box(0.035, 0.52, 0.03, M.foam, 0.22, 0.77, z);
    a1.rotation.z = -0.32;
    rover.add(a1);
    const a2 = box(0.035, 0.52, 0.03, M.foam, 0.46, 0.77, z);
    a2.rotation.z = 0.32;
    rover.add(a2);
  }
  rover.add(box(0.06, 0.03, 0.47, M.foamSide, FLYWHEEL_POS.x, 1.0, 0)); // cross bar
  rover.add(box(0.2, 0.2, 0.15, M.foam, FLYWHEEL_POS.x, FLYWHEEL_POS.y, -0.155, 0.01)); // motor box
  {
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 28), M.metal);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(FLYWHEEL_POS.x, FLYWHEEL_POS.y, -0.13);
    motor.castShadow = true;
    rover.add(motor);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), M.darkMetal);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(FLYWHEEL_POS.x, FLYWHEEL_POS.y, -0.04);
    rover.add(cap);
  }
  const flywheel = new THREE.Group();
  flywheel.position.copy(FLYWHEEL_POS);
  {
    const fwTire = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.032, 14, 40), M.tire);
    fwTire.castShadow = true;
    flywheel.add(fwTire);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 32), M.rim);
    disc.rotation.x = Math.PI / 2;
    flywheel.add(disc);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.06), M.hub);
      s.rotation.z = (i / 5) * Math.PI * 2;
      s.position.set(Math.cos(s.rotation.z) * 0.05, Math.sin(s.rotation.z) * 0.05, 0);
      flywheel.add(s);
    }
  }
  rover.add(flywheel);
  const blurMat = new THREE.MeshBasicMaterial({
    color: 0xffd640,
    map: glowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(0.19, 40), blurMat);
  blurDisc.position.set(FLYWHEEL_POS.x, FLYWHEEL_POS.y, 0.04);
  rover.add(blurDisc);

  const guide = new THREE.Mesh(halfPipe(GUIDE_PATH, 0.118), M.acrylic);
  rover.add(guide);
  {
    const railPts = (side: number) =>
      GUIDE_PATH.getSpacedPoints(48).map((p, i, arr) => {
        const t = GUIDE_PATH.getTangentAt(i / (arr.length - 1));
        const up = new THREE.Vector3(-t.y, t.x, 0).multiplyScalar(0.03);
        return p.clone().add(up).add(new THREE.Vector3(0, 0, side * 0.116));
      });
    const railMat = new THREE.LineBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.55, toneMapped: false });
    rover.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPts(1)), railMat));
    rover.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPts(-1)), railMat));
  }
  // guide support
  rover.add(box(0.5, 0.02, 0.2, M.foamSide, 0.1, 0.565, 0));

  /* ---------------- balls ---------------- */
  const ballGeo = new THREE.SphereGeometry(BALL_R, 32, 20);
  const balls: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: ORANGE,
      roughness: 0.32,
      metalness: 0,
      emissive: ORANGE,
      emissiveIntensity: 0.08,
      transparent: false,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.castShadow = true;
    rover.add(mesh);
    balls.push({ mesh, mat });
  }

  /* ---------------- target ---------------- */
  const targetG = new THREE.Group();
  targetG.position.copy(TARGET);
  scene.add(targetG);
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0.004) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    return m;
  };
  const tRingMat = fxMat(ORANGE);
  const tFillMat = fxMat(ORANGE);
  targetG.add(flat(new THREE.RingGeometry(0.98, 1.03, 72), tRingMat));
  targetG.add(flat(new THREE.RingGeometry(0.6, 0.63, 64), tRingMat));
  targetG.add(flat(new THREE.CircleGeometry(0.2, 40), tFillMat));
  for (let i = 0; i < 4; i++) {
    const tick = flat(new THREE.PlaneGeometry(0.28, 0.025), tRingMat);
    const a = (i / 4) * Math.PI * 2;
    tick.position.set(Math.cos(a) * 1.22, 0.004, Math.sin(a) * 1.22);
    tick.rotation.z = -a;
    targetG.add(tick);
  }
  const tPulseMat = fxMat(ORANGE);
  const tPulse = flat(new THREE.RingGeometry(0.96, 1.0, 72), tPulseMat, 0.006);
  targetG.add(tPulse);
  const beamMat = beamMaterial();
  fxMats.push(beamMat);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 32, 1, true), beamMat);
  beam.position.y = 1.3;
  targetG.add(beam);

  /* ---------------- stage effects ---------------- */
  // Load: glow over the magazine mouth
  const mouthGlow = glowSprite(ORANGE);
  mouthGlow.scale.setScalar(0.55);
  rover.add(mouthGlow);

  // Deploy: phone hologram + Bluetooth particles + power ring
  const phone = new THREE.Group();
  const phoneBodyMat = new THREE.MeshStandardMaterial({
    color: 0x10151c,
    roughness: 0.3,
    metalness: 0.6,
    transparent: true,
    opacity: 0,
  });
  phone.add(new THREE.Mesh(new RoundedBoxGeometry(0.31, 0.6, 0.03, 3, 0.03), phoneBodyMat));
  const screenMat = new THREE.MeshBasicMaterial({
    map: phoneScreenTexture(),
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.56), screenMat);
  screen.position.z = 0.0165;
  phone.add(screen);
  const phoneHalo = glowSprite(0x2be3ff, true);
  phoneHalo.scale.set(0.9, 1.1, 1);
  phoneHalo.position.z = -0.05;
  phone.add(phoneHalo);
  scene.add(phone);

  const btDots: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const s = glowSprite(0x2be3ff, true);
    scene.add(s);
    btDots.push(s);
  }
  const powerRings: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const r = flat(new THREE.RingGeometry(0.97, 1.0, 72), fxMat(0x2be3ff, true), 0.008);
    rover.add(r);
    powerRings.push(r);
  }

  // Approach: sonar arcs
  const sonarArcs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 40, 1, -0.42, 0.84), fxMat(0x2be3ff, true));
    arc.rotation.x = -Math.PI / 2;
    arc.position.copy(SONAR_POS).add(new THREE.Vector3(0.05, 0, 0));
    rover.add(arc);
    sonarArcs.push(arc);
  }

  // Aim: camera frustum, scan slice, reticle
  const frustumGeo = new THREE.BufferGeometry();
  frustumGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
  frustumGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
  const frustumFaceMat = fxMat(0x2be3ff, true);
  const frustum = new THREE.Mesh(frustumGeo, frustumFaceMat);
  frustum.frustumCulled = false;
  rover.add(frustum);
  const frustumLineGeo = new THREE.BufferGeometry();
  frustumLineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  const frustumLines = new THREE.LineSegments(frustumLineGeo, lineMat(0x2be3ff, true));
  frustumLines.frustumCulled = false;
  rover.add(frustumLines);
  const scanGeo = new THREE.BufferGeometry();
  scanGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
  const scanLine = new THREE.Line(scanGeo, lineMat(0x2be3ff, true));
  scanLine.frustumCulled = false;
  rover.add(scanLine);

  const reticle = new THREE.Group();
  const reticleMat = fxMat(0x2be3ff, true);
  reticle.add(flat(new THREE.RingGeometry(0.44, 0.47, 64, 1, 0.2, Math.PI / 2 - 0.4), reticleMat, 0));
  reticle.add(flat(new THREE.RingGeometry(0.44, 0.47, 64, 1, Math.PI / 2 + 0.2, Math.PI / 2 - 0.4), reticleMat, 0));
  reticle.add(flat(new THREE.RingGeometry(0.44, 0.47, 64, 1, Math.PI + 0.2, Math.PI / 2 - 0.4), reticleMat, 0));
  reticle.add(flat(new THREE.RingGeometry(0.44, 0.47, 64, 1, 1.5 * Math.PI + 0.2, Math.PI / 2 - 0.4), reticleMat, 0));
  reticle.position.set(TARGET.x, 0.012, TARGET.z);
  scene.add(reticle);

  // Launch: trail, impact flash, shock ring, sparks
  const trailMat = new THREE.MeshBasicMaterial({
    color: ORANGE,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  });
  fxMats.push(trailMat);
  const TRAIL_N = 22;
  const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), trailMat, TRAIL_N);
  trail.frustumCulled = false;
  scene.add(trail);
  const impactFlash = glowSprite(0xe8f7ff);
  scene.add(impactFlash);
  const shock = flat(new THREE.RingGeometry(0.9, 1.0, 72), fxMat(0xdff4ff), 0.01);
  shock.position.x = TARGET.x;
  scene.add(shock);
  const sparks: { s: THREE.Sprite; d: THREE.Vector3 }[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
    const up = 1.4 + ((i * 37) % 10) / 10;
    const sp = 1.1 + ((i * 53) % 10) / 12;
    const s = glowSprite(0xdff4ff);
    scene.add(s);
    sparks.push({ s, d: new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp) });
  }

  // Evaluate: radar sweep + hit ring
  const sweepMat = fxMat(0x2be3ff, true);
  const sweep = flat(new THREE.CircleGeometry(1.45, 40, 0, 0.75), sweepMat, 0.009);
  sweep.position.x = TARGET.x;
  scene.add(sweep);
  const radarRingMat = fxMat(0x2be3ff, true);
  const radarRing = flat(new THREE.RingGeometry(1.43, 1.46, 96), radarRingMat, 0.009);
  radarRing.position.x = TARGET.x;
  scene.add(radarRing);
  const hitRings: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const r = flat(new THREE.RingGeometry(0.2, 0.24, 48), fxMat(0x2be3ff, true), 0.011);
    r.position.x = TARGET.x;
    scene.add(r);
    hitRings.push(r);
  }

  /* ------------------------------------------------------------------ */
  /* State                                                              */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* Final scenario: rescue zone + operator laptop running the AI       */
  /* dashboard on the live ESP32-CAM feed                               */
  /* ------------------------------------------------------------------ */
  const scenario = new THREE.Group();
  scene.add(scenario);
  const hideInFeed: THREE.Object3D[] = [sweep, radarRing, ...hitRings, phone];

  /* Stylised 3D cartoon characters: big expressive head, glasses, swept hair,
     collared shirt with rolled sleeves, belt, jeans and shoes. Built from
     primitives so nothing is downloaded. */
  interface Look {
    skin: number;
    shirt: number;
    pants: number;
    hair: number;
    shoes: number;
    glasses: boolean;
    watch: boolean;
    mouth: "open" | "frown";
    quiff: boolean;
  }
  interface Person {
    root: THREE.Group;
    torso: THREE.Mesh;
    head: THREE.Group;
    eyes: THREE.Group[];
    mouth: THREE.Mesh;
    joints: Record<string, THREE.Object3D>;
    parts: Record<string, THREE.Group>;
  }
  const phys = (color: number, roughness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, ...extra });
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const sphereG = (r: number, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
  const capsuleG = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 18);

  /** Jointed character ~1.45 units tall, feet at y = 0, facing +z. */
  const makePerson = (look: Look): Person => {
    const root = new THREE.Group();
    const skinM = phys(look.skin, 0.48, { sheen: 0.4, sheenColor: new THREE.Color(0xffd6b8), sheenRoughness: 0.55 });
    const shirtM = phys(look.shirt, 0.8, { sheen: 0.6, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8 });
    const shirtTrim = phys(new THREE.Color(look.shirt).offsetHSL(0, 0, 0.07).getHex(), 0.8);
    const pantsM = phys(look.pants, 0.86, { sheen: 0.35, sheenColor: new THREE.Color(0x9fb4d6), sheenRoughness: 0.7 });
    const hemM = phys(new THREE.Color(look.pants).offsetHSL(0, 0, -0.05).getHex(), 0.9);
    const hairM = phys(look.hair, 0.5, { sheen: 0.7, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.35 });
    const shoeM = phys(look.shoes, 0.42, { clearcoat: 0.45, clearcoatRoughness: 0.35 });
    const soleM = phys(0x2a211c, 0.8);
    const beltM = phys(0x7a4a2b, 0.5, { clearcoat: 0.3, clearcoatRoughness: 0.4 });
    const eyeWhiteM = phys(0xffffff, 0.15, { clearcoat: 1, clearcoatRoughness: 0.05 });
    const irisM = phys(0x3b2516, 0.2, { clearcoat: 1, clearcoatRoughness: 0.05 });
    const darkM = phys(0x1b1512, 0.5);
    const glintM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const joints: Record<string, THREE.Object3D> = {};
    const parts: Record<string, THREE.Group> = {};
    const mark = (name: string, parent: THREE.Object3D, y = 0) => {
      const o = new THREE.Object3D();
      o.position.y = y;
      parent.add(o);
      joints[name] = o;
    };

    // hips, belt, torso + shirt details
    const pelvis = part(capsuleG(0.105, 0.09), pantsM, 0, 0.63, 0);
    pelvis.rotation.z = Math.PI / 2;
    pelvis.scale.z = 0.8;
    root.add(pelvis);
    const belt = part(new THREE.CylinderGeometry(0.129, 0.129, 0.045, 32), beltM, 0, 0.7, 0);
    belt.scale.z = 0.8;
    root.add(belt);
    root.add(part(new THREE.BoxGeometry(0.05, 0.038, 0.012), M.metal, 0, 0.7, 0.104));
    const torso = part(capsuleG(0.135, 0.17), shirtM, 0, 0.86, 0);
    torso.scale.set(1.05, 1, 0.74);
    root.add(torso);
    for (const s of [-1, 1]) {
      const collar = part(new THREE.BoxGeometry(0.075, 0.012, 0.06), shirtTrim, s * 0.042, 1.015, 0.072);
      collar.rotation.set(0.55, 0, s * 0.55);
      root.add(collar);
    }
    for (let i = 0; i < 3; i++) root.add(part(sphereG(0.008, 8, 6), shirtTrim, 0, 0.95 - i * 0.075, 0.1));
    root.add(part(new THREE.BoxGeometry(0.06, 0.065, 0.008), shirtTrim, 0.062, 0.92, 0.094));
    root.add(part(new THREE.CylinderGeometry(0.042, 0.046, 0.09, 16), skinM, 0, 1.04, 0));
    mark("neck", root, 1.04);

    // head
    const head = new THREE.Group();
    head.position.y = 1.08;
    root.add(head);
    parts.head = head;
    mark("head", head, 0.14);
    const skull = part(sphereG(0.155, 36, 26), skinM, 0, 0.14, 0);
    skull.scale.set(1, 1.06, 0.98);
    head.add(skull);
    for (const s of [-1, 1]) {
      const ear = part(sphereG(0.035, 14, 10), skinM, s * 0.152, 0.13, -0.005);
      ear.scale.set(0.6, 1, 1);
      head.add(ear);
    }
    const nose = part(sphereG(0.025, 14, 10), skinM, 0, 0.115, 0.152);
    nose.scale.set(1, 0.9, 1);
    head.add(nose);
    const eyes: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.058, 0.165, 0.126);
      const white = part(sphereG(0.036, 20, 14), eyeWhiteM);
      white.scale.set(1, 1.12, 0.7);
      eye.add(white);
      eye.add(part(sphereG(0.021, 16, 12), irisM, 0, -0.002, 0.014));
      eye.add(part(sphereG(0.0065, 8, 6), glintM, 0.008, 0.009, 0.034));
      head.add(eye);
      eyes.push(eye);
      const brow = part(new THREE.BoxGeometry(0.062, 0.014, 0.018), hairM, s * 0.058, 0.222, 0.136);
      brow.rotation.set(0, s * 0.35, -s * 0.28); // inner ends raised: worried
      head.add(brow);
    }
    let mouth: THREE.Mesh;
    if (look.mouth === "open") {
      mouth = part(sphereG(0.028, 16, 12), phys(0x5a1d1d, 0.6), 0, 0.074, 0.142);
      mouth.scale.set(1.15, 0.8, 0.45);
    } else {
      mouth = part(new THREE.TorusGeometry(0.026, 0.0065, 6, 16, Math.PI), darkM, 0, 0.068, 0.148);
    }
    head.add(mouth);
    if (look.glasses) {
      for (const s of [-1, 1]) {
        head.add(part(new THREE.TorusGeometry(0.043, 0.0068, 8, 28), darkM, s * 0.058, 0.165, 0.165));
        const temple = part(new THREE.BoxGeometry(0.008, 0.008, 0.15), darkM, s * 0.145, 0.168, 0.09);
        temple.rotation.y = -s * 0.12;
        head.add(temple);
      }
      head.add(part(new THREE.BoxGeometry(0.03, 0.008, 0.008), darkM, 0, 0.175, 0.17));
    }
    const cap = part(new THREE.SphereGeometry(0.163, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, 0.16, -0.012);
    cap.rotation.x = -0.28;
    cap.scale.set(1.03, 1, 1.04);
    head.add(cap);
    if (look.quiff) {
      // swept-up quiff of rounded locks
      for (let i = 0; i < 7; i++) {
        const x = -0.09 + i * 0.03;
        const lock = part(sphereG(0.05, 14, 10), hairM, x, 0.29 + Math.sin(i * 1.7) * 0.012, 0.045 - Math.abs(x) * 0.3);
        lock.scale.set(0.85, 1.55, 0.8);
        lock.rotation.set(-0.75 - (i % 2) * 0.15, 0, x * 3.2);
        head.add(lock);
      }
    } else {
      const fringe = part(sphereG(0.06, 14, 10), hairM, 0.03, 0.25, 0.1);
      fringe.scale.set(1.8, 0.55, 0.9);
      fringe.rotation.z = -0.25;
      head.add(fringe);
    }

    // arms with rolled sleeves
    for (const side of [-1, 1]) {
      const s = side < 0 ? "R" : "L"; // facing +z, the figure's right is -x
      const sh = new THREE.Group();
      sh.position.set(side * 0.165, 0.985, 0);
      root.add(sh);
      parts["sh" + s] = sh;
      mark("sh" + s, sh);
      sh.add(part(sphereG(0.062, 18, 14), shirtM));
      sh.add(part(capsuleG(0.055, 0.13), shirtM, 0, -0.11, 0));
      const el = new THREE.Group();
      el.position.y = -0.235;
      sh.add(el);
      parts["el" + s] = el;
      mark("el" + s, el);
      el.add(part(new THREE.CylinderGeometry(0.06, 0.058, 0.06, 18), shirtTrim, 0, 0.0, 0));
      el.add(part(capsuleG(0.04, 0.12), skinM, 0, -0.1, 0));
      const hand = part(sphereG(0.052, 18, 14), skinM, 0, -0.215, 0.005);
      hand.scale.set(0.9, 1, 0.85);
      el.add(hand);
      el.add(part(sphereG(0.02, 10, 8), skinM, -side * 0.032, -0.2, 0.035));
      if (look.watch && s === "L") {
        const watch = part(new THREE.TorusGeometry(0.043, 0.01, 8, 24), phys(0xe0703a, 0.4), 0, -0.165, 0);
        watch.rotation.x = Math.PI / 2;
        el.add(watch);
      }
      mark("wr" + s, el, -0.2);

      // legs: jeans + shoes
      const hip = new THREE.Group();
      hip.position.set(side * 0.075, 0.62, 0);
      root.add(hip);
      parts["hip" + s] = hip;
      mark("hip" + s, hip);
      hip.add(part(capsuleG(0.072, 0.17), pantsM, 0, -0.13, 0));
      const kn = new THREE.Group();
      kn.position.y = -0.27;
      hip.add(kn);
      parts["kn" + s] = kn;
      mark("kn" + s, kn);
      kn.add(part(capsuleG(0.064, 0.17), pantsM, 0, -0.12, 0));
      kn.add(part(new THREE.CylinderGeometry(0.068, 0.07, 0.035, 18), hemM, 0, -0.235, 0));
      kn.add(part(new RoundedBoxGeometry(0.12, 0.085, 0.22, 3, 0.035), shoeM, 0, -0.3, 0.035));
      kn.add(part(new THREE.BoxGeometry(0.124, 0.02, 0.222), soleM, 0, -0.337, 0.035));
      mark("an" + s, kn, -0.27);
    }
    return { root, torso, head, eyes, mouth, joints, parts };
  };

  // survivor standing, waving and calling to the rover
  const waver = makePerson({
    skin: 0xf1c09c,
    shirt: 0x9aa6cc,
    pants: 0x3b4a66,
    hair: 0x5a3420,
    shoes: 0x8a5530,
    glasses: true,
    watch: true,
    mouth: "open",
    quiff: true,
  });
  const WAVER = new THREE.Vector3(3.65, 0, 1.85);
  waver.root.position.copy(WAVER);
  waver.root.rotation.y = Math.atan2(-WAVER.x, -WAVER.z);
  scenario.add(waver.root);

  // person down: lying on their back, one knee raised, head lifting weakly
  const down = makePerson({
    skin: 0xb27650,
    shirt: 0x3f8f7a,
    pants: 0x8b7a5a,
    hair: 0x1d1714,
    shoes: 0x3a2e28,
    glasses: false,
    watch: false,
    mouth: "frown",
    quiff: false,
  });
  const DOWN = new THREE.Vector3(6.05, 0, 1.5);
  const downHolder = new THREE.Group();
  downHolder.position.set(DOWN.x, 0.11, DOWN.z);
  downHolder.rotation.y = 0.95;
  down.root.rotation.x = -Math.PI / 2;
  down.root.position.z = 0.7;
  down.parts.head.rotation.x = 0.32;
  down.parts.shR.rotation.z = -0.45;
  down.parts.hipL.rotation.x = -0.65;
  down.parts.knL.rotation.x = 1.2;
  down.parts.hipR.rotation.z = -0.08;
  downHolder.add(down.root);
  scenario.add(downHolder);

  // fire burning on a pile of debris at the target area (shown from Approach onward,
  // put out by the extinguisher ball in Launch, and again in the final scene)
  const FIRE = new THREE.Vector3(TARGET.x, 0, TARGET.z);
  const fireG = new THREE.Group();
  fireG.position.copy(FIRE);
  scene.add(fireG);
  const charM = std(0x2a2421, 0.95);
  const woodM = std(0x5b4636, 0.9);
  fireG.add(box(0.62, 0.16, 0.42, charM, 0, 0.08, 0, 0.03));
  const beam1 = box(1.1, 0.09, 0.1, woodM, 0.05, 0.2, 0.08, 0.02);
  beam1.rotation.set(0.1, 0.5, 0.18);
  fireG.add(beam1);
  const beam2 = box(0.95, 0.08, 0.09, charM, -0.05, 0.22, -0.1, 0.02);
  beam2.rotation.set(-0.12, -0.7, -0.15);
  fireG.add(beam2);
  const flameMats: THREE.ShaderMaterial[] = [];
  const flames: THREE.Mesh[] = [];
  const flame = (w: number, h: number, x: number, z: number, seed: number, rot: number) => {
    const fm = flameMaterial(seed);
    flameMats.push(fm);
    fxMats.push(fm);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm);
    q.position.set(x, h / 2 + 0.12, z);
    q.rotation.y = rot;
    q.renderOrder = 3;
    q.userData.h = h;
    fireG.add(q);
    flames.push(q);
  };
  for (let i = 0; i < 3; i++) flame(1.05, 1.6, 0, 0, i * 1.37, (i / 3) * Math.PI);
  flame(0.55, 0.95, 0.38, 0.18, 4.1, 0.4);
  flame(0.5, 0.85, -0.34, -0.22, 5.3, -0.9);
  const fireLight = new THREE.PointLight(0xff7a29, 0, 7.5, 1.6);
  fireLight.position.set(FIRE.x, 0.85, FIRE.z);
  scene.add(fireLight);
  const fireGlow = glowSprite(0xff8a3d);
  fireGlow.scale.setScalar(2.6);
  fireGlow.position.set(FIRE.x, 0.7, FIRE.z);
  scene.add(fireGlow);
  const smoke: THREE.Sprite[] = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0x59606a, transparent: true, opacity: 0, depthWrite: false }),
    );
    scene.add(s);
    smoke.push(s);
  }
  const embers: THREE.Sprite[] = [];
  for (let i = 0; i < 18; i++) {
    const s = glowSprite(0xffa040);
    scene.add(s);
    embers.push(s);
  }
  // extinguisher burst: a cloud of white powder/foam thrown out where the ball breaks
  const powder: { s: THREE.Sprite; d: THREE.Vector3; r: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39996; // golden-angle spread
    const up = 0.15 + ((i * 37) % 17) / 22;
    const len = Math.hypot(1, up);
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xeef8ff, transparent: true, opacity: 0, depthWrite: false }),
    );
    s.renderOrder = 4;
    scene.add(s);
    powder.push({ s, d: new THREE.Vector3(Math.cos(a) / len, up / len, Math.sin(a) / len), r: 0.9 + ((i * 53) % 10) / 12 });
  }

  // hazard: gas cylinder, plus scattered rubble
  const GAS = new THREE.Vector3(4.3, 0, -1.95);
  const gasG = new THREE.Group();
  gasG.position.copy(GAS);
  {
    const redM = std(0xc0262d, 0.38, 0.3);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 28), redM);
    body.position.y = 0.25;
    body.castShadow = true;
    gasG.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), redM);
    dome.position.y = 0.48;
    gasG.add(dome);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.08, 14), M.metal);
    valve.position.y = 0.6;
    gasG.add(valve);
    const ringFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), M.darkMetal);
    ringFoot.position.y = 0.015;
    gasG.add(ringFoot);
  }
  scenario.add(gasG);
  const rubbleM = std(0x8a8f96, 0.95);
  const rubbleGeo = new THREE.IcosahedronGeometry(1, 0);
  for (const [x, z, s] of [
    [5.3, -1.0, 0.16],
    [5.75, -2.1, 0.22],
    [7.2, -0.6, 0.18],
    [4.6, 1.05, 0.12],
    [6.9, 2.1, 0.17],
    [3.2, -1.3, 0.11],
    [7.4, -2.0, 0.2],
  ]) {
    const r = new THREE.Mesh(rubbleGeo, rubbleM);
    r.scale.set(s * 1.3, s * 0.7, s);
    r.position.set(x, s * 0.45, z);
    r.rotation.set(x, z, s * 10);
    r.castShadow = true;
    r.receiveShadow = true;
    scenario.add(r);
  }

  // detections: ground ring + floating tag in the 3D scene
  interface Detection {
    reveal: number;
    until: number;
    ring: THREE.Mesh;
    ringMat: THREE.MeshBasicMaterial;
    tag: THREE.Sprite;
    baseY: number;
  }
  const detection = (
    text: string,
    css: string,
    hex: number,
    at: THREE.Vector3,
    h: number,
    r: number,
    reveal: number,
    until = Infinity,
  ) => {
    const ringMat = fxMat(hex);
    const ring = flat(new THREE.RingGeometry(r, r + 0.045, 64), ringMat, 0.012);
    ring.position.set(at.x, 0.012, at.z);
    scene.add(ring);
    const tag = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tagTexture(text, css),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    tag.position.set(at.x, h, at.z);
    tag.scale.set(1.2, 0.26, 1);
    tag.renderOrder = 5;
    scene.add(tag);
    hideInFeed.push(ring, tag);
    return { reveal, until, ring, ringMat, tag, baseY: h } as Detection;
  };
  // final scene timeline (seconds into the slide): fire seen -> ball hits -> fire out -> people
  const REVEAL = { fire: 0.3, out: IMPACT + 0.7, person: 3.2, down: 4.0, gas: 4.8 };
  const detections = [
    detection("FIRE 0.88", "#ff7a29", 0xff7a29, FIRE, 2.05, 0.8, REVEAL.fire, IMPACT + 0.15),
    detection("FIRE SUPPRESSED", "#31d27c", 0x31d27c, FIRE, 1.25, 0.8, REVEAL.out),
    detection("PERSON 0.93", "#2be3ff", 0x2be3ff, WAVER, 1.72, 0.42, REVEAL.person),
    detection("PERSON DOWN 0.89", "#ff4d4d", 0xff4d4d, DOWN, 0.82, 0.78, REVEAL.down),
    detection("GAS CYLINDER 0.71", "#f2c418", 0xf2c418, GAS, 0.98, 0.28, REVEAL.gas),
  ];

  // operator station: field case + laptop
  const station = new THREE.Group();
  station.position.set(-1.05, 0, 2.3);
  station.rotation.y = -1.1;
  scenario.add(station);
  hideInFeed.push(station);
  station.add(box(1.15, 0.58, 0.8, std(0x2c3540, 0.7, 0.25), 0, 0.29, 0, 0.03));
  station.add(box(1.17, 0.04, 0.82, M.darkMetal, 0, 0.56, 0, 0.01));
  station.add(box(1.17, 0.04, 0.82, M.darkMetal, 0, 0.04, 0, 0.01));
  const alu = std(0x9aa3ad, 0.32, 0.85);
  const laptop = new THREE.Group();
  laptop.position.y = 0.58;
  station.add(laptop);
  laptop.add(box(0.98, 0.035, 0.66, alu, 0, 0.0175, 0, 0.012));
  {
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.3), M.black);
    kb.rotation.x = -Math.PI / 2;
    kb.position.set(0, 0.0355, -0.08);
    laptop.add(kb);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.17), std(0x7d8690, 0.4, 0.7));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.0356, 0.2);
    laptop.add(pad);
  }
  const lid = new THREE.Group();
  lid.position.set(0, 0.035, -0.325);
  lid.rotation.x = -0.22;
  laptop.add(lid);
  lid.add(box(0.98, 0.64, 0.025, alu, 0, 0.32, 0, 0.012));
  const SCREEN_W = 0.92;
  const SCREEN_H = 0.575;
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.61), M.black);
  bezel.position.set(0, 0.32, 0.0128);
  lid.add(bezel);

  // dashboard canvas (UI + detection overlay); the video itself is a render target
  const DW = 1024;
  const DH = 640;
  const VX = 16;
  const VY = 92;
  const VW = 640;
  const VH = 360;
  const dashCanvas = document.createElement("canvas");
  dashCanvas.width = DW;
  dashCanvas.height = DH;
  const dash = dashCanvas.getContext("2d")!;
  const dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.colorSpace = THREE.SRGBColorSpace;
  dashTex.anisotropy = 8;
  const feedRT = new THREE.WebGLRenderTarget(640, 360, { type: THREE.HalfFloatType, samples: 4 });
  const feedCam = new THREE.PerspectiveCamera(54, 16 / 9, 0.05, 40);
  const feedBg = new THREE.Color(0x0c1118);
  const videoMat = new THREE.MeshBasicMaterial({ map: feedRT.texture });
  const video = new THREE.Mesh(new THREE.PlaneGeometry((VW / DW) * SCREEN_W, (VH / DH) * SCREEN_H), videoMat);
  video.position.set(((VX + VW / 2) / DW - 0.5) * SCREEN_W, 0.32 + (0.5 - (VY + VH / 2) / DH) * SCREEN_H, 0.0132);
  video.renderOrder = 1;
  lid.add(video);
  const uiMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, toneMapped: false });
  const ui = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), uiMat);
  ui.position.set(0, 0.32, 0.0136);
  ui.renderOrder = 2;
  lid.add(ui);
  const screenGlow = glowSprite(0x2be3ff, true);
  screenGlow.scale.set(1.9, 1.3, 1);
  screenGlow.position.set(0, 0.32, 0.25);
  lid.add(screenGlow);

  // remember each prop's own size so the pop-in animation can scale relative to it
  for (const child of scenario.children) child.userData.s0 = child.scale.clone();

  const EVAL_P = 22;
  const EVAL_POS = new THREE.CatmullRomCurve3(
    [
      [2.6, 3.3, 7.6],
      [5.6, 2.8, 6.8],
      [8.6, 2.1, 3.6],
      [6.9, 1.4, 3.7],
      [3.0, 1.7, 4.6],
      [-2.7, 1.7, 3.5],
      [-1.92, 1.24, 2.74],
      [-1.98, 1.28, 2.86],
      [-1.4, 2.7, 5.0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    "catmullrom",
    0.5,
  );
  const EVAL_LOOK = new THREE.CatmullRomCurve3(
    [
      [3.4, 0.5, 0],
      [4.9, 0.55, 0],
      [5.4, 0.6, 0.2],
      [5.2, 0.5, 0.9],
      [2.6, 0.7, 1.6],
      [0.2, 0.8, 1.4],
      [-0.7, 0.92, 2.12],
      [-0.66, 0.9, 2.08],
      [1.6, 0.6, 1.0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    "catmullrom",
    0.5,
  );

  const SKELETON: [string, string][] = [
    ["head", "neck"],
    ["neck", "shL"],
    ["neck", "shR"],
    ["shL", "elL"],
    ["elL", "wrL"],
    ["shR", "elR"],
    ["elR", "wrR"],
    ["shL", "hipL"],
    ["shR", "hipR"],
    ["hipL", "hipR"],
    ["hipL", "knL"],
    ["knL", "anL"],
    ["hipR", "knR"],
    ["knR", "anR"],
  ];
  const projV = new THREE.Vector3();
  /** World point -> pixel in the dashboard's video rectangle (or null if off-screen). */
  const toFeed = (p: THREE.Vector3): [number, number] | null => {
    projV.copy(p).project(feedCam);
    if (projV.z > 1 || Math.abs(projV.x) > 1.3 || Math.abs(projV.y) > 1.3) return null;
    return [VX + ((projV.x + 1) / 2) * VW, VY + ((1 - projV.y) / 2) * VH];
  };
  const boxOf = (pts: THREE.Vector3[], pad: number) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      const s = toFeed(p);
      if (!s) continue;
      x0 = Math.min(x0, s[0]);
      y0 = Math.min(y0, s[1]);
      x1 = Math.max(x1, s[0]);
      y1 = Math.max(y1, s[1]);
    }
    return x0 === Infinity ? null : [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  };
  const cornersOf = (c: THREE.Vector3, rx: number, rz: number, h: number) => {
    const out: THREE.Vector3[] = [];
    for (const y of [0, h]) for (const dx of [-rx, rx]) for (const dz of [-rz, rz]) out.push(new THREE.Vector3(c.x + dx, y, c.z + dz));
    return out;
  };
  const FIRE_PTS = cornersOf(FIRE, 0.5, 0.5, 1.55);
  const GAS_PTS = cornersOf(GAS, 0.13, 0.13, 0.66);
  const personPts = (p: Person) => {
    const pts = Object.values(p.joints).map((j) => j.getWorldPosition(new THREE.Vector3()));
    pts.push(p.joints.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)));
    return pts;
  };

  let risk = 20;
  let lastDash = -1;
  const clock2 = (sec: number) => {
    const s = 134 + Math.floor(sec);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const drawDashboard = (t: number, dt: number) => {
    const g = dash;
    const seen = (k: keyof typeof REVEAL) => t >= REVEAL[k];
    const fireOn = seen("fire") && t < IMPACT + 0.15;
    const level = seen("down")
      ? { name: "CRITICAL", col: "#ff4d4d", risk: 82 }
      : fireOn
        ? { name: "DANGER", col: "#ff7a29", risk: 68 }
        : { name: "CAUTION", col: "#f2c418", risk: 30 };
    risk = dt > 0 ? damp(risk, level.risk, 2.5, dt) : level.risk;

    g.clearRect(0, 0, DW, DH);
    g.fillStyle = "#0a0f17";
    g.fillRect(0, 0, DW, DH);

    // header
    g.fillStyle = "#0f1722";
    g.fillRect(0, 0, DW, 52);
    g.fillStyle = "rgba(43,227,255,0.35)";
    g.fillRect(0, 52, DW, 1);
    g.strokeStyle = "#2be3ff";
    g.lineWidth = 2;
    g.strokeRect(16, 13, 26, 26);
    g.fillStyle = "#2be3ff";
    g.font = "700 11px monospace";
    g.textAlign = "center";
    g.fillText("RQ", 29, 30);
    g.textAlign = "left";
    g.fillStyle = "#e6edf5";
    g.font = "600 19px sans-serif";
    g.fillText("ResQBot Mission Control", 54, 33);
    const chip = (x: number, text: string, fg: string, bg: string) => {
      g.font = "700 12px monospace";
      const w = g.measureText(text).width + 22;
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(x - w, 14, w, 24, 12);
      g.fill();
      g.fillStyle = fg;
      g.fillText(text, x - w + 11, 30);
      return x - w - 8;
    };
    let cx = chip(1008, `THREAT  ${level.name}`, "#05070a", level.col);
    cx = chip(cx, "AI  ON", "#2be3ff", "rgba(43,227,255,0.14)");
    chip(cx, "● LIVE", "#31d27c", "rgba(49,210,124,0.14)");

    // video header + tabs
    g.fillStyle = "#8a94a3";
    g.font = "600 12px monospace";
    g.fillText("LIVE CAMERA · ESP32-CAM", VX, 80);
    ["Live", "Enhanced", "Depth"].forEach((m, i) => {
      const x = VX + VW - 210 + i * 72;
      g.fillStyle = i === 0 ? "rgba(43,227,255,0.18)" : "rgba(255,255,255,0.05)";
      g.fillRect(x, 64, 66, 22);
      g.fillStyle = i === 0 ? "#2be3ff" : "#8a94a3";
      g.fillText(m, x + 9, 80);
    });

    // video window: transparent so the render-target plane shows through
    g.clearRect(VX, VY, VW, VH);
    g.save();
    g.beginPath();
    g.rect(VX, VY, VW, VH);
    g.clip();
    g.fillStyle = "rgba(0,0,0,0.07)";
    for (let y = VY; y < VY + VH; y += 4) g.fillRect(VX, y, VW, 1);
    const drawBox = (b: number[] | null, label: string, col: string) => {
      if (!b) return;
      g.strokeStyle = col;
      g.lineWidth = 2.5;
      g.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
      g.font = "700 13px monospace";
      const w = g.measureText(label).width + 12;
      g.fillStyle = col;
      g.fillRect(b[0] - 1.25, b[1] - 20, w, 20);
      g.fillStyle = "#05070a";
      g.fillText(label, b[0] + 5, b[1] - 6);
    };
    const jitter = (k: number) => (0.015 * Math.sin(elapsed * 1.3 + k)).toFixed(2).slice(-1);
    if (fireOn) drawBox(boxOf(FIRE_PTS, 4), `fire 0.8${jitter(1)}`, "#ff7a29");
    if (seen("out") && t < REVEAL.out + 3.2 && Math.sin(elapsed * 5) > -0.4) {
      g.fillStyle = "rgba(49,210,124,0.92)";
      g.fillRect(VX + VW / 2 - 130, VY + 12, 260, 30);
      g.fillStyle = "#05070a";
      g.font = "700 15px monospace";
      g.textAlign = "center";
      g.fillText("✓  FIRE SUPPRESSED", VX + VW / 2, VY + 32);
      g.textAlign = "left";
    }
    if (seen("gas")) drawBox(boxOf(GAS_PTS, 4), `gas cylinder 0.7${jitter(2)}`, "#f2c418");
    const skeleton = (p: Person, col: string) => {
      const pts: Record<string, [number, number] | null> = {};
      for (const [k, j] of Object.entries(p.joints)) pts[k] = toFeed(j.getWorldPosition(projV.clone()));
      g.strokeStyle = col;
      g.lineWidth = 2;
      for (const [a, b] of SKELETON) {
        const pa = pts[a];
        const pb = pts[b];
        if (!pa || !pb) continue;
        g.beginPath();
        g.moveTo(pa[0], pa[1]);
        g.lineTo(pb[0], pb[1]);
        g.stroke();
      }
      g.fillStyle = "#ffffff";
      for (const s of Object.values(pts)) if (s) g.fillRect(s[0] - 2, s[1] - 2, 4, 4);
    };
    if (seen("person")) {
      skeleton(waver, "rgba(43,227,255,0.9)");
      drawBox(boxOf(personPts(waver), 6), `person 0.9${jitter(3)}`, "#2be3ff");
    }
    if (seen("down")) {
      skeleton(down, "rgba(255,77,77,0.9)");
      drawBox(boxOf(personPts(down), 6), `PERSON DOWN 0.8${jitter(4)}`, "#ff4d4d");
      if (t > REVEAL.out + 3.2 && Math.sin(elapsed * 6) > -0.2) {
        g.fillStyle = "rgba(255,77,77,0.92)";
        g.fillRect(VX + VW / 2 - 130, VY + 12, 260, 30);
        g.fillStyle = "#ffffff";
        g.font = "700 15px monospace";
        g.textAlign = "center";
        g.fillText("⚠  PERSON DOWN DETECTED", VX + VW / 2, VY + 32);
        g.textAlign = "left";
      }
    }
    g.fillStyle = "rgba(5,8,14,0.6)";
    g.fillRect(VX + 8, VY + VH - 30, 196, 22);
    g.fillStyle = "#ff4d4d";
    g.beginPath();
    g.arc(VX + 20, VY + VH - 19, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e6edf5";
    g.font = "600 12px monospace";
    g.fillText(`REC  ESP32-CAM  ${clock2(t)}`, VX + 31, VY + VH - 15);
    g.restore();
    g.strokeStyle = "rgba(43,227,255,0.45)";
    g.lineWidth = 1.5;
    g.strokeRect(VX, VY, VW, VH);

    const panel = (x: number, y: number, w: number, h: number, title: string) => {
      g.fillStyle = "#0f1722";
      g.fillRect(x, y, w, h);
      g.strokeStyle = "rgba(255,255,255,0.08)";
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = "#8a94a3";
      g.font = "600 12px monospace";
      g.fillText(title, x + 12, y + 22);
    };

    // AI vision panel: risk ring + counters
    panel(672, 64, 336, 238, "CAMERA VISION · AI");
    {
      const rx = 752;
      const ry = 178;
      g.lineWidth = 12;
      g.strokeStyle = "rgba(255,255,255,0.08)";
      g.beginPath();
      g.arc(rx, ry, 56, Math.PI * 0.75, Math.PI * 2.25);
      g.stroke();
      g.strokeStyle = level.col;
      g.beginPath();
      g.arc(rx, ry, 56, Math.PI * 0.75, Math.PI * 0.75 + (Math.PI * 1.5 * risk) / 100);
      g.stroke();
      g.fillStyle = "#e6edf5";
      g.font = "700 34px sans-serif";
      g.textAlign = "center";
      g.fillText(String(Math.round(risk)), rx, ry + 10);
      g.fillStyle = level.col;
      g.font = "700 12px monospace";
      g.fillText(level.name, rx, ry + 34);
      g.fillStyle = "#8a94a3";
      g.font = "600 10px monospace";
      g.fillText("RISK INDEX", rx, ry + 78);
      g.textAlign = "left";
      const counters: [string, number, string][] = [
        ["PEOPLE", (seen("person") ? 1 : 0) + (seen("down") ? 1 : 0), "#2be3ff"],
        ["DOWN", seen("down") ? 1 : 0, "#ff4d4d"],
        ["FIRE", fireOn ? 1 : 0, "#ff7a29"],
        ["HAZARD", seen("gas") ? 1 : 0, "#f2c418"],
      ];
      counters.forEach(([name, n, col], i) => {
        const x = 836 + (i % 2) * 84;
        const y = 104 + Math.floor(i / 2) * 92;
        g.fillStyle = "rgba(255,255,255,0.04)";
        g.fillRect(x, y, 76, 80);
        g.fillStyle = n > 0 ? col : "#5b6470";
        g.font = "700 32px sans-serif";
        g.fillText(String(n), x + 10, y + 44);
        g.fillStyle = "#8a94a3";
        g.font = "600 11px monospace";
        g.fillText(name, x + 10, y + 68);
      });
    }

    // sensors (DHT11 + MQ-2)
    panel(672, 312, 336, 142, "SENSORS");
    {
      // heat builds while the fire burns, then falls away once the ball has put it out
      const heat = t < IMPACT ? 0.55 + 0.1 * clamp01(t / IMPACT) : 0.65 * Math.exp(-(t - IMPACT) / 5);
      const rows: [string, string, number, string][] = [
        ["TEMP", `${(31.5 + heat * 9).toFixed(1)} °C`, 0.45 + heat * 0.35, "#ff7a29"],
        ["HUMIDITY", `${Math.round(52 - heat * 11)} %`, 0.52 - heat * 0.11, "#2be3ff"],
        ["GAS (MQ-2)", `${Math.round(310 + heat * 290)}`, 0.3 + heat * 0.42, "#f2c418"],
      ];
      rows.forEach(([name, val, f, col], i) => {
        const y = 350 + i * 34;
        g.fillStyle = "#8a94a3";
        g.font = "600 11px monospace";
        g.fillText(name, 684, y);
        g.fillStyle = "#e6edf5";
        g.font = "700 14px monospace";
        g.textAlign = "right";
        g.fillText(val, 996, y);
        g.textAlign = "left";
        g.fillStyle = "rgba(255,255,255,0.07)";
        g.fillRect(684, y + 7, 312, 5);
        g.fillStyle = col;
        g.fillRect(684, y + 7, 312 * f, 5);
      });
    }

    // detection timeline
    panel(VX, 464, VW, 162, "DETECTION TIMELINE");
    {
      const events: [number, string, string][] = [
        [REVEAL.fire, "Fire detected · YOLO-World", "#ff7a29"],
        [IMPACT, "Extinguisher ball launched · hit", "#2be3ff"],
        [REVEAL.out, "Fire suppressed — no flames in view", "#31d27c"],
        [REVEAL.person, "Person detected · YOLO11n-pose", "#2be3ff"],
        [REVEAL.down, "PERSON DOWN — alert raised", "#ff4d4d"],
        [REVEAL.gas, "Hazard: gas cylinder", "#f2c418"],
      ];
      const shown = events.filter((e) => t >= e[0]).reverse().slice(0, 4);
      shown.forEach(([at, text, col], i) => {
        const y = 498 + i * 30;
        const a = clamp01((t - at) / 0.4);
        g.globalAlpha = a;
        g.fillStyle = col;
        g.fillRect(VX + 12, y - 12, 4, 18);
        g.fillStyle = "#8a94a3";
        g.font = "600 12px monospace";
        g.fillText(clock2(at), VX + 26, y + 2);
        g.fillStyle = "#e6edf5";
        g.font = "600 14px sans-serif";
        g.fillText(text, VX + 84, y + 2);
        g.globalAlpha = 1;
      });
      if (!shown.length) {
        g.fillStyle = "#5b6470";
        g.font = "600 13px monospace";
        g.fillText("Scanning…", VX + 14, 504);
      }
    }

    // rover panel
    panel(672, 464, 336, 162, "ROVER");
    {
      const rows: [string, string][] = [
        ["LINK", "Bluetooth · connected"],
        ["BATTERY", "LiPo 3S · 11.4 V"],
        ["PAYLOAD", "3 balls left"],
        ["SONAR", "obstacle 0.6 m"],
      ];
      rows.forEach(([k, v], i) => {
        const y = 500 + i * 30;
        g.fillStyle = "#8a94a3";
        g.font = "600 11px monospace";
        g.fillText(k, 684, y);
        g.fillStyle = "#e6edf5";
        g.font = "600 13px sans-serif";
        g.textAlign = "right";
        g.fillText(v, 996, y);
        g.textAlign = "left";
      });
    }
    dashTex.needsUpdate = true;
  };

  const feedLook = new THREE.Vector3(TARGET.x + 0.6, 0.3, 0.2);
  const hiddenState: boolean[] = [];
  const renderFeed = () => {
    rover.localToWorld(feedCam.position.copy(LENS_POS).add(tmpOff));
    feedCam.lookAt(feedLook);
    feedCam.updateMatrixWorld();
    hideInFeed.forEach((o, i) => {
      hiddenState[i] = o.visible;
      o.visible = false;
    });
    const bg = scene.background;
    scene.background = feedBg;
    const autoShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    const gc = gridU.uCenter.value.clone();
    gridU.uCenter.value.set(4, 0);
    renderer.setRenderTarget(feedRT);
    renderer.render(scene, feedCam);
    renderer.setRenderTarget(null);
    gridU.uCenter.value.copy(gc);
    renderer.shadowMap.autoUpdate = autoShadow;
    scene.background = bg;
    hideInFeed.forEach((o, i) => (o.visible = hiddenState[i]));
  };
  const tmpOff = new THREE.Vector3(0.045, 0, 0);

  let stage = Math.max(0, Math.min(6, opts.stage));
  let tStage = 0;
  let reduced = opts.reducedMotion;
  let active = false;
  let disposed = false;

  const roverState = {
    x: stage >= 2 ? 0 : START.x,
    z: stage >= 2 ? 0 : START.z,
    vx: 0,
    vz: 0,
    yaw: stage >= 3 ? 0 : APPROACH_YAW,
  };
  let flySpeed = 0;
  let flyAngle = 0;
  let gateAngle = 0;
  const w = { phone: 0, bt: 0, sonar: 0, aim: 0, launch: 0, evalu: 0, load: 0, target: 0.6, fire: 0 };
  let fireLevel = 1; // 1 = burning, 0 = put out
  let sinceOut = 0; // seconds since the fire went out (drives the steam)

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  // ball blending between stages (rover-local space)
  const ballFrom = balls.map(() => ({ p: new THREE.Vector3(), o: 1 }));
  let blendStart = -1;
  const BLEND = 0.75;

  /* ------------------------------------------------------------------ */
  /* Per-stage ball poses (rover-local)                                 */
  /* ------------------------------------------------------------------ */
  const tmpV = new THREE.Vector3();
  const tmpW = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const pose = balls.map(() => ({ p: new THREE.Vector3(), o: 1 }));
  const hiddenAbove = (k: number) => tmpV.set(TOWER_X, slotY(k), 0);

  const flightExit = new THREE.Vector3();
  const flightVel = new THREE.Vector3();
  const TARGET_REST = new THREE.Vector3(TARGET.x, BALL_R, TARGET.z);
  /** World position of a launched ball tau seconds after leaving the guide. */
  const flightPos = (tau: number, out: THREE.Vector3) => {
    if (tau <= FLIGHT_T) {
      return out.set(
        flightExit.x + flightVel.x * tau,
        flightExit.y + flightVel.y * tau - 0.5 * GRAVITY * tau * tau,
        flightExit.z + flightVel.z * tau,
      );
    }
    // small settling hops after impact
    const tt = tau - FLIGHT_T;
    let y = 0;
    let v = 1.25;
    let rem = tt;
    for (let b = 0; b < 4; b++) {
      const tb = (2 * v) / GRAVITY;
      if (rem < tb) {
        y = v * rem - 0.5 * GRAVITY * rem * rem;
        break;
      }
      rem -= tb;
      v *= 0.42;
    }
    const roll = 0.22 * (1 - Math.exp(-tt * 3.2));
    return out.set(TARGET.x + roll, BALL_R + Math.max(0, y), TARGET.z);
  };

  const stackShift = (s: number) => {
    // balls 1..4 sit in slots (k - s); ball 4 fades in at the top as the stack drops
    for (let k = 1; k < 5; k++) {
      pose[k].p.set(TOWER_X, slotY(k - s), 0);
      pose[k].o = k === 4 ? s : 1;
    }
  };

  const computeBallPoses = (st: number, t: number) => {
    switch (st) {
      case 0: {
        const lt = t % LOAD_P;
        const fadeOut = 1 - smooth(4.75, 5.45, lt);
        for (let k = 0; k < 5; k++) {
          if (k === 4) {
            pose[k].p.copy(hiddenAbove(4));
            pose[k].o = 0;
            continue;
          }
          const t0 = 0.35 + k * 0.85;
          const y0 = 2.35;
          const yEnd = slotY(k);
          const g = 7.2;
          const tau = lt - t0;
          let y = y0;
          let o = 0;
          if (tau >= 0) {
            const tHit = Math.sqrt((2 * (y0 - yEnd)) / g);
            if (tau < tHit) y = y0 - 0.5 * g * tau * tau;
            else {
              let v = g * tHit * 0.3;
              let rem = tau - tHit;
              y = yEnd;
              for (let b = 0; b < 3; b++) {
                const tb = (2 * v) / g;
                if (rem < tb) {
                  y = yEnd + v * rem - 0.5 * g * rem * rem;
                  break;
                }
                rem -= tb;
                v *= 0.3;
              }
            }
            o = clamp01(tau / 0.14);
          }
          pose[k].p.set(TOWER_X, y, 0);
          pose[k].o = o * fadeOut;
        }
        break;
      }
      case 1:
      case 2:
      case 3: {
        for (let k = 0; k < 5; k++) {
          pose[k].p.set(TOWER_X, slotY(Math.min(k, 4)), 0);
          pose[k].o = k < 4 ? 1 : 0;
        }
        break;
      }
      case 4: {
        const ft = t % FEED_P;
        const u = easeInOut(smooth(0.3, 1.15, ft)) * U_INTAKE;
        BALL_PATH.getPointAt(u, pose[0].p);
        pose[0].o = 1 - smooth(2.15, 2.75, ft);
        stackShift(smooth(1.45, 1.85, ft) ** 2);
        break;
      }
      case 5: {
        const lt = t % LAUNCH_P;
        if (lt < FLIGHT_T0) {
          const a = smooth(0.12, 0.58, lt);
          const b = clamp01((lt - 0.58) / (FLIGHT_T0 - 0.58));
          const u = lt < 0.58 ? easeInOut(a) * U_INTAKE : U_INTAKE + (1 - U_INTAKE) * b * b;
          BALL_PATH.getPointAt(u, pose[0].p);
          pose[0].o = 1;
        } else {
          flightPos(lt - FLIGHT_T0, tmpW);
          rover.worldToLocal(pose[0].p.copy(tmpW));
          pose[0].o = 1 - smooth(2.55, 3.1, lt);
        }
        stackShift(smooth(0.72, 1.05, lt) ** 2);
        break;
      }
      case 6: {
        // the final scene replays one throw into the fire, then the ball stays where it burst
        if (t < FLIGHT_T0) {
          const a = smooth(0.12, 0.58, t);
          const b = clamp01((t - 0.58) / (FLIGHT_T0 - 0.58));
          BALL_PATH.getPointAt(t < 0.58 ? easeInOut(a) * U_INTAKE : U_INTAKE + (1 - U_INTAKE) * b * b, pose[0].p);
        } else {
          flightPos(t - FLIGHT_T0, tmpW);
          rover.worldToLocal(pose[0].p.copy(tmpW));
        }
        pose[0].o = 1;
        const s = smooth(0.72, 1.05, t) ** 2;
        for (let k = 1; k < 5; k++) {
          pose[k].p.set(TOWER_X, slotY(k - s), 0);
          pose[k].o = k < 4 ? 1 : 0;
        }
        break;
      }
    }
  };

  const applyBalls = (now: number, snap: boolean) => {
    const bw = snap || blendStart < 0 ? 1 : easeInOut(clamp01((now - blendStart) / BLEND));
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      const p = pose[i];
      if (bw < 1) {
        b.mesh.position.lerpVectors(ballFrom[i].p, p.p, bw);
        b.mat.opacity = ballFrom[i].o + (p.o - ballFrom[i].o) * bw;
      } else {
        b.mesh.position.copy(p.p);
        b.mat.opacity = p.o;
      }
      const o = b.mat.opacity;
      b.mesh.visible = o > 0.004;
      b.mat.transparent = o < 0.995;
      b.mat.depthWrite = o > 0.5;
      b.mesh.scale.setScalar(0.85 + 0.15 * Math.min(1, o * 1.6));
    }
  };

  /* ------------------------------------------------------------------ */
  /* Theme                                                              */
  /* ------------------------------------------------------------------ */
  let theme: SceneTheme = opts.theme;
  const applyTheme = () => {
    const pal = THEME[theme];
    gridU.uColor.value.setHex(pal.grid);
    gridU.uAlpha.value = pal.gridAlpha;
    shadowMat.opacity = pal.shadow;
    renderer.toneMappingExposure = pal.exposure;
    const blending = theme === "dark" ? THREE.AdditiveBlending : THREE.NormalBlending;
    for (const m of fxMats) {
      if (m.blending !== blending) {
        m.blending = blending;
        m.needsUpdate = true;
      }
    }
    for (const m of cyanMats) m.color.setHex(pal.cyan);
    // powder cloud: bright white on dark, a cooler grey-white so it still reads on the light theme
    for (const p of powder) (p.s.material as THREE.SpriteMaterial).color.setHex(theme === "dark" ? 0xeef8ff : 0xb9c7d2);
    hemi.intensity = theme === "dark" ? 0.65 : 0.9;
    rim.intensity = theme === "dark" ? 1.1 : 0.55;
  };
  applyTheme();

  /* ------------------------------------------------------------------ */
  /* Frame update                                                       */
  /* ------------------------------------------------------------------ */
  let elapsed = 0;
  const sizeState = { w: 1, h: 1, aspect: 16 / 9 };

  const update = (dt: number, snap: boolean) => {
    const t = reduced ? STILL_T[stage] : tStage;
    const st = stage;

    /* --- rover drive (critically damped spring) --- */
    const goalX = st >= 2 ? 0 : START.x;
    const goalZ = st >= 2 ? 0 : START.z;
    const goalYaw = st >= 3 ? 0 : APPROACH_YAW;
    const prevX = roverState.x;
    const prevZ = roverState.z;
    const prevYaw = roverState.yaw;
    if (snap) {
      roverState.x = goalX;
      roverState.z = goalZ;
      roverState.vx = roverState.vz = 0;
      roverState.yaw = goalYaw;
    } else {
      const om = 1.55;
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        roverState.vx += (-2 * om * roverState.vx - om * om * (roverState.x - goalX)) * h;
        roverState.vz += (-2 * om * roverState.vz - om * om * (roverState.z - goalZ)) * h;
        roverState.x += roverState.vx * h;
        roverState.z += roverState.vz * h;
      }
      roverState.yaw = damp(roverState.yaw, goalYaw, 2.2, dt);
    }
    const speed = Math.hypot(roverState.vx, roverState.vz);
    rover.position.set(roverState.x, Math.sin(elapsed * 9) * 0.004 * clamp01(speed), roverState.z);
    rover.rotation.y = roverState.yaw;
    rover.updateMatrixWorld(true);

    // wheel spin from actual motion (plus differential spin when turning on the spot)
    if (!snap && dt > 0) {
      const fx = Math.cos(roverState.yaw);
      const fz = -Math.sin(roverState.yaw);
      const v = ((roverState.x - prevX) * fx + (roverState.z - prevZ) * fz) / dt;
      const yawRate = (roverState.yaw - prevYaw) / dt;
      for (const wh of wheels) {
        const ws = v + yawRate * wh.z;
        wh.g.rotation.z -= (ws / WHEEL_R) * dt;
      }
    }

    /* --- stage weights --- */
    const lam = snap ? 1e6 : 3.2;
    w.load = damp(w.load, st === 0 ? 1 : 0, lam, dt);
    w.phone = damp(w.phone, st === 1 ? 1 : 0, st === 1 ? lam : lam * 2.5, dt);
    w.bt = damp(w.bt, st === 1 ? 1 : 0, lam, dt);
    w.sonar = damp(w.sonar, st === 2 ? 1 : 0, lam, dt);
    w.aim = damp(w.aim, st === 3 ? 1 : 0, lam, dt);
    w.launch = damp(w.launch, st === 5 ? 1 : 0, lam * 2, dt);
    w.evalu = damp(w.evalu, st === 6 ? 1 : 0, lam, dt);
    w.target = damp(w.target, st >= 2 ? 1 : 0.45, lam, dt);

    /* --- gate + flywheel --- */
    let gateGoal = 0;
    if (st === 4) {
      const ft = t % FEED_P;
      gateGoal = smooth(0.08, 0.3, ft) * (1 - smooth(1.15, 1.4, ft));
    } else if (st === 5 || st === 6) {
      const lt = st === 5 ? t % LAUNCH_P : t;
      gateGoal = smooth(0.0, 0.14, lt) * (1 - smooth(0.5, 0.66, lt));
    }
    gateAngle = snap || st >= 4 ? gateGoal * 1.25 : damp(gateAngle, 0, 6, dt);
    gatePivot.rotation.z = gateAngle;
    horn.rotation.z = -gateAngle;

    const flyGoal = st === 5 || (st === 6 && t < IMPACT) ? 46 : st === 4 ? 7 : 0;
    flySpeed = snap ? flyGoal : damp(flySpeed, flyGoal, flyGoal > 40 ? 2.2 : 0.9, dt);
    flyAngle -= flySpeed * dt;
    flywheel.rotation.z = flyAngle;
    blurMat.opacity = clamp01((flySpeed - 12) / 40) * 0.55;
    blurDisc.visible = blurMat.opacity > 0.01;

    /* --- flight setup for this frame --- */
    rover.localToWorld(flightExit.copy(BALL_PATH.getPointAt(1, tmpV)));
    flightVel.set(
      (TARGET_REST.x - flightExit.x) / FLIGHT_T,
      (TARGET_REST.y - flightExit.y + 0.5 * GRAVITY * FLIGHT_T * FLIGHT_T) / FLIGHT_T,
      (TARGET_REST.z - flightExit.z) / FLIGHT_T,
    );

    /* --- balls --- */
    computeBallPoses(st, t);
    applyBalls(elapsed, snap);

    /* --- LEDs --- */
    const blink = reduced ? 1 : 0.5 + 0.5 * Math.sin(elapsed * (st === 1 ? 9 : 3));
    espLedMat.color.setHex(0x3aa0ff).multiplyScalar(0.35 + 0.65 * blink);
    (espGlow.material as THREE.SpriteMaterial).opacity = (0.25 + 0.6 * w.bt) * blink;
    (protoGlow.material as THREE.SpriteMaterial).opacity = 0.55;
    const rec = st === 3 || st === 6 ? (reduced ? 1 : Math.sin(elapsed * 5) > 0 ? 1 : 0.15) : 0.25;
    camLedMat.color.setHex(0xff2d2d).multiplyScalar(0.3 + 0.7 * rec);
    (camGlow.material as THREE.SpriteMaterial).opacity = rec * 0.8;

    /* --- Load --- */
    mouthGlow.position.set(TOWER_X, TOWER_Y1 + 0.06, 0);
    {
      const lt = t % LOAD_P;
      let flash = 0;
      for (let k = 0; k < 4; k++) {
        const d = lt - (0.35 + k * 0.85);
        if (d > -0.15 && d < 0.5) flash = Math.max(flash, 1 - Math.abs(d - 0.05) / 0.45);
      }
      (mouthGlow.material as THREE.SpriteMaterial).opacity = w.load * (0.25 + 0.55 * clamp01(flash));
    }

    /* --- Deploy --- */
    const roverWorldEsp = rover.localToWorld(tmpV.set(0.2, 0.3, 0.18)).clone();
    phone.position.set(roverState.x + 1.4, 1.18 + Math.sin(elapsed * 1.4) * 0.035, roverState.z + 1.3);
    phone.lookAt(camera.position);
    phone.rotateY(-0.25);
    phone.rotateZ(0.06);
    phone.scale.setScalar(0.82 + 0.18 * w.phone);
    phone.visible = w.phone > 0.005;
    phoneBodyMat.opacity = w.phone;
    screenMat.opacity = w.phone;
    (phoneHalo.material as THREE.SpriteMaterial).opacity = 0.35 * w.phone;
    {
      const p0 = phone.position;
      const p2 = roverWorldEsp;
      const p1 = tmpW.copy(p0).add(p2).multiplyScalar(0.5);
      p1.y += 0.7;
      for (let i = 0; i < btDots.length; i++) {
        const u = fract((reduced ? 0.3 : elapsed * 0.55) + i / btDots.length);
        const a = 1 - u;
        const d = btDots[i];
        d.position.set(
          a * a * p0.x + 2 * a * u * p1.x + u * u * p2.x,
          a * a * p0.y + 2 * a * u * p1.y + u * u * p2.y,
          a * a * p0.z + 2 * a * u * p1.z + u * u * p2.z,
        );
        d.scale.setScalar(0.07 + 0.05 * Math.sin(Math.PI * u));
        (d.material as THREE.SpriteMaterial).opacity = w.bt * Math.sin(Math.PI * u) * 0.95;
        d.visible = w.bt > 0.005;
      }
    }
    for (let i = 0; i < powerRings.length; i++) {
      const u = fract((reduced ? 0.35 : elapsed * 0.55) + i * 0.5);
      const r = powerRings[i];
      r.position.set(0, 0.008, 0);
      r.scale.setScalar(0.4 + u * 1.9);
      (r.material as THREE.MeshBasicMaterial).opacity = w.bt * (1 - u) * 0.6;
      r.visible = w.bt > 0.005;
    }

    /* --- Approach: sonar --- */
    for (let i = 0; i < sonarArcs.length; i++) {
      const u = fract((reduced ? 0.25 : elapsed * 0.9) + i / sonarArcs.length);
      const a = sonarArcs[i];
      a.scale.setScalar(0.12 + u * 2.6);
      (a.material as THREE.MeshBasicMaterial).opacity = w.sonar * (1 - u) * 0.85;
      a.visible = w.sonar > 0.005;
    }

    /* --- Aim: camera frustum + reticle --- */
    {
      const pos = frustumGeo.attributes.position as THREE.BufferAttribute;
      const apex = tmpV.copy(LENS_POS).add(new THREE.Vector3(0.03, 0, 0));
      const corners = [
        [TARGET.x - 1.15, -0.95],
        [TARGET.x + 1.15, -0.95],
        [TARGET.x + 1.15, 0.95],
        [TARGET.x - 1.15, 0.95],
      ].map(([x, z]) => rover.worldToLocal(new THREE.Vector3(x, 0.01, z)));
      pos.setXYZ(0, apex.x, apex.y, apex.z);
      corners.forEach((c, i) => pos.setXYZ(i + 1, c.x, c.y, c.z));
      pos.needsUpdate = true;
      frustumFaceMat.opacity = 0.07 * w.aim;
      frustum.visible = w.aim > 0.005;

      const lp = frustumLineGeo.attributes.position as THREE.BufferAttribute;
      let n = 0;
      for (let i = 0; i < 4; i++) {
        lp.setXYZ(n++, apex.x, apex.y, apex.z);
        lp.setXYZ(n++, corners[i].x, corners[i].y, corners[i].z);
      }
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        lp.setXYZ(n++, a.x, a.y, a.z);
        lp.setXYZ(n++, b.x, b.y, b.z);
      }
      lp.needsUpdate = true;
      (frustumLines.material as THREE.LineBasicMaterial).opacity = 0.75 * w.aim;
      frustumLines.visible = w.aim > 0.005;

      const su = 0.15 + 0.85 * fract(reduced ? 0.6 : elapsed * 0.45);
      const sp = scanGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 5; i++) {
        const c = corners[i % 4];
        sp.setXYZ(i, apex.x + (c.x - apex.x) * su, apex.y + (c.y - apex.y) * su, apex.z + (c.z - apex.z) * su);
      }
      sp.needsUpdate = true;
      (scanLine.material as THREE.LineBasicMaterial).opacity = w.aim * 0.9 * Math.sin(Math.PI * su);
      scanLine.visible = w.aim > 0.005;

      const lock = smooth(0, 1.2, (t % 2.4) * 1.0);
      reticle.scale.setScalar(1 + (1 - easeInOut(lock)) * 1.4);
      reticle.rotation.y = (1 - lock) * 1.2;
      reticleMat.opacity = w.aim * (0.35 + 0.65 * lock);
      reticle.visible = w.aim > 0.005;
    }

    /* --- Launch (and the replay in the final scene): trail, extinguisher burst --- */
    {
      // Launch loops its throw; the final scene plays it once
      const lt = st === 6 ? t : t % LAUNCH_P;
      const fxW = st === 6 ? w.evalu : w.launch;
      const tau = lt - FLIGHT_T0;
      const m4 = new THREE.Matrix4();
      for (let j = 0; j < TRAIL_N; j++) {
        const tj = tau - j * 0.016;
        if (fxW > 0.01 && tj > 0 && tj < FLIGHT_T + 0.05 && tau < FLIGHT_T + 0.35) {
          flightPos(Math.min(tj, FLIGHT_T), tmpW);
          const s = 0.075 * (1 - j / TRAIL_N) * (1 - smooth(FLIGHT_T, FLIGHT_T + 0.35, tau));
          m4.makeScale(s, s, s).setPosition(tmpW);
        } else {
          m4.makeScale(0, 0, 0);
        }
        trail.setMatrixAt(j, m4);
      }
      trail.instanceMatrix.needsUpdate = true;
      trailMat.opacity = 0.5 * fxW;

      const it = tau - FLIGHT_T; // time since impact
      const hit = fxW > 0.01 && it > 0 && it < 1.2;
      const fl = hit ? Math.exp(-it * 6) : 0;
      impactFlash.position.set(TARGET.x, 0.35, TARGET.z);
      impactFlash.scale.setScalar(0.8 + 2.8 * (1 - Math.exp(-it * 8)));
      (impactFlash.material as THREE.SpriteMaterial).opacity = fl * fxW;
      impactFlash.visible = fl > 0.01;
      shock.scale.setScalar(0.15 + 2.4 * easeInOut(clamp01(it / 0.7)));
      (shock.material as THREE.MeshBasicMaterial).opacity = hit ? (1 - clamp01(it / 0.7)) * 0.9 * fxW : 0;
      shock.visible = hit;
      for (const sp of sparks) {
        const k = clamp01(it / 0.75);
        const vis = hit && k < 1;
        sp.s.visible = vis;
        if (!vis) continue;
        sp.s.position.set(
          TARGET.x + sp.d.x * it * 0.9,
          0.08 + sp.d.y * it - 0.5 * 6 * it * it,
          TARGET.z + sp.d.z * it * 0.9,
        );
        sp.s.scale.setScalar(0.12 * (1 - k));
        (sp.s.material as THREE.SpriteMaterial).opacity = (1 - k) * fxW;
      }
      // the ball bursts: a billowing cloud of extinguisher powder smothers the flames
      const maxAge = st === 6 ? 3.6 : LAUNCH_P - IMPACT;
      for (const p of powder) {
        const age = it;
        const vis = fxW > 0.01 && age > 0 && age < maxAge;
        p.s.visible = vis;
        if (!vis) continue;
        const spread = 1 - Math.exp(-age * 3.2);
        p.s.position.set(
          TARGET.x + p.d.x * spread * p.r * 1.25,
          0.25 + p.d.y * spread * p.r * 1.1 + age * 0.18,
          TARGET.z + p.d.z * spread * p.r * 1.25,
        );
        p.s.scale.setScalar(0.25 + 1.25 * (1 - Math.exp(-age * 2.4)) * p.r);
        const fade = Math.exp(-age * (st === 6 ? 0.9 : 1.3)) * (1 - smooth(maxAge - 0.35, maxAge, age));
        (p.s.material as THREE.SpriteMaterial).opacity = 0.85 * fade * clamp01(age * 12) * fxW;
      }
      targetLight.intensity = 6 * fl * fxW + 0.6 * w.target * (theme === "dark" ? 1 : 0.4);
    }

    /* --- Fire at the target: burns until the extinguisher ball hits --- */
    {
      w.fire = damp(w.fire, st >= 2 ? 1 : 0, lam, dt);
      // Launch: out after the first hit and stays out; final scene: burns, then put out by its replayed throw
      const burning = st < 5 || t < IMPACT;
      const goal = burning ? 1 : 0;
      fireLevel = snap ? goal : damp(fireLevel, goal, goal < fireLevel ? 4.2 : 1.6, dt);
      sinceOut = fireLevel < 0.5 ? (snap ? Math.max(0, t - IMPACT) : sinceOut + dt) : 0;
      const fv = w.fire;
      const on = fv > 0.005;
      const lvl = fireLevel;
      fireG.visible = on;
      fireG.scale.setScalar(Math.max(0.001, fv));
      const e = reduced ? 3.1 : elapsed;
      for (const fm of flameMats) {
        fm.uniforms.uTime.value = e;
        fm.uniforms.uAlpha.value = fv * Math.min(1, lvl * 1.4);
      }
      for (const q of flames) {
        const h = q.userData.h as number;
        const k = 0.15 + 0.85 * lvl;
        q.scale.y = k;
        q.position.y = (h * k) / 2 + 0.12;
        q.visible = lvl > 0.02;
      }
      const flicker = 0.75 + 0.25 * Math.sin(e * 13.1) * Math.sin(e * 7.3 + 1.1) + 0.12 * Math.sin(e * 23.7);
      fireLight.intensity = fv * lvl * 4.2 * flicker;
      (fireGlow.material as THREE.SpriteMaterial).opacity = fv * lvl * 0.55 * flicker;
      fireGlow.visible = on && lvl > 0.02;
      // smoke while burning turns to white steam that thins out once the fire is out
      const steam = 1 - lvl;
      const steamAmt = 0.25 + 0.75 * Math.exp(-sinceOut / 4);
      for (let i = 0; i < smoke.length; i++) {
        const u = fract(e * (0.16 + steam * 0.08) + i / smoke.length);
        const s = smoke[i];
        s.position.set(
          FIRE.x + Math.sin(i * 2.1) * 0.15 + u * 1.1,
          (1.35 - steam * 0.9) + u * 2.7,
          FIRE.z + Math.cos(i * 1.7) * 0.15 + u * 0.35,
        );
        s.scale.setScalar(0.7 + u * 2.3);
        const mat = s.material as THREE.SpriteMaterial;
        mat.color.setHex(0x59606a).lerp(tmpColor.setHex(0xe4edf2), steam);
        mat.opacity = Math.sin(Math.PI * u) * fv * (lvl * 0.38 + steam * 0.42 * steamAmt);
        s.visible = on;
      }
      for (let i = 0; i < embers.length; i++) {
        const u = fract(e * 0.5 + i * 0.137);
        const s = embers[i];
        s.position.set(
          FIRE.x + Math.sin(i * 12.9 + e * 2.1) * 0.3 * u + u * 0.4,
          0.35 + u * 2.3,
          FIRE.z + Math.cos(i * 7.3 + e * 1.7) * 0.3 * u,
        );
        s.scale.setScalar(0.03 + 0.06 * (1 - u));
        (s.material as THREE.SpriteMaterial).opacity = (1 - u) * fv * lvl;
        s.visible = on && lvl > 0.02;
      }
    }

    /* --- Target --- */
    {
      const pulseU = fract(reduced ? 0.4 : elapsed * 0.6);
      tPulse.scale.setScalar(1 + pulseU * 0.9);
      tPulseMat.opacity = (1 - pulseU) * 0.55 * w.target;
      const flashBoost = (st === 5 ? clamp01(1 - Math.abs((t % LAUNCH_P) - FLIGHT_T0 - FLIGHT_T) * 3) : 0) * 0.5;
      tRingMat.opacity = (0.55 + flashBoost) * w.target;
      tFillMat.opacity = (0.22 + flashBoost) * w.target;
      // the marker beam steps back while the fire itself marks the target
      beamMat.uniforms.uAlpha.value = (0.16 + 0.3 * w.evalu + flashBoost * 0.5) * w.target * (1 - 0.75 * w.fire * fireLevel);
    }

    /* --- Evaluate --- */
    {
      sweep.rotation.z = -(reduced ? 0.8 : elapsed * 1.6);
      sweepMat.opacity = 0.16 * w.evalu;
      sweep.visible = w.evalu > 0.005;
      radarRingMat.opacity = 0.6 * w.evalu;
      radarRing.visible = w.evalu > 0.005;
      for (let i = 0; i < hitRings.length; i++) {
        const u = fract((reduced ? 0.3 : elapsed * 0.7) + i * 0.5);
        const r = hitRings[i];
        r.position.set(TARGET.x + 0.22, 0.011, TARGET.z);
        r.scale.setScalar(0.6 + u * 3.2);
        (r.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.8 * w.evalu;
        r.visible = w.evalu > 0.005;
      }
    }

    /* --- Final scenario (rescue zone, people, fire, laptop) --- */
    {
      const wE = w.evalu;
      const on = wE > 0.005;
      scenario.visible = on;
      const pop = (x: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };
      const sc = Math.max(0.001, pop(clamp01(wE)));
      for (const child of scenario.children) child.scale.copy(child.userData.s0 as THREE.Vector3).multiplyScalar(sc);
      const e = reduced ? 3.1 : elapsed;

      // characters: blinking, the survivor bounces, waves and calls out,
      // the person on the ground breathes, lifts an arm and rolls their head
      const blink = (p: Person, off: number) => {
        const b = fract(e * 0.29 + off);
        const k = reduced ? 1 : b > 0.965 ? 0.1 : 1;
        for (const eye of p.eyes) eye.scale.y = k;
      };
      blink(waver, 0);
      blink(down, 0.47);
      const calmed = smooth(IMPACT, IMPACT + 1.5, t); // waves more gently once the fire is out
      waver.root.position.y = Math.abs(Math.sin(e * 3.3)) * 0.035 * (1 - 0.5 * calmed);
      waver.parts.shR.rotation.z = -2.5 + Math.sin(e * 1.9) * 0.06;
      waver.parts.elR.rotation.z = Math.sin(e * (6.5 - 2 * calmed)) * 0.6;
      waver.parts.shL.rotation.z = 0.14 + Math.sin(e * 1.3) * 0.05;
      waver.parts.elL.rotation.x = -0.25;
      waver.parts.head.rotation.z = Math.sin(e * 3.3) * 0.05;
      waver.parts.head.rotation.x = -0.08;
      waver.mouth.scale.y = 0.45 + 0.45 * Math.abs(Math.sin(e * 4.4)) * (1 - 0.6 * calmed);
      waver.root.rotation.z = Math.sin(e * 1.3) * 0.02;
      down.torso.scale.x = 1.05 * (1 + Math.sin(e * 2.2) * 0.035);
      down.parts.shL.rotation.z = 0.55 + Math.sin(e * 0.9) * 0.22;
      down.parts.elL.rotation.z = 0.4 + Math.sin(e * 0.9 + 0.6) * 0.25;
      down.parts.head.rotation.y = Math.sin(e * 0.55) * 0.35;

      // detections appear one after another, then keep pulsing (the fire tag goes once it is out)
      for (let i = 0; i < detections.length; i++) {
        const d = detections[i];
        const k = clamp01((t - d.reveal) / 0.45) * (1 - clamp01((t - d.until) / 0.35)) * wE;
        const pulse = 0.5 + 0.5 * Math.sin(e * 3 + i);
        d.ringMat.opacity = k * (0.45 + 0.4 * pulse);
        d.ring.scale.setScalar(0.85 + 0.15 * pulse + (1 - k) * 0.8);
        d.ring.visible = k > 0.005;
        (d.tag.material as THREE.SpriteMaterial).opacity = k;
        d.tag.position.y = d.baseY + Math.sin(e * 1.6 + i) * 0.03 + (1 - k) * 0.25;
        d.tag.visible = k > 0.005;
      }
      (screenGlow.material as THREE.SpriteMaterial).opacity = wE * 0.22;
      screenGlow.visible = on;
    }

    /* --- camera --- */
    const preset = CAMS[st];
    const fit = Math.min(1.75, Math.max(1, 1.62 / sizeState.aspect));
    const base = preset.follow ? tmpW.set(roverState.x, 0, roverState.z) : tmpW.set(0, 0, 0);
    const look = new THREE.Vector3(...preset.look).add(base);
    let pos: THREE.Vector3;
    if (st === 6) {
      // scripted fly-through: wide shot -> survivors & fire -> over the operator's laptop
      const u = fract(t / EVAL_P);
      pos = EVAL_POS.getPoint(u, new THREE.Vector3());
      EVAL_LOOK.getPoint(u, look);
    } else {
      pos = new THREE.Vector3(...preset.pos).add(base);
    }
    pos.sub(look).multiplyScalar(fit).add(look);
    if (!reduced) {
      pos.x += Math.sin(elapsed * 0.31) * 0.05;
      pos.y += Math.sin(elapsed * 0.43) * 0.035;
    }
    if (snap) {
      camPos.copy(pos);
      camLook.copy(look);
    } else {
      const k = 1 - Math.exp(-2.1 * dt);
      camPos.lerp(pos, k);
      camLook.lerp(look, k);
    }
    pointer.sx = damp(pointer.sx, pointer.x, 4, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 4, dt);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (!reduced && (pointer.sx || pointer.sy)) {
      const dist = camPos.distanceTo(camLook);
      camera.translateX(pointer.sx * 0.06 * dist);
      camera.translateY(-pointer.sy * 0.035 * dist);
      camera.lookAt(camLook);
    }

    gridU.uCenter.value.set(camLook.x, camLook.z);
    key.position.set(camLook.x + 3.5, 7, camLook.z + 4.5);
    key.target.position.set(camLook.x, 0, camLook.z);
    key.target.updateMatrixWorld();
  };

  /* ------------------------------------------------------------------ */
  /* Loop, sizing, adaptive resolution                                  */
  /* ------------------------------------------------------------------ */
  const clock = new THREE.Timer();
  let frameAcc = 0;
  let frameCount = 0;

  const resize = () => {
    const r = host.getBoundingClientRect();
    const wPx = Math.max(1, Math.round(r.width));
    const hPx = Math.max(1, Math.round(r.height));
    sizeState.w = wPx;
    sizeState.h = hPx;
    sizeState.aspect = wPx / hPx;
    renderer.setSize(wPx, hPx, false);
    camera.aspect = sizeState.aspect;
    camera.fov = sizeState.aspect < 1.2 ? 40 : 34;
    camera.updateProjectionMatrix();
  };

  /** Laptop screen: camera feed render pass + dashboard redraw (only while it can be seen). */
  let feedParity = 0;
  const renderLaptop = (force: boolean) => {
    if (w.evalu < 0.01) return;
    feedParity ^= 1;
    if (force || feedParity === 0) renderFeed();
    if (force || elapsed - lastDash >= 0.05) {
      drawDashboard(reduced ? STILL_T[6] : tStage, force ? 0 : elapsed - lastDash);
      lastDash = elapsed;
    }
  };

  const renderStill = () => {
    if (disposed) return;
    update(0, true);
    renderLaptop(true);
    renderer.render(scene, camera);
  };

  const frame = (now: number) => {
    clock.update(now);
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    elapsed += dt;
    tStage += dt;
    update(dt, false);
    renderLaptop(false);
    renderer.render(scene, camera);

    // adaptive resolution: step down if frames are consistently slow
    frameAcc += raw;
    frameCount++;
    if (frameCount >= 90) {
      const avg = frameAcc / frameCount;
      if (avg > 0.024 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        renderer.setPixelRatio(dpr);
        resize();
      }
      frameAcc = 0;
      frameCount = 0;
    }
  };

  const startLoop = () => {
    if (disposed) return;
    if (reduced) {
      renderer.setAnimationLoop(null);
      renderStill();
      return;
    }
    clock.reset();
    renderer.setAnimationLoop(frame);
  };

  const ro = new ResizeObserver(() => {
    resize();
    if (reduced || !active) renderStill();
  });
  ro.observe(host);
  resize();

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = host.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  const onLeave = () => {
    pointer.x = 0;
    pointer.y = 0;
  };
  host.addEventListener("pointermove", onPointer);
  host.addEventListener("pointerleave", onLeave);

  // first frame: place everything for the current stage
  renderStill();


  return {
    setStage(next: number) {
      next = Math.max(0, Math.min(6, next));
      if (next === stage) return;
      for (let i = 0; i < balls.length; i++) {
        ballFrom[i].p.copy(balls[i].mesh.position);
        ballFrom[i].o = balls[i].mat.opacity;
      }
      blendStart = elapsed;
      stage = next;
      tStage = 0;
      if (reduced) renderStill();
    },
    setTheme(next: SceneTheme) {
      theme = next;
      applyTheme();
      if (reduced || !active) renderStill();
    },
    setReducedMotion(next: boolean) {
      if (next === reduced) return;
      reduced = next;
      if (active) startLoop();
      else renderStill();
    },
    setActive(next: boolean) {
      if (next === active || disposed) return;
      active = next;
      if (active) startLoop();
      else renderer.setAnimationLoop(null);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
          m.dispose();
        }
      });
      textures.forEach((t) => t.dispose());
      glowTex.dispose();
      envTex.dispose();
      feedRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
