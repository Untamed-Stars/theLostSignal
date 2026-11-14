import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/PointerLockControls.js";

const canvas = document.getElementById("game-canvas");
const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const messageElement = document.getElementById("message");
const objectiveText = document.getElementById("objective-text");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9a58a);
scene.fog = new THREE.FogExp2(0xb9a58a, 0.0085);

const camera = new THREE.PerspectiveCamera(
  76,
  window.innerWidth / window.innerHeight,
  0.1,
  1200
);
camera.position.set(0, 1.7, 12);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.75;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

const state = {
  started: false,
  velocityY: 0,
  onGround: true,
  oxygen: 100,
  hydration: 100,
  suit: 100,
  power: 100,
  ferrite: 0,
  silicate: 0,
  data: 0,
  scans: 0,
  mined: 0,
  messageTimer: 0,
  objectiveComplete: false
};

const keys = {};
const interactables = [];
const resourceObjects = [];
const scannedObjects = new Set();

const WORLD_SIZE = 700;
const PLAYER_HEIGHT = 1.7;
const WALK_SPEED = 10;
const SPRINT_MULTIPLIER = 1.55;
const GRAVITY = 22;
const JUMP_FORCE = 8.5;

function showMessage(text, duration = 2.5) {
  messageElement.textContent = text;
  messageElement.classList.add("visible");
  state.messageTimer = duration;
}

function makeMaterial(color, roughness = 1, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// Lighting: a hot, pale sun and a muted planetary sky.
scene.add(new THREE.HemisphereLight(0xd8d6c7, 0x554438, 1.65));

const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
sun.position.set(-120, 180, 80);
scene.add(sun);

// Ground with gentle procedural height variation.
const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 150, 150);
groundGeometry.rotateX(-Math.PI / 2);
const positionAttribute = groundGeometry.attributes.position;

for (let i = 0; i < positionAttribute.count; i++) {
  const x = positionAttribute.getX(i);
  const z = positionAttribute.getZ(i);
  const broad = Math.sin(x * 0.018) * 1.2 + Math.cos(z * 0.014) * 1.1;
  const detail = Math.sin(x * 0.071 + z * 0.043) * 0.28;
  const ridge = Math.sin((x + z) * 0.009) * 0.8;
  positionAttribute.setY(i, broad + detail + ridge);
}
groundGeometry.computeVertexNormals();

const ground = new THREE.Mesh(
  groundGeometry,
  new THREE.MeshStandardMaterial({
    color: 0x88745c,
    roughness: 1,
    metalness: 0
  })
);
ground.receiveShadow = true;
ground.name = "planetary-ground";
scene.add(ground);

function terrainHeight(x, z) {
  return (
    Math.sin(x * 0.018) * 1.2 +
    Math.cos(z * 0.014) * 1.1 +
    Math.sin(x * 0.071 + z * 0.043) * 0.28 +
    Math.sin((x + z) * 0.009) * 0.8
  );
}

// Distant rock formations.
function addRock(x, z, scale = 1, color = 0x655b50) {
  const geometry = new THREE.DodecahedronGeometry(1, 1);
  const material = makeMaterial(color);
  const rock = new THREE.Mesh(geometry, material);
  rock.position.set(x, terrainHeight(x, z) + scale * 0.42, z);
  rock.scale.set(scale * 0.8, scale * (0.65 + Math.random() * 0.5), scale);
  rock.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
  scene.add(rock);
  return rock;
}

for (let i = 0; i < 150; i++) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 25 + Math.random() * 300;
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  addRock(x, z, 1.5 + Math.random() * 8, 0x665b4e + Math.floor(Math.random() * 0x171717));
}

// Resource nodes and ancient fragments.
function addResourceNode(x, z, type) {
  const isFerrite = type === "ferrite";
  const color = isFerrite ? 0x8c7770 : 0x9aab9d;
  const crystalColor = isFerrite ? 0xc27b55 : 0x83b6a8;

  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);

  const base = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.05, 0),
    makeMaterial(color, 0.95)
  );
  base.scale.set(1.2, 0.75, 1.0);
  base.position.y = 0.65;
  group.add(base);

  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.24 + Math.random() * 0.18, 0.9 + Math.random() * 0.8, 5),
      new THREE.MeshStandardMaterial({
        color: crystalColor,
        roughness: 0.45,
        metalness: 0.15,
        emissive: crystalColor,
        emissiveIntensity: 0.12
      })
    );
    shard.position.set((Math.random() - 0.5) * 1.1, 1.25, (Math.random() - 0.5) * 0.9);
    shard.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(shard);
  }

  group.userData = { kind: "resource", resourceType: type, collected: false };
  scene.add(group);
  interactables.push(group);
  resourceObjects.push(group);
}

for (let i = 0; i < 28; i++) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 14 + Math.random() * 150;
  addResourceNode(Math.cos(angle) * distance, Math.sin(angle) * distance, i % 2 ? "ferrite" : "silicate");
}

function addDataFragment(x, z) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z) + 0.8, z);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.09, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8ed5c4,
      emissive: 0x2eaa91,
      emissiveIntensity: 0.65,
      metalness: 0.55,
      roughness: 0.35
    })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3),
    new THREE.MeshStandardMaterial({
      color: 0xd5e8d8,
      emissive: 0x64a994,
      emissiveIntensity: 0.8
    })
  );
  group.add(core);

  group.userData = { kind: "data", collected: false };
  scene.add(group);
  interactables.push(group);
}

addDataFragment(-22, -38);
addDataFragment(42, -72);
addDataFragment(75, 30);
addDataFragment(-90, 55);

// A simple landing pod gives the player a landmark.
function addLandingPod() {
  const pod = new THREE.Group();
  pod.position.set(0, terrainHeight(0, 0), -12);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.8, 5.2, 12),
    makeMaterial(0x777c79, 0.75, 0.25)
  );
  body.position.y = 2.6;
  pod.add(body);

  const top = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 1.8, 12),
    makeMaterial(0x9a9d91, 0.7, 0.2)
  );
  top.position.y = 6.1;
  pod.add(top);

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(2.25, 0.12, 8, 24),
    makeMaterial(0xc49a60, 0.55, 0.35)
  );
  band.position.y = 3.1;
  band.rotation.x = Math.PI / 2;
  pod.add(band);

  scene.add(pod);
}
addLandingPod();

// Small atmospheric details.
const dustGeometry = new THREE.BufferGeometry();
const dustPositions = new Float32Array(900 * 3);
for (let i = 0; i < 900; i++) {
  dustPositions[i * 3] = (Math.random() - 0.5) * 220;
  dustPositions[i * 3 + 1] = Math.random() * 30 + 1;
  dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
}
dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeometry,
  new THREE.PointsMaterial({ color: 0xe4cda9, size: 0.12, transparent: true, opacity: 0.35 })
);
scene.add(dust);

function updateHud() {
  const meters = [
    ["oxygen", state.oxygen],
    ["hydration", state.hydration],
    ["suit", state.suit],
    ["power", state.power]
  ];

  for (const [name, value] of meters) {
    const rounded = Math.max(0, Math.round(value));
    document.getElementById(`${name}-fill`).style.width = `${rounded}%`;
    document.getElementById(`${name}-value`).textContent = rounded;
  }

  document.getElementById("ferrite-count").textContent = state.ferrite;
  document.getElementById("silicate-count").textContent = state.silicate;
  document.getElementById("data-count").textContent = state.data;

  if (state.ferrite >= 5 && state.silicate >= 3) {
    objectiveText.textContent = "Initial materials secured. Continue exploring and recover the strange data fragments.";
  }
  if (state.data >= 1) {
    objectiveText.textContent = "A data fragment has been recovered. Its contents are corrupted, but something is still readable.";
  }
  if (state.data >= 3 && !state.objectiveComplete) {
    state.objectiveComplete = true;
    objectiveText.textContent = "Expedition milestone complete. The fragments contain a repeating signal coordinate.";
    showMessage("NEW DISCOVERY: REPEATING SIGNAL COORDINATE", 4);
  }
}

function getGroundY(x, z) {
  return terrainHeight(x, z) + PLAYER_HEIGHT;
}

function updateMovement(delta) {
  if (!controls.isLocked) return;

  const direction = new THREE.Vector3();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();

  if (keys.KeyW) direction.add(forward);
  if (keys.KeyS) direction.sub(forward);
  if (keys.KeyD) direction.add(right);
  if (keys.KeyA) direction.sub(right);

  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = keys.ShiftLeft ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED;
    controls.getObject().position.addScaledVector(direction, speed * delta);
  }

  if (keys.Space && state.onGround) {
    state.velocityY = JUMP_FORCE;
    state.onGround = false;
  }

  state.velocityY -= GRAVITY * delta;
  controls.getObject().position.y += state.velocityY * delta;

  const player = controls.getObject().position;
  const groundY = getGroundY(player.x, player.z);
  if (player.y <= groundY) {
    player.y = groundY;
    state.velocityY = 0;
    state.onGround = true;
  }

  const limit = WORLD_SIZE * 0.47;
  player.x = THREE.MathUtils.clamp(player.x, -limit, limit);
  player.z = THREE.MathUtils.clamp(player.z, -limit, limit);
}

function updateSurvival(delta) {
  if (!state.started || !controls.isLocked) return;

  state.oxygen = Math.max(0, state.oxygen - delta * 0.12);
  state.hydration = Math.max(0, state.hydration - delta * 0.055);
  state.power = Math.max(0, state.power - delta * 0.035);

  if (state.oxygen <= 0 || state.hydration <= 0) {
    state.suit = Math.max(0, state.suit - delta * 0.8);
  }

  if (state.suit <= 0) {
    showMessage("SUIT INTEGRITY CRITICAL. EXPEDITION SYSTEMS OFFLINE.", 3);
    state.suit = 0;
  }
}

function getTarget(maxDistance = 5) {
  raycaster.setFromCamera(centerScreen, camera);
  const hits = raycaster.intersectObjects(interactables, true);
  for (const hit of hits) {
    let object = hit.object;
    while (object && !object.userData.kind && object.parent) object = object.parent;
    if (object && object.userData.kind && hit.distance <= maxDistance) {
      return { object, distance: hit.distance };
    }
  }
  return null;
}

function interact() {
  if (!controls.isLocked) return;

  const target = getTarget(5);
  if (!target) {
    showMessage("No interactable object in range.");
    return;
  }

  const object = target.object;
  const data = object.userData;

  if (data.kind === "resource") {
    if (data.collected) return;
    data.collected = true;
    if (data.resourceType === "ferrite") {
      state.ferrite += 2 + Math.floor(Math.random() * 3);
      showMessage("MINED: FERRITE");
    } else {
      state.silicate += 2 + Math.floor(Math.random() * 3);
      showMessage("MINED: SILICATE");
    }
    state.mined++;
    scene.remove(object);
    updateHud();
    return;
  }

  if (data.kind === "data") {
    if (data.collected) return;
    data.collected = true;
    state.data++;
    state.power = Math.min(100, state.power + 4);
    showMessage("RECOVERED: UNKNOWN DATA FRAGMENT");
    scene.remove(object);
    updateHud();
  }
}

function scan() {
  if (!controls.isLocked) return;
  if (state.power < 1) {
    showMessage("SCANNER UNAVAILABLE: INSUFFICIENT POWER.");
    return;
  }

  state.power = Math.max(0, state.power - 1.5);
  raycaster.setFromCamera(centerScreen, camera);
  const candidates = [...resourceObjects, ...scene.children.filter(o => o.userData?.kind === "data")];
  const visible = raycaster.intersectObjects(candidates, true);

  if (visible.length && visible[0].distance < 45) {
    let object = visible[0].object;
    while (object && !object.userData.kind && object.parent) object = object.parent;
    if (object && !scannedObjects.has(object.uuid)) {
      scannedObjects.add(object.uuid);
      state.scans++;
      const label = object.userData.kind === "resource"
        ? `${object.userData.resourceType.toUpperCase()} DEPOSIT`
        : "UNKNOWN TECHNOLOGICAL FRAGMENT";
      showMessage(`SCAN COMPLETE: ${label}`);
    } else {
      showMessage("SCAN COMPLETE: NO NEW DATA.");
    }
  } else {
    showMessage("SCAN COMPLETE: NO SIGNIFICANT OBJECT DETECTED.");
  }
  updateHud();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updateMovement(delta);
  updateSurvival(delta);

  if (state.messageTimer > 0) {
    state.messageTimer -= delta;
    if (state.messageTimer <= 0) messageElement.classList.remove("visible");
  }

  dust.rotation.y += delta * 0.006;
  for (const object of interactables) {
    if (object.userData.kind === "data" && !object.userData.collected) {
      object.rotation.y += delta * 0.5;
      object.position.y += Math.sin(performance.now() * 0.001 + object.position.x) * delta * 0.12;
    }
  }

  renderer.render(scene, camera);
}

startButton.addEventListener("click", () => {
  state.started = true;
  controls.lock();
});

controls.addEventListener("lock", () => {
  startScreen.style.display = "none";
  showMessage("SUIT ONLINE. EXPEDITION LOG STARTED.", 3);
});

controls.addEventListener("unlock", () => {
  if (state.started) startScreen.style.display = "grid";
});

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (event.code === "KeyE") interact();
  if (event.code === "KeyQ") scan();
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
});

updateHud();
animate();
