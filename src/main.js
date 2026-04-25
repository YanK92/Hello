import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import './style.css'

// ─── Scene ─────────────────────────────────────────────────────────────────
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x000008, 0.04)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.z = 4

const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

// ─── Post-processing ────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9,  // strength
  0.35, // radius
  0.2   // threshold
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ─── Galaxy particle system ─────────────────────────────────────────────────
function buildGalaxy() {
  const COUNT = 80000
  const RADIUS = 6
  const BRANCHES = 4
  const SPIN = 1.2
  const SPREAD_POWER = 3

  const positions = new Float32Array(COUNT * 3)
  const colors = new Float32Array(COUNT * 3)

  const innerColor = new THREE.Color('#ff6030')
  const outerColor = new THREE.Color('#1a3aaa')

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3
    const r = Math.random() * RADIUS
    const branch = (i % BRANCHES) / BRANCHES * Math.PI * 2
    const spin = r * SPIN

    const spread = (v) =>
      Math.pow(Math.random(), SPREAD_POWER) * (Math.random() < 0.5 ? 1 : -1) * 0.25 * r * v

    positions[i3 + 0] = Math.cos(branch + spin) * r + spread(1)
    positions[i3 + 1] = spread(0.4)
    positions[i3 + 2] = Math.sin(branch + spin) * r + spread(1)

    const c = innerColor.clone().lerp(outerColor, r / RADIUS)
    colors[i3 + 0] = c.r
    colors[i3 + 1] = c.g
    colors[i3 + 2] = c.b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.004,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  }))
}

const galaxy = buildGalaxy()
scene.add(galaxy)

// ─── Floating geometric shapes ──────────────────────────────────────────────
const SHAPE_DEFS = [
  { geo: new THREE.IcosahedronGeometry(0.42, 1), pos: [ 1.6,  0.5, -1.0], hue: 0.04 },
  { geo: new THREE.OctahedronGeometry(0.32),     pos: [-1.9, -0.3, -0.5], hue: 0.60 },
  { geo: new THREE.TetrahedronGeometry(0.38),    pos: [ 0.2,  1.3, -2.0], hue: 0.12 },
  { geo: new THREE.IcosahedronGeometry(0.22, 0), pos: [-0.9,  0.9,  0.5], hue: 0.55 },
  { geo: new THREE.OctahedronGeometry(0.44),     pos: [ 2.6, -1.1, -2.0], hue: 0.72 },
]

const shapes = SHAPE_DEFS.map(({ geo, pos, hue }) => {
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.75, 0.55),
      emissive: new THREE.Color().setHSL(hue, 0.85, 0.18),
      metalness: 0.85,
      roughness: 0.12,
    })
  )
  mesh.position.set(...pos)
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
  scene.add(mesh)

  // Subtle wireframe overlay
  const wire = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.06 })
  )
  wire.position.copy(mesh.position)
  wire.rotation.copy(mesh.rotation)
  scene.add(wire)

  return { mesh, wire }
})

// ─── Lighting ───────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.08))

;[
  { color: '#ff6030', position: [ 3,  3,  2], intensity: 4 },
  { color: '#2255ff', position: [-3, -3, -2], intensity: 4 },
  { color: '#ffffff', position: [ 0,  5,  0], intensity: 2 },
].forEach(({ color, position, intensity }) => {
  const light = new THREE.PointLight(color, intensity, 18)
  light.position.set(...position)
  scene.add(light)
})

// ─── Interaction ─────────────────────────────────────────────────────────────
const pointer = { x: 0, y: 0 }
const smoothed = { x: 0, y: 0 }

window.addEventListener('mousemove', (e) => {
  pointer.x = (e.clientX / window.innerWidth - 0.5) * 2
  pointer.y = -(e.clientY / window.innerHeight - 0.5) * 2
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  composer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Animation loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock()

const originalY = SHAPE_DEFS.map(d => d.pos[1])

function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()

  // Galaxy slow rotation
  galaxy.rotation.y = t * 0.04
  galaxy.rotation.x = Math.sin(t * 0.015) * 0.08

  // Shape animation
  shapes.forEach(({ mesh, wire }, i) => {
    const dir = i % 2 === 0 ? 1 : -1
    mesh.rotation.x = t * 0.18 * dir + i
    mesh.rotation.y = t * 0.26 * dir + i
    mesh.position.y = originalY[i] + Math.sin(t * 0.5 + i * 1.3) * 0.14
    wire.rotation.copy(mesh.rotation)
    wire.position.copy(mesh.position)
  })

  // Smooth mouse parallax
  smoothed.x += (pointer.x - smoothed.x) * 0.045
  smoothed.y += (pointer.y - smoothed.y) * 0.045
  camera.position.x = smoothed.x * 0.7
  camera.position.y = smoothed.y * 0.35
  camera.lookAt(scene.position)

  composer.render()
}

animate()
