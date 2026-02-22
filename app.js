/* ══════════════════════════════════════════════════════
   Apple Music Replay 2025 — Map + LP Player
   ══════════════════════════════════════════════════════ */

let data = [];
let bubbles = [];
let images = {};
let hoveredBubble = null;
let lastHoveredBubble = null;
let connections = [];
let canvasReady = false;

// ~50% smaller than before
const MIN_RADIUS = 8;
const MAX_RADIUS = 28;
const MAX_PLAYS  = 43;

// Zoom & pan state
let zoomLevel = 1.0;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4.0;
let panX = 0, panY = 0;
let isDragging = false;
let dragStartX, dragStartY, panStartX, panStartY;

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
      const norm = (song.plays - 1) / (MAX_PLAYS - 1);
      const r    = MIN_RADIUS + Math.pow(norm, 0.5) * (MAX_RADIUS - MIN_RADIUS);
      bubbles.push({
        month: month.month_label,
        title: song.title,
        artist: song.artist,
        plays: song.plays,
        radius: r,
        imgKey: `${mi}-${si}`,
        coverUrl: song.cover_url,
        col: getColorFromIdx(idx),
        youtubeUrl: song.youtube_url || '',
        x: 0, y: 0,
        idx: idx++,
      });
    });
  });
  buildConnections();
  if (canvasReady) arrangeSpiral();
}

function buildConnections() {
  connections = [];
  for (let i = 0; i < bubbles.length; i++)
    for (let j = i + 1; j < bubbles.length; j++)
      if (bubbles[i].artist && bubbles[i].artist === bubbles[j].artist)
        connections.push({ a: bubbles[i], b: bubbles[j] });
}

/* ── Setup ──────────────────────────────────────────── */
function setup() {
  const panel = document.getElementById('map-panel');
  const cnv   = createCanvas(panel.offsetWidth, panel.offsetHeight);
  cnv.parent('map-panel');
  imageMode(CENTER);
  textAlign(CENTER, CENTER);
  canvasReady = true;
  if (bubbles.length > 0) arrangeSpiral();
}

/* ── Draw ───────────────────────────────────────────── */
function draw() {
  background(10);

  // Apply zoom + pan
  translate(width / 2 + panX, height / 2 + panY);
  scale(zoomLevel);

  // World-space mouse (accounting for zoom/pan)
  const mx = (mouseX - width  / 2 - panX) / zoomLevel;
  const my = (mouseY - height / 2 - panY) / zoomLevel;

  // Hover detection
  let newHovered = null;
  bubbles.forEach(b => {
    if (dist(mx, my, b.x, b.y) < b.radius) newHovered = b;
  });

  if (newHovered !== hoveredBubble) {
    hoveredBubble = newHovered;
    if (hoveredBubble) {
      lastHoveredBubble = hoveredBubble;
      updateLPPlayer(lastHoveredBubble);
    }
  }

  drawConnections();
  bubbles.forEach(b => {
    const isHov = b === hoveredBubble;
    const isCon = hoveredBubble && b.artist === hoveredBubble.artist && !isHov;
    drawBubble(b, isHov, isCon);
  });

  // Cursor (check in screen space)
  document.body.style.cursor = (hoveredBubble && !isDragging) ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
}

/* ── Connections ────────────────────────────────────── */
function drawConnections() {
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

/* ── Spiral ─────────────────────────────────────────── */
function arrangeSpiral() {
  const scale = min(width, height) * 0.006; // slightly tighter
  bubbles.forEach((b, i) => {
    const angle = i * 2.399; // golden angle
    const r     = scale * Math.sqrt(i + 1) * 3.4;
    b.x = cos(angle) * r;
    b.y = sin(angle) * r;
  });
}

/* ── Draw Bubble ────────────────────────────────────── */
function drawBubble(b, isHov, isCon) {
  const imgSize = b.radius * 1.85;
  const dimmed  = hoveredBubble && !isHov && !isCon;
  const gAlpha  = isHov ? 0.4 : isCon ? 0.2 : 0.08;
  const gSize   = isHov ? b.radius * 3 : b.radius * 2;

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
    else         { dw = imgSize; dh = imgSize / asp; }
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
  const mx = mouseX - width  / 2;
  const my = mouseY - height / 2;
  panX = mx - (mx - panX) * (newZoom / zoomLevel);
  panY = my - (my - panY) * (newZoom / zoomLevel);

  zoomLevel = newZoom;
  return false; // prevent page scroll
}

/* ── Pan (drag) ─────────────────────────────────────── */
function mousePressed() {
  // Only drag if not hovering a bubble
  if (!hoveredBubble) {
    isDragging = true;
    dragStartX = mouseX; dragStartY = mouseY;
    panStartX  = panX;   panStartY  = panY;
  }
}

function mouseDragged() {
  if (isDragging) {
    panX = panStartX + (mouseX - dragStartX);
    panY = panStartY + (mouseY - dragStartY);
  }
}

function mouseReleased() {
  isDragging = false;
}

/* ── LP Player ──────────────────────────────────────── */
function updateLPPlayer(b) {
  const record   = document.getElementById('lp-record');
  const tonearm  = document.getElementById('lp-tonearm');
  const art      = document.getElementById('lp-album-art');
  const led      = document.getElementById('lp-led');
  const idleMsg  = document.getElementById('lp-idle-msg');
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
  document.getElementById('lp-month').textContent  = b.month;
  document.getElementById('lp-title').textContent  = b.title;
  document.getElementById('lp-artist').textContent = b.artist || '';
  document.getElementById('lp-plays').textContent  = `${b.plays}회 재생`;

  const ytBtn = document.getElementById('lp-yt-btn');
  ytBtn.href         = b.youtubeUrl || '#';
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
