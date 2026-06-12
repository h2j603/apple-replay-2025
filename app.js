// p5.js 인스턴스 모드로 변환
let myP5 = null;

const sketch = (p) => {
  let data = [];
  let bubbles = [];
  let images = {};
  let layout = 'grid';
  let hoveredBubble = null;
  
  // 노드 크기 스케일 편차 확대
  const MIN_RADIUS = 20;
  const MAX_RADIUS = 60;
  const MAX_PLAYS = 43;
  
  // DOM 요소 참조
  let radioDefault, radioContent, radioCover, radioTitle, radioArtist, radioMonth, radioPlays, radioYoutube;
  
  p.preload = function() {
    p.loadJSON('data/music_2025.json', (loadedData) => {
      data = loadedData;
      loadImages();
    });
  };
  
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
          p.loadImage(song.cover_url, (img) => {
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
        // 재생 횟수 매핑을 더 급격하게 (pow 사용)
        let r = p.map(p.pow(song.plays, 1.5), 1, p.pow(MAX_PLAYS, 1.5), MIN_RADIUS, MAX_RADIUS);
        let c = getColorFromIdx(idx);
        
        bubbles.push({
          month: month.month_label,
          title: song.title,
          artist: song.artist,
          plays: song.plays,
          radius: r,
          imgKey: `${mi}-${si}`,
          color: c,
          monthIdx: mi,
          songIdx: si,
          idx: idx,
          youtube_url: song.youtube_url || '',
          cover_url: song.cover_url || ''
        });
        idx++;
      });
    });
    
    arrangeLayout();
  }
  
  function getColorFromIdx(idx) {
    const hues = [340, 200, 45, 160, 280, 30, 180, 320, 100, 260, 20, 140];
    let h = hues[idx % hues.length];
    return p.color(`hsla(${h}, 70%, 60%, 1)`);
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
    let spacing = 85;
    let startX = -((cols - 1) * spacing) / 2;
    let startY = -180;
    
    bubbles.forEach((b, i) => {
      let col = i % cols;
      let row = p.floor(i / cols);
      b.targetX = startX + col * spacing;
      b.targetY = startY + row * spacing;
      b.x = b.targetX;
      b.y = b.targetY;
    });
  }
  
  function arrangeSpiral() {
    let angle = 0;
    let radius = 40;
    
    bubbles.forEach((b, i) => {
      angle = i * 0.5;
      radius = 40 + i * 7;
      b.targetX = p.cos(angle) * radius;
      b.targetY = p.sin(angle) * radius;
      b.x = b.targetX;
      b.y = b.targetY;
    });
  }
  
  function arrangeTimeline() {
    let monthWidth = 100;
    let startX = -((12 - 1) * monthWidth) / 2;
    
    let monthBubbles = {};
    bubbles.forEach(b => {
      if (!monthBubbles[b.monthIdx]) monthBubbles[b.monthIdx] = [];
      monthBubbles[b.monthIdx].push(b);
    });
    
    Object.keys(monthBubbles).forEach(mi => {
      let songs = monthBubbles[mi];
      let startY = -130;
      
      songs.forEach((b, si) => {
        b.targetX = startX + p.parseInt(mi) * monthWidth;
        b.targetY = startY + si * 60;
        b.x = b.targetX;
        b.y = b.targetY;
      });
    });
  }
  
  // 외부에서 호출 가능하도록 노출
  p.setLayout = function(newLayout) {
    layout = newLayout;
    arrangeLayout();
  };
  
  p.setup = function() {
    // 캔버스를 #map-side 내부에 생성
    let mapSide = document.getElementById('map-side');
    let canvas = p.createCanvas(mapSide.offsetWidth, mapSide.offsetHeight);
    canvas.parent('canvas-container');
    p.imageMode(p.CENTER);
    p.textAlign(p.CENTER, p.CENTER);
    
    // DOM 요소 참조 저장
    radioDefault = document.getElementById('radio-default');
    radioContent = document.getElementById('radio-content');
    radioCover = document.getElementById('radio-cover');
    radioTitle = document.getElementById('radio-title');
    radioArtist = document.getElementById('radio-artist');
    radioMonth = document.getElementById('radio-month');
    radioPlays = document.getElementById('radio-plays');
    radioYoutube = document.getElementById('radio-youtube');
  };
  
  p.draw = function() {
    p.background(10);
    
    p.translate(p.width / 2, p.height / 2);
    
    hoveredBubble = null;
    
    // 가수 기반 노드 연결선 그리기 (Obsidian 그래프 스타일)
    drawArtistConnections();
    
    // 버블 그리기
    bubbles.forEach(b => {
      let d = p.dist(p.mouseX - p.width/2, p.mouseY - p.height/2, b.x, b.y);
      let isHovered = d < b.radius;
      
      if (isHovered) hoveredBubble = b;
      
      let glowAlpha = isHovered ? 0.5 : 0.15;
      let glowSize = isHovered ? b.radius * 2.5 : b.radius * 2;
      
      // 글로우 효과
      p.noStroke();
      for (let i = 5; i > 0; i--) {
        let alpha = glowAlpha * (1 - i/5);
        let c = p.color(p.red(b.color), p.green(b.color), p.blue(b.color), alpha * 255);
        p.fill(c);
        p.ellipse(b.x, b.y, glowSize + i * 12, glowSize + i * 12);
      }
      
      // 앨범 커버 또는 기본 원
      if (images[b.imgKey]) {
        p.push();
        p.translate(b.x, b.y);
        
        let imgSize = b.radius * 1.8;
        
        p.drawingContext.save();
        p.drawingContext.beginPath();
        p.drawingContext.arc(0, 0, imgSize/2, 0, p.TWO_PI);
        p.drawingContext.clip();
        
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
        p.image(img, 0, 0, drawW, drawH);
        
        p.drawingContext.restore();
        p.pop();
      } else {
        p.fill(30);
        p.noStroke();
        p.ellipse(b.x, b.y, b.radius * 1.8);
        
        p.fill(100);
        p.textSize(b.radius * 0.3);
        p.text(b.title.substring(0, 4), b.x, b.y);
      }
      
      // 호버 시 테두리
      if (isHovered) {
        p.noFill();
        p.stroke(255, 220);
        p.strokeWeight(2);
        p.ellipse(b.x, b.y, b.radius * 2 + 8);
      }
    });
    
    // 라디오 화면 업데이트
    updateRadioSide();
  };
  
  // 가수 기반 연결선 그리기
  function drawArtistConnections() {
    bubbles.forEach((b1, i) => {
      bubbles.forEach((b2, j) => {
        if (i < j && b1.artist === b2.artist) {
          // 연결선 그리기 (Obsidian 그래프 스타일)
          let d = p.dist(b1.x, b1.y, b2.x, b2.y);
          
          // 거리에 따른 투명도 조절
          let alpha = p.map(d, 0, 300, 50, 15);
          alpha = p.constrain(alpha, 15, 50);
          
          // 호버된 노드와 연결된 선은 더 밝게
          let isRelatedToHovered = (hoveredBubble && 
            (hoveredBubble.artist === b1.artist));
          
          if (isRelatedToHovered) {
            p.stroke(255, 255, 255, 120);
            p.strokeWeight(1.5);
          } else {
            p.stroke(255, alpha);
            p.strokeWeight(0.8);
          }
          
          p.line(b1.x, b1.y, b2.x, b2.y);
        }
      });
    });
  }
  
  // 라디오 화면(#radio-side) 업데이트
  function updateRadioSide() {
    if (hoveredBubble) {
      // 활성 상태로 전환
      radioDefault.style.display = 'none';
      radioContent.classList.add('active');
      
      // 앨범 커버 업데이트
      if (hoveredBubble.cover_url) {
        radioCover.src = hoveredBubble.cover_url;
        radioCover.alt = `${hoveredBubble.title} - ${hoveredBubble.artist}`;
      }
      
      // 곡 정보 업데이트
      radioTitle.textContent = hoveredBubble.title;
      radioArtist.textContent = hoveredBubble.artist || 'Unknown';
      radioMonth.textContent = hoveredBubble.month;
      radioPlays.textContent = `${hoveredBubble.plays}회 재생`;
      
      // YouTube 링크 업데이트
      if (hoveredBubble.youtube_url) {
        radioYoutube.href = hoveredBubble.youtube_url;
        radioYoutube.style.display = 'inline-flex';
      } else {
        radioYoutube.style.display = 'none';
      }
      
      // 커서 스타일
      if (hoveredBubble.youtube_url) {
        document.body.style.cursor = 'pointer';
      } else {
        document.body.style.cursor = 'default';
      }
    } else {
      // 기본 상태로 복귀
      radioDefault.style.display = 'block';
      radioContent.classList.remove('active');
      document.body.style.cursor = 'default';
    }
  }
  
  p.mousePressed = function() {
    if (hoveredBubble && hoveredBubble.youtube_url) {
      window.open(hoveredBubble.youtube_url, '_blank');
    }
  };
  
  p.windowResized = function() {
    let mapSide = document.getElementById('map-side');
    p.resizeCanvas(mapSide.offsetWidth, mapSide.offsetHeight);
  };
};

// p5.js 인스턴스 생성
myP5 = new p5(sketch);

// 컨트롤 버튼 이벤트
document.getElementById('btn-grid').addEventListener('click', () => {
  updateButtons('grid');
  if (myP5) myP5.setLayout('grid');
});

document.getElementById('btn-spiral').addEventListener('click', () => {
  updateButtons('spiral');
  if (myP5) myP5.setLayout('spiral');
});

document.getElementById('btn-timeline').addEventListener('click', () => {
  updateButtons('timeline');
  if (myP5) myP5.setLayout('timeline');
});

function updateButtons(layout) {
  document.querySelectorAll('.controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById('btn-' + layout)?.classList.add('active');
}
