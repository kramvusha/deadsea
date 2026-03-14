import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import menuBg from './assets/menu-bg.png'
import singlePlayerSvg from './assets/single-player-btn.svg?raw'

// ── Scene ──
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.FogExp2(0x87ceeb, 0.0006)

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(devicePixelRatio)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// ── Lights ──
const sun = new THREE.DirectionalLight(0xfff4e0, 2.0)
sun.position.set(100, 200, -80)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.far = 600
scene.add(sun)

const ambientLight = new THREE.AmbientLight(0x4488aa, 0.8)
scene.add(ambientLight)
const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a4060, 0.5)
scene.add(hemiLight)

// ── Ocean (shader-based) ──
const OCEAN_SIZE = 1200
const OCEAN_SEG = 120

const oceanUniforms = {
  uTime: { value: 0 },
  uDeepColor: { value: new THREE.Color(0x0055aa) },
  uShallowColor: { value: new THREE.Color(0x33bbee) },
  uFresnelColor: { value: new THREE.Color(0x88ddff) },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, -0.3).normalize() },
  uCausticsColor: { value: new THREE.Color(0xaaeeff) },
}

const oceanVertShader = `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float w1 = sin(pos.x * 0.04 + uTime * 1.2) * 0.8;
    float w2 = cos(pos.y * 0.03 + uTime * 0.9) * 1.0;
    float w3 = sin((pos.x + pos.y) * 0.02 + uTime * 1.8) * 0.4;
    float w4 = sin(pos.x * 0.08 - uTime * 2.0) * 0.2;
    float w5 = cos(pos.y * 0.06 + uTime * 1.4) * 0.25;
    pos.z += w1 + w2 + w3 + w4 + w5;

    vec3 tangent1 = vec3(1.0, 0.0,
      0.04 * cos(pos.x * 0.04 + uTime * 1.2) * 0.8 +
      0.02 * cos((pos.x + pos.y) * 0.02 + uTime * 1.8) * 0.4 +
      0.08 * cos(pos.x * 0.08 - uTime * 2.0) * 0.2
    );
    vec3 tangent2 = vec3(0.0, 1.0,
      -0.03 * sin(pos.y * 0.03 + uTime * 0.9) * 1.0 +
      0.02 * cos((pos.x + pos.y) * 0.02 + uTime * 1.8) * 0.4 +
      -0.06 * sin(pos.y * 0.06 + uTime * 1.4) * 0.25
    );
    vNormal = normalize(cross(tangent1, tangent2));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const oceanFragShader = `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFresnelColor;
  uniform vec3 uSunDir;
  uniform vec3 uCausticsColor;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  float caustic(vec2 p, float t) {
    float s = 0.0;
    s += sin(p.x * 3.0 + t * 1.5) * sin(p.y * 2.7 - t * 1.1) * 0.5;
    s += sin(p.x * 5.3 - t * 0.8) * sin(p.y * 4.8 + t * 1.3) * 0.3;
    s += sin((p.x + p.y) * 7.0 + t * 2.0) * 0.2;
    return s * s;
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 normal = normalize(vNormal);

    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

    float depth = smoothstep(-2.0, 2.0, vWorldPos.y);
    vec3 waterColor = mix(uDeepColor, uShallowColor, depth);

    waterColor = mix(waterColor, uFresnelColor, fresnel * 0.4);

    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 200.0);
    float sparkle = pow(max(dot(normal, halfDir), 0.0), 800.0);

    vec2 cUv = vWorldPos.xz * 0.04;
    float c = caustic(cUv, uTime);
    waterColor += uCausticsColor * c * 0.08;

    waterColor += vec3(1.0) * spec * 0.15;
    waterColor += vec3(1.0, 0.98, 0.95) * sparkle * 0.6;

    float foam = 0.0;
    float wave = sin(vWorldPos.x * 0.04 + uTime * 1.2) * 0.8 +
                 cos(vWorldPos.z * 0.03 + uTime * 0.9) * 1.0;
    foam += smoothstep(1.2, 1.6, wave) * 0.15;
    waterColor = mix(waterColor, vec3(0.9, 0.95, 1.0), foam);

    gl_FragColor = vec4(waterColor, 0.88 - fresnel * 0.15);
  }
`

const oceanMat = new THREE.ShaderMaterial({
  uniforms: oceanUniforms,
  vertexShader: oceanVertShader,
  fragmentShader: oceanFragShader,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
})

const oceanGeo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEG, OCEAN_SEG)
const ocean = new THREE.Mesh(oceanGeo, oceanMat)
ocean.rotation.x = -Math.PI / 2
scene.add(ocean)

function updateOcean(t) {
  oceanUniforms.uTime.value = t
}

// ── Deep water plane ──
const deepMat = new THREE.MeshBasicMaterial({ color: 0x0a2850 })
const deep = new THREE.Mesh(
  new THREE.PlaneGeometry(OCEAN_SIZE * 3, OCEAN_SIZE * 3),
  deepMat
)
deep.rotation.x = -Math.PI / 2
deep.position.y = -15
scene.add(deep)

function updateDepthTerrain() {}

// ── Audio ──
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
const masterGain = audioCtx.createGain()
masterGain.connect(audioCtx.destination)
let masterVolume = 0.5
masterGain.gain.value = masterVolume

function playBiteSound() {
  const t = audioCtx.currentTime
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(500, t)
  filter.frequency.exponentialRampToValueAtTime(60, t + 0.35)
  filter.connect(masterGain)

  const gain = audioCtx.createGain()
  gain.connect(filter)
  gain.gain.setValueAtTime(0.2, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)

  const osc = audioCtx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(150, t)
  osc.frequency.exponentialRampToValueAtTime(25, t + 0.35)
  osc.connect(gain)
  osc.start(t)
  osc.stop(t + 0.5)

  const bufSize = audioCtx.sampleRate * 0.12
  const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const noise = audioCtx.createBufferSource()
  noise.buffer = noiseBuf
  const nGain = audioCtx.createGain()
  nGain.connect(masterGain)
  nGain.gain.setValueAtTime(0.15, t)
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  noise.connect(nGain)
  noise.start(t)
  noise.stop(t + 0.12)
}

function playSplashSound() {
  const t = audioCtx.currentTime
  const bufSize = audioCtx.sampleRate * 0.25
  const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const noise = audioCtx.createBufferSource()
  noise.buffer = noiseBuf
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(900, t)
  filter.Q.setValueAtTime(0.8, t)
  const gain = audioCtx.createGain()
  gain.connect(masterGain)
  gain.gain.setValueAtTime(0.07, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  noise.connect(filter)
  filter.connect(gain)
  noise.start(t)
  noise.stop(t + 0.25)
}

// ── Day/Night ──
let isNightMode = false

function applyDayNight() {
  if (isNightMode) {
    scene.background.set(0x06101c)
    scene.fog.color.set(0x06101c)
    scene.fog.density = 0.002
    sun.color.set(0x6688aa)
    sun.intensity = 0.5
    ambientLight.color.set(0x0a1520)
    ambientLight.intensity = 0.3
    hemiLight.color.set(0x0a1830)
    hemiLight.groundColor.set(0x030508)
    hemiLight.intensity = 0.2
    oceanUniforms.uDeepColor.value.set(0x020a18)
    oceanUniforms.uShallowColor.value.set(0x0a2040)
    oceanUniforms.uFresnelColor.value.set(0x1a3355)
    oceanUniforms.uCausticsColor.value.set(0x223355)
    deepMat.color.set(0x020810)
  } else {
    scene.background.set(0x87ceeb)
    scene.fog.color.set(0x87ceeb)
    scene.fog.density = 0.0006
    sun.color.set(0xfff4e0)
    sun.intensity = 2.2
    ambientLight.color.set(0x6699bb)
    ambientLight.intensity = 1.0
    hemiLight.color.set(0x87ceeb)
    hemiLight.groundColor.set(0x1a4060)
    hemiLight.intensity = 0.6
    oceanUniforms.uDeepColor.value.set(0x0055aa)
    oceanUniforms.uShallowColor.value.set(0x33bbee)
    oceanUniforms.uFresnelColor.value.set(0x88ddff)
    oceanUniforms.uCausticsColor.value.set(0xaaeeff)
    deepMat.color.set(0x0a2850)
  }
}

// ── Player (Barbarossa model) ──
const playerModel = new THREE.Group()
const PLAYER_MODEL_SCALE = 5
const PLAYER_WAIST_OFFSET = -1.5

let playerInner = null
let playerMixer = null

const playerLoader = new GLTFLoader()
playerLoader.load('/resources/characters/barbarossa/barbarossa.gltf', (gltf) => {
  playerInner = gltf.scene

  const barbarossaMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0.64, 0.64, 0.64),
    specular: new THREE.Color(0.5, 0.5, 0.5),
    shininess: 96,
  })
  playerInner.traverse((child) => {
    if (child.isMesh) {
      if (child.material && child.material.map) {
        barbarossaMat.map = child.material.map
      }
      child.material = barbarossaMat
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  const box = new THREE.Box3().setFromObject(playerInner)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const s = PLAYER_MODEL_SCALE / maxDim
  playerInner.scale.setScalar(s)

  const center = box.getCenter(new THREE.Vector3())
  playerInner.position.set(-center.x * s, -box.min.y * s + PLAYER_WAIST_OFFSET, -center.z * s)

  playerModel.add(playerInner)

  if (gltf.animations && gltf.animations.length > 0) {
    playerMixer = new THREE.AnimationMixer(playerInner)
    for (const clip of gltf.animations) {
      const action = playerMixer.clipAction(clip)
      action.play()
    }
  }
})

playerModel.position.set(0, 1.0, 0)
scene.add(playerModel)

// ── Isometric camera ──
const CAM_HEIGHT = 70
const CAM_Z_OFF = 45
function updateCamera() {
  const target = playerModel.position
  camera.position.set(
    target.x,
    target.y + CAM_HEIGHT,
    target.z + CAM_Z_OFF
  )
  camera.lookAt(target.x, 0, target.z)
}
updateCamera()

// ── Shark model ──
let sharkTemplate = null
let sharkMixer = null
let sharkAnimations = []
const SHARK_TARGET_SIZE = 12

const gltfLoader = new GLTFLoader()
gltfLoader.load('/resources/characters/shark/shark.glb', (gltf) => {
  sharkTemplate = gltf.scene
  sharkAnimations = gltf.animations || []
  const atlasMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0.64, 0.64, 0.64),
    specular: new THREE.Color(0.5, 0.5, 0.5),
    shininess: 96,
    emissive: new THREE.Color(0, 0, 0),
  })
  sharkTemplate.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.material && child.material.map) {
        atlasMat.map = child.material.map
      }
      child.material = atlasMat
    }
  })
  const box = new THREE.Box3().setFromObject(sharkTemplate)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const s = SHARK_TARGET_SIZE / maxDim
  sharkTemplate.scale.setScalar(s)

  const center = box.getCenter(new THREE.Vector3())
  sharkTemplate.position.set(-center.x * s, -center.y * s, -center.z * s)
  sharkTemplate.rotation.y = Math.PI

  const wrapper = new THREE.Group()
  wrapper.add(sharkTemplate)
  sharkTemplate = wrapper
})

function createShark() {
  let group
  if (sharkTemplate) {
    group = SkeletonUtils.clone(sharkTemplate)
  } else {
    group = new THREE.Group()
    const mat = new THREE.MeshPhongMaterial({ color: 0x556677, shininess: 30 })
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat)
    body.scale.set(2.0, 1.0, 5.0)
    body.castShadow = true
    group.add(body)
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.0, 4), mat)
    fin.position.set(0, 1.5, 0)
    group.add(fin)
  }

  let mixer = null
  if (sharkTemplate && sharkAnimations.length > 0) {
    mixer = new THREE.AnimationMixer(group)
    for (const clip of sharkAnimations) {
      const action = mixer.clipAction(clip)
      action.timeScale = 1.0 + Math.random() * 0.5
      action.play()
    }
  }

  const cruiseSpeed = 5 + Math.random() * 4
  group.userData = {
    cruiseSpeed,
    burstSpeed: cruiseSpeed * (2.5 + Math.random()),
    currentSpeed: cruiseSpeed,
    turnSpeed: 0.6 + Math.random() * 0.8,
    direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
    swimPhase: Math.random() * Math.PI * 2,
    noticeRadius: 50 + Math.random() * 20,
    attackRadius: 15 + Math.random() * 5,
    mixer,
    visualQuat: new THREE.Quaternion(),
    state: 'patrol',
    patrolCenter: new THREE.Vector3(),
    patrolRadius: 30 + Math.random() * 50,
    patrolAngle: Math.random() * Math.PI * 2,
    patrolAngSpeed: (0.15 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1),
    circleDir: Math.random() < 0.5 ? 1 : -1,
    circleAngle: 0,
    circleTimer: 0,
    circleDuration: 3 + Math.random() * 5,
    lungeTimer: 0,
    lungeCooldown: 0,
    interest: 0,
    bobAmp: 0.08 + Math.random() * 0.12,
    bobFreq: 0.25 + Math.random() * 0.35,
    diveTimer: 0,
    diveCooldown: 8 + Math.random() * 20,
    diveDepth: -8,
    surfaceY: 0.3,
    submergedTimer: 0,
    submergedDuration: 3 + Math.random() * 5,
    surfaceTarget: new THREE.Vector3(),
  }

  return group
}

// ── Splash effects ──
const splashes = []

function createSplash(pos) {
  const group = new THREE.Group()
  group.position.copy(pos)
  const count = 20
  const vels = []
  for (let i = 0; i < count; i++) {
    const size = 0.15 + Math.random() * 0.4
    const geo = new THREE.BoxGeometry(size, size, size)
    const meshMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    })
    const p = new THREE.Mesh(geo, meshMat)
    p.position.set(
      (Math.random() - 0.5) * 2,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 2
    )
    group.add(p)
    vels.push(new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      4 + Math.random() * 8,
      (Math.random() - 0.5) * 10
    ))
  }
  scene.add(group)
  splashes.push({ group, vels, age: 0, life: 1.2 })
}

function updateSplashes(dt) {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]
    s.age += dt
    const progress = s.age / s.life
    const children = s.group.children
    for (let j = 0; j < children.length; j++) {
      const p = children[j]
      const v = s.vels[j]
      p.position.x += v.x * dt
      p.position.y += v.y * dt
      p.position.z += v.z * dt
      v.y -= 18 * dt
      p.material.opacity = Math.max(0, 0.85 - progress)
      const sc = Math.max(0.01, 1 - progress * 0.5)
      p.scale.setScalar(sc)
    }
    if (s.age >= s.life) {
      scene.remove(s.group)
      splashes.splice(i, 1)
    }
  }
}

// ── Game state ──
const sharks = []
let gameActive = false
let isDead = false
let survivalTime = 0
let spawnTimer = 0
let difficulty = 1
let stamina = 100
let swimPhase = 0

const PLAYER_SPEED = 18
const SPRINT_MULT = 1.7
const STAMINA_DRAIN = 35
const STAMINA_REGEN = 18
const STAMINA_MIN = 15
const BITE_REACH = 6
const BITE_CONE = 0.7
const INITIAL_SHARKS = 12
const SPAWN_INTERVAL = 15
const MAX_SHARKS = 25
const MIN_SPAWN_DIST = 120

// ── HUD ──
const hud = document.createElement('div')
Object.assign(hud.style, {
  position: 'fixed', top: '20px', left: '20px',
  color: '#fff', fontFamily: "'Montserrat', sans-serif", fontSize: '18px',
  textShadow: '0 2px 6px rgba(0,0,0,0.7)', zIndex: '5',
  pointerEvents: 'none', lineHeight: '1.6', display: 'none',
})
document.body.appendChild(hud)

const staminaContainer = document.createElement('div')
Object.assign(staminaContainer.style, {
  position: 'fixed', bottom: '30px', left: '50%',
  transform: 'translateX(-50%)', width: '200px', height: '8px',
  background: 'rgba(0,0,0,0.4)', borderRadius: '4px',
  zIndex: '5', pointerEvents: 'none', overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.2)', display: 'none',
})
const staminaFill = document.createElement('div')
Object.assign(staminaFill.style, {
  width: '100%', height: '100%',
  background: 'linear-gradient(90deg, #22ccaa, #44ffcc)',
  borderRadius: '4px', transition: 'width 0.1s',
})
staminaContainer.appendChild(staminaFill)
document.body.appendChild(staminaContainer)

function updateHUD() {
  const show = gameActive && !isDead
  hud.style.display = show ? 'block' : 'none'
  staminaContainer.style.display = show ? 'block' : 'none'
  if (!show) return

  const mins = Math.floor(survivalTime / 60)
  const secs = Math.floor(survivalTime % 60)
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  hud.innerHTML = [
    `<b style="font-size:28px;">${timeStr}</b>`,
    `Sharks: <b>${sharks.length}</b>`,
  ].join('<br>')
  staminaFill.style.width = stamina + '%'
}

// ── Menu overlay ──
const overlay = document.createElement('div')
Object.assign(overlay.style, {
  position: 'fixed', inset: '0', zIndex: '10',
  display: 'flex', flexDirection: 'column',
  fontFamily: "'Montserrat', sans-serif", color: '#fff',
})

overlay.innerHTML = `
  <img src="${menuBg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:40px 60px 30px;">
    <h1 style="
      font-size:clamp(60px,11vw,140px);font-weight:700;margin:0;
      letter-spacing:-0.14em;line-height:1;
      text-shadow:0 4px 30px rgba(0,0,0,0.3);
    ">
      D<i>EA</i>D\u2003S<i>E</i>A
    </h1>

    <nav style="
      display:flex;flex-direction:column;gap:4px;
      margin-top:24px;align-items:flex-start;
    ">
      <button id="btn-play" style="
        background:none;border:none;cursor:pointer;padding:8px 0;
        position:relative;display:inline-block;
      ">
        <div style="width:235px;height:54px;">${singlePlayerSvg}</div>
      </button>

      <div style="
        display:flex;align-items:center;gap:8px;
        padding:4px 0;opacity:0.5;cursor:default;
      ">
        <span style="
          background:#000;color:#fff;font-size:8px;font-weight:500;
          padding:2px 4px;line-height:12px;letter-spacing:0.5px;
          font-family:'Montserrat',sans-serif;
        ">COMING</span>
        <span style="font-size:28px;font-weight:700;letter-spacing:-0.02em;">
          C<i>O</i>-<i>O</i>P
        </span>
        <span style="
          background:#000;color:#fff;font-size:8px;font-weight:500;
          padding:2px 4px;line-height:12px;letter-spacing:0.5px;
          font-family:'Montserrat',sans-serif;
        ">SOON</span>
      </div>

      <button class="menu-btn" style="
        background:none;border:none;cursor:pointer;padding:4px 0;
        color:#fff;font-family:'Montserrat',sans-serif;
        font-size:28px;font-weight:700;letter-spacing:-0.02em;
      ">
        S<i>E</i>TT<i>I</i>NGS
      </button>

      <button class="menu-btn" style="
        background:none;border:none;cursor:pointer;padding:4px 0;
        color:#fff;font-family:'Montserrat',sans-serif;
        font-size:28px;font-weight:700;letter-spacing:-0.02em;
      ">
        <i>E</i>XTR<i>A</i>S
      </button>

      <button class="menu-btn" style="
        background:none;border:none;cursor:pointer;padding:4px 0;
        color:#fff;font-family:'Montserrat',sans-serif;
        font-size:28px;font-weight:700;letter-spacing:-0.02em;
      ">
        <i>QUI</i>T
      </button>
    </nav>

    <div style="flex:1"></div>

    <p style="
      font-size:12px;font-weight:500;text-align:center;
      opacity:0.7;line-height:1.5;max-width:600px;
      align-self:center;
    ">
      \u00A92026 KRAM STUDIOS. SEA OF DEATH\u00AE is developed by KRAM STUDIOS.
      All related rights, titles, trademarks, logotypes, and copyrights used in
      SEA OF DEATH\u00AE are the exclusive property of KRAM STUDIOS unless
      specifically stated otherwise. All rights reserved.
    </p>
  </div>
`
document.body.appendChild(overlay)

// ── Settings panel ──
const settingsPanel = document.createElement('div')
Object.assign(settingsPanel.style, {
  position: 'fixed', inset: '0', zIndex: '12',
  display: 'none', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Montserrat', sans-serif", color: '#fff',
})
settingsPanel.innerHTML = `
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.85);"></div>
  <div style="
    position:relative;z-index:1;
    background:rgba(255,255,255,0.07);
    border:1px solid rgba(255,255,255,0.15);
    border-radius:16px;padding:40px 50px;
    min-width:380px;backdrop-filter:blur(20px);
  ">
    <h2 style="
      font-size:36px;font-weight:700;margin:0 0 32px;
      letter-spacing:-0.04em;
    ">
      S<i>E</i>TT<i>I</i>NGS
    </h2>

    <div style="margin-bottom:28px;">
      <label style="font-size:14px;font-weight:500;opacity:0.7;display:block;margin-bottom:10px;">
        VOLUME
      </label>
      <div style="display:flex;align-items:center;gap:14px;">
        <input id="vol-slider" type="range" min="0" max="100" value="50" style="
          flex:1;height:6px;appearance:none;background:rgba(255,255,255,0.2);
          border-radius:3px;outline:none;cursor:pointer;
        "/>
        <span id="vol-value" style="
          font-size:16px;font-weight:700;min-width:40px;text-align:right;
        ">50%</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button id="btn-preview-bite" style="
          background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);
          color:#fff;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;
          padding:8px 16px;border-radius:6px;cursor:pointer;transition:background 0.2s;
        ">Test Bite</button>
        <button id="btn-preview-splash" style="
          background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);
          color:#fff;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;
          padding:8px 16px;border-radius:6px;cursor:pointer;transition:background 0.2s;
        ">Test Splash</button>
      </div>
    </div>

    <div style="margin-bottom:32px;">
      <label style="font-size:14px;font-weight:500;opacity:0.7;display:block;margin-bottom:10px;">
        TIME OF DAY
      </label>
      <div style="display:flex;gap:8px;">
        <button id="btn-day" class="tod-btn tod-active" style="
          flex:1;padding:10px;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;
          border:2px solid rgba(255,255,255,0.4);border-radius:8px;cursor:pointer;
          background:rgba(255,255,255,0.2);color:#fff;transition:all 0.2s;
        ">DAY</button>
        <button id="btn-night" class="tod-btn" style="
          flex:1;padding:10px;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;
          border:2px solid rgba(255,255,255,0.15);border-radius:8px;cursor:pointer;
          background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);transition:all 0.2s;
        ">NIGHT</button>
      </div>
    </div>

    <button id="btn-settings-back" style="
      width:100%;padding:12px;
      font-family:'Montserrat',sans-serif;font-size:18px;font-weight:700;
      background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.3);
      color:#fff;border-radius:8px;cursor:pointer;
      letter-spacing:-0.02em;transition:background 0.2s;
    ">
      B<i>A</i>CK
    </button>
  </div>
`
document.body.appendChild(settingsPanel)

const volSlider = settingsPanel.querySelector('#vol-slider')
const volValue = settingsPanel.querySelector('#vol-value')
volSlider.addEventListener('input', () => {
  masterVolume = volSlider.value / 100
  masterGain.gain.value = masterVolume
  volValue.textContent = volSlider.value + '%'
})

settingsPanel.querySelector('#btn-preview-bite').addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  playBiteSound()
})
settingsPanel.querySelector('#btn-preview-splash').addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  playSplashSound()
})

const btnDay = settingsPanel.querySelector('#btn-day')
const btnNight = settingsPanel.querySelector('#btn-night')

function setTodButton(active, inactive) {
  active.style.background = 'rgba(255,255,255,0.2)'
  active.style.borderColor = 'rgba(255,255,255,0.4)'
  active.style.color = '#fff'
  inactive.style.background = 'rgba(255,255,255,0.05)'
  inactive.style.borderColor = 'rgba(255,255,255,0.15)'
  inactive.style.color = 'rgba(255,255,255,0.5)'
}

btnDay.addEventListener('click', () => {
  isNightMode = false
  applyDayNight()
  setTodButton(btnDay, btnNight)
})
btnNight.addEventListener('click', () => {
  isNightMode = true
  applyDayNight()
  setTodButton(btnNight, btnDay)
})

settingsPanel.querySelector('#btn-settings-back').addEventListener('click', () => {
  settingsPanel.style.display = 'none'
  overlay.style.display = 'flex'
})

settingsPanel.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.25)' })
  btn.addEventListener('mouseleave', () => {
    if (btn.id === 'btn-settings-back' || btn.id.startsWith('btn-preview')) {
      btn.style.background = 'rgba(255,255,255,0.12)'
    } else if (btn.id === 'btn-day') {
      btn.style.background = isNightMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)'
    } else if (btn.id === 'btn-night') {
      btn.style.background = isNightMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'
    }
  })
})

// ── Death screen ──
const deathScreen = document.createElement('div')
Object.assign(deathScreen.style, {
  position: 'fixed', inset: '0', zIndex: '15',
  display: 'none', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: '16px',
  background: 'rgba(80,0,0,0.7)',
  fontFamily: "'Montserrat', sans-serif", color: '#fff',
  transition: 'opacity 0.5s', opacity: '0',
})
deathScreen.innerHTML = `
  <div style="font-size:56px;font-weight:700;letter-spacing:-0.06em;text-shadow:0 4px 20px rgba(0,0,0,0.5);">
    DEV<i>OU</i>RED
  </div>
  <div id="death-stats" style="font-size:20px;font-weight:500;opacity:0.8;"></div>
  <div style="display:flex;gap:12px;margin-top:20px;">
    <button id="btn-restart" style="
      padding:14px 40px;
      font-family:'Montserrat',sans-serif;font-size:22px;font-weight:700;
      background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);
      color:#fff;border-radius:8px;cursor:pointer;
      letter-spacing:-0.02em;transition:background 0.2s;
    ">
      R<i>E</i>ST<i>A</i>RT
    </button>
    <button id="btn-death-menu" style="
      padding:14px 40px;
      font-family:'Montserrat',sans-serif;font-size:22px;font-weight:700;
      background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);
      color:#fff;border-radius:8px;cursor:pointer;
      letter-spacing:-0.02em;transition:background 0.2s;
    ">
      M<i>E</i>NU
    </button>
  </div>
`
document.body.appendChild(deathScreen)

deathScreen.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.3)' })
  btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.15)' })
})

deathScreen.querySelector('#btn-restart').addEventListener('click', restartGame)
deathScreen.querySelector('#btn-death-menu').addEventListener('click', () => {
  deathScreen.style.opacity = '0'
  setTimeout(() => {
    deathScreen.style.display = 'none'
    overlay.style.display = 'flex'
    cleanupGame()
  }, 400)
})

// ── Menu events ──
overlay.querySelector('#btn-play').addEventListener('click', startGame)

const menuButtons = overlay.querySelectorAll('.menu-btn')
menuButtons.forEach((btn) => {
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.7' })
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1' })
})

menuButtons[0].addEventListener('click', () => {
  overlay.style.display = 'none'
  settingsPanel.style.display = 'flex'
})

// ── Input ──
const keys = {}
document.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (e.code === 'Escape' && gameActive && !isDead) {
    gameActive = false
    overlay.style.display = 'flex'
  }
})
document.addEventListener('keyup', (e) => { keys[e.code] = false })

let rightMouseDown = false
const mouseNDC = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0)
const mouseWorldTarget = new THREE.Vector3()
let hasMouseTarget = false

document.addEventListener('mousedown', (e) => {
  if (e.button === 2) { rightMouseDown = true; e.preventDefault() }
})
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) rightMouseDown = false
})
document.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / innerWidth) * 2 - 1
  mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1
})
document.addEventListener('contextmenu', (e) => e.preventDefault())

// ── Game start / stop / restart ──
function startGame() {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  overlay.style.display = 'none'
  settingsPanel.style.display = 'none'

  if (isDead || !gameActive) {
    cleanupGame()
    playerModel.position.set(0, 1.0, 0)
    playerModel.rotation.y = 0
    survivalTime = 0
    spawnTimer = 0
    difficulty = 1
    stamina = 100
    isDead = false
    swimPhase = 0
    for (let i = 0; i < INITIAL_SHARKS; i++) spawnShark(true)
  }

  gameActive = true
}

function cleanupGame() {
  for (const s of sharks) scene.remove(s)
  sharks.length = 0
  for (const s of splashes) scene.remove(s.group)
  splashes.length = 0
  for (const g of gibParts) scene.remove(g.mesh)
  gibParts.length = 0
  for (const b of bloodPools) scene.remove(b.group)
  bloodPools.length = 0
  playerModel.visible = true
  gameActive = false
  isDead = false
}

function restartGame() {
  deathScreen.style.opacity = '0'
  setTimeout(() => {
    deathScreen.style.display = 'none'
    startGame()
  }, 400)
}

// ── Shark spawning ──
function spawnShark(scattered) {
  const shark = createShark()
  const px = playerModel.position.x
  const pz = playerModel.position.z

  if (scattered) {
    const angle = Math.random() * Math.PI * 2
    const dist = 40 + Math.random() * 160
    shark.position.set(
      px + Math.cos(angle) * dist,
      0.5,
      pz + Math.sin(angle) * dist
    )
  } else {
    const angle = Math.random() * Math.PI * 2
    const dist = MIN_SPAWN_DIST + Math.random() * 80
    shark.position.set(
      px + Math.cos(angle) * dist,
      0.5,
      pz + Math.sin(angle) * dist
    )
  }

  shark.userData.cruiseSpeed += difficulty * 0.3
  shark.userData.burstSpeed += difficulty * 0.6
  shark.userData.currentSpeed = shark.userData.cruiseSpeed
  shark.userData.turnSpeed += difficulty * 0.1
  shark.userData.patrolCenter.copy(shark.position)

  scene.add(shark)
  sharks.push(shark)
}

// ── Movement ──
function updateMovement(dt) {
  if (!gameActive || isDead) return

  const dir = new THREE.Vector3()
  if (keys['KeyW'] || keys['ArrowUp']) dir.z -= 1
  if (keys['KeyS'] || keys['ArrowDown']) dir.z += 1
  if (keys['KeyA'] || keys['ArrowLeft']) dir.x -= 1
  if (keys['KeyD'] || keys['ArrowRight']) dir.x += 1

  hasMouseTarget = false
  if (rightMouseDown) {
    raycaster.setFromCamera(mouseNDC, camera)
    const hitPoint = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(waterPlane, hitPoint)) {
      const toTarget = hitPoint.clone().sub(playerModel.position)
      toTarget.y = 0
      if (toTarget.length() > 2) {
        toTarget.normalize()
        dir.x += toTarget.x
        dir.z += toTarget.z
        hasMouseTarget = true
      }
    }
  }

  let isSprinting = false
  const wantsToMove = dir.lengthSq() > 0
  if ((keys['ShiftLeft'] || keys['ShiftRight']) && stamina > STAMINA_MIN && wantsToMove) {
    isSprinting = true
    stamina = Math.max(0, stamina - STAMINA_DRAIN * dt)
  } else {
    stamina = Math.min(100, stamina + STAMINA_REGEN * dt)
  }
  if (stamina <= 1) isSprinting = false

  const speed = isSprinting ? PLAYER_SPEED * SPRINT_MULT : PLAYER_SPEED
  const isMoving = dir.lengthSq() > 0

  if (isMoving) {
    dir.normalize()
    playerModel.position.x += dir.x * speed * dt
    playerModel.position.z += dir.z * speed * dt

    const PLAYER_RADIUS = 2
    const SHARK_PUSH_RADIUS = 5
    const minDist = PLAYER_RADIUS + SHARK_PUSH_RADIUS
    for (const s of sharks) {
      if (s.userData.state === 'submerged' || s.userData.state === 'dive') continue
      const dx = playerModel.position.x - s.position.x
      const dz = playerModel.position.z - s.position.z
      const distSq = dx * dx + dz * dz
      if (distSq < minDist * minDist && distSq > 0.001) {
        const d = Math.sqrt(distSq)
        const overlap = minDist - d
        const nx = dx / d
        const nz = dz / d
        playerModel.position.x += nx * overlap
        playerModel.position.z += nz * overlap
      }
    }

    const targetAngle = Math.atan2(dir.x, dir.z)
    let angleDiff = targetAngle - playerModel.rotation.y
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    playerModel.rotation.y += angleDiff * Math.min(1, dt * 8)
  }

  const animSpeed = isSprinting ? 16 : isMoving ? 10 : 3
  swimPhase += dt * animSpeed

  if (isMoving) {
    playerModel.position.y = 1.0 + Math.sin(swimPhase * 0.5) * 0.25
  } else {
    playerModel.position.y = 1.0 + Math.sin(swimPhase * 0.3) * 0.1
  }

  if (playerMixer) playerMixer.update(dt)

  updateCamera()
}

// ── Shark AI ──
const _lookQuat = new THREE.Quaternion()
const _lookMtx = new THREE.Matrix4()
const _up = new THREE.Vector3(0, 1, 0)

function updateSharks(dt) {
  if (!gameActive || isDead) return

  spawnTimer += dt
  if (spawnTimer >= SPAWN_INTERVAL && sharks.length < MAX_SHARKS) {
    spawnTimer = 0
    spawnShark()
  }

  const playerPos = playerModel.position.clone()
  playerPos.y = 0

  for (let i = sharks.length - 1; i >= 0; i--) {
    const s = sharks[i]
    const ud = s.userData

    const toPlayer = new THREE.Vector3().subVectors(playerPos, s.position)
    toPlayer.y = 0
    const dist = toPlayer.length()

    // ── State machine ──
    if (ud.state === 'patrol') {
      ud.patrolAngle += ud.patrolAngSpeed * dt
      const targetX = ud.patrolCenter.x + Math.cos(ud.patrolAngle) * ud.patrolRadius
      const targetZ = ud.patrolCenter.z + Math.sin(ud.patrolAngle) * ud.patrolRadius
      const toTarget = new THREE.Vector3(targetX - s.position.x, 0, targetZ - s.position.z)
      if (toTarget.length() > 0.5) {
        toTarget.normalize()
        ud.direction.lerp(toTarget, ud.turnSpeed * 0.5 * dt)
        ud.direction.normalize()
      }
      ud.currentSpeed += (ud.cruiseSpeed - ud.currentSpeed) * 2 * dt

      if (dist < ud.noticeRadius) {
        ud.interest += dt * 0.4
        if (ud.interest > 1.0 + Math.random() * 2.0) {
          ud.state = 'circle'
          ud.circleAngle = Math.atan2(
            s.position.z - playerPos.z,
            s.position.x - playerPos.x
          )
          ud.circleTimer = 0
          ud.circleDuration = 3 + Math.random() * 5
          ud.circleDir = Math.random() < 0.5 ? 1 : -1
        }
      } else {
        ud.interest = Math.max(0, ud.interest - dt * 0.2)
      }

    } else if (ud.state === 'circle') {
      const circleRadius = 18 + Math.random() * 0.3
      ud.circleAngle += ud.circleDir * (ud.cruiseSpeed / circleRadius) * dt * 1.2
      const orbitX = playerPos.x + Math.cos(ud.circleAngle) * circleRadius
      const orbitZ = playerPos.z + Math.sin(ud.circleAngle) * circleRadius
      const toOrbit = new THREE.Vector3(orbitX - s.position.x, 0, orbitZ - s.position.z)
      if (toOrbit.length() > 0.5) {
        toOrbit.normalize()
        ud.direction.lerp(toOrbit, ud.turnSpeed * 1.5 * dt)
        ud.direction.normalize()
      }
      ud.currentSpeed += (ud.cruiseSpeed * 1.2 - ud.currentSpeed) * 3 * dt

      ud.circleTimer += dt
      if (ud.circleTimer >= ud.circleDuration && ud.lungeCooldown <= 0) {
        ud.state = 'lunge'
        ud.lungeTimer = 0
      }
      if (dist > ud.noticeRadius * 1.8) {
        ud.state = 'patrol'
        ud.patrolCenter.copy(s.position)
        ud.interest = 0
      }

    } else if (ud.state === 'lunge') {
      if (dist > 0.5) {
        toPlayer.normalize()
        ud.direction.lerp(toPlayer, ud.turnSpeed * 3.5 * dt)
        ud.direction.normalize()
      }
      ud.lungeTimer += dt
      const rampUp = Math.min(1, ud.lungeTimer * 2)
      const targetSpeed = ud.cruiseSpeed + (ud.burstSpeed - ud.cruiseSpeed) * rampUp
      ud.currentSpeed += (targetSpeed - ud.currentSpeed) * 4 * dt

      if (checkBite(s, ud, playerPos)) {
        die()
        return
      }
      if (dist < 5 && ud.lungeTimer > 1.5) {
        ud.state = 'retreat'
        ud.lungeCooldown = 4 + Math.random() * 4
        const away = ud.direction.clone().negate()
        away.x += (Math.random() - 0.5) * 0.8
        away.z += (Math.random() - 0.5) * 0.8
        away.normalize()
        ud.direction.copy(away)
      }
      if (ud.lungeTimer > 4) {
        ud.state = 'circle'
        ud.circleAngle = Math.atan2(
          s.position.z - playerPos.z,
          s.position.x - playerPos.x
        )
        ud.circleTimer = 0
        ud.circleDuration = 2 + Math.random() * 3
      }

    } else if (ud.state === 'retreat') {
      ud.currentSpeed += (ud.burstSpeed * 0.7 - ud.currentSpeed) * 3 * dt
      ud.lungeCooldown -= dt
      if (dist > ud.noticeRadius * 0.6 || ud.lungeCooldown <= 0) {
        ud.lungeCooldown = 0
        if (Math.random() < 0.4) {
          ud.state = 'dive'
          ud.diveTimer = 0
          ud.submergedDuration = 3 + Math.random() * 5
        } else {
          ud.state = 'circle'
          ud.circleAngle = Math.atan2(
            s.position.z - playerPos.z,
            s.position.x - playerPos.x
          )
          ud.circleTimer = 0
          ud.circleDuration = 2 + Math.random() * 4
        }
      }

    } else if (ud.state === 'dive') {
      ud.diveTimer += dt
      const diveSpeed = 4
      s.position.y += (ud.diveDepth - s.position.y) * diveSpeed * dt
      ud.currentSpeed += (ud.cruiseSpeed * 0.6 - ud.currentSpeed) * 2 * dt

      if (s.position.y < ud.diveDepth + 0.5) {
        ud.state = 'submerged'
        ud.submergedTimer = 0
        const angle = Math.random() * Math.PI * 2
        const emergeDist = 30 + Math.random() * 60
        ud.surfaceTarget.set(
          playerPos.x + Math.cos(angle) * emergeDist,
          ud.surfaceY,
          playerPos.z + Math.sin(angle) * emergeDist
        )
      }

    } else if (ud.state === 'submerged') {
      ud.submergedTimer += dt
      const toTarget = new THREE.Vector3().subVectors(ud.surfaceTarget, s.position)
      toTarget.y = 0
      if (toTarget.length() > 2) {
        toTarget.normalize()
        ud.direction.lerp(toTarget, 2.0 * dt)
        ud.direction.normalize()
      }
      ud.currentSpeed += (ud.burstSpeed * 0.5 - ud.currentSpeed) * 2 * dt
      s.position.y = ud.diveDepth + Math.sin(ud.swimPhase * 0.3) * 0.3

      if (ud.submergedTimer >= ud.submergedDuration) {
        ud.state = 'surface'
        ud.diveCooldown = 10 + Math.random() * 25
        createSplash(new THREE.Vector3(s.position.x, 0.5, s.position.z))
      }

    } else if (ud.state === 'surface') {
      const riseSpeed = 3
      s.position.y += (ud.surfaceY - s.position.y) * riseSpeed * dt
      ud.currentSpeed += (ud.cruiseSpeed - ud.currentSpeed) * 2 * dt

      if (s.position.y > ud.surfaceY - 0.2) {
        s.position.y = ud.surfaceY
        ud.state = 'patrol'
        ud.patrolCenter.copy(s.position)
        ud.interest = 0
      }
    }

    if (ud.state !== 'dive' && ud.state !== 'submerged' && ud.state !== 'surface'
        && ud.state !== 'lunge' && ud.state !== 'circle') {
      ud.diveCooldown -= dt
      if (ud.diveCooldown <= 0 && Math.random() < 0.003) {
        ud.state = 'dive'
        ud.diveTimer = 0
        ud.submergedDuration = 3 + Math.random() * 5
        ud.diveCooldown = 10 + Math.random() * 25
      }
    }

    s.position.x += ud.direction.x * ud.currentSpeed * dt
    s.position.z += ud.direction.z * ud.currentSpeed * dt

    const boundary = OCEAN_SIZE * 0.45
    if (Math.abs(s.position.x) > boundary || Math.abs(s.position.z) > boundary) {
      const center = new THREE.Vector3(-s.position.x, 0, -s.position.z).normalize()
      ud.direction.lerp(center, 2 * dt)
      ud.direction.normalize()
    }

    const lookTarget = s.position.clone().add(ud.direction.clone().multiplyScalar(5))
    lookTarget.y = s.position.y
    _lookMtx.lookAt(s.position, lookTarget, _up)
    _lookQuat.setFromRotationMatrix(_lookMtx)
    if (!ud.visualQuat.lengthSq()) ud.visualQuat.copy(_lookQuat)
    const slerpSpeed = ud.state === 'lunge' ? 5 : 2.5
    ud.visualQuat.slerp(_lookQuat, Math.min(1, slerpSpeed * dt))
    s.quaternion.copy(ud.visualQuat)

    const swimRate = 3 + (ud.currentSpeed / ud.cruiseSpeed) * 3
    ud.swimPhase += dt * swimRate
    if (ud.state !== 'dive' && ud.state !== 'submerged' && ud.state !== 'surface') {
      s.position.y = ud.surfaceY + Math.sin(ud.swimPhase * ud.bobFreq) * ud.bobAmp
    }

    if (ud.mixer) {
      ud.mixer.update(dt)
    } else {
      s.rotation.z = Math.sin(ud.swimPhase * 0.7) * 0.05
    }

    if (ud.state !== 'dive' && ud.state !== 'submerged') {
      if (checkBite(s, ud, playerPos)) {
        die()
        return
      }
    }

    if (dist > 400 && ud.state !== 'submerged') {
      scene.remove(s)
      sharks.splice(i, 1)
    }
  }

  const SHARK_BODY_RADIUS = 5
  for (let i = 0; i < sharks.length; i++) {
    for (let j = i + 1; j < sharks.length; j++) {
      const a = sharks[i]
      const b = sharks[j]
      const dx = b.position.x - a.position.x
      const dz = b.position.z - a.position.z
      const distSq = dx * dx + dz * dz
      const minDist = SHARK_BODY_RADIUS * 2
      if (distSq < minDist * minDist && distSq > 0.001) {
        const d = Math.sqrt(distSq)
        const overlap = (minDist - d) * 0.5
        const nx = dx / d
        const nz = dz / d
        a.position.x -= nx * overlap
        a.position.z -= nz * overlap
        b.position.x += nx * overlap
        b.position.z += nz * overlap

        a.userData.direction.x -= nx * 0.15
        a.userData.direction.z -= nz * 0.15
        a.userData.direction.normalize()
        b.userData.direction.x += nx * 0.15
        b.userData.direction.z += nz * 0.15
        b.userData.direction.normalize()
      }
    }
  }
}

// ── Bite check (front of shark only) ──
function checkBite(shark, ud, playerPos) {
  const nosePos = shark.position.clone().add(ud.direction.clone().multiplyScalar(BITE_REACH * 0.5))
  nosePos.y = 0
  const toPlayer = new THREE.Vector3().subVectors(playerPos, nosePos)
  toPlayer.y = 0
  const noseDist = toPlayer.length()
  if (noseDist > BITE_REACH) return false
  if (noseDist < 0.01) return true
  toPlayer.normalize()
  const dot = ud.direction.dot(toPlayer)
  return dot > BITE_CONE
}

// ── Gore explosion ──
const gibParts = []

function explodePlayer(pos) {
  playerModel.visible = false

  const colors = [0xcc2222, 0xaa1111, 0xffcc88, 0xcc3333, 0x334455, 0x991111]
  const count = 25
  for (let i = 0; i < count; i++) {
    const size = 0.2 + Math.random() * 0.5
    const geo = new THREE.BoxGeometry(size, size, size)
    const mat = new THREE.MeshPhongMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
    })
    const gib = new THREE.Mesh(geo, mat)
    gib.position.copy(pos)
    gib.position.y += 0.5
    scene.add(gib)
    gibParts.push({
      mesh: gib,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        3 + Math.random() * 10,
        (Math.random() - 0.5) * 16
      ),
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      ),
      age: 0,
      life: 1.5 + Math.random() * 1.5,
    })
  }

  spawnBloodPool(pos)
}

function updateGibs(dt) {
  for (let i = gibParts.length - 1; i >= 0; i--) {
    const g = gibParts[i]
    g.age += dt
    g.vel.y -= 18 * dt
    g.mesh.position.x += g.vel.x * dt
    g.mesh.position.y += g.vel.y * dt
    g.mesh.position.z += g.vel.z * dt
    g.mesh.rotation.x += g.rotVel.x * dt
    g.mesh.rotation.y += g.rotVel.y * dt
    g.mesh.rotation.z += g.rotVel.z * dt

    if (g.mesh.position.y < 0.2) {
      g.mesh.position.y = 0.2
      g.vel.y *= -0.2
      g.vel.x *= 0.7
      g.vel.z *= 0.7
    }

    if (g.age > g.life * 0.6) {
      g.mesh.material.opacity = 1 - (g.age - g.life * 0.6) / (g.life * 0.4)
      g.mesh.material.transparent = true
    }

    if (g.age >= g.life) {
      scene.remove(g.mesh)
      gibParts.splice(i, 1)
    }
  }
}

// ── Blood pool ──
const bloodPools = []

function spawnBloodPool(pos) {
  const poolGroup = new THREE.Group()
  poolGroup.position.set(pos.x, 0.15, pos.z)
  scene.add(poolGroup)

  const pool = {
    group: poolGroup,
    patches: [],
    age: 0,
    spreadDuration: 3,
    fadeDuration: 12,
  }

  const patchCount = 6 + Math.floor(Math.random() * 5)
  for (let i = 0; i < patchCount; i++) {
    const r = 1.5 + Math.random() * 3
    const geo = new THREE.CircleGeometry(r, 12)
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(
        0.4 + Math.random() * 0.3,
        0.02 + Math.random() * 0.03,
        0.02 + Math.random() * 0.02
      ),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const patch = new THREE.Mesh(geo, mat)
    patch.rotation.x = -Math.PI / 2
    const angle = Math.random() * Math.PI * 2
    const offset = Math.random() * 2
    patch.position.set(Math.cos(angle) * offset, Math.random() * 0.02, Math.sin(angle) * offset)
    patch.scale.setScalar(0.01)
    poolGroup.add(patch)
    pool.patches.push({ mesh: patch, targetScale: 1, delay: Math.random() * 1.5 })
  }

  bloodPools.push(pool)
}

function updateBloodPools(dt) {
  for (let i = bloodPools.length - 1; i >= 0; i--) {
    const pool = bloodPools[i]
    pool.age += dt

    for (const p of pool.patches) {
      if (pool.age < p.delay) continue
      const t = Math.min(1, (pool.age - p.delay) / pool.spreadDuration)
      const ease = 1 - Math.pow(1 - t, 3)
      p.mesh.scale.setScalar(ease * p.targetScale)
      const fadeStart = pool.spreadDuration + p.delay + 2
      if (pool.age > fadeStart) {
        const fadeT = Math.min(1, (pool.age - fadeStart) / pool.fadeDuration)
        p.mesh.material.opacity = 0.7 * (1 - fadeT)
      } else {
        p.mesh.material.opacity = Math.min(0.7, ease * 0.7)
      }
    }

    const totalLife = pool.spreadDuration + 2 + pool.fadeDuration + 2
    if (pool.age > totalLife) {
      scene.remove(pool.group)
      bloodPools.splice(i, 1)
    }
  }
}

// ── Death ──
function die() {
  if (isDead) return
  isDead = true
  playBiteSound()
  playSplashSound()

  explodePlayer(playerModel.position.clone())

  const secs = Math.floor(survivalTime)
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  const timeStr = mins > 0
    ? `${mins}m ${String(rem).padStart(2, '0')}s`
    : `${secs} seconds`
  deathScreen.querySelector('#death-stats').textContent = `Survived: ${timeStr}`

  setTimeout(() => {
    deathScreen.style.display = 'flex'
    requestAnimationFrame(() => { deathScreen.style.opacity = '1' })
  }, 1500)
}

// ── Game loop ──
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  updateOcean(t)
  updateDepthTerrain(t)

  if (gameActive && !isDead) {
    survivalTime += dt
    difficulty = 1 + survivalTime / 30
  }

  updateMovement(dt)
  updateSharks(dt)
  updateSplashes(dt)
  updateGibs(dt)
  updateBloodPools(dt)
  updateHUD()

  renderer.render(scene, camera)
}
animate()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
