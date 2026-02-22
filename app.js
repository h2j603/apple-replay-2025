/* ══════════════════════════════════════════════════════
   Apple Music Replay 2025 — Map + LP Player (Three.js)
   ══════════════════════════════════════════════════════ */

let data = [];
let bubbles = [];
let images = {};
let hoveredBubble = null;
let clickedBubble = null;
let lastClickedBubble = null;
let connections = [];
let genreConnections = [];
let canvasReady = false;

// Toggle state for connections
let showArtistConnections = true;
let showGenreConnections = false;

// Larger radius range for more visible size difference
const MIN_RADIUS = 5;
const MAX_RADIUS = 50;
const MAX_PLAYS = 43;

// Zoom state (drag removed)
let zoomLevel = 1.0;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4.0;
let panX = 0, panY = 0;

// Hover repulsion state
let repulsionActive = false;
let repulsionTarget = null;

// ── THREE.JS LP PLAYER VARIABLES ───────────────────────
let threeScene, threeCamera, threeRenderer;
let vinylMesh, labelMesh, platterMesh, tonearmGroup;
let ledMesh, ledLight;
let isPlaying = false;
let albumTexture = null;
let currentBubble = null;

// Arm animation states
const ARM_IDLE = -28;
const ARM_PLAY = 0;
let armTargetRotation = ARM_IDLE;
let armCurrentRotation = ARM_IDLE;

/* ── Preload ────────────────────────────────────────── */
function preload() {
  loadJSON('data/music_2025.json', (loaded) => {
    data = loaded;
    loadAlbumImages();
  });
}

function loadAlbumImages() {
  let done = 0, total = 0;
  data.forEach(m => m.songs.forEach(s => { if (s.cover_url) total++; }));
  if (total === 0) { createBubbles(); return; }

  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      if (!song.cover_url) return;
      loadImage(song.cover_url,
        (img) => { images[`${mi}-${si}`] = img; if (++done === total) createBubbles(); },
        ()    => {                               if (++done === total) createBubbles(); }
      );
    });
  });
}

/* ── Bubbles ────────────────────────────────────────── */
function createBubbles() {
  bubbles = [];
  let idx = 0;
  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      // Amplified size difference using power function
      const norm = (song.plays - 1) / (MAX_PLAYS - 1);
      const r = MIN_RADIUS + Math.pow(norm, 0.6) * (MAX_RADIUS - MIN_RADIUS);
      
      bubbles.push({
        month: month.month_label,
        title: song.title,
        artist: song.artist,
        genre: song.genre || null, // Genre field (optional)
        plays: song.plays,
        radius: r,
        imgKey: `${mi}-${si}`,
        coverUrl: song.cover_url,
        col: getColorFromIdx(idx),
        youtubeUrl: song.youtube_url || '',
        x: 0, y: 0,
        vx: 0, vy: 0, // Velocity for repulsion animation
        idx: idx++,
      });
    });
  });
  buildConnections();
  buildGenreConnections();
  if (canvasReady) arrangeSpiral();
}

function buildConnections() {
  connections = [];
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      if (bubbles[i].artist && bubbles[i].artist === bubbles[j].artist) {
        connections.push({ a: bubbles[i], b: bubbles[j], type: 'artist' });
      }
    }
  }
}

function buildGenreConnections() {
  genreConnections = [];
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      // Extract first genre (before comma) for comparison
      const genreA = bubbles[i].genre ? bubbles[i].genre.split(',')[0].trim() : null;
      const genreB = bubbles[j].genre ? bubbles[j].genre.split(',')[0].trim() : null;
      
      // Only connect if both have genre and the first genre matches
      if (genreA && genreB && genreA === genreB) {
        genreConnections.push({ a: bubbles[i], b: bubbles[j], type: 'genre', genre: genreA });
      }
    }
  }
}

/* ── Setup ──────────────────────────────────────────── */
function setup() {
  const panel = document.getElementById('map-panel');
  const cnv = createCanvas(panel.offsetWidth, panel.offsetHeight);
  cnv.parent('map-panel');
  // Disable drag on canvas
  cnv.elt.addEventListener('mousedown', (e) => {
    if (hoveredBubble) {
      // Click on bubble - handled in mousePressed
    }
  });
  imageMode(CENTER);
  textAlign(CENTER, CENTER);
  canvasReady = true;
  if (bubbles.length > 0) arrangeSpiral();
  
  // Create toggle buttons
  createConnectionToggles();
  
  // Initialize Three.js LP Player
  initThreeLP();
}

/* ── THREE.JS LP PLAYER INITIALIZATION ───────────────── */
function initThreeLP() {
  const container = document.getElementById('three-lp-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // Scene
  threeScene = new THREE.Scene();
  
  // Camera - angled view to see LP label
  threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  threeCamera.position.set(0, 2.5, 3.5);
  threeCamera.lookAt(0, -0.3, 0);
  
  // Renderer
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(window.devicePixelRatio);
  threeRenderer.setClearColor(0x000000, 0);
  container.appendChild(threeRenderer.domElement);
  
  // ── LIGHTING ─────────────────────────────────────────
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  threeScene.add(ambientLight);
  
  // Main directional light (warm)
  const dirLight = new THREE.DirectionalLight(0xfff0dd, 0.8);
  dirLight.position.set(2, 3, 4);
  threeScene.add(dirLight);
  
  // Fill light
  const fillLight = new THREE.DirectionalLight(0xddeeff, 0.3);
  fillLight.position.set(-2, 1, 2);
  threeScene.add(fillLight);
  
  // Point light for vinyl shine
  const pointLight = new THREE.PointLight(0xffffff, 0.4, 10);
  pointLight.position.set(0, 2, 2);
  threeScene.add(pointLight);
  
  // Spotlight on label
  const spotLight = new THREE.SpotLight(0xffffff, 0.5);
  spotLight.position.set(0, 3, 2);
  spotLight.angle = Math.PI / 6;
  spotLight.penumbra = 0.3;
  spotLight.target.position.set(0, 0, 0);
  threeScene.add(spotLight);
  threeScene.add(spotLight.target);
  
  // ── PLINTH (Wood Base) ───────────────────────────────
  const plinthGeom = new THREE.BoxGeometry(2.8, 0.15, 2.8);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x2a1f0e,
    roughness: 0.8,
    metalness: 0.1
  });
  const plinthMesh = new THREE.Mesh(plinthGeom, plinthMat);
  plinthMesh.position.y = -0.2;
  threeScene.add(plinthMesh);
  
  // Plinth top surface
  const plinthTopGeom = new THREE.BoxGeometry(2.7, 0.02, 2.7);
  const plinthTopMat = new THREE.MeshStandardMaterial({
    color: 0x1a1208,
    roughness: 0.9,
    metalness: 0.0
  });
  const plinthTopMesh = new THREE.Mesh(plinthTopGeom, plinthTopMat);
  plinthTopMesh.position.y = -0.12;
  threeScene.add(plinthTopMesh);
  
  // ── PLATTER (Metal Ring) ─────────────────────────────
  const platterGeom = new THREE.CylinderGeometry(1.15, 1.15, 0.08, 64);
  const platterMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a28,
    roughness: 0.3,
    metalness: 0.7
  });
  platterMesh = new THREE.Mesh(platterGeom, platterMat);
  platterMesh.rotation.x = Math.PI / 2;
  platterMesh.position.y = -0.06;
  threeScene.add(platterMesh);
  
  // Platter edge ring
  const platterRingGeom = new THREE.TorusGeometry(1.15, 0.03, 16, 64);
  const platterRingMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.5,
    metalness: 0.8
  });
  const platterRing = new THREE.Mesh(platterRingGeom, platterRingMat);
  platterRing.position.y = -0.02;
  threeScene.add(platterRing);
  
  // ── VINYL RECORD ──────────────────────────────────────
  // Create vinyl with groove texture
  const vinylGeom = new THREE.CircleGeometry(1.0, 64);
  
  // Create canvas for vinyl texture with grooves
  const vinylCanvas = document.createElement('canvas');
  vinylCanvas.width = 512;
  vinylCanvas.height = 512;
  const vCtx = vinylCanvas.getContext('2d');
  
  // Draw vinyl grooves
  const gradient = vCtx.createRadialGradient(256, 256, 50, 256, 256, 250);
  gradient.addColorStop(0, '#0d0d0d');
  gradient.addColorStop(0.3, '#1a1a1a');
  gradient.addColorStop(0.31, '#0d0d0d');
  gradient.addColorStop(0.38, '#1a1a1a');
  gradient.addColorStop(0.39, '#0d0d0d');
  gradient.addColorStop(0.46, '#1a1a1a');
  gradient.addColorStop(0.47, '#0d0d0d');
  gradient.addColorStop(0.55, '#1a1a1a');
  gradient.addColorStop(0.56, '#0d0d0d');
  gradient.addColorStop(1, '#111111');
  vCtx.fillStyle = gradient;
  vCtx.fillRect(0, 0, 512, 512);
  
  // Add subtle shine
  const shineGradient = vCtx.createConicGradient(0, 256, 256);
  shineGradient.addColorStop(0, 'rgba(255,255,255,0.02)');
  shineGradient.addColorStop(0.25, 'rgba(255,255,255,0.01)');
  shineGradient.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  shineGradient.addColorStop(0.75, 'rgba(255,255,255,0.01)');
  shineGradient.addColorStop(1, 'rgba(255,255,255,0.02)');
  vCtx.fillStyle = shineGradient;
  vCtx.fillRect(0, 0, 512, 512);
  
  const vinylTexture = new THREE.CanvasTexture(vinylCanvas);
  const vinylMat = new THREE.MeshStandardMaterial({
    map: vinylTexture,
    roughness: 0.3,
    metalness: 0.1
  });
  vinylMesh = new THREE.Mesh(vinylGeom, vinylMat);
  vinylMesh.rotation.x = -Math.PI / 2;
  vinylMesh.position.y = -0.01;
  threeScene.add(vinylMesh);
  
  // ── CENTER LABEL (Album Art) ──────────────────────────
  const labelGeom = new THREE.CircleGeometry(0.38, 64);
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a18,
    roughness: 0.7,
    metalness: 0.0
  });
  labelMesh = new THREE.Mesh(labelGeom, labelMat);
  labelMesh.rotation.x = -Math.PI / 2.5;
  labelMesh.position.y = 0.01;
  threeScene.add(labelMesh);
  
  // Create placeholder texture for label
  createLabelTexture(null);
  
  // Spindle
  const spindleGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16);
  const spindleMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.3,
    metalness: 0.8
  });
  const spindle = new THREE.Mesh(spindleGeom, spindleMat);
  spindle.rotation.x = Math.PI / 2;
  spindle.position.y = 0.02;
  threeScene.add(spindle);
  
  // ── TONEARM ──────────────────────────────────────────
  createTonearm();
  
  // ── LED INDICATOR ─────────────────────────────────────
  const ledGeom = new THREE.CircleGeometry(0.04, 16);
  const ledMat = new THREE.MeshBasicMaterial({
    color: 0x222222
  });
  ledMesh = new THREE.Mesh(ledGeom, ledMat);
  ledMesh.position.set(1.1, 0.01, 1.0);
  threeScene.add(ledMesh);
  
  // LED glow
  const ledGlowGeom = new THREE.CircleGeometry(0.06, 16);
  const ledGlowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0
  });
  const ledGlow = new THREE.Mesh(ledGlowGeom, ledGlowMat);
  ledGlow.position.set(1.1, 0.005, 1.0);
  threeScene.add(ledGlow);
  
  // Store LED glow reference
  ledMesh.userData.glow = ledGlow;
  
  // Start animation loop
  animateThreeLP();
}

/* ── CREATE TONEARM ──────────────────────────────────── */
function createTonearm() {
  tonearmGroup = new THREE.Group();
  
  // Pivot base
  const pivotBaseGeom = new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16);
  const pivotBaseMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.4,
    metalness: 0.6
  });
  const pivotBase = new THREE.Mesh(pivotBaseGeom, pivotBaseMat);
  pivotBase.position.set(1.05, 0.05, 0.9);
  tonearmGroup.add(pivotBase);
  
  // Arm tube
  const armTubeGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8);
  const armTubeMat = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.3,
    metalness: 0.7
  });
  const armTube = new THREE.Mesh(armTubeGeom, armTubeMat);
  armTube.rotation.z = Math.PI / 2 - 0.2;
  armTube.position.set(0.65, 0.08, 0.55);
  tonearmGroup.add(armTube);
  
  // Headshell
  const headshellGeom = new THREE.BoxGeometry(0.06, 0.04, 0.1);
  const headshellMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.4,
    metalness: 0.6
  });
  const headshell = new THREE.Mesh(headshellGeom, headshellMat);
  headshell.position.set(0.25, 0.05, 0.5);
  tonearmGroup.add(headshell);
  
  // Cartridge
  const cartridgeGeom = new THREE.BoxGeometry(0.04, 0.03, 0.06);
  const cartridgeMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.5,
    metalness: 0.3
  });
  const cartridge = new THREE.Mesh(cartridgeGeom, cartridgeMat);
  cartridge.position.set(0.25, 0.02, 0.46);
  tonearmGroup.add(cartridge);
  
  // Stylus (needle)
  const stylusGeom = new THREE.ConeGeometry(0.008, 0.03, 8);
  const stylusMat = new THREE.MeshStandardMaterial({
    color: 0xfc4f05,
    roughness: 0.3,
    metalness: 0.5
  });
  const stylus = new THREE.Mesh(stylusGeom, stylusMat);
  stylus.rotation.x = Math.PI;
  stylus.position.set(0.25, 0.01, 0.43);
  tonearmGroup.add(stylus);
  
  // Counterweight
  const counterweightGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16);
  const counterweightMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.4,
    metalness: 0.6
  });
  const counterweight = new THREE.Mesh(counterweightGeom, counterweightMat);
  counterweight.rotation.z = Math.PI / 2;
  counterweight.position.set(1.15, 0.1, 0.95);
  tonearmGroup.add(counterweight);
  
  // Set initial rotation (idle position)
  tonearmGroup.rotation.y = THREE.MathUtils.degToRad(ARM_IDLE);
  
  threeScene.add(tonearmGroup);
}

/* ── CREATE LABEL TEXTURE ─────────────────────────────── */
function createLabelTexture(coverUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Default label background
  ctx.fillStyle = '#1a1a18';
  ctx.fillRect(0, 0, 256, 256);
  
  // Center circle
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Inner circle
  ctx.beginPath();
  ctx.arc(128, 128, 20, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // If cover URL provided, load image
  if (coverUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(128, 128, 115, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, 230, 230);
      ctx.restore();
      
      // Update texture
      if (albumTexture) albumTexture.dispose();
      albumTexture = new THREE.CanvasTexture(canvas);
      labelMesh.material.map = albumTexture;
      labelMesh.material.needsUpdate = true;
    };
    img.src = coverUrl;
  } else {
    // Show placeholder
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('APPLE', 128, 130);
    ctx.font = '14px sans-serif';
    ctx.fillText('REPLAY', 128, 155);
  }
  
  // Create/update texture
  if (albumTexture) albumTexture.dispose();
  albumTexture = new THREE.CanvasTexture(canvas);
  labelMesh.material.map = albumTexture;
  labelMesh.material.needsUpdate = true;
}

/* ── THREE.JS ANIMATION LOOP ──────────────────────────── */
function animateThreeLP() {
  requestAnimationFrame(animateThreeLP);
  
  // Rotate vinyl when playing
  if (isPlaying && vinylMesh) {
    vinylMesh.rotation.z += 0.03;
  }
  
  // Animate tonearm
  if (tonearmGroup) {
    // Smooth interpolation
    armCurrentRotation += (armTargetRotation - armCurrentRotation) * 0.05;
    tonearmGroup.rotation.y = THREE.MathUtils.degToRad(armCurrentRotation);
  }
  
  // LED animation
  if (ledMesh && isPlaying) {
    const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
    ledMesh.material.color.setHex(0xfc4f05);
    if (ledMesh.userData.glow) {
      ledMesh.userData.glow.material.color.setHex(0xfc4f05);
      ledMesh.userData.glow.material.opacity = 0.3 + pulse * 0.3;
    }
  } else if (ledMesh) {
    ledMesh.material.color.setHex(0x222222);
    if (ledMesh.userData.glow) {
      ledMesh.userData.glow.material.opacity = 0;
    }
  }
  
  threeRenderer.render(threeScene, threeCamera);
}

/* ── Connection Toggle Buttons ────────────────────────── */
function createConnectionToggles() {
  const mapPanel = document.getElementById('map-panel');
  
  // Container for toggles
  const toggleContainer = document.createElement('div');
  toggleContainer.id = 'toggle-container';
  toggleContainer.style.cssText = `
    position: absolute;
    top: 24px; right: 28px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  
  // Artist toggle
  const artistToggle = document.createElement('label');
  artistToggle.innerHTML = `
    <input type="checkbox" id="toggle-artist" checked>
    <span>아티스트 연결</span>
  `;
  artistToggle.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.62rem;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: color 0.2s;
  `;
  artistToggle.querySelector('input').style.cssText = `
    accent-color: #fc4f05;
    width: 14px; height: 14px;
  `;
  artistToggle.addEventListener('change', (e) => {
    showArtistConnections = e.target.checked;
  });
  
  // Genre toggle
  const genreToggle = document.createElement('label');
  genreToggle.innerHTML = `
    <input type="checkbox" id="toggle-genre">
    <span>장르 연결</span>
  `;
  genreToggle.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.62rem;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: color 0.2s;
  `;
  genreToggle.querySelector('input').style.cssText = `
    accent-color: #fc4f05;
    width: 14px; height: 14px;
  `;
  genreToggle.addEventListener('change', (e) => {
    showGenreConnections = e.target.checked;
  });
  
  toggleContainer.appendChild(artistToggle);
  toggleContainer.appendChild(genreToggle);
  mapPanel.appendChild(toggleContainer);
}

/* ── Draw ───────────────────────────────────────────── */
function draw() {
  background(10);

  // Apply zoom + pan (no drag)
  translate(width / 2 + panX, height / 2 + panY);
  scale(zoomLevel);

  // World-space mouse (accounting for zoom/pan)
  const mx = (mouseX - width / 2 - panX) / zoomLevel;
  const my = (mouseY - height / 2 - panY) / zoomLevel;

  // Hover detection (for visual feedback)
  let newHovered = null;
  bubbles.forEach(b => {
    if (dist(mx, my, b.x, b.y) < b.radius) newHovered = b;
  });
  
  hoveredBubble = newHovered;

  // Apply repulsion effect when hovering
  if (hoveredBubble) {
    applyRepulsion(hoveredBubble);
    repulsionActive = true;
    repulsionTarget = hoveredBubble;
  } else {
    // Smoothly return to original positions
    applyReturnForce();
    repulsionActive = false;
    repulsionTarget = null;
  }

  // Draw connections based on toggle states
  drawConnections();
  
  bubbles.forEach(b => {
    const isHov = b === hoveredBubble;
    // Extract first genre for comparison
    const bGenre = b.genre ? b.genre.split(',')[0].trim() : null;
    const hGenre = hoveredBubble && hoveredBubble.genre ? hoveredBubble.genre.split(',')[0].trim() : null;
    const isCon = hoveredBubble && (
      (showArtistConnections && b.artist === hoveredBubble.artist) ||
      (showGenreConnections && bGenre && hGenre && bGenre === hGenre)
    ) && !isHov;
    drawBubble(b, isHov, isCon);
  });

  // Cursor
  document.body.style.cursor = hoveredBubble ? 'pointer' : 'default';
}

/* ── Repulsion Effect ───────────────────────────────── */
function applyRepulsion(target) {
  const repulsionRadius = target.radius * 8; // Repel within 8x radius
  const repulsionStrength = 0.8; // Strong repulsion
  
  bubbles.forEach(b => {
    if (b === target) return;
    
    const d = dist(target.x, target.y, b.x, b.y);
    
    if (d < repulsionRadius && d > 0) {
      // Calculate repulsion force
      const force = (repulsionRadius - d) / repulsionRadius * repulsionStrength;
      const angle = atan2(b.y - target.y, b.x - target.x);
      
      // Apply velocity
      b.vx += cos(angle) * force;
      b.vy += sin(angle) * force;
    }
  });
  
  // Apply velocity to position with damping
  bubbles.forEach(b => {
    if (b === target) return;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= 0.85; // Damping
    b.vy *= 0.85;
  });
}

function applyReturnForce() {
  const returnStrength = 0.15;
  const damping = 0.8;
  
  bubbles.forEach(b => {
    // Calculate original spiral position
    const origX = b._originalX;
    const origY = b._originalY;
    
    if (origX !== undefined && origY !== undefined) {
      // Pull back to original position
      b.vx += (origX - b.x) * returnStrength;
      b.vy += (origY - b.y) * returnStrength;
      
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= damping;
      b.vy *= damping;
    }
  });
}

/* ── Connections ────────────────────────────────────── */
function drawConnections() {
  // Draw artist connections
  if (showArtistConnections) {
    connections.forEach(({ a, b }) => {
      const active = hoveredBubble && a.artist === hoveredBubble.artist;
      if (active) {
        stroke(255, 255, 255, 100); strokeWeight(1 / zoomLevel);
        drawingContext.setLineDash([]);
      } else {
        stroke(255, 255, 255, 14); strokeWeight(0.5 / zoomLevel);
        drawingContext.setLineDash([3, 7]);
      }
      line(a.x, a.y, b.x, b.y);
      drawingContext.setLineDash([]);

      if (active) {
        noStroke(); fill(255, 255, 255, 140);
        ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, 3 / zoomLevel, 3 / zoomLevel);
      }
    });
  }
  
  // Draw genre connections
  if (showGenreConnections) {
    const genreColor = color('rgba(252, 79, 5, 0.8)'); // Orange for genre
    genreConnections.forEach(({ a, b, genre }) => {
      // Extract first genre for comparison with hovered bubble
      const hoveredGenre = hoveredBubble && hoveredBubble.genre ? hoveredBubble.genre.split(',')[0].trim() : null;
      const active = hoveredGenre && genre === hoveredGenre;
      if (active) {
        stroke(252, 79, 5, 180); strokeWeight(1.5 / zoomLevel);
        drawingContext.setLineDash([]);
      } else {
        stroke(252, 79, 5, 30); strokeWeight(0.7 / zoomLevel);
        drawingContext.setLineDash([4, 6]);
      }
      line(a.x, a.y, b.x, b.y);
      drawingContext.setLineDash([]);

      if (active) {
        noStroke(); fill(252, 79, 5, 200);
        ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, 4 / zoomLevel, 4 / zoomLevel);
      }
    });
  }
}

/* ── Spiral ─────────────────────────────────────────── */
function arrangeSpiral() {
  // Increased spacing: scale * 5.0 instead of 3.4
  const scale = min(width, height) * 0.008;
  bubbles.forEach((b, i) => {
    const angle = i * 2.399; // golden angle
    const r = scale * Math.sqrt(i + 1) * 5.0; // Increased spacing
    b.x = cos(angle) * r;
    b.y = sin(angle) * r;
    // Store original position for return force
    b._originalX = b.x;
    b._originalY = b.y;
    b.vx = 0;
    b.vy = 0;
  });
}

/* ── Draw Bubble ────────────────────────────────────── */
function drawBubble(b, isHov, isCon) {
  const imgSize = b.radius * 1.85;
  const dimmed = hoveredBubble && !isHov && !isCon;
  const gAlpha = isHov ? 0.4 : isCon ? 0.2 : 0.08;
  const gSize = isHov ? b.radius * 3 : b.radius * 2;

  // Glow
  noStroke();
  for (let i = 4; i > 0; i--) {
    fill(red(b.col), green(b.col), blue(b.col), gAlpha * (1 - i / 4.5) * 255);
    ellipse(b.x, b.y, gSize + i * 8, gSize + i * 8);
  }

  // Image
  if (images[b.imgKey]) {
    push(); translate(b.x, b.y);
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(0, 0, imgSize / 2, 0, TWO_PI);
    drawingContext.clip();
    if (dimmed) drawingContext.globalAlpha = 0.3;

    const img = images[b.imgKey];
    const asp = img.width / img.height;
    let dw, dh;
    if (asp > 1) { dh = imgSize; dw = imgSize * asp; }
    else { dw = imgSize; dh = imgSize / asp; }
    image(img, 0, 0, dw, dh);

    drawingContext.globalAlpha = 1;
    drawingContext.restore();
    pop();
  } else {
    fill(dimmed ? 20 : 32);
    noStroke();
    ellipse(b.x, b.y, imgSize);
    fill(dimmed ? 50 : 90);
    textSize(b.radius * 0.3);
    text(b.title.substring(0, 2), b.x, b.y);
  }

  // Ring
  if (isHov) {
    noFill(); stroke(255, 210); strokeWeight(1.5 / zoomLevel);
    ellipse(b.x, b.y, imgSize + 6 / zoomLevel);
  } else if (isCon) {
    noFill(); stroke(255, 70); strokeWeight(0.8 / zoomLevel);
    ellipse(b.x, b.y, imgSize + 3 / zoomLevel);
  }
}

/* ── Zoom (scroll wheel) ────────────────────────────── */
function mouseWheel(event) {
  // Zoom toward mouse position
  const factor = event.delta > 0 ? 0.92 : 1.09;
  const newZoom = constrain(zoomLevel * factor, ZOOM_MIN, ZOOM_MAX);

  // Adjust pan so zoom centers on mouse
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;
  panX = mx - (mx - panX) * (newZoom / zoomLevel);
  panY = my - (my - panY) * (newZoom / zoomLevel);

  zoomLevel = newZoom;
  return false; // prevent page scroll
}

/* ── Click Event (replaces hover) ─────────────────────── */
function mousePressed() {
  // Handle click on bubble
  const mx = (mouseX - width / 2 - panX) / zoomLevel;
  const my = (mouseY - height / 2 - panY) / zoomLevel;
  
  let clicked = null;
  bubbles.forEach(b => {
    if (dist(mx, my, b.x, b.y) < b.radius) clicked = b;
  });
  
  if (clicked) {
    clickedBubble = clicked;
    lastClickedBubble = clickedBubble;
    updateLPPlayer(lastClickedBubble);
  }
}

/* ── LP Player (Three.js) ────────────────────────────── */
function updateLPPlayer(b) {
  const led = document.getElementById('lp-led');
  const idleMsg = document.getElementById('lp-idle-msg');
  const songInfo = document.getElementById('lp-song-info');

  if (!b) {
    // Stop playing
    isPlaying = false;
    armTargetRotation = ARM_IDLE;
    led.classList.remove('on');
    idleMsg.classList.remove('hidden');
    songInfo.classList.remove('visible');
    return;
  }

  // Start playing
  isPlaying = true;
  armTargetRotation = ARM_PLAY;
  led.classList.add('on');
  
  // Update current bubble
  currentBubble = b;
  
  // Update album art texture on label
  if (b.coverUrl) {
    createLabelTexture(b.coverUrl);
  } else {
    createLabelTexture(null);
  }

  // Text info
  document.getElementById('lp-month').textContent = b.month;
  document.getElementById('lp-title').textContent = b.title;
  document.getElementById('lp-artist').textContent = b.artist || '';
  document.getElementById('lp-plays').textContent = `${b.plays}회 재생`;
  
  // Show genre if available
  const genreEl = document.getElementById('lp-genre');
  if (genreEl) {
    genreEl.textContent = b.genre || '';
    genreEl.style.display = b.genre ? 'inline' : 'none';
  }

  const ytBtn = document.getElementById('lp-yt-btn');
  ytBtn.href = b.youtubeUrl || '#';
  ytBtn.style.display = b.youtubeUrl ? 'inline-flex' : 'none';

  idleMsg.classList.add('hidden');
  songInfo.classList.add('visible');
}

/* ── Resize ─────────────────────────────────────────── */
function windowResized() {
  const panel = document.getElementById('map-panel');
  resizeCanvas(panel.offsetWidth, panel.offsetHeight);
  arrangeSpiral();
  
  // Resize Three.js LP player
  const container = document.getElementById('three-lp-container');
  if (container && threeRenderer && threeCamera) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    threeRenderer.setSize(width, height);
    threeCamera.aspect = width / height;
    threeCamera.updateProjectionMatrix();
  }
}

/* ── Color ──────────────────────────────────────────── */
function getColorFromIdx(idx) {
  const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
  return color(`hsla(${hues[idx % hues.length]}, 68%, 58%, 1)`);
}
