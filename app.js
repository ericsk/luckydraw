/**
 * LuckySpin — Modern Physics-Based Lucky Draw Wheel
 */

(() => {
  // --- Curated Modern Palette (Vibrant & Harmonious) ---
  const SLICE_PALETTE = [
    { bg: '#6366f1', border: '#818cf8', text: '#ffffff' }, // Indigo
    { bg: '#ec4899', border: '#f472b6', text: '#ffffff' }, // Pink
    { bg: '#06b6d4', border: '#22d3ee', text: '#ffffff' }, // Cyan
    { bg: '#f59e0b', border: '#fbbf24', text: '#0f172a' }, // Amber
    { bg: '#10b981', border: '#34d399', text: '#ffffff' }, // Emerald
    { bg: '#8b5cf6', border: '#a78bfa', text: '#ffffff' }, // Violet
    { bg: '#f43f5e', border: '#fb7185', text: '#ffffff' }, // Rose
    { bg: '#3b82f6', border: '#60a5fa', text: '#ffffff' }, // Blue
  ];

  // --- DOM Elements ---
  const wheelCanvas = document.getElementById('wheelCanvas');
  const ctx = wheelCanvas.getContext('2d');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const confettiCtx = confettiCanvas.getContext('2d');

  const rangeForm = document.getElementById('rangeForm');
  const startNumberInput = document.getElementById('startNumber');
  const endNumberInput = document.getElementById('endNumber');
  const rangeError = document.getElementById('rangeError');
  const sliceCountBadge = document.getElementById('sliceCountBadge');
  const presetChips = document.querySelectorAll('.chip');
  const generateWheelBtn = document.getElementById('generateWheelBtn');

  const removeWinnerToggle = document.getElementById('removeWinnerToggle');
  const frictionPresetSelect = document.getElementById('frictionPreset');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundOnIcon = document.getElementById('soundOnIcon');
  const soundOffIcon = document.getElementById('soundOffIcon');

  const centerSpinBtn = document.getElementById('centerSpinBtn');
  const mainSpinBtn = document.getElementById('mainSpinBtn');
  const spinBtnLabel = document.getElementById('spinBtnLabel');

  const currentPointerNumberEl = document.getElementById('currentPointerNumber');
  const stateDot = document.getElementById('stateDot');
  const stateText = document.getElementById('stateText');
  const speedBarFill = document.getElementById('speedBarFill');
  const speedValueEl = document.getElementById('speedValue');

  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  const winnerModal = document.getElementById('winnerModal');
  const winnerNumberDisplay = document.getElementById('winnerNumberDisplay');
  const winnerBadge = document.getElementById('winnerBadge');
  const winnerMetaText = document.getElementById('winnerMetaText');
  const keepAndCloseBtn = document.getElementById('keepAndCloseBtn');
  const removeAndCloseBtn = document.getElementById('removeAndCloseBtn');

  // --- Application State ---
  let items = []; // Array of { number: number, color: object }
  let history = [];
  let soundEnabled = true;

  // Physics State
  let wheelAngle = 0; // Current rotation angle in radians
  let angularVelocity = 0; // rad/s
  let maxInitialVelocity = 24;
  let isSpinning = false;
  let winningIndex = -1;
  let lastSliceIndexUnderPointer = -1;
  let highlightPulse = 0;

  // Pointer (Flapper) Spring Physics State
  let pointerAngle = 0; // Deflection angle in radians
  let pointerVelocity = 0;

  // Timing
  let lastFrameTime = performance.now();

  // --- Web Audio Synthesizer (Zero External Assets) ---
  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playPegTick(speedRatio) {
    if (!soundEnabled) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Pitch rises slightly with wheel speed for realism
    const baseFreq = 520 + Math.min(speedRatio, 1) * 420;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.028);

    const volume = 0.08 + Math.min(speedRatio, 1) * 0.14;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.032);
  }

  function playWinFanfare() {
    if (!soundEnabled) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    const now = audioCtx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.075);
      gain.gain.linearRampToValueAtTime(0.16, now + idx * 0.075 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.075 + 0.65);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.7);
    });
  }

  // --- Color Assignment (Prevents Adjacent Duplicates) ---
  function assignColors(numbers) {
    const n = numbers.length;
    const result = [];
    const pLen = SLICE_PALETTE.length;

    for (let i = 0; i < n; i++) {
      let colorIdx = i % pLen;
      // Avoid first and last slice sharing the same color when n > 1
      if (i === n - 1 && n > 1 && colorIdx === 0) {
        colorIdx = 1;
      }
      result.push({
        number: numbers[i],
        color: SLICE_PALETTE[colorIdx],
      });
    }
    return result;
  }

  // --- Generate Numbers From Range A to B ---
  function buildRange(startVal, endVal) {
    const a = parseInt(startVal, 10);
    const b = parseInt(endVal, 10);

    if (Number.isNaN(a) || Number.isNaN(b)) {
      return { error: 'Please enter valid integer numbers.' };
    }
    if (a > b) {
      return { error: 'Start number (A) must be less than or equal to End number (B).' };
    }
    const count = b - a + 1;
    if (count < 2) {
      return { error: 'Please include at least 2 numbers to spin the wheel.' };
    }
    if (count > 200) {
      return { error: `For visual clarity, the wheel supports up to 200 numbers at once (currently ${count}).` };
    }

    const nums = [];
    for (let current = a; current <= b; current++) {
      nums.push(current);
    }
    return { numbers: nums };
  }

  function applyRange(a, b) {
    const res = buildRange(a, b);
    if (res.error) {
      rangeError.textContent = res.error;
      rangeError.classList.remove('hidden');
      return false;
    }

    rangeError.classList.add('hidden');
    items = assignColors(res.numbers);
    winningIndex = -1;
    // Align initial angle so first slice is nicely visible
    wheelAngle = -Math.PI / 2;
    lastSliceIndexUnderPointer = getSliceIndexAtPointer();
    updateUIStats();
    return true;
  }

  function updateUIStats() {
    sliceCountBadge.textContent = `${items.length} Numbers`;
    const idx = getSliceIndexAtPointer();
    if (items[idx]) {
      currentPointerNumberEl.textContent = items[idx].number;
    } else {
      currentPointerNumberEl.textContent = '--';
    }

    const canSpin = items.length >= 2 && !isSpinning;
    mainSpinBtn.disabled = !canSpin;
    centerSpinBtn.disabled = !canSpin;
  }

  // --- Pointer Math (Top of Wheel = -Math.PI / 2) ---
  const POINTER_WORLD_ANGLE = -Math.PI / 2;

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    return ((angle % twoPi) + twoPi) % twoPi;
  }

  function getSliceIndexAtPointer() {
    if (items.length === 0) return -1;
    const sliceArc = (Math.PI * 2) / items.length;
    const relativeAngle = normalizeAngle(POINTER_WORLD_ANGLE - wheelAngle);
    const index = Math.floor(relativeAngle / sliceArc) % items.length;
    return index;
  }

  // --- Physics Presets ---
  function getPhysicsParams() {
    const mode = frictionPresetSelect.value;
    if (mode === 'quick') {
      return {
        minV: 19,
        maxV: 24,
        viscousDrag: 0.72,
        dryFriction: 0.42,
      };
    }
    if (mode === 'suspense') {
      return {
        minV: 25,
        maxV: 31,
        viscousDrag: 0.34,
        dryFriction: 0.14,
      };
    }
    // Standard
    return {
      minV: 22,
      maxV: 28,
      viscousDrag: 0.48,
      dryFriction: 0.22,
    };
  }

  // --- Start Spin ---
  function startSpin() {
    if (isSpinning || items.length < 2) return;
    ensureAudioContext();

    const params = getPhysicsParams();
    // Cryptographically strong random factor if available, fallback to Math.random
    let rand = Math.random();
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      rand = buf[0] / (0xffffffff + 1);
    }

    angularVelocity = params.minV + rand * (params.maxV - params.minV);
    maxInitialVelocity = angularVelocity;
    isSpinning = true;
    winningIndex = -1;
    lastSliceIndexUnderPointer = getSliceIndexAtPointer();

    // Update UI controls
    mainSpinBtn.disabled = true;
    centerSpinBtn.disabled = true;
    generateWheelBtn.disabled = true;
    spinBtnLabel.textContent = 'Spinning...';
    stateDot.className = 'dot spinning';
    stateText.textContent = 'High-Speed Spin';
  }

  // --- Physics Step & Animation Loop ---
  function updatePhysics(dt) {
    // Clamp dt to prevent huge jumps when switching browser tabs
    const safeDt = Math.min(dt, 0.05);

    if (isSpinning) {
      const params = getPhysicsParams();

      // Advance wheel angle
      wheelAngle += angularVelocity * safeDt;

      // Detect slice boundary / peg passing pointer
      const currentIdx = getSliceIndexAtPointer();
      if (currentIdx !== lastSliceIndexUnderPointer && currentIdx !== -1) {
        const speedRatio = Math.min(angularVelocity / 18, 1);
        // Deflect the top pointer flapper physically
        const impulse = Math.min(0.62, 0.22 + speedRatio * 0.42);
        pointerAngle = Math.max(pointerAngle, impulse);
        pointerVelocity = 1.8;

        // Play mechanical click sound
        playPegTick(speedRatio);

        // Micro energy loss when hitting a peg at very low speed
        if (angularVelocity < 2.2) {
          angularVelocity = Math.max(0, angularVelocity - 0.025);
        }

        lastSliceIndexUnderPointer = currentIdx;
        if (items[currentIdx]) {
          currentPointerNumberEl.textContent = items[currentIdx].number;
        }
      }

      // Nonlinear Friction Decay:
      // 1) Viscous air/bearing drag proportional to velocity
      // 2) Dry Coulomb friction that brings the wheel to a realistic stop
      const viscousLoss = params.viscousDrag * angularVelocity;
      const LowSpeedFactor = angularVelocity < 1.8 ? 1.25 : 1.0;
      const dryLoss = params.dryFriction * LowSpeedFactor;

      angularVelocity -= (viscousLoss + dryLoss) * safeDt;

      // Update telemetry status
      if (angularVelocity < 4.5 && angularVelocity > 0) {
        stateDot.className = 'dot decelerating';
        stateText.textContent = 'Decelerating...';
        spinBtnLabel.textContent = 'Slowing Down...';
      }

      const speedPct = Math.min(100, Math.max(0, (angularVelocity / maxInitialVelocity) * 100));
      speedBarFill.style.width = `${speedPct.toFixed(1)}%`;
      speedValueEl.textContent = `${Math.max(0, angularVelocity).toFixed(1)} rad/s`;

      // Stop threshold
      if (angularVelocity <= 0.015) {
        angularVelocity = 0;
        isSpinning = false;
        speedBarFill.style.width = '0%';
        speedValueEl.textContent = '0.0 rad/s';
        onSpinComplete();
      }
    }

    // Spring-Damper Physics for Top Pointer Flapper
    const springStiffness = 180;
    const springDamping = 16;
    const springForce = -springStiffness * pointerAngle - springDamping * pointerVelocity;
    pointerVelocity += springForce * safeDt;
    pointerAngle += pointerVelocity * safeDt;
    if (Math.abs(pointerAngle) < 0.001 && Math.abs(pointerVelocity) < 0.01) {
      pointerAngle = 0;
      pointerVelocity = 0;
    }

    // Winner highlight pulse animation
    if (winningIndex !== -1) {
      highlightPulse += safeDt * 5;
    }
  }

  function onSpinComplete() {
    winningIndex = getSliceIndexAtPointer();
    const winner = items[winningIndex];

    stateDot.className = 'dot';
    stateText.textContent = 'Complete';
    spinBtnLabel.textContent = 'Spin the Wheel';
    mainSpinBtn.disabled = false;
    centerSpinBtn.disabled = false;
    generateWheelBtn.disabled = false;

    if (!winner) return;

    currentPointerNumberEl.textContent = winner.number;
    playWinFanfare();
    launchConfetti();
    recordHistory(winner);

    // Show Winner Modal after a brief beat so user sees the wheel land
    setTimeout(() => {
      openWinnerModal(winner);
    }, 380);
  }

  // --- Draw Wheel on High-DPI Canvas ---
  function drawWheel() {
    const dpr = window.devicePixelRatio || 1;
    const rect = wheelCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (wheelCanvas.width !== targetW || wheelCanvas.height !== targetH) {
      wheelCanvas.width = targetW;
      wheelCanvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;
    const outerRadius = Math.min(cx, cy) - 22;
    const wheelRadius = outerRadius - 18;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Outer Metallic Bezel Ring
    const bezelGrad = ctx.createRadialGradient(cx, cy, wheelRadius - 4, cx, cy, outerRadius);
    bezelGrad.addColorStop(0, '#1e293b');
    bezelGrad.addColorStop(0.55, '#0f172a');
    bezelGrad.addColorStop(0.92, '#334155');
    bezelGrad.addColorStop(1, '#475569');

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = bezelGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();

    // 2. Draw Perimeter LED Lights on Bezel
    const ledCount = 24;
    const ledRingRadius = (outerRadius + wheelRadius) / 2;
    const timeSec = performance.now() / 1000;
    for (let i = 0; i < ledCount; i++) {
      const angle = (i / ledCount) * Math.PI * 2;
      const lx = cx + Math.cos(angle) * ledRingRadius;
      const ly = cy + Math.sin(angle) * ledRingRadius;

      const isLit = isSpinning
        ? Math.floor(timeSec * 14 + i) % 2 === 0
        : (winningIndex !== -1 ? Math.floor(timeSec * 6 + i) % 2 === 0 : i % 2 === 0);

      ctx.beginPath();
      ctx.arc(lx, ly, isLit ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? '#fde047' : 'rgba(255, 255, 255, 0.22)';
      if (isLit) {
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3. Draw Wheel Slices
    const n = items.length;
    if (n > 0) {
      const sliceArc = (Math.PI * 2) / n;
      const activeIdx = getSliceIndexAtPointer();

      for (let i = 0; i < n; i++) {
        const startA = wheelAngle + i * sliceArc;
        const endA = startA + sliceArc;
        const midA = startA + sliceArc / 2;
        const item = items[i];
        const isWinner = !isSpinning && winningIndex === i;
        const isUnderPointer = isSpinning && activeIdx === i;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, wheelRadius, startA, endA);
        ctx.closePath();

        // Slice fill with subtle radial depth
        const sliceGrad = ctx.createRadialGradient(cx, cy, wheelRadius * 0.12, cx, cy, wheelRadius);
        sliceGrad.addColorStop(0, item.color.border);
        sliceGrad.addColorStop(1, item.color.bg);
        ctx.fillStyle = sliceGrad;
        ctx.fill();

        // Highlight active or winning slice
        if (isWinner) {
          const alpha = 0.28 + 0.18 * Math.sin(highlightPulse);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();
        } else if (isUnderPointer) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.fill();
        }

        // Slice divider line
        ctx.lineWidth = n > 80 ? 0.6 : 1.4;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.stroke();

        // Draw Number Label along radius
        ctx.translate(cx, cy);
        ctx.rotate(midA);

        // Adaptive font sizing based on number of slices
        let fontSize = 18;
        if (n > 120) fontSize = 8.5;
        else if (n > 80) fontSize = 10;
        else if (n > 50) fontSize = 12;
        else if (n > 30) fontSize = 14;
        else if (n <= 12) fontSize = 21;

        ctx.font = `800 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = item.color.text;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        if (n <= 60) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 4;
        }

        const textRadius = wheelRadius - (n > 60 ? 12 : 20);
        ctx.fillText(String(item.number), textRadius, 0);
        ctx.restore();
      }

      // 4. Draw Inner Shadow Ring & Pegs
      ctx.beginPath();
      ctx.arc(cx, cy, wheelRadius, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.stroke();

      // Draw Metallic Pegs on Slice Boundaries (if n <= 90 so pegs don't overlap)
      if (n <= 90) {
        const pegRadius = n > 50 ? 2.2 : 3.5;
        const pegDist = wheelRadius - 4;
        for (let i = 0; i < n; i++) {
          const pegA = wheelAngle + i * sliceArc;
          const px = cx + Math.cos(pegA) * pegDist;
          const py = cy + Math.sin(pegA) * pegDist;

          ctx.beginPath();
          ctx.arc(px, py, pegRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();
        }
      }
    }

    // 5. Draw Top Physical Pointer (Flapper) with Spring Deflection
    ctx.save();
    const pointerPivotX = cx;
    const pointerPivotY = cy - outerRadius + 4;
    ctx.translate(pointerPivotX, pointerPivotY);
    // Deflect to the left as clockwise pegs push the bottom tip of the pointer right
    ctx.rotate(-pointerAngle);

    // Drop shadow for pointer
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // Pointer triangle body
    ctx.beginPath();
    ctx.moveTo(0, 34); // Tip pointing down into the wheel pegs
    ctx.lineTo(-15, -6);
    ctx.quadraticCurveTo(0, -14, 15, -6);
    ctx.closePath();

    const pointerGrad = ctx.createLinearGradient(-15, -10, 15, 34);
    pointerGrad.addColorStop(0, '#fbbf24');
    pointerGrad.addColorStop(0.5, '#f59e0b');
    pointerGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = pointerGrad;
    ctx.fill();

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Center rivet on pointer mount
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, -1, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fde68a';
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  // --- History Management ---
  function recordHistory(winner) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    history.unshift({
      round: history.length + 1,
      number: winner.number,
      color: winner.color.bg,
      time: timeStr,
    });
    renderHistory();
  }

  function renderHistory() {
    clearHistoryBtn.disabled = history.length === 0;
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No draws yet. Spin the wheel to begin!</div>';
      return;
    }

    historyList.innerHTML = history
      .map(
        (entry) => `
        <div class="history-item">
          <div class="history-left">
            <span class="history-rank">#${entry.round}</span>
            <span class="history-color-dot" style="background:${entry.color}"></span>
            <span class="history-num">No. ${entry.number}</span>
          </div>
          <span class="history-time">${entry.time}</span>
        </div>
      `
      )
      .join('');
  }

  // --- Winner Modal ---
  function openWinnerModal(winner) {
    winnerNumberDisplay.textContent = winner.number;
    winnerBadge.style.background = `linear-gradient(135deg, ${winner.color.bg}, ${winner.color.border})`;
    winnerMetaText.textContent = `Selected from ${items.length} candidate numbers`;

    // Show or hide the "remove and continue" button depending on remaining items
    if (items.length <= 2) {
      removeAndCloseBtn.classList.add('hidden');
    } else {
      removeAndCloseBtn.classList.remove('hidden');
    }

    winnerModal.classList.remove('hidden');

    // If auto-remove toggle is on and we have > 2 numbers, automatically remove on close
    if (removeWinnerToggle.checked && items.length > 2) {
      keepAndCloseBtn.textContent = 'Done (Winner Auto-Removed)';
      removeAndCloseBtn.classList.add('hidden');
    } else {
      keepAndCloseBtn.textContent = 'Done';
    }
  }

  function closeWinnerModal(shouldRemoveWinner) {
    winnerModal.classList.add('hidden');
    if (shouldRemoveWinner && winningIndex !== -1 && items.length > 2) {
      const remainingNumbers = items
        .filter((_, idx) => idx !== winningIndex)
        .map((it) => it.number);
      items = assignColors(remainingNumbers);
      winningIndex = -1;
      updateUIStats();
    }
  }

  // --- Confetti Celebration Engine ---
  let confettiParticles = [];

  function resizeConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  function launchConfetti() {
    resizeConfetti();
    const colors = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#fde047', '#ffffff'];
    for (let i = 0; i < 110; i++) {
      confettiParticles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 180,
        y: window.innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 18,
        vy: -Math.random() * 16 - 6,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      });
    }
  }

  function updateAndDrawConfetti() {
    if (confettiParticles.length === 0) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38; // Gravity
      p.vx *= 0.99; // Air resistance
      p.rotation += p.vRot;

      if (p.y > confettiCanvas.height - 80) {
        p.alpha -= 0.03;
      }

      if (p.alpha <= 0 || p.y > confettiCanvas.height + 40) {
        confettiParticles.splice(i, 1);
        continue;
      }

      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(0, p.alpha);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rotation);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    }
  }

  // --- Main Render Loop ---
  function animate(now) {
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    updatePhysics(dt);
    drawWheel();
    updateAndDrawConfetti();

    requestAnimationFrame(animate);
  }

  // --- Event Listeners ---
  rangeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isSpinning) return;
    presetChips.forEach((c) => c.classList.remove('active'));
    applyRange(startNumberInput.value, endNumberInput.value);
  });

  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (isSpinning) return;
      presetChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      startNumberInput.value = chip.dataset.start;
      endNumberInput.value = chip.dataset.end;
      applyRange(chip.dataset.start, chip.dataset.end);
    });
  });

  mainSpinBtn.addEventListener('click', startSpin);
  centerSpinBtn.addEventListener('click', startSpin);

  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundOnIcon.classList.toggle('hidden', !soundEnabled);
    soundOffIcon.classList.toggle('hidden', soundEnabled);
  });

  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    renderHistory();
  });

  keepAndCloseBtn.addEventListener('click', () => {
    closeWinnerModal(removeWinnerToggle.checked);
  });

  removeAndCloseBtn.addEventListener('click', () => {
    closeWinnerModal(true);
  });

  winnerModal.addEventListener('click', (e) => {
    if (e.target === winnerModal) {
      closeWinnerModal(removeWinnerToggle.checked);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !winnerModal.classList.contains('hidden')) {
      closeWinnerModal(removeWinnerToggle.checked);
    } else if (e.code === 'Space' && winnerModal.classList.contains('hidden')) {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
        e.preventDefault();
        startSpin();
      }
    }
  });

  window.addEventListener('resize', resizeConfetti);

  // Initialize Default Wheel (1 to 20)
  applyRange(startNumberInput.value, endNumberInput.value);
  requestAnimationFrame(animate);
})();
