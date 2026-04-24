(function () {
  // ── Canvas setup ──
  const canvas  = document.getElementById('arena');
  const ctx     = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn    = document.getElementById('start-btn');
  const resultStats = document.getElementById('result-stats');

  let W = 0, H = 0;

  function resize() {
    const wrap = document.getElementById('arena-wrap');
    W = canvas.width  = wrap.clientWidth;
    H = canvas.height = wrap.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Game state ──
  const GAME_DURATION = 60;
  const EDPI_BASE     = 320; // reference: 800 DPI × 0.40 sens

  let running   = false;
  let gameTimer = null;
  let animId    = null;
  let lastTime  = 0;

  let ball = { x: 400, y: 300, vx: 3, vy: 2.2, r: 28 };
  let mouse = { x: -9999, y: -9999 };

  let score       = 0;
  let bestScore   = 0;
  let combo       = 1;
  let maxCombo    = 1;
  let trackingTime = 0;
  let totalTime    = 0;
  let timeLeft     = GAME_DURATION;
  let gameDuration = GAME_DURATION;

  let isHovering = false;
  let lastHover  = false;

  let baseSpeed = 4;
  let dpi       = 800;
  let sens      = 0.4;

  let scorePopups = [];
  let trailPoints = [];
  let pulseRings  = [];
  let speedTimer  = 0;
  let dirTimer    = 0;

  // ── Helpers ──
  function eDPI() { return dpi * sens; }
  function speedFactor() { return EDPI_BASE / eDPI(); }

  function updateEDPIDisplay() {
    document.getElementById('val-edpi').textContent = Math.round(eDPI());
  }

  function randVelocity(speed) {
    const angle = Math.random() * Math.PI * 2;
    const sf    = speedFactor();
    return {
      vx: Math.cos(angle) * speed * sf,
      vy: Math.sin(angle) * speed * sf,
    };
  }

  function getRank(acc) {
    if (acc >= 85) return '★ ELITE — Rastreio perfeito. Você é um predador.';
    if (acc >= 70) return '★ AVANÇADO — Excelente consistência de rastreio.';
    if (acc >= 50) return '★ INTERMEDIÁRIO — Bom controle. Continue treinando.';
    if (acc >= 30) return '★ INICIANTE — Foque em antecipar o movimento da esfera.';
    return '★ TREINANDO — Tente acompanhar a esfera mais de perto.';
  }

  // ── Mouse tracking ──
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // ── Game flow ──
  function startGame() {
    baseSpeed    = parseFloat(document.getElementById('ctrl-speed').value);
    dpi          = parseInt(document.getElementById('ctrl-dpi').value);
    sens         = parseFloat(document.getElementById('ctrl-sens').value);
    ball.r       = parseInt(document.getElementById('ctrl-size').value);
    gameDuration = GAME_DURATION;
    updateEDPIDisplay();

    ball.x = W / 2;
    ball.y = H / 2;
    const v  = randVelocity(baseSpeed);
    ball.vx  = v.vx;
    ball.vy  = v.vy;

    score        = 0;
    combo        = 1;
    maxCombo     = 1;
    trackingTime = 0;
    totalTime    = 0;
    timeLeft     = gameDuration;
    trailPoints  = [];
    scorePopups  = [];
    pulseRings   = [];
    speedTimer   = 0;
    dirTimer     = 0;
    lastHover    = false;
    running      = true;

    overlay.style.display     = 'none';
    resultStats.style.display = 'none';

    document.getElementById('stat-score').textContent     = '0';
    document.getElementById('stat-combo').textContent     = 'x1';
    document.getElementById('stat-acc').textContent       = '0%';
    document.getElementById('timer-display').textContent  = gameDuration + 's';
    document.getElementById('timer-display').style.color  = '#f0a030';
    document.getElementById('tracking-bar').style.width   = '0%';

    if (animId) cancelAnimationFrame(animId);
    lastTime = performance.now();
    animId   = requestAnimationFrame(loop);
    startTimer();
  }

  function startTimer() {
    clearInterval(gameTimer);
    gameTimer = setInterval(() => {
      timeLeft--;
      const td = document.getElementById('timer-display');
      td.textContent = timeLeft + 's';
      td.style.color = timeLeft <= 5 ? '#e05050' : '#f0a030';
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  function endGame() {
    running = false;
    clearInterval(gameTimer);
    cancelAnimationFrame(animId);

    if (score > bestScore) bestScore = score;
    document.getElementById('stat-best').textContent = bestScore;

    const acc = totalTime > 0 ? Math.round((trackingTime / totalTime) * 100) : 0;
    document.getElementById('r-score').textContent = score;
    document.getElementById('r-acc').textContent   = acc + '%';
    document.getElementById('r-combo').textContent = 'x' + maxCombo;
    document.getElementById('r-best').textContent  = bestScore;

    document.getElementById('overlay-title').textContent = 'RESULTADO';
    document.getElementById('overlay-sub').textContent   = getRank(acc);
    resultStats.style.display = 'flex';
    startBtn.textContent      = 'JOGAR NOVAMENTE';
    overlay.style.display     = 'flex';

    document.getElementById('timer-display').textContent = '--';
    document.getElementById('timer-display').style.color = '#f0a030';
  }

  // ── Draw functions ──
  function drawGrid() {
    ctx.strokeStyle = 'rgba(20,32,48,0.8)';
    ctx.lineWidth   = 0.5;
    const step      = 48;

    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }

    // Corner marks
    ctx.strokeStyle = 'rgba(74,158,255,0.12)';
    ctx.lineWidth   = 1;
    const corners   = [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]];
    corners.forEach(([cx, cy]) => {
      const s = 10;
      ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.stroke();
    });
  }

  function drawPulseRings() {
    for (let i = pulseRings.length - 1; i >= 0; i--) {
      const p   = pulseRings[i];
      p.r      += 1.8;
      p.life   -= 1;
      const alpha = (p.life / 30) * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(61,186,125,${alpha})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
      if (p.life <= 0) pulseRings.splice(i, 1);
    }
  }

  function drawTrail() {
    for (let i = 1; i < trailPoints.length; i++) {
      const t     = i / trailPoints.length;
      const alpha = t * 0.25;
      const r     = t * ball.r * 0.55;
      ctx.beginPath();
      ctx.arc(trailPoints[i].x, trailPoints[i].y, Math.max(r, 1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(74,158,255,${alpha})`;
      ctx.fill();
    }
  }

  function drawBall() {
    const r = ball.r;
    ctx.save();

    // Outer glow when hovering
    if (isHovering) {
      const grd = ctx.createRadialGradient(ball.x, ball.y, r, ball.x, ball.y, r + 20);
      grd.addColorStop(0, 'rgba(61,186,125,0.18)');
      grd.addColorStop(1, 'rgba(61,186,125,0)');
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r + 20, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = isHovering ? 'rgba(61,186,125,0.4)' : 'rgba(74,158,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Main fill
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = isHovering ? 'rgba(20,48,34,0.95)' : 'rgba(10,22,40,0.95)';
    ctx.fill();
    ctx.strokeStyle = isHovering ? '#3dba7d' : '#4a9eff';
    ctx.lineWidth   = isHovering ? 2.5 : 1.5;
    ctx.stroke();

    // Inner crosshair lines
    ctx.strokeStyle = isHovering ? 'rgba(61,186,125,0.4)' : 'rgba(74,158,255,0.25)';
    ctx.lineWidth   = 0.5;
    const hl        = r * 0.55;
    ctx.beginPath(); ctx.moveTo(ball.x - hl, ball.y); ctx.lineTo(ball.x + hl, ball.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y - hl); ctx.lineTo(ball.x, ball.y + hl); ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = isHovering ? 'rgba(61,186,125,0.9)' : 'rgba(74,158,255,0.6)';
    ctx.fill();

    // Combo progress arc
    if (combo > 1) {
      const progress = (combo - 1) / 7;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r + 10, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = `rgba(61,186,125,${0.3 + progress * 0.5})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCrosshair() {
    if (mouse.x < 0 || mouse.x > W || mouse.y < 0 || mouse.y > H) return;
    ctx.save();
    const col = isHovering ? 'rgba(61,186,125,0.85)' : 'rgba(74,158,255,0.65)';
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1;
    const s = 12, gap = 4;
    ctx.beginPath(); ctx.moveTo(mouse.x - s,   mouse.y);       ctx.lineTo(mouse.x - gap, mouse.y);       ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouse.x + gap,  mouse.y);       ctx.lineTo(mouse.x + s,   mouse.y);       ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouse.x,         mouse.y - s);  ctx.lineTo(mouse.x,        mouse.y - gap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouse.x,         mouse.y + gap); ctx.lineTo(mouse.x,        mouse.y + s);  ctx.stroke();
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    if (!running) return;
    const pct  = timeLeft / gameDuration;
    const barW = 180;
    const bx   = W / 2 - barW / 2;
    const by   = H - 14;

    ctx.fillStyle = 'rgba(20,30,48,0.7)';
    ctx.beginPath();
    ctx.roundRect(bx, by - 5, barW, 4, 2);
    ctx.fill();

    ctx.fillStyle = pct > 0.4 ? '#4a9eff' : pct > 0.2 ? '#f0a030' : '#e05050';
    ctx.beginPath();
    ctx.roundRect(bx, by - 5, barW * pct, 4, 2);
    ctx.fill();
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      const p   = scorePopups[i];
      p.y      -= 1.4;
      p.life   -= 1;
      const alpha = Math.min(p.life / 30, 1);
      ctx.font      = `500 ${p.size}px Rajdhani, sans-serif`;
      ctx.fillStyle = p.color
        ? `rgba(${p.color},${alpha})`
        : `rgba(61,186,125,${alpha})`;
      ctx.fillText(p.text, p.x, p.y);
      if (p.life <= 0) scorePopups.splice(i, 1);
    }
  }

  // ── Main loop ──
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;

    ctx.clearRect(0, 0, W, H);
    drawGrid();

    // Random speed/direction changes
    speedTimer += dt;
    dirTimer   += dt;

    if (speedTimer > 1800 + Math.random() * 1400) {
      speedTimer     = 0;
      const sf       = speedFactor();
      const newSpeed = baseSpeed * (0.55 + Math.random() * 1.0) * sf;
      const angle    = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 2.0;
      ball.vx        = Math.cos(angle) * newSpeed;
      ball.vy        = Math.sin(angle) * newSpeed;
    }

    if (dirTimer > 3000 + Math.random() * 2500) {
      dirTimer    = 0;
      const v     = randVelocity(baseSpeed * (0.65 + Math.random() * 0.9));
      ball.vx     = v.vx;
      ball.vy     = v.vy;
    }

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce off walls
    const pad = ball.r;
    if (ball.x - pad < 0)  { ball.x = pad;     ball.vx =  Math.abs(ball.vx); }
    if (ball.x + pad > W)  { ball.x = W - pad;  ball.vx = -Math.abs(ball.vx); }
    if (ball.y - pad < 0)  { ball.y = pad;     ball.vy =  Math.abs(ball.vy); }
    if (ball.y + pad > H)  { ball.y = H - pad;  ball.vy = -Math.abs(ball.vy); }

    // Trail
    trailPoints.push({ x: ball.x, y: ball.y });
    if (trailPoints.length > 22) trailPoints.shift();

    // Hover detection
    const dx   = mouse.x - ball.x;
    const dy   = mouse.y - ball.y;
    isHovering = Math.sqrt(dx * dx + dy * dy) < ball.r;

    // Scoring
    totalTime++;
    if (isHovering) {
      trackingTime++;
      combo = Math.min(combo + 0.025, 8);
      const pts = Math.round(combo);
      score += pts;
      if (Math.floor(combo) > maxCombo) maxCombo = Math.floor(combo);
      if (Math.random() < 0.03) {
        const sz = 13 + Math.floor(combo) * 1.2;
        scorePopups.push({
          x: ball.x + (Math.random() - 0.5) * 20,
          y: ball.y - ball.r - 4,
          text: '+' + pts,
          life: 38,
          size: sz,
        });
      }
    } else {
      combo = Math.max(1, combo - 0.07);
    }

    // On-target event
    if (!lastHover && isHovering) {
      pulseRings.push({ x: ball.x, y: ball.y, r: ball.r, life: 30 });
      scorePopups.push({
        x: ball.x,
        y: ball.y - ball.r - 14,
        text: 'ON TARGET',
        life: 32,
        size: 11,
        color: '61,186,125',
      });
    }
    lastHover = isHovering;

    // Update UI
    const acc = totalTime > 0 ? Math.round((trackingTime / totalTime) * 100) : 0;
    document.getElementById('stat-score').textContent = score;
    document.getElementById('stat-combo').textContent = 'x' + Math.floor(combo);
    document.getElementById('stat-acc').textContent   = acc + '%';

    const tb         = document.getElementById('tracking-bar');
    tb.style.width   = acc + '%';
    tb.style.background = acc > 65 ? '#3dba7d' : acc > 35 ? '#f0a030' : '#e05050';

    drawPulseRings();
    drawTrail();
    drawBall();
    drawCrosshair();
    drawHUD();
    drawPopups();

    animId = requestAnimationFrame(loop);
  }

  // ── Controls ──
  startBtn.addEventListener('click', startGame);

  [
    ['ctrl-speed', 'val-speed', (v) => v],
    ['ctrl-size',  'val-size',  (v) => v + 'px'],
    ['ctrl-dpi',   'val-dpi',   (v) => { dpi  = parseInt(v);     updateEDPIDisplay(); return v; }],
    ['ctrl-sens',  'val-sens',  (v) => { sens = parseFloat(v);   updateEDPIDisplay(); return parseFloat(v).toFixed(2); }],
  ].forEach(([id, vid, fmt]) => {
    document.getElementById(id).addEventListener('input', function () {
      const result = fmt(this.value);
      if (result !== undefined) document.getElementById(vid).textContent = result;
    });
  });

  // Initial idle render
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, W, H);
})();
