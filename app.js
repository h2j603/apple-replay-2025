/* ══════════════════════════════════════════════════════
   Apple Music Replay 2025 — Map + 3D LP Player
   ══════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════
// GLOBAL VARIABLES
// ══════════════════════════════════════════════════════

// Map data
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

// Bubble size constants
const MIN_RADIUS = 5;
const MAX_RADIUS = 50;
const MAX_PLAYS = 43;

// Zoom state
let zoomLevel = 1.0;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4.0;
let panX = 0, panY = 0;

// Hover repulsion state
let repulsionActive = false;
let repulsionTarget = null;

// ══════════════════════════════════════════════════════
// 3D LP PLAYER VARIABLES
// ══════════════════════════════════════════════════════

let lp3d;
let currentTrack = null;
let isPlaying = false;
let rotationAngle = 0;
let targetRotation = 0;
let tonearmAngle = 35;

// ══════════════════════════════════════════════════════
// PRELOAD
// ══════════════════════════════════════════════════════

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
        (img) => { 
          images[`${mi}-${si}`] = img; 
          if (++done === total) createBubbles(); 
        },
        ()    => {                               if (++done === total) createBubbles(); }
      );
    });
  });
}

// ══════════════════════════════════════════════════════
// SETUP - 2D MAP
// ══════════════════════════════════════════════════════

function setup() {
  const panel = document.getElementById('map-panel');
  const cnv = createCanvas(panel.offsetWidth, panel.offsetHeight);
  cnv.parent('map-panel');
  
  imageMode(CENTER);
  textAlign(CENTER, CENTER);
  canvasReady = true;
  
  if (bubbles.length > 0) arrangeSpiral();
  
  // Initialize 3D LP player
  initLP3D();
}

// ══════════════════════════════════════════════════════
// 3D LP PLAYER - WEBGL IMPLEMENTATION
// ══════════════════════════════════════════════════════

let lp3dSketch;
let lpGraphics; // For label texture

function initLP3D() {
  const container = document.getElementById('lp-canvas-container');
  
  // Create p5.js WEBGL instance
  lp3dSketch = new p5((p) => {
    p.setup = function() {
      const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight, p.WEBGL);
      canvas.parent('lp-canvas-container');
      p.angleMode(p.DEGREES);
      p.imageMode(p.CENTER);
      
      // Create graphics buffer for label texture
      lpGraphics = p.createGraphics(256, 256);
      
      // Add click listener to canvas
      canvas.elt.addEventListener('click', () => {
        toggleLPPlay();
      });
    };
    
    p.draw = function() {
      p.background(255, 69, 0); // #FF4500 background
      
      // Calculate LP size
      const lpRadius = Math.min(p.width, p.height) * 0.32;
      const labelRadius = lpRadius * 0.35;
      
      // Update rotation
      if (isPlaying) {
        rotationAngle += 2.5;
      }
      
      // Smooth tonearm animation
      const targetArmAngle = isPlaying ? -25 : 35;
      tonearmAngle = p.lerp(tonearmAngle, targetArmAngle, 0.1);
      
      // Lighting
      p.ambientLight(100);
      p.directionalLight(255, 255, 255, 0.5, 0.5, -1);
      p.pointLight(200, 200, 200, 0, -200, 200);
      
      // Camera position
      p.camera(0, -lpRadius * 1.2, lpRadius * 2.5, 0, 0, 0, 0, 1, 0);
      
      // Draw turntable base (platter)
      p.push();
      p.translate(0, lpRadius * 0.15, 0);
      p.rotateX(90);
      p.noStroke();
      p.fill(30);
      p.ellipse(0, 0, lpRadius * 2.5, lpRadius * 2.5);
      p.pop();
      
      // Draw LP record
      p.push();
      p.rotateX(90);
      p.rotateZ(rotationAngle);
      
      // Main vinyl disc
      p.noStroke();
      p.fill(10);
      p.ellipse(0, 0, lpRadius * 2, lpRadius * 2);
      
      // Groove rings
      p.stroke(40);
      p.noFill();
      for (let r = labelRadius + 10; r < lpRadius * 0.95; r += 3) {
        p.strokeWeight(0.5);
        p.ellipse(0, 0, r * 2, r * 2);
      }
      
      // Outer edge highlight
      p.stroke(80);
      p.strokeWeight(2);
      p.ellipse(0, 0, lpRadius * 2, lpRadius * 2);
      
      // Draw label (album cover)
      p.push();
      // Update label texture with album cover
      updateLabelTexture(p, labelRadius);
      
      // Apply label texture
      p.texture(lpGraphics);
      p.noStroke();
      p.ellipse(0, 0, labelRadius * 2, labelRadius * 2);
      
      // Center hole
      p.fill(255, 69, 0); // Orange
      p.ellipse(0, 0, 10, 10);
      
      // Center spindle
      p.fill(60);
      p.ellipse(0, 0, 6, 6);
      
      p.pop();
      p.pop();
      
      // Draw tonearm
      drawTonearm3D(p, lpRadius);
    };
    
    p.windowResized = function() {
      p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    };
  }, 'lp-3d-canvas');
}

function updateLabelTexture(p, labelRadius) {
  lpGraphics.background(30);
  lpGraphics.noStroke();
  
  if (currentTrack && currentTrack.coverUrl && images[currentTrack.imgKey]) {
    // Draw album cover image
    const img = images[currentTrack.imgKey];
    lpGraphics.image(img, 0, 0, labelRadius * 2, labelRadius * 2);
  } else {
    // Default label
    lpGraphics.fill(34);
    lpGraphics.ellipse(128, 128, 256, 256);
    
    // Label text
    lpGraphics.fill(170);
    lpGraphics.textAlign(lpGraphics.CENTER, lpGraphics.CENTER);
    lpGraphics.textSize(20);
    lpGraphics.text('APPLESonic', 128, 118);
    lpGraphics.textSize(14);
    lpGraphics.text('2025', 128, 145);
  }
  
  // Add border
  lpGraphics.noFill();
  lpGraphics.stroke(255, 69, 0, 50);
  lpGraphics.strokeWeight(2);
  lpGraphics.ellipse(128, 128, 250, 250);
}

function drawTonearm3D(p, lpRadius) {
  const armLength = lpRadius * 0.7;
  const pivotX = lpRadius * 0.85;
  const pivotY = -lpRadius * 0.35;
  const pivotZ = 20;
  
  p.push();
  p.translate(pivotX, pivotY, pivotZ);
  p.rotateZ(tonearmAngle);
  
  // Arm base (pivot)
  p.push();
  p.noStroke();
  p.fill(45);
  p.sphere(15);
  p.pop();
  
  // Arm tube
  p.push();
  p.stroke(70);
  p.strokeWeight(6);
  p.line(0, 0, 0, -armLength * 0.8);
  p.pop();
  
  // Headshell
  p.push();
  p.translate(0, -armLength * 0.85);
  p.noStroke();
  p.fill(55);
  p.box(12, 20, 10);
  p.pop();
  
  // Cartridge
  p.push();
  p.translate(0, -armLength * 0.85 - 12);
  p.fill(40);
  p.box(8, 14, 8);
  p.pop();
  
  // Stylus
  p.push();
  p.translate(0, -armLength * 0.85 - 22);
  p.fill(90);
  p.cone(3, 10);
  p.pop();
  
  p.pop();
}

// Window resize handler for LP
function resizeLP() {
  // WEBGL canvas handles resize automatically via windowResized
}

// ══════════════════════════════════════════════════════
// TOGGLE LP PLAY
// ══════════════════════════════════════════════════════

function toggleLPPlay() {
  if (!currentTrack) {
    // If no track selected, select the first one
    if (bubbles.length > 0) {
      selectTrack(bubbles[0]);
    }
    return;
  }
  
  isPlaying = !isPlaying;
  
  // Update LED
  const led = document.getElementById('lp-led');
  if (led) {
    led.classList.toggle('on', isPlaying);
  }
}

// ══════════════════════════════════════════════════════
// SELECT TRACK
// ══════════════════════════════════════════════════════

function selectTrack(b) {
  currentTrack = b;
  
  // Start playing
  isPlaying = true;
  rotationAngle = 0;
  
  // Update LED
  const led = document.getElementById('lp-led');
  if (led) {
    led.classList.add('on');
  }
  
  // Update info panel
  updateLPInfo(b);
}

function updateLPInfo(b) {
  const idleMsg = document.getElementById('lp-idle-msg');
  const songInfo = document.getElementById('lp-song-info');

  if (!b) {
    if (idleMsg) idleMsg.classList.remove('hidden');
    if (songInfo) songInfo.classList.remove('visible');
    return;
  }

  // Text info
  const monthEl = document.getElementById('lp-month');
  const titleEl = document.getElementById('lp-title');
  const artistEl = document.getElementById('lp-artist');
  const playsEl = document.getElementById('lp-plays');
  
  if (monthEl) monthEl.textContent = b.month;
  if (titleEl) titleEl.textContent = b.title;
  if (artistEl) artistEl.textContent = b.artist || '';
  if (playsEl) playsEl.textContent = b.plays + '회 재생';
  
  const genreEl = document.getElementById('lp-genre');
  if (genreEl) {
    genreEl.textContent = b.genre || '';
    genreEl.style.display = b.genre ? 'inline' : 'none';
  }

  const ytBtn = document.getElementById('lp-yt-btn');
  if (ytBtn) {
    ytBtn.href = b.youtubeUrl || '#';
    ytBtn.style.display = b.youtubeUrl ? 'inline-flex' : 'none';
  }

  if (idleMsg) idleMsg.classList.add('hidden');
  if (songInfo) songInfo.classList.add('visible');
}

// ══════════════════════════════════════════════════════
// BUBBLES - DATA PROCESSING
// ══════════════════════════════════════════════════════

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
        genre: song.genre || null,
        plays: song.plays,
        radius: r,
        imgKey: `${mi}-${si}`,
        coverUrl: song.cover_url,
        col: getColorFromIdx(idx),
        youtubeUrl: song.youtube_url || '',
        x: 0, y: 0,
        vx: 0, vy: 0,
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
      const genreA = bubbles[i].genre ? bubbles[i].genre.split(',')[0].trim() : null;
      const genreB = bubbles[j].genre ? bubbles[j].genre.split(',')[0].trim() : null;
      
      if (genreA && genreB && genreA === genreB) {
        genreConnections.push({ a: bubbles[i], b: bubbles[j], type: 'genre', genre: genreA });
      }
    }
  }
}

// ══════════════════════════════════════════════════════
// DRAW - 2D MAP
// ══════════════════════════════════════════════════════

function draw() {
  clear(); // Transparent background to show CSS grid

  // Draw grid (scales with zoom)
  drawGrid();

  // Apply zoom + pan
  translate(width / 2 + panX, height / 2 + panY);
  scale(zoomLevel);

  // World-space mouse
  const mx = (mouseX - width / 2 - panX) / zoomLevel;
  const my = (mouseY - height / 2 - panY) / zoomLevel;

  // Hover detection
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
    applyReturnForce();
    repulsionActive = false;
    repulsionTarget = null;
  }

  // Draw connections
  drawConnections();
  
  bubbles.forEach(b => {
    const isHov = b === hoveredBubble;
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

// ══════════════════════════════════════════════════════
// DRAW GRID (Scales with zoom)
// ══════════════════════════════════════════════════════

function drawGrid() {
  const gridSize = 40;
  const gridColor = color(255, 69, 0); // #FF4500
  
  stroke(red(gridColor), green(gridColor), blue(gridColor), 80);
  strokeWeight(1 / zoomLevel); // Keep line width constant on screen
  
  const step = gridSize * zoomLevel;
  
  // Calculate visible area
  const startX = (-width / 2 - panX) / zoomLevel;
  const startY = (-height / 2 - panY) / zoomLevel;
  const endX = (width / 2 - panX) / zoomLevel;
  const endY = (height / 2 - panY) / zoomLevel;
  
  // Snap to grid
  const gridStartX = Math.floor(startX / gridSize) * gridSize;
  const gridStartY = Math.floor(startY / gridSize) * gridSize;
  
  // Draw vertical lines
  for (let x = gridStartX; x <= endX; x += gridSize) {
    const screenX = x * zoomLevel + panX + width / 2;
    line(screenX, 0, screenX, height);
  }
  
  // Draw horizontal lines
  for (let y = gridStartY; y <= endY; y += gridSize) {
    const screenY = y * zoomLevel + panY + height / 2;
    line(0, screenY, width, screenY);
  }
}

// ══════════════════════════════════════════════════════
// REPULSION EFFECT
// ══════════════════════════════════════════════════════

function applyRepulsion(target) {
  const repulsionRadius = target.radius * 8;
  const repulsionStrength = 0.8;
  
  bubbles.forEach(b => {
    if (b === target) return;
    
    const d = dist(target.x, target.y, b.x, b.y);
    
    if (d < repulsionRadius && d > 0) {
      const force = (repulsionRadius - d) / repulsionRadius * repulsionStrength;
      const angle = atan2(b.y - target.y, b.x - target.x);
      
      b.vx += cos(angle) * force;
      b.vy += sin(angle) * force;
    }
  });
  
  bubbles.forEach(b => {
    if (b === target) return;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= 0.85;
    b.vy *= 0.85;
  });
}

function applyReturnForce() {
  const returnStrength = 0.15;
  const damping = 0.8;
  
  bubbles.forEach(b => {
    const origX = b._originalX;
    const origY = b._originalY;
    
    if (origX !== undefined && origY !== undefined) {
      b.vx += (origX - b.x) * returnStrength;
      b.vy += (origY - b.y) * returnStrength;
      
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= damping;
      b.vy *= damping;
    }
  });
}

// ══════════════════════════════════════════════════════
// CONNECTIONS
// ══════════════════════════════════════════════════════

function drawConnections() {
  const lineColor = color(255, 69, 0);
  
  // Draw artist connections
  if (showArtistConnections) {
    connections.forEach(({ a, b }) => {
      const active = hoveredBubble && a.artist === hoveredBubble.artist;
      if (active) {
        stroke(red(lineColor), green(lineColor), blue(lineColor), 200); 
        strokeWeight(1.5 / zoomLevel);
        drawingContext.setLineDash([]);
      } else {
        stroke(red(lineColor), green(lineColor), blue(lineColor), 40); 
        strokeWeight(0.5 / zoomLevel);
        drawingContext.setLineDash([3, 7]);
      }
      line(a.x, a.y, b.x, b.y);
      drawingContext.setLineDash([]);

      if (active) {
        noStroke(); 
        fill(red(lineColor), green(lineColor), blue(lineColor), 220);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        ellipse(midX, midY, 4 / zoomLevel, 4 / zoomLevel);
        textSize(8 / zoomLevel);
        textAlign(CENTER, CENTER);
        text('아티스트', midX, midY - 10 / zoomLevel);
      }
    });
  }
  
  // Draw genre connections
  if (showGenreConnections) {
    genreConnections.forEach(({ a, b, genre }) => {
      const hoveredGenre = hoveredBubble && hoveredBubble.genre ? hoveredBubble.genre.split(',')[0].trim() : null;
      const active = hoveredGenre && genre === hoveredGenre;
      if (active) {
        stroke(red(lineColor), green(lineColor), blue(lineColor), 200); 
        strokeWeight(1.5 / zoomLevel);
        drawingContext.setLineDash([]);
      } else {
        stroke(red(lineColor), green(lineColor), blue(lineColor), 40); 
        strokeWeight(0.5 / zoomLevel);
        drawingContext.setLineDash([4, 6]);
      }
      line(a.x, a.y, b.x, b.y);
      drawingContext.setLineDash([]);

      if (active) {
        noStroke(); 
        fill(red(lineColor), green(lineColor), blue(lineColor), 220);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        ellipse(midX, midY, 4 / zoomLevel, 4 / zoomLevel);
        textSize(8 / zoomLevel);
        textAlign(CENTER, CENTER);
        text('장르', midX, midY - 10 / zoomLevel);
      }
    });
  }
}

// ══════════════════════════════════════════════════════
// SPIRAL LAYOUT
// ══════════════════════════════════════════════════════

function arrangeSpiral() {
  const scale = min(width, height) * 0.008;
  bubbles.forEach((b, i) => {
    const angle = i * 2.399; // golden angle
    const r = scale * Math.sqrt(i + 1) * 5.0;
    b.x = cos(angle) * r;
    b.y = sin(angle) * r;
    b._originalX = b.x;
    b._originalY = b.y;
    b.vx = 0;
    b.vy = 0;
  });
}

// ══════════════════════════════════════════════════════
// DRAW BUBBLE
// ══════════════════════════════════════════════════════

function drawBubble(b, isHov, isCon) {
  const imgSize = b.radius * 1.85;
  const dimmed = hoveredBubble && !isHov && !isCon;
  const gAlpha = isHov ? 0.4 : isCon ? 0.2 : 0.08;
  const gSize = isHov ? b.radius * 3 : b.radius * 2;

  // Glow
  noStroke();
  for (let i = 4; i > 0; i--) {
    fill(255, 69, 0, gAlpha * (1 - i / 4.5) * 255);
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

// ══════════════════════════════════════════════════════
// MOUSE WHEEL - ZOOM
// ══════════════════════════════════════════════════════

function mouseWheel(event) {
  const factor = event.delta > 0 ? 0.92 : 1.09;
  const newZoom = constrain(zoomLevel * factor, ZOOM_MIN, ZOOM_MAX);

  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;
  panX = mx - (mx - panX) * (newZoom / zoomLevel);
  panY = my - (my - panY) * (newZoom / zoomLevel);

  zoomLevel = newZoom;
  return false;
}

// ══════════════════════════════════════════════════════
// MOUSE PRESSED
// ══════════════════════════════════════════════════════

function mousePressed() {
  // Check if click is on map panel
  const mapPanel = document.getElementById('map-panel');
  const rect = mapPanel.getBoundingClientRect();
  
  if (mouseX >= rect.left && mouseX <= rect.right && 
      mouseY >= rect.top && mouseY <= rect.bottom) {
    
    const mx = (mouseX - width / 2 - panX) / zoomLevel;
    const my = (mouseY - height / 2 - panY) / zoomLevel;
    
    let clicked = null;
    bubbles.forEach(b => {
      if (dist(mx, my, b.x, b.y) < b.radius) clicked = b;
    });
    
    if (clicked) {
      // Toggle between artist and genre connections
      if (showArtistConnections) {
        showArtistConnections = false;
        showGenreConnections = true;
      } else {
        showArtistConnections = true;
        showGenreConnections = false;
      }
      
      clickedBubble = clicked;
      lastClickedBubble = clickedBubble;
      
      // Update 3D LP player
      selectTrack(lastClickedBubble);
    }
  }
}

// ══════════════════════════════════════════════════════
// WINDOW RESIZED
// ══════════════════════════════════════════════════════

function windowResized() {
  const panel = document.getElementById('map-panel');
  resizeCanvas(panel.offsetWidth, panel.offsetHeight);
  arrangeSpiral();
  
  // Resize LP canvas
  resizeLP();
}

// ══════════════════════════════════════════════════════
// COLOR UTILITY
// ══════════════════════════════════════════════════════

function getColorFromIdx(idx) {
  const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
  return color(`hsla(${hues[idx % hues.length]}, 68%, 58%, 1)`);
}
