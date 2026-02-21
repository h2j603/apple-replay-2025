/* ══════════════════════════════════════════════════════
   Apple Music Replay 2025 — Map + Radio
   ══════════════════════════════════════════════════════ */

let data = [];
let bubbles = [];
let images = {};
let hoveredBubble = null;
let lastHoveredBubble = null; // stays on radio until new bubble hovered
let connections = [];
let canvasReady = false; // arrangeSpiral waits for setup()

const MIN_RADIUS = 14;
const MAX_RADIUS = 52;
const MAX_PLAYS = 43;

/* ── Preload ────────────────────────────────────────── */
function preload() {
  loadJSON('data/music_2025.json', (loadedData) => {
    data = loadedData;
    loadImages();
  });
}

function loadImages() {
  let loaded = 0;
  let total = 0;

  data.forEach(month => {
    month.songs.forEach(song => {
      if (song.cover_url) total++;
    });
  });

  if (total === 0) { createBubbles(); return; }

  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      if (song.cover_url) {
        loadImage(
          song.cover_url,
          (img) => {
            images[`${mi}-${si}`] = img;
            loaded++;
            if (loaded === total) createBubbles();
          },
          () => {
            loaded++;
            if (loaded === total) createBubbles();
          }
        );
      }
    });
  });
}

function createBubbles() {
  bubbles = [];
  let idx = 0;

  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      // Non-linear scale: more dramatic size difference
      const normalized = (song.plays - 1) / (MAX_PLAYS - 1);
      const r = MIN_RADIUS + Math.pow(normalized, 0.55) * (MAX_RADIUS - MIN_RADIUS);

      bubbles.push({
        month: month.month_label,
        title: song.title,
        artist: song.artist,
        plays: song.plays,
        radius: r,
        imgKey: `${mi}-${si}`,
        coverUrl: song.cover_url,
        color: getColorFromIdx(idx),
        monthIdx: mi,
        songIdx: si,
        idx: idx,
        youtubeUrl: song.youtube_url || '',
        x: 0, y: 0,
      });
      idx++;
    });
  });

  buildConnections();

  // Only arrange if canvas is ready; otherwise setup() will call it
  if (canvasReady) arrangeSpiral();
}

/* ── Setup ──────────────────────────────────────────── */
function setup() {
  const panel = document.getElementById('map-panel');
  const canvas = createCanvas(panel.offsetWidth, panel.offsetHeight);
  canvas.parent('map-panel');
  imageMode(CENTER);
  textAlign(CENTER, CENTER);
  canvasReady = true;

  // If bubbles already loaded during preload, arrange now
  if (bubbles.length > 0) arrangeSpiral();
}

/* ── Draw ───────────────────────────────────────────── */
function draw() {
  background(10);
  translate(width / 2, height / 2);

  // Detect hover
  let newHovered = null;
  bubbles.forEach(b => {
    const d = dist(mouseX - width / 2, mouseY - height / 2, b.x, b.y);
    if (d < b.radius) newHovered = b;
  });

  // Update radio only when hover changes to a NEW bubble
  if (newHovered !== hoveredBubble) {
    hoveredBubble = newHovered;
    if (hoveredBubble) {
      // Hovering a new bubble → update radio
      lastHoveredBubble = hoveredBubble;
      updateRadioPanel(lastHoveredBubble);
    }
    // Mouse left bubble but not on a new one → keep radio as-is
  }

  drawConnections();

  bubbles.forEach(b => {
    const isHovered   = b === hoveredBubble;
    const isConnected = hoveredBubble &&
      b.artist === hoveredBubble.artist &&
      b !== hoveredBubble;
    drawBubble(b, isHovered, isConnected);
  });

  document.body.style.cursor = hoveredBubble ? 'pointer' : 'default';
}

/* ── Connections ────────────────────────────────────── */
function buildConnections() {
  connections = [];
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      if (
        bubbles[i].artist &&
        bubbles[j].artist &&
        bubbles[i].artist === bubbles[j].artist
      ) {
        connections.push({ a: bubbles[i], b: bubbles[j] });
      }
    }
  }
}

function drawConnections() {
  connections.forEach(({ a, b }) => {
    const isActive = hoveredBubble && a.artist === hoveredBubble.artist;

    if (isActive) {
      stroke(255, 255, 255, 110);
      strokeWeight(1.2);
      drawingContext.setLineDash([]);
    } else {
      stroke(255, 255, 255, 16);
      strokeWeight(0.6);
      drawingContext.setLineDash([3, 7]);
    }

    line(a.x, a.y, b.x, b.y);
    drawingContext.setLineDash([]);

    // Midpoint dot when active
    if (isActive) {
      noStroke();
      fill(255, 255, 255, 150);
      ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, 4, 4);
    }
  });
}

/* ── Spiral ─────────────────────────────────────────── */
function arrangeSpiral() {
  const scale = min(width, height) * 0.009;

  bubbles.forEach((b, i) => {
    const angle = i * 2.399; // golden angle
    const r = scale * Math.sqrt(i + 1) * 3.6;
    b.x = cos(angle) * r;
    b.y = sin(angle) * r;
  });
}

/* ── Draw Bubble ────────────────────────────────────── */
function drawBubble(b, isHovered, isConnected) {
  const imgSize = b.radius * 1.85;
  const dimmed  = hoveredBubble && !isHovered && !isConnected;

  // Glow
  const glowAlpha = isHovered ? 0.42 : isConnected ? 0.22 : 0.1;
  const glowSize  = isHovered ? b.radius * 2.8 : b.radius * 2.1;

  noStroke();
  for (let i = 4; i > 0; i--) {
    const a = glowAlpha * (1 - i / 4.5);
    fill(red(b.color), green(b.color), blue(b.color), a * 255);
    ellipse(b.x, b.y, glowSize + i * 10, glowSize + i * 10);
  }

  // Image or fallback
  if (images[b.imgKey]) {
    push();
    translate(b.x, b.y);
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(0, 0, imgSize / 2, 0, TWO_PI);
    drawingContext.clip();
    if (dimmed) drawingContext.globalAlpha = 0.35;

    const img = images[b.imgKey];
    const aspect = img.width / img.height;
    let dw, dh;
    if (aspect > 1) { dh = imgSize; dw = imgSize * aspect; }
    else            { dw = imgSize; dh = imgSize / aspect; }
    image(img, 0, 0, dw, dh);

    drawingContext.globalAlpha = 1;
    drawingContext.restore();
    pop();
  } else {
    fill(dimmed ? 22 : 35);
    noStroke();
    ellipse(b.x, b.y, imgSize);
    fill(dimmed ? 55 : 95);
    textSize(b.radius * 0.28);
    text(b.title.substring(0, 3), b.x, b.y);
  }

  // Hover / connected ring
  if (isHovered) {
    noFill();
    stroke(255, 220);
    strokeWeight(1.8);
    ellipse(b.x, b.y, imgSize + 8);
  } else if (isConnected) {
    noFill();
    stroke(255, 80);
    strokeWeight(1);
    ellipse(b.x, b.y, imgSize + 4);
  }
}

/* ── Radio Panel ────────────────────────────────────── */
function updateRadioPanel(bubble) {
  const idle     = document.getElementById('radio-idle');
  const active   = document.getElementById('radio-active');
  const albumImg = document.getElementById('radio-album-img');
  const titleEl  = document.getElementById('radio-title');
  const artistEl = document.getElementById('radio-artist');
  const playsEl  = document.getElementById('radio-plays-count');
  const monthEl  = document.getElementById('radio-month');
  const ytBtn    = document.getElementById('radio-yt-btn');

  if (!bubble) {
    idle.classList.remove('hidden');
    active.classList.remove('visible');
    return;
  }

  titleEl.textContent  = bubble.title;
  artistEl.textContent = bubble.artist || 'Unknown';
  playsEl.textContent  = `${bubble.plays}회 재생`;
  monthEl.textContent  = bubble.month;

  if (bubble.coverUrl) {
    albumImg.src = bubble.coverUrl;
    albumImg.style.display = 'block';
  } else {
    albumImg.style.display = 'none';
  }

  ytBtn.href         = bubble.youtubeUrl || '#';
  ytBtn.style.display = bubble.youtubeUrl ? 'flex' : 'none';

  idle.classList.add('hidden');
  active.classList.add('visible');
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
  const h = hues[idx % hues.length];
  return color(`hsla(${h}, 68%, 58%, 1)`);
}

/* ── Radio background setter ────────────────────────── */
window.setRadioBackground = function(src) {
  const img = document.getElementById('radio-bg-img');
  img.src = src;
  img.style.display = 'block';
};
