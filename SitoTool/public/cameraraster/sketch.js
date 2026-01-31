/**
 * ██████╗  █████╗ ███████╗████████╗███████╗██████╗ 
 * ██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
 * ██████╔╝███████║███████╗   ██║   █████╗  ██████╔╝
 * ██╔══██╗██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
 * ██║  ██║██║  ██║███████║   ██║   ███████╗██║  ██║
 * ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
 * 
 * PROFESSIONAL CAMERA RASTERIZER v2.0
 * A premium real-time video effect processor
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
    captureW: 640,
    captureH: 480,
    UI_WIDTH: 320
};

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════

let video;
let previousBrightness = [];
let particles = [];
let noiseOffset = 0;

// Recording state
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Parameters (controlled by UI)
const params = {
    // Core
    resolution: 10,
    ghosting: 0.3,  // 0 = no ghosting, 1 = max ghosting
    contrast: 1.3,
    brightness: 1.1,
    dotScale: 1.8,  // Multiplier for dot size (1 = same as grid, 2 = overlap)

    // Mode & Style
    mode: 'CIRCLE',  // CIRCLE, SQUARE, ASCII, TRIANGLE, DIAMOND, CROSS
    palette: 'NEON', // NEON, THERMAL, MATRIX, MONO, SUNSET, OCEAN

    // Effects
    scanlines: true,
    vignette: true,
    chromatic: false,
    particles: false,
    glow: true,
    invert: false,
    mirror: true,

    // Animation
    pulse: false,
    wave: false,
    rotate: false
};

// Color Palettes
const PALETTES = {
    NEON: {
        bg: '#0a0a12',
        colors: ['#ff00ff', '#00ffff', '#ff0080', '#80ff00'],
        accent: '#00ffaa'
    },
    THERMAL: {
        bg: '#0a0510',
        colors: ['#1a0530', '#ff0000', '#ff8800', '#ffff00', '#ffffff'],
        accent: '#ff4400'
    },
    MATRIX: {
        bg: '#000800',
        colors: ['#003300', '#00ff00', '#88ff88'],
        accent: '#00ff00'
    },
    MONO: {
        bg: '#080808',
        colors: ['#222222', '#888888', '#ffffff'],
        accent: '#ffffff'
    },
    SUNSET: {
        bg: '#1a0a15',
        colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec'],
        accent: '#ff006e'
    },
    OCEAN: {
        bg: '#051020',
        colors: ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
        accent: '#00b4d8'
    }
};

const ASCII_CHARS = ' ·:;=+*#%@█';
const SHAPES = ['CIRCLE', 'SQUARE', 'ASCII', 'TRIANGLE', 'DIAMOND', 'CROSS'];

// ═══════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════

function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);
    noStroke();

    // Video capture
    video = createCapture(VIDEO);
    video.size(CONFIG.captureW, CONFIG.captureH);
    video.hide();

    // Initialize particles
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: random(width),
            y: random(height),
            vx: random(-1, 1),
            vy: random(-2, -0.5),
            size: random(1, 3),
            alpha: random(0.3, 0.8)
        });
    }

    // Inject UI
    injectStyles();
    createUI();
}

// ═══════════════════════════════════════════════════════════════════
// MAIN DRAW LOOP
// ═══════════════════════════════════════════════════════════════════

function draw() {
    const pal = PALETTES[params.palette];
    background(pal.bg);

    video.loadPixels();
    if (video.pixels.length === 0) return;

    // Calculate render dimensions (cover screen)
    const zoomFactor = Math.max(width / CONFIG.captureW, height / CONFIG.captureH);
    const renderW = CONFIG.captureW * zoomFactor;
    const renderH = CONFIG.captureH * zoomFactor;
    const offsetX = (width - renderW) / 2;
    const offsetY = (height - renderH) / 2;

    // Animation offsets
    const elapsedSec = millis() / 1000;
    const pulseAmt = params.pulse ? sin(elapsedSec * 2) * 0.2 : 0;

    push();
    translate(offsetX, offsetY);

    // Rotation effect
    if (params.rotate) {
        translate(renderW / 2, renderH / 2);
        rotate(sin(elapsedSec * 0.5) * 0.02);
        translate(-renderW / 2, -renderH / 2);
    }

    const step = params.resolution;
    const cols = Math.ceil(CONFIG.captureW / step);
    const rows = Math.ceil(CONFIG.captureH / step);

    // Resize brightness cache if needed
    if (previousBrightness.length !== cols * rows) {
        previousBrightness = new Array(cols * rows).fill(0);
    }

    let idx = 0;

    for (let gy = 0; gy < CONFIG.captureH; gy += step) {
        for (let gx = 0; gx < CONFIG.captureW; gx += step) {

            // Sample video pixel
            const px = Math.floor(gx + step / 2);
            const py = Math.floor(gy + step / 2);
            const vidIdx = (py * video.width + px) * 4;

            if (vidIdx >= 0 && vidIdx < video.pixels.length - 3) {
                let r = video.pixels[vidIdx];
                let g = video.pixels[vidIdx + 1];
                let b = video.pixels[vidIdx + 2];

                // Calculate brightness
                let bright = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                bright = Math.pow(bright, params.contrast) * params.brightness;
                if (params.invert) bright = 1 - bright;
                bright = constrain(bright, 0, 1);

                // Lag/ghosting
                const prev = previousBrightness[idx] || 0;
                // Fix: Map slider (0-2) to speed (1.0-0.02) to prevent negative values
                const lerpSpeed = map(params.ghosting, 0, 2, 1.0, 0.02, true);
                const current = lerp(prev, bright, lerpSpeed);
                previousBrightness[idx] = current;

                // Wave effect
                let waveOffset = 0;
                if (params.wave) {
                    waveOffset = sin(gx * 0.05 + elapsedSec * 3) * step * 0.3;
                }

                // Calculate draw position
                let dx = params.mirror
                    ? map(gx, 0, CONFIG.captureW, renderW, 0)  // Mirrored
                    : map(gx, 0, CONFIG.captureW, 0, renderW);
                let dy = map(gy, 0, CONFIG.captureH, 0, renderH) + waveOffset;

                // Size with pulse and zoomFactor
                let size = current * step * zoomFactor * params.dotScale * (1 + pulseAmt);

                // Get color from palette
                const col = getColorFromPalette(pal, current, r, g, b);

                // Chromatic aberration
                if (params.chromatic && params.mode !== 'ASCII') {
                    const offset = 3 * zoomFactor;
                    fill(red(col), 0, 0, 150);
                    drawShape(dx - offset, dy, size * 0.9);
                    fill(0, 0, blue(col), 150);
                    drawShape(dx + offset, dy, size * 0.9);
                }

                // Draw main shape
                fill(col);
                drawShape(dx, dy, size, current);
            }
            idx++;
        }
    }

    pop();

    // Post-processing effects
    if (params.glow) drawGlow(pal.accent);
    if (params.particles) drawParticles(pal.accent);
    if (params.scanlines) drawScanlines();
    if (params.vignette) drawVignette();

    // FPS counter (debug)
    // fill(255); textSize(12); text(floor(frameRate()) + ' FPS', 10, height - 10);

    noiseOffset += 0.01;
}

// ═══════════════════════════════════════════════════════════════════
// RENDERING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function getColorFromPalette(pal, brightness, r, g, b) {
    const colors = pal.colors;

    if (params.palette === 'THERMAL') {
        // Thermal uses brightness to interpolate through gradient
        const idx = brightness * (colors.length - 1);
        const i = floor(idx);
        const t = idx - i;
        const c1 = color(colors[min(i, colors.length - 1)]);
        const c2 = color(colors[min(i + 1, colors.length - 1)]);
        return lerpColor(c1, c2, t);
    }

    // Other palettes: use brightness for saturation/brightness
    const baseColor = color(colors[floor(brightness * (colors.length - 1))]);
    return baseColor;
}

function drawShape(x, y, size, brightness = 0.5) {
    if (size < 1) return;

    switch (params.mode) {
        case 'CIRCLE':
            ellipse(x, y, size, size);
            break;

        case 'SQUARE':
            rectMode(CENTER);
            rect(x, y, size * 0.9, size * 0.9);
            break;

        case 'TRIANGLE':
            const h = size * 0.866;
            triangle(x, y - h / 2, x - size / 2, y + h / 2, x + size / 2, y + h / 2);
            break;

        case 'DIAMOND':
            const s = size * 0.7;
            quad(x, y - s, x + s, y, x, y + s, x - s, y);
            break;

        case 'CROSS':
            rectMode(CENTER);
            const w = size * 0.3;
            rect(x, y, w, size);
            rect(x, y, size, w);
            break;

        case 'ASCII':
            const charIdx = floor(brightness * (ASCII_CHARS.length - 1));
            const char = ASCII_CHARS.charAt(charIdx);
            textAlign(CENTER, CENTER);
            textSize(size * 1.2);
            text(char, x, y);
            break;
    }
}

// ═══════════════════════════════════════════════════════════════════
// POST-PROCESSING EFFECTS
// ═══════════════════════════════════════════════════════════════════

function drawGlow(accentColor) {
    // Subtle overlay glow on edges
    drawingContext.shadowBlur = 0;
}

function drawScanlines() {
    fill(0, 0, 0, 25);
    for (let y = 0; y < height; y += 3) {
        rect(0, y, width, 1);
    }
}

function drawVignette() {
    // Radial gradient vignette
    const ctx = drawingContext;
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.9
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.7)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function drawNoise() {
    loadPixels();
    for (let i = 0; i < pixels.length; i += 4) {
        const n = random(-15, 15);
        pixels[i] += n;
        pixels[i + 1] += n;
        pixels[i + 2] += n;
    }
    updatePixels();
}

function drawParticles(accentColor) {
    const col = color(accentColor);

    for (let p of particles) {
        // Update
        p.x += p.vx;
        p.y += p.vy;

        // Reset if off screen
        if (p.y < -10) {
            p.y = height + 10;
            p.x = random(width);
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        // Draw
        fill(red(col), green(col), blue(col), p.alpha * 255);
        ellipse(p.x, p.y, p.size);
    }
}

// ═══════════════════════════════════════════════════════════════════
// USER INTERFACE
// ═══════════════════════════════════════════════════════════════════

function createUI() {
    const container = createDiv('');
    container.id('ui-panel');

    // Header
    container.html(`
    <div class="ui-header">
      <div class="logo">RASTER<span>PRO</span></div>
      <div class="version">v2.0</div>
    </div>
  `);

    // Sections
    addSection(container, 'RENDER MODE', createModeButtons());
    addSection(container, 'COLOR PALETTE', createPaletteButtons());
    addSection(container, 'PARAMETERS', createSliders());
    addSection(container, 'EFFECTS', createToggleGrid());
    addSection(container, 'EXPORT', createExportButtons());

    // Footer shortcuts
    const footer = createDiv(`
    <div class="shortcuts">
      <span><kbd>S</kbd> Save</span>
      <span><kbd>R</kbd> Record</span>
      <span><kbd>H</kbd> Hide</span>
    </div>
  `);
    footer.parent(container);
}

function addSection(parent, title, content) {
    const section = createDiv('');
    section.parent(parent);
    section.class('section');

    const header = createDiv(title);
    header.parent(section);
    header.class('section-title');

    content.parent(section);
}

function createModeButtons() {
    const wrapper = createDiv('');
    wrapper.class('btn-grid mode-grid');

    SHAPES.forEach(shape => {
        const btn = createButton(shape.substring(0, 4));
        btn.parent(wrapper);
        btn.class('btn mode-btn' + (params.mode === shape ? ' active' : ''));
        btn.attribute('data-mode', shape);
        btn.mousePressed(() => {
            params.mode = shape;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.elt.classList.add('active');
        });
    });

    return wrapper;
}

function createPaletteButtons() {
    const wrapper = createDiv('');
    wrapper.class('btn-grid palette-grid');

    Object.keys(PALETTES).forEach(name => {
        const pal = PALETTES[name];
        const btn = createButton(name.substring(0, 4));
        btn.parent(wrapper);
        btn.class('btn palette-btn' + (params.palette === name ? ' active' : ''));
        btn.style('border-color', pal.accent);
        btn.attribute('data-palette', name);
        btn.mousePressed(() => {
            params.palette = name;
            document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
            btn.elt.classList.add('active');
        });
    });

    return wrapper;
}

function createSliders() {
    const wrapper = createDiv('');
    wrapper.class('sliders');

    makeSlider(wrapper, 'Resolution', 5, 60, params.resolution, v => params.resolution = v);
    makeSlider(wrapper, 'Dot Scale', 0.5, 3, params.dotScale, v => params.dotScale = v);
    makeSlider(wrapper, 'Ghosting', 0, 1.95, params.ghosting, v => params.ghosting = v);
    makeSlider(wrapper, 'Contrast', 0.5, 3, params.contrast, v => params.contrast = v);
    makeSlider(wrapper, 'Brightness', 0.5, 2.5, params.brightness, v => params.brightness = v);

    return wrapper;
}

function makeSlider(parent, label, min, max, val, callback) {
    const row = createDiv('');
    row.parent(parent);
    row.class('slider-row');

    const lbl = createDiv(`<span>${label}</span><span class="val">${val.toFixed(1)}</span>`);
    lbl.parent(row);
    lbl.class('slider-label');

    const sl = createSlider(min, max, val, (max - min) / 100);
    sl.parent(row);
    sl.class('slider');
    sl.input(() => {
        callback(sl.value());
        lbl.html(`<span>${label}</span><span class="val">${sl.value().toFixed(1)}</span>`);
    });
}

function createToggleGrid() {
    const wrapper = createDiv('');
    wrapper.class('toggle-grid');

    const effects = [
        ['Scanlines', 'scanlines'],
        ['Vignette', 'vignette'],
        ['Chromatic', 'chromatic'],
        ['Particles', 'particles'],
        ['Glow', 'glow'],
        ['Invert', 'invert'],
        ['Mirror', 'mirror'],
        ['Pulse', 'pulse'],
        ['Wave', 'wave'],
        ['Rotate', 'rotate']
    ];

    effects.forEach(([label, key]) => {
        const toggle = createDiv('');
        toggle.parent(wrapper);
        toggle.class('toggle' + (params[key] ? ' active' : ''));
        toggle.html(label);
        toggle.mousePressed(() => {
            params[key] = !params[key];
            toggle.elt.classList.toggle('active');
        });
    });

    return wrapper;
}

function createExportButtons() {
    const wrapper = createDiv('');
    wrapper.class('export-btns');

    const saveBtn = createButton('💾 SAVE FRAME');
    saveBtn.parent(wrapper);
    saveBtn.class('btn export-btn');
    saveBtn.mousePressed(() => saveCanvas('raster_' + Date.now(), 'png'));

    const recordBtn = createButton('⏺ RECORD');
    recordBtn.parent(wrapper);
    recordBtn.id('record-btn');
    recordBtn.class('btn export-btn record-btn');
    recordBtn.mousePressed(toggleRecording);

    const randomBtn = createButton('🎲 RANDOMIZE');
    randomBtn.parent(wrapper);
    randomBtn.class('btn export-btn secondary');
    randomBtn.mousePressed(randomizeParams);

    return wrapper;
}

// ═══════════════════════════════════════════════════════════════════
// VIDEO RECORDING
// ═══════════════════════════════════════════════════════════════════

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    // Hide UI during recording
    const ui = document.getElementById('ui-panel');
    ui.style.opacity = '0';
    ui.style.pointerEvents = 'none';

    // Get canvas stream
    const canvas = document.querySelector('canvas');
    const stream = canvas.captureStream(30); // 30 FPS

    // Setup MediaRecorder
    const options = { mimeType: 'video/webm;codecs=vp9' };
    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        // Fallback if vp9 not supported
        mediaRecorder = new MediaRecorder(stream);
    }

    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };

    mediaRecorder.onstop = () => {
        // Create and download video
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'raster_' + Date.now() + '.webm';
        a.click();
        URL.revokeObjectURL(url);

        // Show UI again
        ui.style.opacity = '1';
        ui.style.pointerEvents = 'auto';
    };

    mediaRecorder.start();
    isRecording = true;

    // Update button
    const btn = document.getElementById('record-btn');
    btn.innerHTML = '⏹ STOP';
    btn.classList.add('recording');

    // Show recording indicator
    showRecordingIndicator(true);
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;

    // Update button
    const btn = document.getElementById('record-btn');
    btn.innerHTML = '⏺ RECORD';
    btn.classList.remove('recording');

    showRecordingIndicator(false);
}

function showRecordingIndicator(show) {
    let indicator = document.getElementById('rec-indicator');

    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'rec-indicator';
            indicator.innerHTML = '⏺ REC';
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'flex';
    } else if (indicator) {
        indicator.style.display = 'none';
    }
}

function randomizeParams() {
    params.mode = random(SHAPES);
    params.palette = random(Object.keys(PALETTES));
    params.resolution = floor(random(8, 25));
    params.contrast = random(0.8, 2.5);

    // Update UI
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === params.mode);
    });
    document.querySelectorAll('.palette-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.palette === params.palette);
    });
}

// ═══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════

function keyPressed() {
    // Don't trigger if typing in input
    if (document.activeElement.tagName === 'INPUT') return;

    switch (key.toLowerCase()) {
        case 's':
            saveCanvas('raster_' + Date.now(), 'png');
            break;
        case 'h':
            const ui = document.getElementById('ui-panel');
            ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
            break;
        case 'r':
            toggleRecording();
            break;
        case 'x':
            randomizeParams();
            break;
        case 'm':
            params.mirror = !params.mirror;
            break;
        case 'g':
            params.glow = !params.glow;
            break;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

function injectStyles() {
    const css = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
    
    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      overflow: hidden;
      background: #000;
      font-family: 'JetBrains Mono', monospace;
    }
    
    canvas {
      display: block;
    }
    
    #ui-panel {
      position: fixed;
      top: 20px;
      left: 20px;
      width: 300px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      background: rgba(8, 8, 15, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 0;
      color: #fff;
      box-shadow: 
        0 25px 50px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    
    #ui-panel::-webkit-scrollbar {
      width: 6px;
    }
    
    #ui-panel::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
    }
    
    .ui-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, rgba(0, 255, 170, 0.1), rgba(255, 0, 128, 0.1));
    }
    
    .logo {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    
    .logo span {
      color: #00ffaa;
    }
    
    .version {
      font-size: 10px;
      color: #666;
      background: rgba(255, 255, 255, 0.05);
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    .section {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .section-title {
      font-size: 10px;
      font-weight: 500;
      color: #666;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    
    .btn-grid {
      display: grid;
      gap: 6px;
    }
    
    .mode-grid { grid-template-columns: repeat(4, 1fr); }
    .palette-grid { grid-template-columns: repeat(3, 1fr); }
    
    .btn {
      padding: 8px 4px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      color: #888;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      transform: translateY(-1px);
    }
    
    .btn.active {
      background: rgba(0, 255, 170, 0.15);
      border-color: #00ffaa;
      color: #00ffaa;
      box-shadow: 0 0 20px rgba(0, 255, 170, 0.2);
    }
    
    .sliders {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    
    .slider-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #888;
    }
    
    .slider-label .val {
      color: #00ffaa;
      font-weight: 500;
    }
    
    .slider {
      -webkit-appearance: none;
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      cursor: pointer;
    }
    
    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: #00ffaa;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(0, 255, 170, 0.5);
      transition: transform 0.1s;
    }
    
    .slider::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }
    
    .toggle-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    
    .toggle {
      padding: 8px 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      color: #555;
      font-size: 9px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }
    
    .toggle:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    
    .toggle.active {
      background: rgba(0, 255, 170, 0.1);
      border-color: rgba(0, 255, 170, 0.3);
      color: #00ffaa;
    }
    
    .export-btns {
      display: flex;
      gap: 8px;
    }
    
    .export-btn {
      flex: 1;
      padding: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .export-btn:not(.secondary) {
      background: linear-gradient(135deg, #00ffaa, #00cc88);
      border: none;
      color: #000;
    }
    
    .export-btn:not(.secondary):hover {
      background: linear-gradient(135deg, #00ffcc, #00ffaa);
      box-shadow: 0 0 30px rgba(0, 255, 170, 0.4);
    }
    
    .export-btn.secondary {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
    }
    
    .shortcuts {
      display: flex;
      justify-content: center;
      gap: 16px;
      padding: 12px;
      font-size: 10px;
      color: #444;
    }
    
    kbd {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      font-family: inherit;
      margin-right: 4px;
    }
    
    /* Recording styles */
    .record-btn.recording {
      background: linear-gradient(135deg, #ff4444, #cc0000) !important;
      animation: pulse-rec 1s infinite;
    }
    
    @keyframes pulse-rec {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    #rec-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: pulse-rec 1s infinite;
      z-index: 9999;
    }
  `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}