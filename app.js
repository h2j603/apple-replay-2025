/* ══════════════════════════════════════════════════════
   Apple Music Replay 2025 — Map + Radio
   ══════════════════════════════════════════════════════ */

let data = [];
let bubbles = [];
let images = {};
let hoveredBubble = null;
let connections = []; // same-artist connections

// Bubble sizing — smaller overall, bigger range
const MIN_RADIUS = 14;
const MAX_RADIUS = 52;
const MAX_PLAYS = 43;

// p5.js sketch (instance mode to target #map-panel)
const sketch = (p) => {

  p.preload = () => {
    p.loadJSON('data/music_2025.json', (loadedData) => {
      data = loadedData;
      loadImages(p);
    });
  };

  p.setup = () => {
    const panel = document.getElementById('map-panel');
    const canvas = p.createCanvas(panel.offsetWidth, panel.offsetHeight);
    canvas.parent('map-panel');
    p.imageMode(p.CENTER);
    p.textAlign(p.CENTER, p.CENTER);
  };

  p.draw = () => {
    p.background(10);
    p.translate(p.width / 2, p.height / 2);

    // Draw connections first (behind bubbles)
    drawConnections(p);

    // Find hovered bubble
    let newHovered = null;
    bubbles.forEach(b => {
      const d = p.dist(p.mouseX - p.width / 2, p.mouseY - p.height / 2, b.x, b.y);
      if (d < b.radius) newHovered = b;
    });

    // Update radio panel if hover changed
    if (newHovered !== hoveredBubble) {
      hoveredBubble = newHovered;
      updateRadioPanel(hoveredBubble);
    }

    // Draw bubbles
    bubbles.forEach(b => {
      const isHovered = b === hoveredBubble;
      const isConnected = hoveredBubble &&
        b.artist === hoveredBubble.artist &&
        b !== hoveredBubble;

      drawBubble(p, b, isHovered, isConnected);
    });

    // Cursor
    document.body.style.cursor = hoveredBubble ? 'pointer' : 'default';
  };

  p.windowResized = () => {
    const panel = document.getElementById('map-panel');
    p.resizeCanvas(panel.offsetWidth, panel.offsetHeight);
    arrangeSpiral(p);
  };
};

/* ── Image Loading ──────────────────────────────────── */
function loadImages(p) {
  let loaded = 0;
  let total = 0;

  data.forEach(month => {
    month.songs.forEach(song => {
      if (song.cover_url) total++;
    });
  });

  if (total === 0) {
    createBubbles(p);
    return;
  }

  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      if (song.cover_url) {
        p.loadImage(
          song.cover_url,
          (img) => {
            images[`${mi}-${si}`] = img;
            loaded++;
            if (loaded === total) createBubbles(p);
          },
          () => {
            loaded++;
            if (loaded === total) createBubbles(p);
          }
        );
      }
    });
  });
}

/* ── Bubble Creation ────────────────────────────────── */
function createBubbles(p) {
  bubbles = [];
  let idx = 0;

  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      // Non-linear scaling: square root for more dramatic size difference
      const normalizedPlays = (song.plays - 1) / (MAX_PLAYS - 1);
      const r = MIN_RADIUS + Math.pow(normalizedPlays, 0.6) * (MAX_RADIUS - MIN_RADIUS);

      bubbles.push({
        month: month.month_label,
        title: song.title,
        artist: song.artist,
        plays: song.plays,
        radius: r,
        imgKey: `${mi}-${si}`,
        coverUrl: song.cover_url,
        color: getColor(p, idx),
        monthIdx: mi,
        songIdx: si,
        idx: idx,
        youtubeUrl: song.youtube_url || '',
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
      });
      idx++;
    });
  });

  // Build connections: same artist pairs
  buildConnections();

  arrangeSpiral(p);
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

function drawConnections(p) {
  connections.forEach(conn => {
    const { a, b } = conn;

    const isActive =
      hoveredBubble &&
      (a === hoveredBubble || b === hoveredBubble || a.artist === hoveredBubble.artist);

    if (isActive) {
      // Active: bright line
      p.stroke(255, 255, 255, 120);
      p.strokeWeight(1.2);
    } else {
      // Passive: very faint dotted
      p.stroke(255, 255, 255, 18);
      p.strokeWeight(0.6);
    }

    p.drawingContext.setLineDash(isActive ? [] : [3, 6]);
    p.line(a.x, a.y, b.x, b.y);
    p.drawingContext.setLineDash([]);

    // Connection dot at midpoint when active
    if (isActive) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      p.noStroke();
      p.fill(255, 255, 255, 160);
      p.ellipse(mx, my, 4, 4);
    }
  });
}

/* ── Spiral Layout ──────────────────────────────────── */
function arrangeSpiral(p) {
  const n = bubbles.length;
  // Tighter golden-angle spiral, adjusted for panel size
  const scale = Math.min(p.width, p.height) * 0.0088;

  bubbles.forEach((b, i) => {
    const angle = i * 2.399; // golden angle in radians
    const radius = scale * Math.sqrt(i + 1) * 3.8;
    b.targetX = Math.cos(angle) * radius;
    b.targetY = Math.sin(angle) * radius;
    b.x = b.targetX;
    b.y = b.targetY;
  });
}

/* ── Draw Single Bubble ─────────────────────────────── */
function drawBubble(p, b, isHovered, isConnected) {
  const imgSize = b.radius * 1.85;

  // Glow
  const glowAlpha = isHovered ? 0.45 : isConnected ? 0.25 : 0.1;
  const glowSize = isHovered ? b.radius * 2.8 : b.radius * 2.2;

  p.noStroke();
  for (let i = 4; i > 0; i--) {
    const alpha = glowAlpha * (1 - i / 4.5);
    const c = p.color(p.red(b.color), p.green(b.color), p.blue(b.color), alpha * 255);
    p.fill(c);
    p.ellipse(b.x, b.y, glowSize + i * 12, glowSize + i * 12);
  }

  // Album image or fallback
  if (images[b.imgKey]) {
    p.push();
    p.translate(b.x, b.y);

    p.drawingContext.save();
    p.drawingContext.beginPath();
    p.drawingContext.arc(0, 0, imgSize / 2, 0, Math.PI * 2);
    p.drawingContext.clip();

    // Dim non-hovered bubbles when something is hovered
    if (hoveredBubble && !isHovered && !isConnected) {
      p.drawingContext.globalAlpha = 0.4;
    }

    const img = images[b.imgKey];
    const aspect = img.width / img.height;
    let dw, dh;
    if (aspect > 1) { dh = imgSize; dw = imgSize * aspect; }
    else { dw = imgSize; dh = imgSize / aspect; }
    p.image(img, 0, 0, dw, dh);

    p.drawingContext.globalAlpha = 1;
    p.drawingContext.restore();
    p.pop();
  } else {
    // Fallback circle
    p.fill(hoveredBubble && !isHovered ? 25 : 35);
    p.noStroke();
    p.ellipse(b.x, b.y, imgSize);
    p.fill(hoveredBubble && !isHovered ? 60 : 100);
    p.textSize(b.radius * 0.28);
    p.text(b.title.substring(0, 3), b.x, b.y);
  }

  // Hover ring
  if (isHovered) {
    p.noFill();
    p.stroke(255, 220);
    p.strokeWeight(1.8);
    p.ellipse(b.x, b.y, imgSize + 8);
  } else if (isConnected) {
    p.noFill();
    p.stroke(255, 90);
    p.strokeWeight(1);
    p.ellipse(b.x, b.y, imgSize + 4);
  }
}

/* ── Radio Panel Update ─────────────────────────────── */
function updateRadioPanel(bubble) {
  const idle = document.getElementById('radio-idle');
  const active = document.getElementById('radio-active');
  const albumImg = document.getElementById('radio-album-img');
  const title = document.getElementById('radio-title');
  const artist = document.getElementById('radio-artist');
  const plays = document.getElementById('radio-plays-count');
  const month = document.getElementById('radio-month');
  const ytBtn = document.getElementById('radio-yt-btn');

  if (!bubble) {
    idle.classList.remove('hidden');
    active.classList.remove('visible');
    return;
  }

  // Fill data
  title.textContent = bubble.title;
  artist.textContent = bubble.artist || 'Unknown';
  plays.textContent = `${bubble.plays}회 재생`;
  month.textContent = bubble.month;

  if (bubble.coverUrl) {
    albumImg.src = bubble.coverUrl;
    albumImg.style.display = 'block';
  } else {
    albumImg.style.display = 'none';
  }

  if (bubble.youtubeUrl) {
    ytBtn.href = bubble.youtubeUrl;
    ytBtn.style.display = 'flex';
  } else {
    ytBtn.style.display = 'none';
  }

  idle.classList.add('hidden');
  active.classList.add('visible');
}

/* ── Radio background image setter (call from console or when ready) ── */
window.setRadioBackground = function(src) {
  const img = document.getElementById('radio-bg-img');
  img.src = src;
  img.style.display = 'block';
};

/* ── Color Palette ──────────────────────────────────── */
function getColor(p, idx) {
  const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
  const h = hues[idx % hues.length];
  return p.color(`hsla(${h}, 65%, 58%, 1)`);
}

/* ── Init ───────────────────────────────────────────── */
new p5(sketch);
