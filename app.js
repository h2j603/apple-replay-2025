/* ══════════════════════════════════════════════════════
   Apple Music Replay 2025 — Map + LP Player
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

/* ── LP Player ──────────────────────────────────────── */
function updateLPPlayer(b) {
  const record = document.getElementById('lp-record');
  const tonearm = document.getElementById('lp-tonearm');
  const art = document.getElementById('lp-album-art');
  const led = document.getElementById('lp-led');
  const idleMsg = document.getElementById('lp-idle-msg');
  const songInfo = document.getElementById('lp-song-info');

  if (!b) {
    record.classList.remove('spinning');
    tonearm.classList.remove('playing');
    led.classList.remove('on');
    idleMsg.classList.remove('hidden');
    songInfo.classList.remove('visible');
    return;
  }

  // Start spinning
  record.classList.add('spinning');
  tonearm.classList.add('playing');
  led.classList.add('on');

  // Album art
  if (b.coverUrl) {
    art.classList.remove('loaded');
    art.onload = () => art.classList.add('loaded');
    art.src = b.coverUrl;
  } else {
    art.src = '';
    art.classList.remove('loaded');
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
}

/* ── Color ──────────────────────────────────────────── */
function getColorFromIdx(idx) {
  const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
  return color(`hsla(${hues[idx % hues.length]}, 68%, 58%, 1)`);
}
