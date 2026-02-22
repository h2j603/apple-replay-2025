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
// 3D LP PLAYER VARIABLES (DEPRECATED - Using 2D instead)
// ══════════════════════════════════════════════════════

// let lp3d; // 3D LP player sketch - REMOVED
let currentTrack = null;
let isPlaying = false;
let rotationAngle = 0;

// Simple 2D LP player
let lpCanvas;
let lpCtx;
let lpContainerW, lpContainerH;

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
// 2D LP PLAYER - SIMPLE IMPLEMENTATION
// ══════════════════════════════════════════════════════

function initLP3D() {
  // Create simple 2D LP player
  const container = document.getElementById('lp-canvas-container');
  lpContainerW = container.offsetWidth;
  lpContainerH = container.offsetHeight;
  
  lpCanvas = document.createElement('canvas');
  lpCanvas.width = lpContainerW;
  lpCanvas.height = lpContainerH;
  container.appendChild(lpCanvas);
  
  lpCtx = lpCanvas.getContext('2d');
  
  // Add click listener
  lpCanvas.addEventListener('click', () => {
    toggleLPPlay();
  });
  
  // Start animation loop
  animateLP();
}

function animateLP() {
  if (!lpCtx) return;
  
  const ctx = lpCtx;
  const w = lpCanvas.width;
  const h = lpCanvas.height;
  const cx = w / 2;
  const cy = h / 2 - 20;
  
  // Clear
  ctx.clearRect(0, 0, w, h);
  
  // Calculate sizes
  const lpRadius = Math.min(w, h) * 0.38;
  const labelRadius = lpRadius * 0.35;
  
  // Update rotation
  if (isPlaying) {
    rotationAngle += 2.5;
  }
  
  // Draw turntable base (platter)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, lpRadius * 1.25, lpRadius * 1.25 * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw LP (rotated)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationAngle * Math.PI / 180);
  
  // Main LP body (black vinyl)
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, 0, lpRadius, lpRadius, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Groove effect (concentric circles)
  ctx.strokeStyle = 'rgba(30, 30, 30, 0.6)';
  ctx.lineWidth = 0.5;
  for (let r = labelRadius + 8; r < lpRadius - 3; r += 2) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Outer edge highlight
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, lpRadius, lpRadius, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Label (center) - album cover
  if (currentTrack && currentTrack.coverUrl && images[currentTrack.imgKey]) {
    const img = images[currentTrack.imgKey];
    
    // Create circular clip for label
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, labelRadius, labelRadius, 0, 0, Math.PI * 2);
    ctx.clip();
    
    // Draw image
    ctx.drawImage(img, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    ctx.restore();
    
    // Add subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, labelRadius, labelRadius, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Default label
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(0, 0, labelRadius, labelRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Label text
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "ibm-plex-mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('APPLESonic', 0, -5);
    ctx.font = '8px "ibm-plex-mono"';
    ctx.fillText('2025', 0, 10);
  }
  
  // Center hole
  ctx.fillStyle = '#FF4500'; // Orange background showing through
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  // Draw tonearm (not rotating)
  drawTonearm(ctx, cx, cy, lpRadius, isPlaying);
  
  // Apply halftone effect ONLY on LP black area (optional subtle effect)
  if (isPlaying) {
    applyHalftoneToLP(ctx, cx, cy, lpRadius);
  }
  
  // Request next frame
  requestAnimationFrame(animateLP);
}

function drawTonearm(ctx, cx, cy, lpRadius, playing) {
  const armAngle = playing ? -25 : 35;
  const armX = cx + lpRadius * 0.85;
  const armY = cy - lpRadius * 0.35;
  
  ctx.save();
  ctx.translate(armX, armY);
  ctx.rotate(armAngle * Math.PI / 180);
  
  // Arm base
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  
  // Arm tube
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -80);
  ctx.stroke();
  
  // Headshell
  ctx.fillStyle = '#353535';
  ctx.fillRect(-6, -95, 12, 18);
  
  // Cartridge
  ctx.fillStyle = '#252525';
  ctx.fillRect(-4, -108, 8, 12);
  
  // Stylus
  ctx.fillStyle = '#606060';
  ctx.beginPath();
  ctx.moveTo(-2, -118);
  ctx.lineTo(2, -118);
  ctx.lineTo(0, -125);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function applyHalftoneToLP(ctx, cx, cy, lpRadius) {
  // Subtle halftone effect ONLY on LP vinyl area
  const dotSize = 2;
  const spacing = 5;
  
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.08;
  
  for (let y = cy - lpRadius; y <= cy + lpRadius; y += spacing) {
    for (let x = cx - lpRadius; x <= cx + lpRadius; x += spacing) {
      const d = Math.sqrt((x - cx) ** 2 + ((y - cy) * 2) ** 2);
      
      if (d <= lpRadius * 0.92 && d > lpRadius * 0.38) {
        // Pattern density varies with distance from center
        const alpha = 0.3 + Math.sin(d * 0.1 + rotationAngle) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  ctx.restore();
}

// Window resize handler for LP
function resizeLP() {
  const container = document.getElementById('lp-canvas-container');
  if (lpCanvas && container) {
    lpContainerW = container.offsetWidth;
    lpContainerH = container.offsetHeight;
    lpCanvas.width = lpContainerW;
    lpCanvas.height = lpContainerH;
  }
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
