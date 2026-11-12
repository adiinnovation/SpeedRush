/**
 * ============================================================================
 * SPEED RUSH - 2D CAR RACING GAME
 * ============================================================================
 * An arcade highway racing game built with HTML5 Canvas, CSS3, & Vanilla JavaScript.
 *
 * Architecture:
 * - CONFIG: Centralized settings for easy customization (colors, speeds, difficulty)
 * - SoundSystem: Zero-dependency Web Audio API sound synthesizer (engine, coin, crash)
 * - ParticleSystem: Visual effects (sparks, crash explosion, skid marks, speed lines)
 * - GameEngine: Game loop with requestAnimationFrame, delta time, collision & state
 * ============================================================================
 */

'use strict';

/* ==========================================================================
   1. GAME CONFIGURATION & CUSTOMIZATION PARAMETERS
   Users can easily modify these parameters to tune game feel, colors, and difficulty.
   ========================================================================== */
const CONFIG = {
  // Road & Highway Design
  road: {
    lanes: 3,
    width: 320,               // Width of the drivable asphalt (px)
    laneLineWidth: 4,         // Width of dashed divider lines (px)
    laneLineLength: 42,       // Length of each dash (px)
    laneLineGap: 38,          // Space between dashes (px)
    curbWidth: 16,            // Width of alternating rumble kerb (px)
    curbSegmentLength: 32,    // Length of each red/white curb stripe (px)
    shoulderWidth: 54,        // Width of grass roadside verges (px)
    asphaltColor: '#25272e',  // Main road surface
    asphaltInner: '#2c2e36',  // Subtle road center gradient
    grassColor: '#142718',    // Roadside verge
    kerbRed: '#e52525',       // Rumble strip red
    kerbWhite: '#f0f0f0',     // Rumble strip white
    dividerColor: '#ffffff',  // White dashed divider
    guardRailColor: '#8a939e',// Metallic roadside safety barrier
  },

  // Player Vehicle Settings
  player: {
    width: 46,                // Car width in canvas px
    height: 88,               // Car length in canvas px
    startSpeed: 110,          // Starting speed in KM/H
    maxSpeed: 250,            // Maximum speed limit in KM/H
    speedIncreaseRate: 3.5,   // KM/H added per speed level milestone
    steerSpeed: 380,          // Horizontal movement speed in px/second
    tiltAngleMax: 0.10,       // Car tilt rotation (radians) while steering
    defaultColor: '#ff1e42',  // Initial sports car body color
    stripeColor: '#ffffff',   // Racing stripe color
  },

  // Enemy Vehicles Settings
  enemies: {
    minSpawnInterval: 1.1,    // Minimum seconds between car spawns
    maxSpawnInterval: 2.3,    // Maximum seconds between car spawns
    speedVariance: [0.50, 0.75], // Enemy speed range relative to current player speed
    // Catalog of enemy models with varied dimensions and colors
    types: [
      { name: 'supercar', width: 46, height: 86, color: '#00d2ff', accent: '#ffffff', type: 'sport' },
      { name: 'sedan',    width: 44, height: 82, color: '#ffb800', accent: '#232323', type: 'sedan' },
      { name: 'taxi',     width: 44, height: 82, color: '#ffd000', accent: '#000000', type: 'taxi' },
      { name: 'muscle',   width: 48, height: 88, color: '#bf00ff', accent: '#ffffff', type: 'muscle' },
      { name: 'van',      width: 50, height: 94, color: '#00ff88', accent: '#1a1a1a', type: 'van' },
      { name: 'coupe',    width: 46, height: 84, color: '#ff6a00', accent: '#ffffff', type: 'sport' },
      { name: 'phantom',  width: 48, height: 88, color: '#30343f', accent: '#e52525', type: 'muscle' },
    ]
  },

  // Collectable Coins Settings
  coins: {
    spawnChance: 0.55,        // Probability to spawn coins when obstacle slot is chosen
    radius: 14,               // Radius of golden coin (px)
    scoreValue: 100,          // Points awarded per coin
    rotationSpeed: 3.8,       // 3D spin animation speed (radians/sec)
  },

  // Difficulty & Progression Curve
  difficulty: {
    scoreIntervalForSpeedUp: 400, // Distance points needed to increase speed tier
    maxDifficultyScore: 8000,     // Score at which enemy density maxes out
  }
};

/* ==========================================================================
   HELPER UTILITIES (Safe Storage & Math)
   ========================================================================== */
function safeGetStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSetStorage(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch (e) {}
}

/* ==========================================================================
   2. AUDIO SYNTHESIZER (Web Audio API)
   Generates engine rumble, coin chimes, crash boom, and UI clicks procedurally.
   Eliminates all external audio file dependencies and CORS issues!
   ========================================================================== */
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = safeGetStorage('speed_rush_muted', 'false') === 'true';
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.isEngineRunning = false;
  }

  // Initialize AudioContext on first user interaction
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    safeSetStorage('speed_rush_muted', this.isMuted);
    if (this.isMuted) {
      this.stopEngine();
    }
    return this.isMuted;
  }

  // Continuous realistic engine hum modulated by current speed
  startEngine() {
    if (this.isMuted || !this.ctx || this.isEngineRunning) return;
    try {
      const now = this.ctx.currentTime;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.001, now);
      this.engineGain.gain.exponentialRampToValueAtTime(0.12, now + 0.3);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(140, now);

      // Low rumble oscillator (sawtooth)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(45, now);

      // Sub-harmonic oscillator (triangle)
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(30, now);

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.isEngineRunning = true;
    } catch (e) {
      console.warn('Audio start error:', e);
    }
  }

  updateEngine(speedRatio) {
    if (!this.isEngineRunning || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Modulate frequency from 45Hz at idle to ~120Hz at max speed
      const baseFreq = 45 + (speedRatio * 80);
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.65, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(140 + (speedRatio * 320), now, 0.08);
    } catch (e) {}
  }

  stopEngine() {
    if (!this.isEngineRunning || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      }
      setTimeout(() => {
        try {
          if (this.engineOsc1) this.engineOsc1.stop();
          if (this.engineOsc2) this.engineOsc2.stop();
        } catch (e) {}
        this.isEngineRunning = false;
      }, 220);
    } catch (e) {
      this.isEngineRunning = false;
    }
  }

  // Bright golden coin collection chime
  playCoin() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Arpeggiated chime: 987Hz (B5) to 1318Hz (E6)
      osc.frequency.setValueAtTime(987, now);
      osc.frequency.setValueAtTime(1318, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // Deep explosion and impact crash sound
  playCrash() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    try {
      const now = this.ctx.currentTime;

      // 1. Noise Burst for impact crunch
      const bufferSize = this.ctx.sampleRate * 0.6;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.55);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);

      // 2. Sub-bass boom
      const boom = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boom.type = 'sawtooth';
      boom.frequency.setValueAtTime(110, now);
      boom.frequency.exponentialRampToValueAtTime(25, now + 0.6);

      boomGain.gain.setValueAtTime(0.35, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      boom.connect(boomGain);
      boomGain.connect(this.ctx.destination);
      boom.start(now);
      boom.stop(now + 0.65);
    } catch (e) {}
  }

  // Level Up / Speed Boost Fanfare
  playSpeedUp() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    try {
      const notes = [440, 554, 659, 880]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = this.ctx.currentTime + (idx * 0.07);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch (e) {}
  }

  // UI Button Click Tone
  playClick() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }
}

/* ==========================================================================
   3. VISUAL EFFECTS & PARTICLE SYSTEM
   Renders crash debris, tire smoke, sparks, skid marks, and floating scores.
   ========================================================================== */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.skidMarks = [];
    this.floatingTexts = [];
  }

  reset() {
    this.particles = [];
    this.skidMarks = [];
    this.floatingTexts = [];
  }

  // Spawn fiery explosion on vehicle collision
  createCrashExplosion(x, y) {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 260 + 60;
      const colors = ['#ff1e42', '#ff6a00', '#ffd000', '#ffffff', '#444444'];
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 1.5 + 1.2, // alpha loss per second
        drag: 0.94,
      });
    }

    // Add crash tire skid marks
    this.skidMarks.push({
      x1: x - 14, y1: y - 20, x2: x - 16, y2: y + 25, alpha: 0.8
    });
    this.skidMarks.push({
      x1: x + 14, y1: y - 20, x2: x + 16, y2: y + 25, alpha: 0.8
    });
  }

  // Sparkling golden starburst when picking up a coin
  createCoinSparks(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 160 + 40;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 2,
        color: '#ffd700',
        alpha: 1,
        decay: 2.2,
        drag: 0.90,
      });
    }
  }

  // Floating score indicator text (+100)
  addFloatingText(text, x, y, color = '#ffd700') {
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      vy: -75,
      alpha: 1,
      color: color,
    });
  }

  // Update particles with delta time
  update(dt, roadSpeedPx) {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += (p.vy + roadSpeedPx * 0.4) * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 2. Scroll skid marks down with the highway road
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const s = this.skidMarks[i];
      s.y1 += roadSpeedPx * dt;
      s.y2 += roadSpeedPx * dt;
      s.alpha -= 0.08 * dt;
      if (s.y1 > 900 || s.alpha <= 0) {
        this.skidMarks.splice(i, 1);
      }
    }

    // 3. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= 1.1 * dt;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // Render particles and visual effects on canvas
  draw(ctx) {
    // 1. Draw Skid Marks
    ctx.save();
    for (const s of this.skidMarks) {
      ctx.strokeStyle = `rgba(10, 10, 12, ${s.alpha * 0.7})`;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Draw Particles
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Draw Floating Texts
    ctx.save();
    ctx.font = 'bold 18px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }
}

/* ==========================================================================
   4. MAIN GAME ENGINE
   Controls canvas rendering, user input, game state, collision, and entities.
   ========================================================================== */
class SpeedRushGame {
  constructor() {
    // DOM References
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('game-container');

    // HUD Elements
    this.scoreDisplay = document.getElementById('score-display');
    this.speedDisplay = document.getElementById('speed-display');
    this.speedBar = document.getElementById('speed-bar');
    this.coinsDisplay = document.getElementById('coins-display');
    this.bestDisplay = document.getElementById('best-display');
    this.soundIcon = document.getElementById('sound-icon');
    this.announcementBanner = document.getElementById('announcement-banner');
    this.announcementText = document.getElementById('announcement-text');

    // Overlay Screens
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameOverScreen = document.getElementById('gameover-screen');

    // Modals Stat Values
    this.startBestScore = document.getElementById('start-best-score');
    this.pauseScore = document.getElementById('pause-score');
    this.pauseCoins = document.getElementById('pause-coins');
    this.finalScore = document.getElementById('final-score');
    this.finalDistance = document.getElementById('final-distance');
    this.finalCoins = document.getElementById('final-coins');
    this.finalBest = document.getElementById('final-best');
    this.newRecordBadge = document.getElementById('new-record-badge');

    // Subsystems
    this.sound = new SoundSystem();
    this.particles = new ParticleSystem();

    // Virtual Internal Coordinates (Standard Arcade Portrait)
    this.vw = 460;
    this.vh = 800;

    // Game States
    this.STATE = {
      START: 'start',
      PLAYING: 'playing',
      PAUSED: 'paused',
      GAMEOVER: 'gameover',
    };
    this.state = this.STATE.START;

    // High Score Persistence
    this.bestScore = parseInt(safeGetStorage('speed_rush_best_score', '0'), 10) || 0;

    // Player State
    this.playerCarColor = safeGetStorage('speed_rush_car_color', CONFIG.player.defaultColor);
    this.playerX = this.vw / 2;
    this.playerY = this.vh - 140;
    this.playerTilt = 0;
    this.steerLeft = false;
    this.steerRight = false;

    // Movement & Speed
    this.currentSpeed = CONFIG.player.startSpeed;
    this.targetSpeed = CONFIG.player.startSpeed;
    this.roadOffset = 0;
    this.distance = 0;
    this.score = 0;
    this.coinsCollected = 0;
    this.speedLevel = 1;

    // Highway Geometry
    this.roadLeft = (this.vw - CONFIG.road.width) / 2;
    this.roadRight = this.roadLeft + CONFIG.road.width;
    this.laneWidth = CONFIG.road.width / CONFIG.road.lanes;

    // Entities
    this.enemies = [];
    this.coins = [];
    this.sceneryProps = []; // Trees and light posts along roadside
    this.nextSpawnTimer = 1.0;

    // Screen Shake
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Timing Loop
    this.lastTime = 0;
    this.animationFrameId = null;

    // Setup
    this.initScenery();
    this.initCanvasSize();
    this.initEvents();
    this.updateHUD();
    this.updateSoundIcon();

    // Set active color chip in UI
    document.querySelectorAll('.color-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.color === this.playerCarColor);
    });

    // Start Render Loop
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // Calculate High-DPI canvas resolution
  initCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.vw * dpr;
    this.canvas.height = this.vh * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Populate roadside environment with trees and street lamps
  initScenery() {
    this.sceneryProps = [];
    const spacing = 110;
    const count = Math.ceil(this.vh / spacing) + 3;
    for (let i = 0; i < count; i++) {
      const y = i * spacing;
      // Left verge tree
      this.sceneryProps.push({
        x: this.roadLeft - CONFIG.road.curbWidth - 28,
        y: y,
        type: (i % 3 === 0) ? 'lamp' : 'tree',
        size: 18 + Math.random() * 6,
        color: (i % 2 === 0) ? '#1f4d25' : '#26592e',
        side: 'left'
      });
      // Right verge tree
      this.sceneryProps.push({
        x: this.roadRight + CONFIG.road.curbWidth + 28,
        y: y + 45,
        type: ((i + 1) % 3 === 0) ? 'lamp' : 'tree',
        size: 18 + Math.random() * 6,
        color: (i % 2 === 0) ? '#26592e' : '#1f4d25',
        side: 'right'
      });
    }
  }

  // Setup Keyboard, Touch, and UI Button Event Listeners
  initEvents() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      // Prevent page scrolling on gaming keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyP'].includes(e.code)) {
        e.preventDefault();
      }

      this.sound.init(); // Initialize audio context on first key press

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.steerLeft = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.steerRight = true;
      } else if (e.code === 'Space') {
        if (this.state === this.STATE.START || this.state === this.STATE.GAMEOVER) {
          this.startRace();
        } else if (this.state === this.STATE.PAUSED) {
          this.resumeRace();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
      } else if (e.code === 'KeyM') {
        this.toggleSound();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.steerLeft = false;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.steerRight = false;
      }
    });

    // Mobile / Touch Buttons
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');

    const bindTouch = (elem, onStart, onEnd) => {
      elem.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.sound.init();
        elem.classList.add('active');
        onStart();
      });
      const endHandler = (e) => {
        e.preventDefault();
        elem.classList.remove('active');
        onEnd();
      };
      elem.addEventListener('pointerup', endHandler);
      elem.addEventListener('pointercancel', endHandler);
      elem.addEventListener('pointerleave', endHandler);
    };

    bindTouch(btnLeft, () => { this.steerLeft = true; }, () => { this.steerLeft = false; });
    bindTouch(btnRight, () => { this.steerRight = true; }, () => { this.steerRight = false; });

    // Direct Canvas Touch / Pointer Controls (Allows tapping left/right side of highway)
    let activePointerId = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== this.STATE.PLAYING) return;
      this.sound.init();
      activePointerId = e.pointerId;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < rect.width / 2) {
        this.steerLeft = true;
        this.steerRight = false;
      } else {
        this.steerRight = true;
        this.steerLeft = false;
      }
    });

    const stopCanvasSteer = (e) => {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        this.steerLeft = false;
        this.steerRight = false;
        activePointerId = null;
      }
    };
    this.canvas.addEventListener('pointerup', stopCanvasSteer);
    this.canvas.addEventListener('pointercancel', stopCanvasSteer);
    this.canvas.addEventListener('pointerleave', stopCanvasSteer);

    // UI Buttons
    document.getElementById('btn-play').addEventListener('click', () => {
      this.sound.playClick();
      this.startRace();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.sound.playClick();
      this.resumeRace();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.sound.playClick();
      this.startRace();
    });

    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      this.sound.playClick();
      this.startRace();
    });

    document.getElementById('btn-pause-toggle').addEventListener('click', () => {
      this.sound.playClick();
      this.togglePause();
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      this.sound.playClick();
      this.toggleSound();
    });

    // Car Color Palette Picker Chips
    document.querySelectorAll('.color-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.sound.playClick();
        document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.playerCarColor = chip.dataset.color;
        safeSetStorage('speed_rush_car_color', this.playerCarColor);
      });
    });
  }

  // Toggle Sound State & Update UI Icon
  toggleSound() {
    const isMuted = this.sound.toggleMute();
    this.updateSoundIcon();
  }

  updateSoundIcon() {
    if (this.sound.isMuted) {
      this.soundIcon.innerHTML = '&#128263;';
      document.getElementById('btn-sound-toggle').setAttribute('title', 'Unmute Sound (M)');
    } else {
      this.soundIcon.innerHTML = '&#128266;';
      document.getElementById('btn-sound-toggle').setAttribute('title', 'Mute Sound (M)');
    }
  }

  // Start / Restart Fresh Race
  startRace() {
    this.sound.init();
    this.state = this.STATE.PLAYING;
    this.score = 0;
    this.distance = 0;
    this.coinsCollected = 0;
    this.speedLevel = 1;
    this.currentSpeed = CONFIG.player.startSpeed;
    this.targetSpeed = CONFIG.player.startSpeed;
    this.playerX = this.vw / 2;
    this.playerTilt = 0;
    this.enemies = [];
    this.coins = [];
    this.nextSpawnTimer = 0.8;
    this.particles.reset();

    // Hide Screens
    this.startScreen.classList.remove('active');
    this.pauseScreen.classList.remove('active');
    this.gameOverScreen.classList.remove('active');

    this.sound.startEngine();
    this.updateHUD();
  }

  // Pause / Resume Logic
  togglePause() {
    if (this.state === this.STATE.PLAYING) {
      this.pauseRace();
    } else if (this.state === this.STATE.PAUSED) {
      this.resumeRace();
    }
  }

  pauseRace() {
    this.state = this.STATE.PAUSED;
    this.sound.stopEngine();
    this.pauseScore.textContent = this.score.toLocaleString();
    this.pauseCoins.textContent = this.coinsCollected.toLocaleString();
    this.pauseScreen.classList.add('active');
  }

  resumeRace() {
    this.state = this.STATE.PLAYING;
    this.pauseScreen.classList.remove('active');
    this.sound.startEngine();
  }

  // Trigger Collision & Game Over
  triggerCrash() {
    this.state = this.STATE.GAMEOVER;
    this.sound.stopEngine();
    this.sound.playCrash();

    // Dramatic Screen Shake
    this.shakeDuration = 0.55;
    this.shakeIntensity = 18;

    // Particle Explosion at Player Center
    this.particles.createCrashExplosion(this.playerX, this.playerY);

    // High Score Evaluation
    let isNewRecord = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      safeSetStorage('speed_rush_best_score', this.bestScore);
      isNewRecord = true;
    }

    // Populate Game Over Screen
    this.finalScore.textContent = this.score.toLocaleString();
    this.finalDistance.textContent = `${Math.floor(this.distance)} m`;
    this.finalCoins.textContent = this.coinsCollected.toLocaleString();
    this.finalBest.textContent = this.bestScore.toLocaleString();
    this.newRecordBadge.classList.toggle('hidden', !isNewRecord);

    // Show Game Over overlay after short dramatic pause
    setTimeout(() => {
      this.gameOverScreen.classList.add('active');
      this.updateHUD();
    }, 600);
  }

  // Speed Up Milestone Notification
  announceSpeedUp() {
    this.sound.playSpeedUp();
    this.announcementText.textContent = `SPEED LEVEL ${this.speedLevel} UP!`;
    this.announcementBanner.classList.add('visible');
    setTimeout(() => {
      this.announcementBanner.classList.remove('visible');
    }, 1800);
  }

  // Spawn Enemy Vehicles and Coins
  spawnTraffic() {
    // 1. Guard against impossible 3-lane walls (always keep at least 1 lane passable)
    const carsNearTop = this.enemies.filter(e => e.y < 180);
    const occupiedLanes = new Set(carsNearTop.map(e => e.lane));
    if (occupiedLanes.size >= CONFIG.road.lanes - 1) {
      return;
    }

    // Pick from available open lanes near the top
    const availableLanes = [];
    for (let l = 0; l < CONFIG.road.lanes; l++) {
      if (!occupiedLanes.has(l)) {
        availableLanes.push(l);
      }
    }
    if (availableLanes.length === 0) return;

    const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
    const laneCenterX = this.roadLeft + (lane * this.laneWidth) + (this.laneWidth / 2);

    // Pick random vehicle type from config
    const typeDef = CONFIG.enemies.types[Math.floor(Math.random() * CONFIG.enemies.types.length)];

    // Speed calculation relative to player
    const speedRatio = CONFIG.enemies.speedVariance[0] +
      Math.random() * (CONFIG.enemies.speedVariance[1] - CONFIG.enemies.speedVariance[0]);
    const enemySpeed = this.currentSpeed * speedRatio;

    this.enemies.push({
      x: laneCenterX,
      y: -typeDef.height - 20,
      width: typeDef.width,
      height: typeDef.height,
      color: typeDef.color,
      accent: typeDef.accent,
      modelType: typeDef.type,
      speed: enemySpeed,
      lane: lane,
    });

    // Optionally spawn a collectable coin in a different open lane
    if (Math.random() < CONFIG.coins.spawnChance) {
      const openLanes = [0, 1, 2].filter(l => l !== lane && !occupiedLanes.has(l));
      if (openLanes.length > 0) {
        const coinLane = openLanes[Math.floor(Math.random() * openLanes.length)];
        const coinX = this.roadLeft + (coinLane * this.laneWidth) + (this.laneWidth / 2);

        this.coins.push({
          x: coinX,
          y: -CONFIG.coins.radius - 30,
          radius: CONFIG.coins.radius,
          rotation: Math.random() * Math.PI,
        });
      }
    }
  }

  // Update Logic (Runs Every Frame)
  update(dt) {
    // 1. Process Screen Shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }

    // When not playing, keep road & scenery gently idling
    if (this.state !== this.STATE.PLAYING) {
      const idleSpeed = 25; // Slow gentle roll for menu background
      const roadSpeedPx = (idleSpeed * 1000 / 3600) * 8.0;
      this.roadOffset = (this.roadOffset + roadSpeedPx * dt) % (CONFIG.road.laneLineLength + CONFIG.road.laneLineGap);
      this.updateScenery(dt, roadSpeedPx);
      this.particles.update(dt, roadSpeedPx);
      return;
    }

    // 2. Smooth Speed Acceleration towards target speed
    if (this.currentSpeed < this.targetSpeed) {
      this.currentSpeed = Math.min(this.targetSpeed, this.currentSpeed + 12 * dt);
    }

    // Convert KM/H to canvas pixels per second
    // 100 km/h corresponds to ~550 px/s highway motion
    const roadSpeedPx = (this.currentSpeed * 1000 / 3600) * 7.5;

    // 3. Distance & Score Tracking
    const metersCovered = (this.currentSpeed * 1000 / 3600) * dt;
    this.distance += metersCovered;
    this.score = Math.floor(this.distance * 0.8) + (this.coinsCollected * CONFIG.coins.scoreValue);

    // Check Speed Progression Tier
    const expectedTier = 1 + Math.floor(this.score / CONFIG.difficulty.scoreIntervalForSpeedUp);
    if (expectedTier > this.speedLevel) {
      this.speedLevel = expectedTier;
      this.targetSpeed = Math.min(CONFIG.player.maxSpeed, CONFIG.player.startSpeed + (this.speedLevel - 1) * CONFIG.player.speedIncreaseRate);
      this.announceSpeedUp();
    }

    // 4. Update Highway Road Markings Scroll
    this.roadOffset = (this.roadOffset + roadSpeedPx * dt) % (CONFIG.road.laneLineLength + CONFIG.road.laneLineGap);

    // 5. Update Roadside Scenery (Trees & Lamps)
    this.updateScenery(dt, roadSpeedPx);

    // 6. Player Steering & Tilt Physics
    const halfWidth = CONFIG.player.width / 2;
    const roadInnerLeft = this.roadLeft + halfWidth + 6;
    const roadInnerRight = this.roadRight - halfWidth - 6;

    if (this.steerLeft && !this.steerRight) {
      this.playerX -= CONFIG.player.steerSpeed * dt;
      this.playerTilt = Math.max(-CONFIG.player.tiltAngleMax, this.playerTilt - 1.2 * dt);
    } else if (this.steerRight && !this.steerLeft) {
      this.playerX += CONFIG.player.steerSpeed * dt;
      this.playerTilt = Math.min(CONFIG.player.tiltAngleMax, this.playerTilt + 1.2 * dt);
    } else {
      // Re-center tilt smoothly
      this.playerTilt *= Math.pow(0.05, dt);
    }

    // Clamp within highway boundaries
    if (this.playerX < roadInnerLeft) {
      this.playerX = roadInnerLeft;
    } else if (this.playerX > roadInnerRight) {
      this.playerX = roadInnerRight;
    }

    // 7. Enemy Vehicles Spawning & Motion
    this.nextSpawnTimer -= dt;
    if (this.nextSpawnTimer <= 0) {
      this.spawnTraffic();
      // Ramp down spawn delay as difficulty increases
      const densityRamp = Math.min(1, this.score / CONFIG.difficulty.maxDifficultyScore);
      const minInterval = CONFIG.enemies.minSpawnInterval * (1 - densityRamp * 0.35);
      const maxInterval = CONFIG.enemies.maxSpawnInterval * (1 - densityRamp * 0.35);
      this.nextSpawnTimer = minInterval + Math.random() * (maxInterval - minInterval);
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // Relative motion: roadSpeed - enemySpeed
      const relativeSpeedPx = ((this.currentSpeed - e.speed) * 1000 / 3600) * 7.5;
      e.y += relativeSpeedPx * dt;

      // Despawn when far behind or off top
      if (e.y > this.vh + 150) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Check Collision with Player
      if (this.checkCollision(this.playerX, this.playerY, CONFIG.player.width, CONFIG.player.height,
                             e.x, e.y, e.width, e.height)) {
        this.triggerCrash();
        return;
      }
    }

    // 8. Coins Spawning & Collection
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.y += roadSpeedPx * dt;
      c.rotation += CONFIG.coins.rotationSpeed * dt;

      // Despawn off screen bottom
      if (c.y > this.vh + 50) {
        this.coins.splice(i, 1);
        continue;
      }

      // Proximity check for pickup (Radius bounding)
      const dx = this.playerX - c.x;
      const dy = this.playerY - c.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < (c.radius + CONFIG.player.width * 0.45)) {
        // Collect Coin!
        this.coinsCollected++;
        this.sound.playCoin();
        this.particles.createCoinSparks(c.x, c.y);
        this.particles.addFloatingText(`+${CONFIG.coins.scoreValue}`, c.x, c.y);
        this.coins.splice(i, 1);
      }
    }

    // 9. Update Particles & Audio
    this.particles.update(dt, roadSpeedPx);
    const speedRatio = (this.currentSpeed - CONFIG.player.startSpeed) / (CONFIG.player.maxSpeed - CONFIG.player.startSpeed);
    this.sound.updateEngine(speedRatio);

    // 10. Sync HUD Display
    this.updateHUD();
  }

  // Update roadside trees & lamps position
  updateScenery(dt, roadSpeedPx) {
    for (const p of this.sceneryProps) {
      p.y += roadSpeedPx * dt;
      if (p.y > this.vh + 60) {
        p.y = -60 - (Math.random() * 40);
      }
    }
  }

  // Inset Box Collision Detection (Ensures fair gameplay around rounded car edges)
  checkCollision(pX, pY, pW, pH, eX, eY, eW, eH) {
    const pInsetX = 6;
    const pInsetY = 8;
    const eInsetX = 6;
    const eInsetY = 8;

    const pLeft   = pX - (pW / 2) + pInsetX;
    const pRight  = pX + (pW / 2) - pInsetX;
    const pTop    = pY - (pH / 2) + pInsetY;
    const pBottom = pY + (pH / 2) - pInsetY;

    const eLeft   = eX - (eW / 2) + eInsetX;
    const eRight  = eX + (eW / 2) - eInsetX;
    const eTop    = eY - (eH / 2) + eInsetY;
    const eBottom = eY + (eH / 2) - eInsetY;

    return (pLeft < eRight && pRight > eLeft && pTop < eBottom && pBottom > eTop);
  }

  // Synchronize HUD and Speedometer Values
  updateHUD() {
    this.scoreDisplay.textContent = this.score.toLocaleString();
    this.speedDisplay.textContent = Math.round(this.currentSpeed);
    this.coinsDisplay.textContent = this.coinsCollected.toLocaleString();
    this.bestDisplay.textContent = Math.max(this.score, this.bestScore).toLocaleString();
    this.startBestScore.textContent = this.bestScore.toLocaleString();

    // Speedometer Gauge Bar Fill (0% to 100%)
    const speedRatio = Math.min(1, Math.max(0,
      (this.currentSpeed - CONFIG.player.startSpeed) / (CONFIG.player.maxSpeed - CONFIG.player.startSpeed)
    ));
    this.speedBar.style.width = `${Math.round(speedRatio * 100)}%`;
  }

  // =========================================================================
  // 5. CANVAS RENDERING
  // =========================================================================
  render() {
    this.ctx.save();

    // Apply Screen Shake
    if (this.shakeIntensity > 0) {
      const offsetX = (Math.random() * 2 - 1) * this.shakeIntensity;
      const offsetY = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.ctx.translate(offsetX, offsetY);
    }

    // 1. Draw Roadside Verges & Grass
    this.drawEnvironment();

    // 2. Draw Highway Asphalt, Rumble Kerbs & Lane Dividers
    this.drawHighway();

    // 3. Draw Roadside Scenery (Trees & Street Lamps)
    this.drawScenery();

    // 4. Draw Particles (Under Cars like Skid marks)
    this.particles.draw(this.ctx);

    // 5. Draw Collectable Coins
    this.drawCoins();

    // 6. Draw Enemy Traffic
    this.drawEnemies();

    // 7. Draw Player Sports Car (Unless exploded)
    if (this.state !== this.STATE.GAMEOVER || this.shakeDuration > 0.4) {
      this.drawPlayerCar();
    }

    this.ctx.restore();
  }

  // Draw roadside ground
  drawEnvironment() {
    // Left Grass Shoulder
    this.ctx.fillStyle = CONFIG.road.grassColor;
    this.ctx.fillRect(0, 0, this.roadLeft, this.vh);

    // Right Grass Shoulder
    this.ctx.fillRect(this.roadRight, 0, this.vw - this.roadRight, this.vh);
  }

  // Draw Asphalt Highway, Kerbs, and Dashed Lane Markings
  drawHighway() {
    // 1. Main Asphalt Road Bed
    const roadGradient = this.ctx.createLinearGradient(this.roadLeft, 0, this.roadRight, 0);
    roadGradient.addColorStop(0, CONFIG.road.asphaltColor);
    roadGradient.addColorStop(0.5, CONFIG.road.asphaltInner);
    roadGradient.addColorStop(1, CONFIG.road.asphaltColor);
    this.ctx.fillStyle = roadGradient;
    this.ctx.fillRect(this.roadLeft, 0, CONFIG.road.width, this.vh);

    // 2. Rumble Kerbs (Alternating red and white curb stripes)
    const curbLen = CONFIG.road.curbSegmentLength;
    const totalSegments = Math.ceil(this.vh / curbLen) + 2;
    const curbOffset = this.roadOffset % (curbLen * 2);

    for (let i = -1; i < totalSegments; i++) {
      const y = (i * curbLen) + curbOffset;
      const isRed = ((Math.floor((y - curbOffset) / curbLen)) % 2 === 0);
      this.ctx.fillStyle = isRed ? CONFIG.road.kerbRed : CONFIG.road.kerbWhite;

      // Left Kerb
      this.ctx.fillRect(this.roadLeft - CONFIG.road.curbWidth, y, CONFIG.road.curbWidth, curbLen);
      // Right Kerb
      this.ctx.fillRect(this.roadRight, y, CONFIG.road.curbWidth, curbLen);
    }

    // 3. Metallic Guard Rails
    this.ctx.fillStyle = CONFIG.road.guardRailColor;
    this.ctx.fillRect(this.roadLeft - CONFIG.road.curbWidth - 3, 0, 3, this.vh);
    this.ctx.fillRect(this.roadRight + CONFIG.road.curbWidth, 0, 3, this.vh);

    // 4. Dashed White Lane Divider Lines
    const dashLen = CONFIG.road.laneLineLength;
    const dashGap = CONFIG.road.laneLineGap;
    const period = dashLen + dashGap;
    const numDashes = Math.ceil(this.vh / period) + 2;

    this.ctx.fillStyle = CONFIG.road.dividerColor;

    for (let laneIdx = 1; laneIdx < CONFIG.road.lanes; laneIdx++) {
      const laneX = this.roadLeft + (laneIdx * this.laneWidth);

      for (let i = -1; i < numDashes; i++) {
        const y = (i * period) + this.roadOffset;
        this.ctx.fillRect(laneX - (CONFIG.road.laneLineWidth / 2), y, CONFIG.road.laneLineWidth, dashLen);
      }
    }
  }

  // Draw Roadside Trees and Street Lamps
  drawScenery() {
    for (const prop of this.sceneryProps) {
      if (prop.type === 'tree') {
        // Tree Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(prop.x + 3, prop.y + 3, prop.size, prop.size * 0.8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Tree Foliage
        this.ctx.fillStyle = prop.color;
        this.ctx.beginPath();
        this.ctx.arc(prop.x, prop.y, prop.size, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner Leaf Highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        this.ctx.beginPath();
        this.ctx.arc(prop.x - 3, prop.y - 3, prop.size * 0.55, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (prop.type === 'lamp') {
        // Metallic Street Lamp Post
        this.ctx.fillStyle = '#616161';
        this.ctx.beginPath();
        this.ctx.arc(prop.x, prop.y, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Lamp Head glowing towards highway
        const armDir = prop.side === 'left' ? 1 : -1;
        this.ctx.strokeStyle = '#9e9e9e';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(prop.x, prop.y);
        this.ctx.lineTo(prop.x + (armDir * 12), prop.y);
        this.ctx.stroke();

        // Light Bulb Glow
        this.ctx.fillStyle = 'rgba(255, 240, 180, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(prop.x + (armDir * 12), prop.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  // Draw High-Detail Player Sports Car
  drawPlayerCar() {
    const x = this.playerX;
    const y = this.playerY;
    const w = CONFIG.player.width;
    const h = CONFIG.player.height;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(this.playerTilt); // Dynamic steering lean

    // 1. Headlight Light Cones onto Asphalt
    const lightGrad = this.ctx.createRadialGradient(0, -h / 2, 10, 0, -h / 2 - 120, 130);
    lightGrad.addColorStop(0, 'rgba(255, 255, 220, 0.28)');
    lightGrad.addColorStop(0.6, 'rgba(255, 255, 200, 0.08)');
    lightGrad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = lightGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(-w * 0.35, -h * 0.4);
    this.ctx.lineTo(-w * 1.1, -h * 0.4 - 150);
    this.ctx.lineTo(w * 1.1, -h * 0.4 - 150);
    this.ctx.lineTo(w * 0.35, -h * 0.4);
    this.ctx.closePath();
    this.ctx.fill();

    // 2. Car Ground Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.drawRoundedRect(-w / 2 - 3, -h / 2 + 4, w + 6, h + 4, 12, true, false);

    // 3. High Performance Tires (4 Wheels)
    this.ctx.fillStyle = '#141416';
    const tireW = 7;
    const tireH = 18;
    this.drawRoundedRect(-w / 2 - 3, -h * 0.35, tireW, tireH, 3, true, false); // Front Left
    this.drawRoundedRect(w / 2 - tireW + 3, -h * 0.35, tireW, tireH, 3, true, false); // Front Right
    this.drawRoundedRect(-w / 2 - 3, h * 0.18, tireW, tireH, 3, true, false);  // Rear Left
    this.drawRoundedRect(w / 2 - tireW + 3, h * 0.18, tireW, tireH, 3, true, false);  // Rear Right

    // 4. Main Aerodynamic Sports Car Chassis
    const carGrad = this.ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    carGrad.addColorStop(0, this.shadeColor(this.playerCarColor, -25));
    carGrad.addColorStop(0.3, this.playerCarColor);
    carGrad.addColorStop(0.7, this.playerCarColor);
    carGrad.addColorStop(1, this.shadeColor(this.playerCarColor, -25));

    this.ctx.fillStyle = carGrad;
    this.drawRoundedRect(-w / 2, -h / 2, w, h, 14, true, false);

    // 5. Dual Racing Stripes
    this.ctx.fillStyle = CONFIG.player.stripeColor;
    const stripeW = 3.5;
    this.ctx.fillRect(-stripeW - 2, -h / 2, stripeW, h);
    this.ctx.fillRect(2, -h / 2, stripeW, h);

    // 6. Curved Tinted Windshield
    const glassGrad = this.ctx.createLinearGradient(0, -h * 0.25, 0, h * 0.15);
    glassGrad.addColorStop(0, '#101726');
    glassGrad.addColorStop(0.6, '#1c2940');
    glassGrad.addColorStop(1, '#0b111c');
    this.ctx.fillStyle = glassGrad;
    this.drawRoundedRect(-w * 0.36, -h * 0.22, w * 0.72, h * 0.24, 7, true, false);

    // Windshield Specular Reflection
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(-w * 0.24, -h * 0.18);
    this.ctx.lineTo(w * 0.18, -h * 0.04);
    this.ctx.stroke();

    // 7. Rear Window
    this.ctx.fillStyle = '#0f141d';
    this.drawRoundedRect(-w * 0.32, h * 0.14, w * 0.64, h * 0.15, 5, true, false);

    // 8. Side Mirrors
    this.ctx.fillStyle = this.shadeColor(this.playerCarColor, -20);
    this.drawRoundedRect(-w / 2 - 5, -h * 0.16, 5, 8, 2, true, false);
    this.drawRoundedRect(w / 2, -h * 0.16, 5, 8, 2, true, false);

    // 9. Rear Wing / Aerodynamic Spoiler
    this.ctx.fillStyle = '#111215';
    this.drawRoundedRect(-w * 0.46, h * 0.36, w * 0.92, 7, 3, true, false);

    // 10. Front Headlights (Bright Xenon Cyan/White)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.drawRoundedRect(-w * 0.38, -h / 2 + 2, 7, 5, 2, true, false);
    this.drawRoundedRect(w * 0.38 - 7, -h / 2 + 2, 7, 5, 2, true, false);

    // 11. Rear LED Taillights (Glowing Red)
    this.ctx.shadowColor = '#ff1e42';
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = '#ff1e42';
    this.drawRoundedRect(-w * 0.42, h / 2 - 4, 9, 4, 2, true, false);
    this.drawRoundedRect(w * 0.42 - 9, h / 2 - 4, 9, 4, 2, true, false);

    this.ctx.restore();
  }

  // Draw Varied Enemy Vehicles
  drawEnemies() {
    for (const e of this.enemies) {
      this.ctx.save();
      this.ctx.translate(e.x, e.y);

      // Car Shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.drawRoundedRect(-e.width / 2 - 2, -e.height / 2 + 3, e.width + 4, e.height + 4, 10, true, false);

      // Tires
      this.ctx.fillStyle = '#141416';
      const tireW = 6;
      const tireH = 16;
      this.drawRoundedRect(-e.width / 2 - 2, -e.height * 0.35, tireW, tireH, 2, true, false);
      this.drawRoundedRect(e.width / 2 - tireW + 2, -e.height * 0.35, tireW, tireH, 2, true, false);
      this.drawRoundedRect(-e.width / 2 - 2, e.height * 0.18, tireW, tireH, 2, true, false);
      this.drawRoundedRect(e.width / 2 - tireW + 2, e.height * 0.18, tireW, tireH, 2, true, false);

      // Car Body
      const bodyGrad = this.ctx.createLinearGradient(-e.width / 2, 0, e.width / 2, 0);
      bodyGrad.addColorStop(0, this.shadeColor(e.color, -25));
      bodyGrad.addColorStop(0.3, e.color);
      bodyGrad.addColorStop(0.7, e.color);
      bodyGrad.addColorStop(1, this.shadeColor(e.color, -25));

      this.ctx.fillStyle = bodyGrad;
      this.drawRoundedRect(-e.width / 2, -e.height / 2, e.width, e.height, 12, true, false);

      // Distinct Model Features
      if (e.modelType === 'taxi') {
        // Taxi Roof Sign & Checkers
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-e.width * 0.25, -5, e.width * 0.5, 9);
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 7px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TAXI', 0, 2);
      } else if (e.modelType === 'sport') {
        // Supercar Spoiler & Hood Vent
        this.ctx.fillStyle = '#151515';
        this.drawRoundedRect(-e.width * 0.42, e.height * 0.35, e.width * 0.84, 6, 2, true, false);
      } else if (e.modelType === 'muscle') {
        // Muscle Dual Hood Scoops
        this.ctx.fillStyle = '#111111';
        this.ctx.fillRect(-7, -e.height * 0.32, 5, 10);
        this.ctx.fillRect(2, -e.height * 0.32, 5, 10);
      }

      // Windshield & Rear Window (Enemy cars face DOWNWARD)
      // Front is facing down towards player!
      this.ctx.fillStyle = '#161c28';
      // Front Windshield (Bottom facing)
      this.drawRoundedRect(-e.width * 0.35, e.height * 0.05, e.width * 0.7, e.height * 0.22, 6, true, false);
      // Rear Window (Top facing)
      this.drawRoundedRect(-e.width * 0.32, -e.height * 0.32, e.width * 0.64, e.height * 0.16, 5, true, false);

      // Front Headlights (Facing DOWN)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 6;
      this.drawRoundedRect(-e.width * 0.38, e.height / 2 - 5, 6, 4, 2, true, false);
      this.drawRoundedRect(e.width * 0.38 - 6, e.height / 2 - 5, 6, 4, 2, true, false);

      // Rear Taillights (Facing UP)
      this.ctx.shadowColor = '#ff1e42';
      this.ctx.shadowBlur = 6;
      this.ctx.fillStyle = '#ff1e42';
      this.drawRoundedRect(-e.width * 0.4, -e.height / 2 + 2, 7, 3, 2, true, false);
      this.drawRoundedRect(e.width * 0.4 - 7, -e.height / 2 + 2, 7, 3, 2, true, false);

      this.ctx.restore();
    }
  }

  // Draw 3D-Animated Rotating Gold Coins
  drawCoins() {
    for (const c of this.coins) {
      this.ctx.save();
      this.ctx.translate(c.x, c.y);

      // 3D Perspective Spin (Horizontal Scale)
      const scaleX = Math.cos(c.rotation);

      // Coin Soft Glow
      this.ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, c.radius + 6, 0, Math.PI * 2);
      this.ctx.fill();

      // Outer Coin Rim
      this.ctx.fillStyle = '#d49b00';
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, Math.max(1, Math.abs(scaleX) * c.radius), c.radius, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Inner Coin Face
      const coinGrad = this.ctx.createLinearGradient(-c.radius, -c.radius, c.radius, c.radius);
      coinGrad.addColorStop(0, '#ffe566');
      coinGrad.addColorStop(0.5, '#ffd700');
      coinGrad.addColorStop(1, '#c99700');

      this.ctx.fillStyle = coinGrad;
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, Math.max(1, Math.abs(scaleX) * (c.radius - 2.5)), c.radius - 2.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Star / Dollar Emboss on coin face
      if (Math.abs(scaleX) > 0.4) {
        this.ctx.fillStyle = '#996f00';
        this.ctx.font = `bold ${Math.round(c.radius * 1.1)}px "Orbitron", sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('$', 0, 1);
      }

      this.ctx.restore();
    }
  }

  // Helper: Draw Rounded Rectangles
  drawRoundedRect(x, y, w, h, r, fill, stroke) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
    if (fill) this.ctx.fill();
    if (stroke) this.ctx.stroke();
  }

  // Helper: Adjust Hex Color Brightness
  shadeColor(color, percent) {
    let num = parseInt(color.replace('#', ''), 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) + amt;
    let G = (num >> 8 & 0x00FF) + amt;
    let B = (num & 0x0000FF) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }

  // =========================================================================
  // 6. MAIN GAME LOOP (requestAnimationFrame with Delta Time)
  // =========================================================================
  loop(timestamp) {
    // Delta time calculation clamped to avoid huge step jumps on tab switch
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}

// Instantiate and Boot Game when DOM is Ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new SpeedRushGame();
});
