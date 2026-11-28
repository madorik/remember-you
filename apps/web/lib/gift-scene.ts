// 선물 고르는 중 장면(three.js): 꼬마 소녀 마법사가 큰 구슬에 두 손을 얹고 선물을 골라 준다.
// 다 골랐을 땐 finale(): 구슬을 모아 '얍!' 하고 번쩍이며 소녀가 통통 뛴다. 브라우저 전용이고, 부르는 쪽(PicksStage)이 동적 import로 늦게 불러 온다.
// 만화풍(툰 셰이더 + 남색 외곽선). 장면은 디자인 시안(Artifact '선물 고르는 중 시안')과 같다.
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Clock,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RedFormat,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { BufferGeometry, Material, Shader, Texture } from "three";

export interface GiftScene {
  /** 얍! 구슬이 번쩍이고 소녀가 호응한다. 소녀가 '얍!' 하는 순간 onHit, 번쩍임이 한창일 때 onPeak을 한 번씩 부른다(그때 고른 선물로 바꿔 끼우면 번쩍임 속에서 바뀐다) */
  finale(onPeak: () => void, onHit?: () => void): void;
  dispose(): void;
}

const INK = 0x1f2340;
const MANGO = 0xffc23d;
const LILAC = 0xd9cfff;
const PINK = 0xff9db0;
const ROSE = 0xff7a8a;
const HAIR = 0x6b4530;
const CAPE = 0x6c6fc4;

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};

// 모으는 동안(초) → 얍!(CHARGE) → 번쩍임이 가장 환함(+FLASH_UP) → 소녀의 '얍!'을 보여 준 뒤 선물로 바꿈(+REVEAL) → 번쩍임이 잦아듦
// 선물이 이미 와 있는 걸 기다리게 하지 않으려고 예전(CHARGE 0.5, FLASH_UP 0.14, FLASH_DOWN 0.6, REVEAL 0.34)의 대략 0.6배로 줄였다.
// 소녀·구슬·꽃가루의 움직임은 같은 모양 그대로 SPEED배 빠르게 흐른다(아래 render의 a)
const CHARGE = 0.25;
const FLASH_UP = 0.08;
const FLASH_DOWN = 0.36;
const REVEAL = 0.2;
const SPEED = 1.7;

/** 구슬 속에서 도는 선물 하나가 구슬 안벽·유리와 어울리는 데 쓰는 셰이더 */
const GLASS_VERT = "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }";
const INNER_FRAG =
  "varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6); vec3 c = mix(vec3(0.93, 0.98, 1.0), vec3(0.42, 0.7, 0.93), f); gl_FragColor = vec4(c, 1.0); }";
const GLASS_FRAG =
  "varying vec3 vN; varying vec3 vV; void main(){ vec3 n = normalize(vN); float f = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4); float spec = pow(max(dot(n, normalize(vec3(-0.5, 0.65, 0.58))), 0.0), 34.0); float spec2 = pow(max(dot(n, normalize(vec3(0.45, -0.7, 0.5))), 0.0), 18.0) * 0.35; vec3 c = mix(vec3(0.85, 0.95, 1.0), vec3(0.3, 0.6, 0.9), f) + vec3(spec + spec2); float a = clamp(mix(0.06, 0.55, f) + spec + spec2, 0.0, 1.0); gl_FragColor = vec4(c, a); }";

export function createGiftScene(canvas: HTMLCanvasElement, opts: { still?: boolean } = {}): GiftScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(camera);
  const world = new Group();
  scene.add(world);

  scene.add(new HemisphereLight(0xffffff, 0xffffff, 1.7));
  const sun = new DirectionalLight(0xffffff, 1.2);
  sun.position.set(3, 7, 9);
  scene.add(sun);

  /* ---------- 재료와 외곽선 ---------- */
  const ramp = new DataTexture(new Uint8Array([175, 220, 255]), 3, 1, RedFormat);
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.needsUpdate = true;
  const toon = (color: number) => new MeshToonMaterial({ color, gradientMap: ramp });
  const ink = new MeshBasicMaterial({ color: INK });
  const hullMat = new MeshBasicMaterial({ color: INK, side: BackSide });
  const smoothCache: Record<string, MeshBasicMaterial> = {};
  const smoothHull = (t: number) => {
    const key = t.toFixed(4);
    if (!smoothCache[key]) {
      const m = new MeshBasicMaterial({ color: INK, side: BackSide });
      m.onBeforeCompile = (s: Shader) => {
        s.vertexShader = s.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = position + normalize(normal) * ${key};`);
      };
      m.customProgramCacheKey = () => `hull${key}`;
      smoothCache[key] = m;
    }
    return smoothCache[key];
  };
  // 면 하나 + 외곽선 하나(부드러운 모양은 법선으로 부풀리고, 모서리 있는 모양은 키운 모양을 따로 준다)
  const part = (geo: BufferGeometry, color: number, o: { hull?: BufferGeometry; k?: number; t?: number } = {}) => {
    const g = new Group();
    g.add(new Mesh(geo, toon(color)));
    let h: Mesh;
    if (o.hull) {
      h = new Mesh(o.hull, hullMat);
    } else if (o.k) {
      h = new Mesh(geo, hullMat);
      h.scale.setScalar(1 + o.k);
    } else {
      h = new Mesh(geo, smoothHull(o.t ?? 0.05));
    }
    g.add(h);
    return g;
  };
  const sphereGeo = new SphereGeometry(1, 36, 24);
  const ell = (rx: number, ry: number, rz: number, color: number, t = 0.05) => {
    const g = new Group();
    g.add(new Mesh(sphereGeo, toon(color)));
    g.add(new Mesh(sphereGeo, smoothHull(t / ((rx + ry + rz) / 3))));
    g.scale.set(rx, ry, rz);
    return g;
  };
  const starShape = (outer: number, inner: number, n: number) => {
    const s = new Shape();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = Math.PI / 2 + (i * Math.PI) / n;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  };
  const heartShape = () => {
    const s = new Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(-0.9, 0.0, -0.55, 0.7, 0, 0.28);
    s.bezierCurveTo(0.55, 0.7, 0.9, 0.0, 0, -0.5);
    return s;
  };
  const extrude = (shape: Shape, depth: number, bevel: number) => {
    const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
    g.center();
    return g;
  };
  const canvasTex = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) draw(g);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  };
  const sparkleTex = (color: string) =>
    canvasTex((g) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(64, 8);
      g.quadraticCurveTo(64, 64, 120, 64);
      g.quadraticCurveTo(64, 64, 64, 120);
      g.quadraticCurveTo(64, 64, 8, 64);
      g.quadraticCurveTo(64, 64, 64, 8);
      g.fill();
    });
  const heartTex = (color: string) =>
    canvasTex((g) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(64, 112);
      g.bezierCurveTo(8, 72, 24, 18, 64, 46);
      g.bezierCurveTo(104, 18, 120, 72, 64, 112);
      g.fill();
    });
  const dotTex = (color: string) =>
    canvasTex((g) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(64, 64, 40, 0, Math.PI * 2);
      g.fill();
    });
  const glowTex = canvasTex((g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.5, "rgba(255,243,196,0.5)");
    gr.addColorStop(1, "rgba(255,211,107,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
  const ringTex = canvasTex((g) => {
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 7;
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.stroke();
  });
  const sprite = (tex: Texture, blend = 1 /* NormalBlending */) => new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: blend as 1 }));

  /* ---------- 뒤쪽 빛 ---------- */
  const backGlow = sprite(glowTex, AdditiveBlending);
  backGlow.position.set(0, 2.4, -2.0);
  backGlow.scale.set(9, 9, 1);
  world.add(backGlow);

  /* ---------- 꼬마 소녀(상체) ---------- */
  const girl = new Group();
  girl.position.set(0, 0, -1.2);
  world.add(girl);

  // 망토(뒤): 구슬 양옆으로 넓게 펼쳐지고 별이 박혀 있다. 구슬 뒷벽보다 뒤에 두어 구슬 안으로 비치지 않게 납작하게 편다
  // (점은 아래에서 위로 이어야 겉면이 바깥을 본다)
  const capeY = [0.4, 1.5, 2.7, 3.7, 4.15];
  const capeX = [3.05, 2.85, 2.3, 1.6, 0.95];
  const capePts = [[0, 0.4]].concat(capeY.map((y, i) => [capeX[i], y])).map((p) => new Vector2(p[0], p[1]));
  const cape = new Group();
  cape.scale.set(1, 1, 0.18);
  cape.position.z = -0.8;
  cape.add(part(new LatheGeometry(capePts, 56), CAPE, { t: 0.06 }));
  girl.add(cape);
  const capeR = (y: number) => {
    for (let i = 0; i < capeY.length - 1; i++) {
      if (y >= capeY[i] && y <= capeY[i + 1]) return capeX[i] + ((y - capeY[i]) / (capeY[i + 1] - capeY[i])) * (capeX[i + 1] - capeX[i]);
    }
    return 3;
  };
  const decalMat = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
  const decalMango = new MeshBasicMaterial({ color: MANGO, side: DoubleSide });
  [
    [3.1, -0.95, 0.2, 0],
    [2.3, 0.85, 0.24, 0],
    [1.4, -1.05, 0.22, 1],
    [0.9, 1.0, 0.2, 0],
    [3.4, 0.75, 0.14, 0],
    [1.9, -0.55, 0.12, 0],
  ].forEach((d) => {
    const r = capeR(d[0]) * 1.01;
    const m = new Mesh(new ShapeGeometry(starShape(d[2], d[2] * 0.3, 4)), d[3] ? decalMango : decalMat);
    m.position.set(Math.sin(d[1]) * r, d[0], Math.cos(d[1]) * r * 0.18 - 0.8 + 0.03);
    m.rotation.y = d[1] * 0.3;
    girl.add(m);
  });

  const body = new Group();
  girl.add(body);

  // 옷(어깨와 가슴): 구슬 위로 보이는 부분만. 구슬 속으로 파고들어 유리 너머로 비치지 않게 한다
  const dressPts = [
    [0, 3.3],
    [1.16, 3.3],
    [1.0, 3.62],
    [0.78, 4.0],
    [0.55, 4.22],
    [0, 4.25],
  ].map((p) => new Vector2(p[0], p[1]));
  const torso = new Group();
  torso.scale.set(1, 1, 0.55);
  torso.add(part(new LatheGeometry(dressPts, 48), LILAC, { t: 0.05 }));
  body.add(torso);

  // 동그란 흰 옷깃과 망고 리본
  [-1, 1].forEach((s) => {
    const collar = ell(0.42, 0.2, 0.34, 0xffffff, 0.035);
    collar.position.set(s * 0.34, 4.2, 0.32);
    collar.rotation.z = s * 0.35;
    body.add(collar);
  });
  [-1, 1].forEach((s) => {
    const loop = ell(0.22, 0.12, 0.1, MANGO, 0.03);
    loop.position.set(s * 0.22, 4.0, 0.62);
    loop.rotation.z = -s * 0.4;
    body.add(loop);
  });
  const knot = ell(0.1, 0.1, 0.09, MANGO, 0.025);
  knot.position.set(0, 4.0, 0.66);
  body.add(knot);

  // 팔: 어깨 공 → 소매(끝으로 갈수록 퍼짐) → 흰 단 → 손. 몸에서 이어져 구슬 위쪽 양옆으로 내려온다
  const orbCenter = new Vector3(0, 1.75, 0.4 + 1.2); // girl 안 좌표(월드 z에 +1.2)
  const hands: { hand: Group; side: number }[] = [];
  const makeArm = (side: number) => {
    const sh = new Vector3(side * 0.85, 3.95, 0.05);
    const handPos = new Vector3(side * 1.22, 3.3, 2.0);
    const toOrb = new Vector3().subVectors(orbCenter, handPos).normalize();
    const wr = handPos.clone().addScaledVector(toOrb, -0.28);
    const dir = new Vector3().subVectors(sh, wr);
    const len = dir.length();
    dir.normalize();
    const ball = ell(0.42, 0.42, 0.42, LILAC, 0.045);
    ball.position.copy(sh);
    body.add(ball);
    const sleeve = part(new CylinderGeometry(0.34, 0.6, len, 32), LILAC, { hull: new CylinderGeometry(0.4, 0.66, len + 0.1, 32) });
    sleeve.position.copy(sh).add(wr).multiplyScalar(0.5);
    sleeve.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    body.add(sleeve);
    const cuff = part(new TorusGeometry(0.6, 0.09, 12, 40), MANGO, { t: 0.03 });
    cuff.position.copy(wr).addScaledVector(dir, 0.04);
    cuff.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), dir);
    body.add(cuff);

    // 손: 손가락이 구슬 표면을 따라 아래·안쪽을 향한다
    const anchor = new Group();
    anchor.position.copy(handPos);
    anchor.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), toOrb);
    const hand = new Group();
    anchor.add(hand);
    hand.add(ell(0.4, 0.36, 0.3, 0xffffff, 0.06));
    const fingerGeo = new CapsuleGeometry(0.11, 0.28, 4, 10);
    [
      [-0.24, -0.42, 0.28],
      [0, -0.5, 0],
      [0.24, -0.42, -0.28],
    ].forEach((f) => {
      const finger = part(fingerGeo, 0xffffff, { t: 0.055 });
      finger.position.set(f[0], f[1], 0.03);
      finger.rotation.z = f[2];
      hand.add(finger);
    });
    const thumb = part(fingerGeo, 0xffffff, { t: 0.055 });
    thumb.scale.setScalar(0.85);
    thumb.position.set(side * 0.46, -0.02, 0.06);
    thumb.rotation.z = -side * 0.9;
    hand.add(thumb);
    body.add(anchor);
    hands.push({ hand, side });
  };
  makeArm(-1);
  makeArm(1);

  // 머리
  const head = new Group();
  head.position.set(0, 5.25, 0.05);
  body.add(head);
  // 뒷머리는 얼굴 뒤로 충분히 빼서(턱 밑에 얼굴 앞으로 튀어나와 수염처럼 보이지 않게) 둘레로만 보이게
  const hairBack = ell(1.14, 1.1, 0.95, HAIR, 0.05);
  hairBack.position.set(0, 0.04, -0.34);
  head.add(hairBack);
  head.add(ell(1.04, 0.95, 0.96, 0xffffff, 0.05));
  const bangs = part(new SphereGeometry(1.08, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.3), HAIR, { t: 0.04 });
  bangs.rotation.x = 0.52;
  head.add(bangs);

  // 눈(크고 반짝이는 눈), 속눈썹, 볼, 입
  const eyes = new Group();
  head.add(eyes);
  [-1, 1].forEach((s) => {
    const eye = new Mesh(sphereGeo, ink);
    eye.scale.set(0.16, 0.2, 0.06);
    eye.position.set(s * 0.4, -0.12, 0.9);
    eyes.add(eye);
    const white = new MeshBasicMaterial({ color: 0xffffff });
    const shine = new Mesh(sphereGeo, white);
    shine.scale.setScalar(0.055);
    shine.position.set(s * 0.4 + 0.055, -0.04, 0.955);
    eyes.add(shine);
    const shine2 = new Mesh(sphereGeo, white);
    shine2.scale.setScalar(0.028);
    shine2.position.set(s * 0.4 - 0.05, -0.2, 0.955);
    eyes.add(shine2);
    // 눈꼬리의 짧은 속눈썹(눈썹처럼 찌푸려 보이지 않게 짧고 눈 높이에 둔다)
    const lash = new Mesh(new CylinderGeometry(0.022, 0.022, 0.13, 6), ink);
    lash.position.set(s * 0.58, -0.03, 0.8);
    lash.rotation.z = -s * 1.1;
    head.add(lash);
    const blush = new Mesh(new CircleGeometry(0.2, 24), new MeshBasicMaterial({ color: 0xffbfcb }));
    blush.scale.set(1, 0.62, 1);
    blush.position.set(s * 0.64, -0.4, 0.72);
    blush.rotation.y = s * 0.72;
    head.add(blush);
  });
  const mouth = new Mesh(new TorusGeometry(0.12, 0.024, 8, 20, Math.PI), ink);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.5, 0.9);
  head.add(mouth);
  // '얍!' 할 때 벌리는 입
  const mouthO = new Group();
  mouthO.position.set(0, -0.52, 0.93);
  const mouthIn = new Mesh(sphereGeo, ink);
  mouthIn.scale.set(0.15, 0.18, 0.05);
  mouthO.add(mouthIn);
  const tongue = new Mesh(sphereGeo, new MeshBasicMaterial({ color: ROSE }));
  tongue.scale.set(0.09, 0.07, 0.04);
  tongue.position.set(0, -0.08, 0.03);
  mouthO.add(tongue);
  mouthO.visible = false;
  head.add(mouthO);

  // 양갈래(가늘고 끝이 살짝 말린다)와 분홍 리본
  const tails: { tail: Group; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const tail = new Group();
    tail.position.set(s * 1.02, 0.15, -0.08);
    const lock = ell(0.22, 0.52, 0.22, HAIR, 0.04);
    lock.position.set(s * 0.1, -0.5, 0);
    lock.rotation.z = s * 0.28;
    tail.add(lock);
    const curl = ell(0.2, 0.2, 0.2, HAIR, 0.04);
    curl.position.set(s * 0.26, -0.98, 0.02);
    tail.add(curl);
    [-1, 1].forEach((b) => {
      const loop = ell(0.21, 0.11, 0.1, ROSE, 0.025);
      loop.position.set(-s * 0.08 + b * 0.17, 0.08, 0.5);
      loop.rotation.z = b * 0.5;
      tail.add(loop);
    });
    const bowKnot = ell(0.09, 0.09, 0.09, ROSE, 0.02);
    bowKnot.position.set(-s * 0.08, 0.08, 0.52);
    tail.add(bowKnot);
    head.add(tail);
    tails.push({ tail, side: s });
  });

  // 모자(챙, 원뿔, 분홍 띠, 별 장식, 꺾인 끝 + 방울)
  const hat = new Group();
  hat.position.set(0, 0.72, -0.02);
  hat.rotation.set(-0.12, 0, 0.1);
  head.add(hat);
  hat.add(part(new CylinderGeometry(1.5, 1.5, 0.1, 56), MANGO, { hull: new CylinderGeometry(1.56, 1.56, 0.2, 56) }));
  const cone = part(new ConeGeometry(0.92, 1.85, 44), MANGO, { hull: new ConeGeometry(0.98, 1.95, 44) });
  cone.position.y = 0.975;
  hat.add(cone);
  const band = part(new TorusGeometry(0.86, 0.085, 14, 56), PINK, { t: 0.03 });
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.2;
  hat.add(band);
  const buckle = part(extrude(starShape(0.21, 0.09, 5), 0.06, 0.02), MANGO, { k: 0.16 });
  buckle.position.set(0, 0.2, 0.96);
  hat.add(buckle);
  const tip = new Group();
  tip.position.set(0, 1.8, 0);
  tip.rotation.z = -0.9;
  const tipCone = part(new ConeGeometry(0.34, 0.9, 28), MANGO, { hull: new ConeGeometry(0.4, 1.0, 28) });
  tipCone.position.y = 0.4;
  tip.add(tipCone);
  const pom = ell(0.17, 0.17, 0.17, 0xffffff, 0.04);
  pom.position.y = 0.88;
  tip.add(pom);
  hat.add(tip);
  [
    [0.5, -0.5, 0.15],
    [1.0, 0.45, 0.1],
    [1.3, -0.1, 0.08],
  ].forEach((d) => {
    const r = 0.92 * (1 - d[0] / 1.85) * 1.015;
    const m = new Mesh(new ShapeGeometry(starShape(d[2], d[2] * 0.3, 4)), decalMat);
    m.position.set(Math.sin(d[1]) * r, 0.05 + d[0], Math.cos(d[1]) * r);
    m.rotation.y = d[1];
    hat.add(m);
  });

  /* ---------- 구슬(크게, 앞에) ---------- */
  const ORB = 1.75;
  const orb = new Group();
  orb.position.set(0, 1.75, 0.4);
  world.add(orb);
  // 뒤쪽 안벽만 그려서(BackSide) 그 앞에서 도는 선물이 가려지지 않게 한다
  const innerMat = new ShaderMaterial({ side: BackSide, vertexShader: GLASS_VERT, fragmentShader: INNER_FRAG });
  orb.add(new Mesh(new SphereGeometry(ORB * 0.98, 56, 40), innerMat));
  orb.add(new Mesh(new SphereGeometry(ORB * 1.04, 56, 40), hullMat));

  // 구슬 안에서 도는 선물들
  const orbit = new Group();
  orbit.rotation.x = 0.25;
  orb.add(orbit);
  const gifts: { holder: Group; obj: Group; phase: number }[] = [];
  const addGift = (obj: Group, angle: number) => {
    const holder = new Group();
    holder.position.set(Math.cos(angle) * 0.95, 0, Math.sin(angle) * 0.95);
    obj.scale.setScalar(1.4);
    holder.add(obj);
    orbit.add(holder);
    gifts.push({ holder, obj, phase: angle });
  };
  const giftBox = new Group();
  giftBox.add(part(new BoxGeometry(0.4, 0.32, 0.4), PINK, { hull: new BoxGeometry(0.46, 0.38, 0.46) }));
  const lid = part(new BoxGeometry(0.46, 0.12, 0.46), MANGO, { hull: new BoxGeometry(0.52, 0.18, 0.52) });
  lid.position.y = 0.2;
  giftBox.add(lid);
  const ribbonMat = new MeshBasicMaterial({ color: MANGO });
  giftBox.add(new Mesh(new BoxGeometry(0.09, 0.33, 0.41), ribbonMat));
  giftBox.add(new Mesh(new BoxGeometry(0.41, 0.33, 0.09), ribbonMat));
  const bowL = ell(0.1, 0.07, 0.07, MANGO, 0.02);
  bowL.position.set(-0.08, 0.3, 0);
  bowL.rotation.z = 0.5;
  const bowR = ell(0.1, 0.07, 0.07, MANGO, 0.02);
  bowR.position.set(0.08, 0.3, 0);
  bowR.rotation.z = -0.5;
  giftBox.add(bowL);
  giftBox.add(bowR);
  addGift(giftBox, 0);
  addGift(part(extrude(heartShape(), 0.3, 0.05), ROSE, { k: 0.1 }), Math.PI * 0.5);
  addGift(part(extrude(starShape(0.3, 0.13, 5), 0.18, 0.04), MANGO, { k: 0.1 }), Math.PI);
  const tumbler = new Group();
  tumbler.add(part(new CylinderGeometry(0.13, 0.11, 0.42, 24), 0xbfe3ff, { hull: new CylinderGeometry(0.18, 0.16, 0.5, 24) }));
  const tLid = part(new CylinderGeometry(0.15, 0.15, 0.09, 24), MANGO, { hull: new CylinderGeometry(0.2, 0.2, 0.17, 24) });
  tLid.position.y = 0.25;
  tumbler.add(tLid);
  addGift(tumbler, Math.PI * 1.5);

  const orbGlow = sprite(glowTex, AdditiveBlending);
  orbGlow.scale.set(3.1, 3.1, 1);
  orbGlow.material.opacity = 0.7;
  orbGlow.renderOrder = 2;
  orb.add(orbGlow);

  // 유리 겉면(테두리는 푸르게, 왼쪽 위에 반짝)
  const glass = new Mesh(new SphereGeometry(ORB, 56, 40), new ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG }));
  glass.renderOrder = 3;
  orb.add(glass);

  const orbLight = new PointLight(0xfff0c8, 1.0, 9, 1.2);
  orbLight.position.set(0, 1.9, 1.4);
  world.add(orbLight);

  /* ---------- 피어오르는 반짝이와 배경 별 ---------- */
  const rise: { s: Sprite; x: number; z: number; size: number; off: number; speed: number }[] = [];
  const risers: [Texture, number, number, number][] = [
    [sparkleTex("#FFC23D"), -2.6, 0.2, 0.4],
    [heartTex("#FF9DB0"), 2.6, 0.4, 0.34],
    [dotTex("#8CC8F0"), 2.9, 0.0, 0.2],
    [sparkleTex("#FF9DB0"), -2.4, 0.8, 0.28],
    [sparkleTex("#FFC23D"), 2.3, 0.9, 0.32],
    [dotTex("#8CC8F0"), -3.0, 0.5, 0.17],
    [heartTex("#FF7A8A"), -2.2, -0.2, 0.3],
    [sparkleTex("#ffffff"), 2.2, 0.1, 0.32],
  ];
  risers.forEach((r, i) => {
    const s = sprite(r[0]);
    world.add(s);
    rise.push({ s, x: r[1], z: r[2], size: r[3], off: i / risers.length, speed: 0.22 + (i % 3) * 0.04 });
  });
  const twinkles: { s: Sprite; size: number; off: number }[] = [];
  (
    [
      [-3.3, 7.4, "#FFC23D", 0.5],
      [3.2, 7.8, "#ffffff", 0.45],
      [-3.5, 5.2, "#ffffff", 0.4],
      [3.4, 4.6, "#FFC23D", 0.4],
      [-2.8, 8.2, "#1F2340", 0.26],
      [2.9, 6.0, "#1F2340", 0.24],
      [-3.2, 0.8, "#FFC23D", 0.34],
      [3.3, 0.5, "#ffffff", 0.34],
    ] as [number, number, string, number][]
  ).forEach((t, i) => {
    const s = sprite(sparkleTex(t[2]));
    s.position.set(t[0], t[1], -2.8);
    world.add(s);
    twinkles.push({ s, size: t[3], off: i * 0.7 });
  });

  /* ---------- 얍! 때 쓰는 것: 번쩍임, 퍼지는 고리, 사방으로 튀는 반짝이 ---------- */
  // 화면 전체를 덮는 환한 판(카메라에 붙인다)
  const flashMat = new MeshBasicMaterial({ color: 0xfffbea, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const flash = new Mesh(new PlaneGeometry(2, 2), flashMat);
  // 구슬에서 터져 나오는 빛(화면을 가득 덮는다)
  const burstGlow = sprite(glowTex, AdditiveBlending);
  burstGlow.position.set(0, 1.9, 1.9);
  burstGlow.material.opacity = 0;
  burstGlow.renderOrder = 5;
  burstGlow.visible = false;
  world.add(burstGlow);
  flash.renderOrder = 10;
  flash.position.z = -1;
  flash.visible = false;
  camera.add(flash);
  const ring = sprite(ringTex, AdditiveBlending);
  ring.position.set(0, 1.75, 1.6);
  ring.material.opacity = 0;
  ring.visible = false;
  world.add(ring);
  const burstTex = [sparkleTex("#FFC23D"), sparkleTex("#ffffff"), sparkleTex("#FF9DB0"), heartTex("#FF9DB0"), dotTex("#8CC8F0")];
  const burst = Array.from({ length: 30 }, (_, i) => {
    const s = sprite(burstTex[i % burstTex.length]);
    s.visible = false;
    world.add(s);
    return { s, v: new Vector3(), age: 0, life: 1, size: 0.3 };
  });

  /* ---------- 크기, 움직임 ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  const onLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);

  // 세로로 11.2 만큼이 보이게 맞추고(모자 위로 말풍선 자리를 남긴다), 너무 좁으면(옆이 잘리면) 뒤로 물러난다
  const TAN = Math.tan((30 / 2) * (Math.PI / 180));
  const resize = () => {
    const w = canvas.clientWidth || 358;
    const h = canvas.clientHeight || 410;
    const aspect = w / h;
    const dist = Math.max(11.2 / 2 / TAN, 7.6 / aspect / 2 / TAN);
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.position.set(0, 4.65, dist);
    camera.lookAt(0, 4.5, 0);
    camera.updateProjectionMatrix();
    flash.scale.set(aspect, 1, 1);
  };
  resize();
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  }

  const blink = (t: number) => {
    const u = (t % 4.6) / 4.6;
    if (u > 0.9 && u < 0.98) return u < 0.94 ? 0.1 : 0.1 + ((u - 0.94) / 0.04) * 0.9;
    return 1;
  };

  // 얍! 진행: t0(시계 초)부터. 모으기(0~CHARGE) → 얍!(CHARGE) → 번쩍임이 가장 환할 때(CHARGE+FLASH_UP) onPeak
  let fin: { t0: number; onPeak: () => void; onHit?: () => void; peaked: boolean; burst: boolean } | null = null;
  let spin = 0;
  let last = 0;

  const render = (t: number) => {
    const dt = Math.min(0.05, Math.max(0, t - last));
    const sdt = dt * SPEED; // 꽃가루는 얍! 뒤 시계로
    last = t;
    const u = fin ? t - fin.t0 : -1;
    const hit = !!fin && u >= CHARGE;
    const after = hit ? u - CHARGE : 0; // 얍! 뒤 실제 초(번쩍임·선물 드러내기)
    const a = after * SPEED; // 소녀·구슬·꽃가루의 움직임 시계(예전 속도 기준 초)
    const charge = fin ? ease(u / CHARGE) : 0; // 0 → 1 모으는 동안
    const calm = hit ? Math.exp(-a * 3.2) : 1; // 얍! 뒤로 잦아드는 정도

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    world.rotation.y = Math.sin(t * 0.5) * 0.14 + pointer.x * 0.2;
    world.rotation.x = pointer.y * 0.05;

    // 소녀: 모을 땐 살짝 웅크리며 손을 올려 떨고, 얍! 하면 손을 내밀며 통통 뛴다
    const jump = hit ? 0.42 * Math.sin(Math.min(a / 0.55, 1) * Math.PI) : -0.14 * charge;
    body.position.y = Math.sin(t * 2.1) * 0.05 + jump;
    head.rotation.z = Math.sin(t * 1.57) * 0.045;
    head.rotation.y = Math.sin(t * 0.9) * 0.1;
    head.rotation.x = Math.sin(t * 1.2) * 0.02 + (hit ? -0.16 * calm : 0.12 * charge);
    const shout = hit && a < 0.8; // 얍! 하는 동안: 눈을 꼭 감고 입을 벌린다
    eyes.scale.y = shout ? 0.14 : blink(t) * (1 + 0.15 * charge * calm);
    mouth.visible = !shout;
    mouthO.visible = shout;
    mouthO.scale.setScalar(shout ? 1 + 0.25 * Math.exp(-a * 6) : 1);
    tip.rotation.z = -0.9 + Math.sin(t * 1.85) * 0.14 + (hit ? Math.sin(a * 18) * 0.38 * Math.exp(-a * 4) : 0);
    tails.forEach((o, i) => {
      o.tail.rotation.z = Math.sin(t * 1.9 + i * 1.6) * 0.1 * -o.side * (1 + (hit ? 2.4 * calm : 0));
    });
    hands.forEach((o, i) => {
      const lift = hit ? 0.32 * (1 - ease(a / 0.06)) - 0.12 * ease(a / 0.06) * Math.exp(-Math.max(0, a - 0.06) * 3.5) : 0.32 * charge;
      o.hand.position.y = lift;
      o.hand.rotation.z = Math.sin(t * 1.96 + i * 1.9) * 0.22 * o.side + (fin && !hit ? Math.sin(t * 40 + i) * 0.07 * charge : 0);
      o.hand.rotation.x = Math.sin(t * 1.96 + i * 1.9 + 1.2) * 0.1;
    });
    cape.scale.x = 1 + Math.sin(t * 1.8) * 0.015 + (hit ? 0.09 * calm : 0.03 * charge);

    // 구슬: 모으는 동안 선물이 빨리 돌고 빛이 커진다
    const glowK = charge * (hit ? Math.exp(-a * 2.4) : 1);
    spin += dt * (0.75 + 6 * glowK);
    orbit.rotation.y = spin;
    gifts.forEach((g, i) => {
      // 구슬이 돌아도 선물은 늘 정면을 보고(납작한 하트·별이 옆면으로 보이지 않게) 살짝만 흔들린다
      g.obj.rotation.y = -orbit.rotation.y + Math.sin(t * 1.3 + i * 1.7) * 0.6;
      g.obj.rotation.z = Math.sin(t * 1.7 + i) * 0.25;
      g.holder.position.y = Math.sin(t * 2 + g.phase * 2) * 0.14;
    });
    const pop = hit ? Math.exp(-a * 5) * 2 : 0;
    orbGlow.scale.setScalar(3.1 + Math.sin(t * 2.4) * 0.34 + glowK * 4.2 + pop);
    orbGlow.material.opacity = Math.min(1, 0.62 + Math.sin(t * 2.4) * 0.2 + glowK * 0.5);
    orbLight.intensity = 1 + glowK * 3.5 + pop;
    backGlow.scale.setScalar(9 + Math.sin(t * 2.4) * 0.5 + glowK * 4);

    if (fin && hit) {
      if (!fin.burst) {
        fin.burst = true;
        fin.onHit?.();
        burst.forEach((p, i) => {
          const a = Math.random() * Math.PI * 2;
          const sp = 2.4 + Math.random() * 3.6;
          p.s.position.set(0, 1.75, 1.7);
          p.v.set(Math.cos(a) * sp, Math.sin(a) * sp * 0.9 + 0.7, (Math.random() - 0.3) * 1.2);
          p.age = 0;
          p.life = 0.7 + Math.random() * 0.55;
          p.size = 0.3 + Math.random() * 0.32 + (i % 5 === 3 ? 0.08 : 0);
          p.s.visible = true;
        });
        ring.visible = true;
        flash.visible = true;
        burstGlow.visible = true;
      }
      burst.forEach((p) => {
        if (!p.s.visible) return;
        p.age += sdt;
        if (p.age >= p.life) {
          p.s.visible = false;
          return;
        }
        const k = p.age / p.life;
        p.s.position.addScaledVector(p.v, sdt);
        p.v.multiplyScalar(0.965);
        p.s.scale.setScalar(p.size * (0.5 + 0.9 * Math.sin(k * Math.PI)));
        p.s.material.opacity = 1 - k * k;
      });
      ring.scale.setScalar(2.2 + a * 12);
      ring.material.opacity = Math.max(0, 0.95 - a * 1.5);
      // 번쩍임: 구슬에서 빛이 크게 터지고(가운데는 새하얗게), 화면 전체가 살짝 환해졌다 가라앉는다
      const up = after < FLASH_UP ? after / FLASH_UP : 1;
      const down = after < FLASH_UP ? 1 : Math.max(0, 1 - (after - FLASH_UP) / FLASH_DOWN);
      flashMat.opacity = 0.22 * up * down;
      burstGlow.scale.setScalar(4.5 + 7.5 * ease(a / (FLASH_UP * SPEED + 0.3)));
      burstGlow.material.opacity = 0.85 * up * down;
      if (!fin.peaked && after >= REVEAL) {
        fin.peaked = true;
        fin.onPeak();
      }
      if (after > FLASH_UP + FLASH_DOWN) {
        flash.visible = false;
        burstGlow.visible = false;
      }
    }

    rise.forEach((r) => {
      const v = (t * r.speed + r.off) % 1;
      const a = v < 0.2 ? v / 0.2 : 1 - (v - 0.2) / 0.8;
      r.s.position.set(r.x + Math.sin(v * 5 + r.off * 9) * 0.12, 1.4 + v * 3.2, r.z);
      r.s.scale.setScalar(r.size * (0.4 + 0.8 * v));
      r.s.material.opacity = Math.max(0, a);
    });
    twinkles.forEach((w) => {
      const k = 0.5 + 0.5 * Math.sin(t * 2.3 + w.off);
      w.s.material.opacity = 0.2 + 0.8 * k;
      w.s.scale.setScalar(w.size * (0.7 + 0.45 * k));
    });

    renderer.render(scene, camera);
  };

  let raf = 0;
  let disposed = false;
  const clock = new Clock();
  const frame = () => {
    raf = window.requestAnimationFrame(frame);
    render(clock.getElapsedTime());
  };
  if (opts.still) {
    // 움직임 줄이기: 멈춘 그림 한 장
    render(0.6);
  } else {
    frame();
  }

  return {
    finale(onPeak, onHit) {
      if (fin || disposed) return;
      fin = { t0: clock.getElapsedTime(), onPeak, onHit, peaked: false, burst: false };
      if (opts.still) onPeak();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      if (ro) ro.disconnect();
      const seen = new Set<unknown>();
      const free = (x: { dispose: () => void } | null | undefined) => {
        if (x && !seen.has(x)) {
          seen.add(x);
          x.dispose();
        }
      };
      scene.traverse((o) => {
        const m = o as Mesh;
        free(m.geometry);
        const mats = (Array.isArray(m.material) ? m.material : [m.material]) as (Material & { map?: Texture | null })[];
        mats.forEach((mat) => {
          if (!mat) return;
          free(mat.map);
          free(mat);
        });
      });
      free(ramp);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
