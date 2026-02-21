let data = [];
let bubbles = [];
let images = {};
let layout = 'grid';
let hoveredBubble = null;

const MIN_RADIUS = 30;
const MAX_RADIUS = 80;
const MAX_PLAYS = 43;

function preload() {
  loadJSON('data/music_2025_with_covers.json', (loadedData) => {
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
  
  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      if (song.cover_url) {
        loadImage(song.cover_url, (img) => {
          images[`${mi}-${si}`] = img;
          loaded++;
          if (loaded === total) {
            createBubbles();
          }
        }, () => {
          loaded++;
          if (loaded === total) createBubbles();
        });
      }
    });
  });
  
  if (total === 0) createBubbles();
}

function createBubbles() {
  bubbles = [];
  
  let idx = 0;
  data.forEach((month, mi) => {
    month.songs.forEach((song, si) => {
      let r = map(song.plays, 1, MAX_PLAYS, MIN_RADIUS, MAX_RADIUS);
      let color = getColorFromIdx(idx);
      
      bubbles.push({
        month: month.month_label,
        title: song.title,
        artist: song.artist,
        plays: song.plays,
        radius: r,
        imgKey: `${mi}-${si}`,
        color: color,
        monthIdx: mi,
        songIdx: si,
        idx: idx,
        youtube_url: song.youtube_url || ''
      });
      idx++;
    });
  });
  
  arrangeLayout();
}

function getColorFromIdx(idx) {
  const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
  let h = hues[idx % hues.length];
  return color(`hsla(${h}, 70%, 60%, 1)`);
}

function arrangeLayout() {
  if (layout === 'grid') {
    arrangeGrid();
  } else if (layout === 'spiral') {
    arrangeSpiral();
  } else {
    arrangeTimeline();
  }
}

function arrangeGrid() {
  let cols = 6;
  let spacing = 100;
  let startX = -((cols - 1) * spacing) / 2;
  let startY = -200;
  
  bubbles.forEach((b, i) => {
    let col = i % cols;
    let row = floor(i / cols);
    b.targetX = startX + col * spacing;
    b.targetY = startY + row * spacing;
    b.x = b.targetX;
    b.y = b.targetY;
  });
}

function arrangeSpiral() {
  let angle = 0;
  let radius = 50;
  
  bubbles.forEach((b, i) => {
    angle = i * 0.5;
    radius = 50 + i * 8;
    b.targetX = cos(angle) * radius;
    b.targetY = sin(angle) * radius;
    b.x = b.targetX;
    b.y = b.targetY;
  });
}

function arrangeTimeline() {
  let monthWidth = 120;
  let startX = -((12 - 1) * monthWidth) / 2;
  
  let monthBubbles = {};
  bubbles.forEach(b => {
    if (!monthBubbles[b.monthIdx]) monthBubbles[b.monthIdx] = [];
    monthBubbles[b.monthIdx].push(b);
  });
  
  Object.keys(monthBubbles).forEach(mi => {
    let songs = monthBubbles[mi];
    let startY = -150;
    
    songs.forEach((b, si) => {
      b.targetX = startX + parseInt(mi) * monthWidth;
      b.targetY = startY + si * 70;
      b.x = b.targetX;
      b.y = b.targetY;
    });
  });
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  imageMode(CENTER);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(10);
  
  translate(width / 2, height / 2);
  
  hoveredBubble = null;
  
  bubbles.forEach(b => {
    let d = dist(mouseX - width/2, mouseY - height/2, b.x, b.y);
    let isHovered = d < b.radius;
    
    if (isHovered) hoveredBubble = b;
    
    let glowAlpha = isHovered ? 0.4 : 0.15;
    let glowSize = isHovered ? b.radius * 2.5 : b.radius * 2;
    
    noStroke();
    for (let i = 5; i > 0; i--) {
      let alpha = glowAlpha * (1 - i/5);
      let c = color(red(b.color), green(b.color), blue(b.color), alpha * 255);
      fill(c);
      ellipse(b.x, b.y, glowSize + i * 15, glowSize + i * 15);
    }
    
    if (images[b.imgKey]) {
      push();
      translate(b.x, b.y);
      
      let imgSize = b.radius * 1.8;
      
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.arc(0, 0, imgSize/2, 0, TWO_PI);
      drawingContext.clip();
      
      let img = images[b.imgKey];
      let aspect = img.width / img.height;
      let drawW, drawH;
      if (aspect > 1) {
        drawH = imgSize;
        drawW = imgSize * aspect;
      } else {
        drawW = imgSize;
        drawH = imgSize / aspect;
      }
      image(img, 0, 0, drawW, drawH);
      
      drawingContext.restore();
      pop();
    } else {
      fill(30);
      noStroke();
      ellipse(b.x, b.y, b.radius * 1.8);
      
      fill(100);
      textSize(b.radius * 0.3);
      text(b.title.substring(0, 4), b.x, b.y);
    }
    
    if (isHovered) {
      noFill();
      stroke(255, 200);
      strokeWeight(2);
      ellipse(b.x, b.y, b.radius * 2 + 10);
    }
  });
  
  updateTooltip();
}

function updateTooltip() {
  let tooltip = document.getElementById('tooltip');
  
  if (hoveredBubble) {
    tooltip.classList.add('visible');
    tooltip.style.left = (mouseX + 20) + 'px';
    tooltip.style.top = (mouseY - 20) + 'px';
    
    tooltip.querySelector('.month').textContent = hoveredBubble.month;
    tooltip.querySelector('.title').textContent = hoveredBubble.title;
    tooltip.querySelector('.artist').textContent = hoveredBubble.artist || 'Unknown';
    tooltip.querySelector('.plays').textContent = `${hoveredBubble.plays}회 재생`;
    
    if (hoveredBubble.youtube_url) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  } else {
    tooltip.classList.remove('visible');
    document.body.style.cursor = 'default';
  }
}

function mousePressed() {
  if (hoveredBubble && hoveredBubble.youtube_url) {
    window.open(hoveredBubble.youtube_url, '_blank');
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

document.getElementById('btn-grid').addEventListener('click', () => {
  layout = 'grid';
  updateButtons();
  arrangeLayout();
});

document.getElementById('btn-spiral').addEventListener('click', () => {
  layout = 'spiral';
  updateButtons();
  arrangeLayout();
});

document.getElementById('btn-timeline').addEventListener('click', () => {
  layout = 'timeline';
  updateButtons();
  arrangeLayout();
});

function updateButtons() {
  document.querySelectorAll('.controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById('btn-' + layout).classList.add('active');
}
