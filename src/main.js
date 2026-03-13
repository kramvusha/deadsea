import './style.css'
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import menuBg from './assets/menu-bg.png'
import singlePlayerSvg from './assets/single-player-btn.svg?raw'

// ── Scene ──
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.FogExp2(0xadd8e6, 0.0008)

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000)
camera.position.set(0, 12, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(devicePixelRatio)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// ── Lights ──
const sun = new THREE.DirectionalLight(0xfff4e0, 2.5)
sun.position.set(100, 80, 50)
sun.castShadow = true
scene.add(sun)
scene.add(new THREE.AmbientLight(0x9ec5ff, 0.8))
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x94b8c9, 0.6))

// ── Ground (desert road) ──
const groundGeo = new THREE.PlaneGeometry(2000, 2000)
const groundMat = new THREE.MeshLambertMaterial({ color: 0xc2b280 })
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
ground.position.y = 0
ground.receiveShadow = true
scene.add(ground)

const roadGeo = new THREE.PlaneGeometry(20, 2000)
const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 })
const road = new THREE.Mesh(roadGeo, roadMat)
road.rotation.x = -Math.PI / 2
road.position.y = 0.05
road.receiveShadow = true
scene.add(road)

const stripeGeo = new THREE.PlaneGeometry(0.4, 4)
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
for (let z = -1000; z < 1000; z += 12) {
  const stripe = new THREE.Mesh(stripeGeo, stripeMat)
  stripe.rotation.x = -Math.PI / 2
  stripe.position.set(0, 0.06, z)
  scene.add(stripe)
}

// ── Controls ──
const controls = new PointerLockControls(camera, document.body)

// ── HUD ──
const hud = document.createElement('div')
Object.assign(hud.style, {
  position: 'fixed', top: '20px', left: '20px',
  color: '#fff', fontFamily: "'Montserrat', sans-serif", fontSize: '18px',
  textShadow: '0 2px 4px rgba(0,0,0,0.6)', zIndex: '5',
  pointerEvents: 'none', lineHeight: '1.6',
})
document.body.appendChild(hud)

const crosshair = document.createElement('div')
Object.assign(crosshair.style, {
  position: 'fixed', top: '50%', left: '50%',
  transform: 'translate(-50%,-50%)', zIndex: '5',
  pointerEvents: 'none', display: 'none',
})
crosshair.innerHTML = `
  <svg width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="12" stroke="white" stroke-width="1.5" fill="none" opacity="0.7"/>
    <circle cx="16" cy="16" r="2" fill="white" opacity="0.9"/>
    <line x1="16" y1="0" x2="16" y2="8" stroke="white" stroke-width="1.5" opacity="0.5"/>
    <line x1="16" y1="24" x2="16" y2="32" stroke="white" stroke-width="1.5" opacity="0.5"/>
    <line x1="0" y1="16" x2="8" y2="16" stroke="white" stroke-width="1.5" opacity="0.5"/>
    <line x1="24" y1="16" x2="32" y2="16" stroke="white" stroke-width="1.5" opacity="0.5"/>
  </svg>`
document.body.appendChild(crosshair)

// ── Helper: mixed italic text ──
function styledText(pairs) {
  return pairs.map(([text, italic]) =>
    italic ? `<span style="font-style:italic">${text}</span>` : text
  ).join('')
}

// ── Start screen overlay ──
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

overlay.querySelector('#btn-play').addEventListener('click', () => controls.lock())

overlay.querySelectorAll('.menu-btn').forEach((btn) => {
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.7' })
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1' })
})

controls.addEventListener('lock', () => {
  overlay.style.display = 'none'
  crosshair.style.display = 'block'
})
controls.addEventListener('unlock', () => {
  if (!isDead) overlay.style.display = 'flex'
  crosshair.style.display = 'none'
})

// ── Input ──
const keys = {}
document.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (e.code === 'Space') e.preventDefault()
})
document.addEventListener('keyup', (e) => { keys[e.code] = false })

const moveSpeed = 30
const moveDir = new THREE.Vector3()

const STAND_HEIGHT = 12
const CROUCH_HEIGHT = 7
const JUMP_FORCE = 18
const GRAVITY = 40
let velocityY = 0
let isGrounded = true
let isCrouching = false
let currentHeight = STAND_HEIGHT

function updateMovement(dt) {
  if (!controls.isLocked) return

  moveDir.set(0, 0, 0)
  if (keys['KeyW']) moveDir.z -= 1
  if (keys['KeyS']) moveDir.z += 1
  if (keys['KeyA']) moveDir.x -= 1
  if (keys['KeyD']) moveDir.x += 1

  const speed = isCrouching ? moveSpeed * 0.4 : moveSpeed
  if (moveDir.lengthSq() > 0) {
    moveDir.normalize()
    controls.moveRight(moveDir.x * speed * dt)
    controls.moveForward(-moveDir.z * speed * dt)
  }

  isCrouching = keys['ControlLeft'] || keys['ControlRight']
  const targetHeight = isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT
  currentHeight += (targetHeight - currentHeight) * Math.min(1, dt * 12)

  if (keys['Space'] && isGrounded) {
    velocityY = JUMP_FORCE
    isGrounded = false
  }

  velocityY -= GRAVITY * dt
  camera.position.y += velocityY * dt

  const groundLevel = currentHeight
  if (camera.position.y <= groundLevel) {
    camera.position.y = groundLevel
    velocityY = 0
    isGrounded = true
  }
}

// ── Car builder ──
const CAR_COLORS = [0xe03030, 0x3070e0, 0x30a830, 0xe0a020, 0xe06020, 0x8030c0, 0x20c0c0]

function createCar() {
  const group = new THREE.Group()
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]
  const mat = new THREE.MeshPhongMaterial({ color })

  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 5), mat)
  body.position.y = 1
  body.castShadow = true
  group.add(body)

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1, 2.5),
    new THREE.MeshPhongMaterial({ color: 0x222222, specular: 0x444444, shininess: 80 })
  )
  cabin.position.set(0, 2, -0.3)
  cabin.castShadow = true
  group.add(cabin)

  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12)
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 })
  const offsets = [
    [-1.5, 0.5, 1.5], [1.5, 0.5, 1.5],
    [-1.5, 0.5, -1.5], [1.5, 0.5, -1.5],
  ]
  for (const [x, y, z] of offsets) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, y, z)
    group.add(wheel)
  }

  const headlightGeo = new THREE.BoxGeometry(0.4, 0.3, 0.1)
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc })
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(headlightGeo, headlightMat)
    hl.position.set(side * 1, 1, 2.55)
    group.add(hl)
  }

  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 })
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(headlightGeo, taillightMat)
    tl.position.set(side * 1, 1, -2.55)
    group.add(tl)
  }

  group.userData = { speed: 20 + Math.random() * 25, hp: 1, color, mat }
  return group
}

// ── Cars management ──
const cars = []
let spawnTimer = 0
const SPAWN_INTERVAL = 1.5
const SPAWN_DIST = 250
const CAR_HIT_RADIUS = 5
let score = 0
let killed = 0
let isDead = false

function spawnCar() {
  const car = createCar()
  const angle = (Math.random() - 0.5) * Math.PI * 0.8
  const dist = SPAWN_DIST + Math.random() * 100
  const dir = new THREE.Vector3(
    Math.sin(angle) * dist,
    0,
    -Math.cos(angle) * dist
  )
  car.position.copy(camera.position).add(dir)
  car.position.y = 0

  const target = camera.position.clone()
  target.y = 0
  car.lookAt(target)

  car.userData.direction = new THREE.Vector3()
    .subVectors(target, car.position).normalize()

  scene.add(car)
  cars.push(car)
}

function updateCars(dt) {
  if (isDead) return

  spawnTimer += dt
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0
    if (cars.length < 20) spawnCar()
  }

  const playerPos = camera.position.clone()
  playerPos.y = 0

  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i]
    const d = car.userData.direction
    car.position.x += d.x * car.userData.speed * dt
    car.position.z += d.z * car.userData.speed * dt

    const carPos = car.position.clone()
    carPos.y = 0
    const dist = carPos.distanceTo(playerPos)

    if (dist < CAR_HIT_RADIUS) {
      die()
      return
    }

    if (dist > 500) {
      scene.remove(car)
      cars.splice(i, 1)
    }
  }
}

// ── Explosions ──
const explosions = []

function createExplosion(position, color) {
  const group = new THREE.Group()
  group.position.copy(position)

  const particleCount = 30
  const velocities = []

  for (let i = 0; i < particleCount; i++) {
    const size = 0.2 + Math.random() * 0.6
    const geo = new THREE.BoxGeometry(size, size, size)
    const isFlame = Math.random() > 0.4
    const mat = new THREE.MeshBasicMaterial({
      color: isFlame
        ? new THREE.Color().lerpColors(new THREE.Color(0xff4400), new THREE.Color(0xffcc00), Math.random())
        : color,
      transparent: true,
      opacity: 1,
    })
    const piece = new THREE.Mesh(geo, mat)
    piece.position.set(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5,
      (Math.random() - 0.5) * 2
    )
    piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    group.add(piece)
    velocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      5 + Math.random() * 15,
      (Math.random() - 0.5) * 20
    ))
  }

  const flash = new THREE.PointLight(0xff6600, 50, 30)
  flash.position.set(0, 2, 0)
  group.add(flash)

  scene.add(group)
  explosions.push({ group, velocities, life: 1.5, age: 0, flash })
}

function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i]
    ex.age += dt
    const progress = ex.age / ex.life

    if (ex.age > 0.15 && ex.flash.parent) {
      ex.group.remove(ex.flash)
    }

    const children = ex.group.children.filter((c) => c.isMesh)
    children.forEach((piece, j) => {
      const vel = ex.velocities[j]
      piece.position.x += vel.x * dt
      piece.position.y += vel.y * dt
      piece.position.z += vel.z * dt
      vel.y -= 25 * dt
      piece.rotation.x += dt * 5
      piece.rotation.z += dt * 3
      if (piece.material.opacity > 0) {
        piece.material.opacity = Math.max(0, 1 - progress)
      }
      const s = Math.max(0.01, 1 - progress * 0.7)
      piece.scale.setScalar(s)
    })

    if (ex.age >= ex.life) {
      scene.remove(ex.group)
      explosions.splice(i, 1)
    }
  }
}

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
  <div style="font-size:64px;font-weight:700;letter-spacing:-0.06em;text-shadow:0 4px 20px rgba(0,0,0,0.5);">
    YOU D<i>IE</i>D
  </div>
  <div id="death-stats" style="font-size:20px;font-weight:500;opacity:0.8;"></div>
  <button id="btn-restart" style="
    margin-top:20px;padding:14px 40px;
    font-family:'Montserrat',sans-serif;font-size:22px;font-weight:700;
    background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);
    color:#fff;border-radius:8px;cursor:pointer;
    letter-spacing:-0.02em;transition:background 0.2s;
  ">
    R<i>E</i>ST<i>A</i>RT
  </button>
`
document.body.appendChild(deathScreen)

deathScreen.querySelector('#btn-restart').addEventListener('mouseenter', (e) => {
  e.target.style.background = 'rgba(255,255,255,0.3)'
})
deathScreen.querySelector('#btn-restart').addEventListener('mouseleave', (e) => {
  e.target.style.background = 'rgba(255,255,255,0.15)'
})
deathScreen.querySelector('#btn-restart').addEventListener('click', restartGame)

function die() {
  if (isDead) return
  isDead = true
  controls.unlock()

  deathScreen.querySelector('#death-stats').textContent =
    `Score: ${score}  |  Kills: ${killed}`

  deathScreen.style.display = 'flex'
  requestAnimationFrame(() => { deathScreen.style.opacity = '1' })
}

function restartGame() {
  for (const car of cars) scene.remove(car)
  cars.length = 0
  for (const b of bullets) scene.remove(b)
  bullets.length = 0
  for (const ex of explosions) scene.remove(ex.group)
  explosions.length = 0

  score = 0
  killed = 0
  spawnTimer = 0
  isDead = false
  velocityY = 0
  isGrounded = true
  camera.position.set(0, STAND_HEIGHT, 0)

  deathScreen.style.opacity = '0'
  setTimeout(() => {
    deathScreen.style.display = 'none'
    controls.lock()
  }, 400)
}

// ── Bullets ──
const bullets = []
const BULLET_SPEED = 200
const BULLET_MAX_DIST = 600
const BULLET_HIT_RADIUS = 3
const FIRE_RATE = 0.12
let canShoot = true

const bulletGeo = new THREE.SphereGeometry(0.15, 6, 6)
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 })

const trailGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 4)
trailGeo.rotateX(Math.PI / 2)
const trailMat = new THREE.MeshBasicMaterial({
  color: 0xffaa22,
  transparent: true,
  opacity: 0.6,
})

function spawnBullet() {
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)

  const bullet = new THREE.Mesh(bulletGeo, bulletMat)
  bullet.position.copy(camera.position)
  bullet.position.addScaledVector(dir, 2)
  bullet.position.y -= 0.25

  const trail = new THREE.Mesh(trailGeo, trailMat.clone())
  trail.scale.z = 3
  bullet.add(trail)

  const glow = new THREE.PointLight(0xffaa22, 3, 8)
  bullet.add(glow)

  bullet.userData = {
    direction: dir.clone(),
    traveled: 0,
    alive: true,
  }

  scene.add(bullet)
  bullets.push(bullet)
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    if (!b.userData.alive) continue

    const step = BULLET_SPEED * dt
    b.position.addScaledVector(b.userData.direction, step)
    b.userData.traveled += step

    if (b.userData.traveled > BULLET_MAX_DIST || b.position.y < -1) {
      scene.remove(b)
      bullets.splice(i, 1)
      continue
    }

    for (let j = cars.length - 1; j >= 0; j--) {
      const car = cars[j]
      if (car.userData.hp <= 0) continue

      const carCenter = new THREE.Vector3()
      car.getWorldPosition(carCenter)
      carCenter.y += 1.2

      const dist = b.position.distanceTo(carCenter)
      if (dist < BULLET_HIT_RADIUS) {
        b.userData.alive = false
        scene.remove(b)
        bullets.splice(i, 1)

        car.userData.hp--
        if (car.userData.hp <= 0) {
          createExplosion(car.position.clone().setY(1.5), car.userData.color)
          scene.remove(car)
          cars.splice(j, 1)
          score += 100
          killed++
        }
        break
      }
    }
  }
}

// ── Muzzle flash ──
let muzzleFlash = null
let muzzleTimer = 0

function showMuzzleFlash() {
  if (!muzzleFlash) {
    const geo = new THREE.SphereGeometry(0.18, 6, 6)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
    muzzleFlash = new THREE.Mesh(geo, mat)
    const glow = new THREE.PointLight(0xffaa00, 8, 10)
    muzzleFlash.add(glow)
  }
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  muzzleFlash.position.copy(camera.position).addScaledVector(dir, 1.5)
  muzzleFlash.position.y -= 0.3
  scene.add(muzzleFlash)
  muzzleTimer = 0.05
}

function updateMuzzleFlash(dt) {
  if (muzzleTimer > 0) {
    muzzleTimer -= dt
    if (muzzleTimer <= 0 && muzzleFlash && muzzleFlash.parent) {
      scene.remove(muzzleFlash)
    }
  }
}

// ── Shooting ──
function shoot() {
  if (!controls.isLocked || !canShoot || isDead) return
  canShoot = false
  setTimeout(() => { canShoot = true }, FIRE_RATE * 1000)

  showMuzzleFlash()
  spawnBullet()
}

document.addEventListener('mousedown', (e) => {
  if (e.button === 0) shoot()
})

// ── HUD update ──
function updateHUD() {
  hud.innerHTML = `Score: <b>${score}</b><br>Kills: <b>${killed}</b>`
}

// ── Game loop ──
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  updateMovement(dt)
  updateCars(dt)
  updateBullets(dt)
  updateExplosions(dt)
  updateMuzzleFlash(dt)
  updateHUD()

  renderer.render(scene, camera)
}
animate()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
