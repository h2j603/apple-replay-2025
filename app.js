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

let lp3d; // 3D LP player sketch
let currentTrack = null;
let isPlaying = false;
let rotationAngle = 0;
let targetRotation = 0;
let tonearmAngle = 0;
let tonearmTarget = 0;
let currentCoverTexture = null;
let coverTextureReady = false;

// LP dimensions
const LP_RADIUS = 180;
const LP_THICKNESS = 12;
const LABEL_RADIUS = 65;

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
// 3D LP PLAYER - SEPARATE SKETCH
// ══════════════════════════════════════════════════════

function initLP3D() {
  // Create 3D LP player as a separate p5 instance
  lp3d = new p5((p) => {
    let pg; // Graphics buffer for dithering
    
    p.setup = function() {
      const container = document.getElementById('lp-canvas-container');
      const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight, p.WEBGL);
      canvas.parent('lp-canvas-container');
      
      pg = p.createGraphics(container.offsetWidth, container.offsetHeight);
      pg.colorMode(p.RGB);
      pg.noStroke();
      
      p.angleMode(p.DEGREES);
      p.imageMode(p.CENTER);
    };
    
    p.draw = function() {
      p.clear();
      p.background(255, 69, 0); // Orange-red background
      
      // Center the scene
      p.translate(0, 0, 0);
      
      // Mouse interaction for LP rotation
      let lpClicked = false;
      if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        const d = p.dist(p.mouseX, p.mouseY, centerX, centerY);
        
        if (d < LP_RADIUS * 1.2 && p.mouseIsPressed) {
          lpClicked = true;
        }
      }
      
      // Toggle play on click
      if (lpClicked && !p._clicked) {
        p._clicked = true;
        toggleLPPlay();
      } else if (!lpClicked) {
        p._clicked = false;
      }
      
      // Smooth rotation
      if (isPlaying) {
        rotationAngle += 2.5;
        tonearmTarget = -25;
      } else {
        tonearmTarget = 35;
      }
      
      tonearmAngle = p.lerp(tonearmAngle, tonearmTarget, 0.08);
      
      // Draw turntable base (platter)
      p.push();
      p.fill(25);
      p.noStroke();
      p.rotateX(90);
      p.ellipse(0, 0, LP_RADIUS * 2.4, LP_RADIUS * 2.4);
      p.pop();
      
      // Draw LP record
      p.push();
      p.translate(0, 0, 0);
      
      // Main LP body (black vinyl)
      p.noStroke();
      p.fill(15);
      p.rotateX(90);
      
      // Create LP with grooves using cylinder
      p.cylinder(LP_RADIUS, LP_THICKNESS);
      
      // Top surface with grooves effect
      p.push();
      p.translate(0, 0, LP_THICKNESS / 2);
      
      // Outer edge (dark)
      p.fill(8);
      p.ellipse(0, 0, LP_RADIUS * 2, LP_RADIUS * 2);
      
      // Groove area
      for (let r = LABEL_RADIUS + 10; r < LP_RADIUS - 5; r += 3) {
        p.fill(20 + p.sin(r) * 5);
        p.ellipse(0, 0, r * 2, r * 2);
      }
      
      // Label area (center)
      if (currentCoverTexture && coverTextureReady) {
        p.push();
        p.texture(currentCoverTexture);
        p.ellipse(0, 0, LABEL_RADIUS * 2, LABEL_RADIUS * 2);
        p.pop();
      } else {
        p.fill(35);
        p.ellipse(0, 0, LABEL_RADIUS * 2, LABEL_RADIUS * 2);
        
        // Label text
        p.push();
        p.fill(180);
        p.textSize(10);
        p.textAlign(p.CENTER, p.CENTER);
        p.translate(0, 0, 1);
        p.text('APPLESonic', 0, -8);
        p.textSize(8);
        p.text('2025', 0, 8);
        p.pop();
      }
      
      // Center hole
      p.push();
      p.fill(255, 69, 0); // Orange background showing through
      p.translate(0, 0, LP_THICKNESS / 2 + 1);
      p.ellipse(0, 0, 8, 8);
      p.pop();
      
      p.pop(); // End top surface
      p.pop(); // End LP
      
      // Draw tonearm
      p.push();
      p.translate(LP_RADIUS * 0.95, -LP_RADIUS * 0.3, 40);
      p.rotateZ(tonearmAngle);
      
      // Arm base
      p.fill(40);
      p.noStroke();
      p.sphere(18);
      
      // Arm tube
      p.push();
      p.translate(0, 0, 0);
      p.rotateX(90);
      p.fill(60);
      p.cylinder(4, 120);
      p.pop();
      
      // Headshell
      p.push();
      p.translate(0, -60, 0);
      p.rotateX(90);
      p.fill(50);
      p.box(12, 20, 8);
      p.pop();
      
      // Cartridge
      p.push();
      p.translate(0, -72, 0);
      p.rotateX(90);
      p.fill(30);
      p.box(8, 14, 6);
      p.pop();
      
      // Stylus
      p.push();
      p.translate(0, -80, 0);
      p.rotateX(90);
      p.fill(80);
      p.cone(2, 8);
      p.pop();
      
      p.pop(); // End tonearm
      
      // Apply dithering effect to the entire LP player
      applyDithering(p);
    };
    
    function applyDithering(p) {
      // Create halftone/dither pattern - ONLY on LP area
      pg.clear();
      
      // Draw halftone dots only on LP area
      const dotSize = 3;
      const spacing = 6;
      
      pg.background(255, 69, 0, 0);
      
      const centerX = pg.width / 2;
      const centerY = pg.height / 2;
      
      // Only apply to LP circle area (radius = LP_RADIUS * 1.1)
      const lpAreaRadius = LP_RADIUS * 1.1;
      
      for (let y = centerY - lpAreaRadius; y <= centerY + lpAreaRadius; y += spacing) {
        for (let x = centerX - lpAreaRadius; x <= centerX + lpAreaRadius; x += spacing) {
          // Only draw dots inside the LP circle
          const d = p.dist(x, y, centerX, centerY);
          
          if (d <= lpAreaRadius) {
            // Pattern density based on distance from center
            let alpha = p.map(d, 0, lpAreaRadius, 180, 60);
            
            // Add some noise for organic feel
            if (p.random() < 0.2) {
              alpha *= 0.8;
            }
            
            pg.fill(0, alpha);
            pg.noStroke();
            pg.ellipse(x, y, dotSize, dotSize);
          }
        }
      }
      
      // Overlay the dither pattern
      p.push();
      p.resetMatrix();
      p.translate(0, 0, 100); // On top
      p.image(pg, 0, 0);
      p.pop();
    }
    
    p.windowResized = function() {
      const container = document.getElementById('lp-canvas-container');
      p.resizeCanvas(container.offsetWidth, container.offsetHeight);
      pg = p.createGraphics(container.offsetWidth, container.offsetHeight);
    };
  });
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
  
  // Load cover texture
  coverTextureReady = false;
  if (b.coverUrl && images[b.imgKey]) {
    const img = images[b.imgKey];
    // Create texture from image for 3D LP
    if (lp3d) {
      currentCoverTexture = lp3d.createGraphics(256, 256);
      currentCoverTexture.image(img, 0, 0, 256, 256);
      coverTextureReady = true;
    }
  } else {
    currentCoverTexture = null;
  }
  
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
}

// ══════════════════════════════════════════════════════
// COLOR UTILITY
// ══════════════════════════════════════════════════════

function getColorFromIdx(idx) {
  const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
  return color(`hsla(${hues[idx % hues.length]}, 68%, 58%, 1)`);
}
