/**
 * RASTER-TYPE ANIMATION (p5.js)
 *
 * Features:
 * - Particle-based text visualization
 * - Perlin noise driven movement
 * - Shapes: Circle, Square, Diamond
 * - Interactive UI
 * - Video Export (WebM/MP4)
 */

let pg;                 // Text buffer (alpha mask)
let ui = {};
let currentFont = null;

let canvasMode = "Window";
let guiVisible = true;

// Particles
let particles = [];
let particleConfig = {
    spacing: 8,
    noiseScale: 0.02,
    noiseSpeed: 0.01,
    size: 4,
    returnForce: 0.05,
    shape: "Circle", // Circle, Square, Diamond
    color: "#ffffff"
};

// Video Recording
let recorder;
let chunks = [];
let isRecording = false;


// Pan/Zoom & Artboard
let artboard = { w: 800, h: 800 }; // logical size
let view = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let startPan = { x: 0, y: 0 };

/* =========================================================
   SETUP / RESIZE
   ========================================================= */

function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);

    // Initial artboard setup
    artboard.w = windowWidth;
    artboard.h = windowHeight;

    pg = createGraphics(artboard.w, artboard.h);
    pg.pixelDensity(1);

    buildUI();
    centerView(); // Center artboard on start

    // Initial spawn
    renderTextToBuffer();
    spawnParticles();

    loop(); // Animation is active
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);

    if (canvasMode === "Window") {
        applyCanvasSize();
    }
}

function applyCanvasSize() {
    let w, h;
    if (canvasMode === "Window") {
        w = windowWidth;
        h = windowHeight;
        ui.canvasW.value(w);
        ui.canvasH.value(h);
    } else {
        w = parseInt(ui.canvasW.value(), 10);
        h = parseInt(ui.canvasH.value(), 10);
        if (!Number.isFinite(w)) w = 800;
        if (!Number.isFinite(h)) h = 800;
    }

    artboard.w = constrain(w, 100, 8000);
    artboard.h = constrain(h, 100, 8000);

    pg = createGraphics(artboard.w, artboard.h);
    pg.pixelDensity(1);

    centerView();
    renderTextToBuffer();
    spawnParticles();
}

function centerView() {
    const margin = 50;
    const availW = width - margin * 2;
    const availH = height - margin * 2;
    const scaleW = availW / artboard.w;
    const scaleH = availH / artboard.h;
    view.zoom = min(scaleW, scaleH, 1.0);
    view.x = (width - artboard.w * view.zoom) / 2;
    view.y = (height - artboard.h * view.zoom) / 2;
}

function updateCanvasUIVisibility() {
    const isCustom = canvasMode === "Custom Artboard";
    const display = isCustom ? "grid" : "none";
    const btnDisplay = isCustom ? "block" : "none";

    if (ui.canvasWWrap) ui.canvasWWrap.style("display", display);
    if (ui.canvasHWrap) ui.canvasHWrap.style("display", display);
    if (ui.applyCanvasBtn) ui.applyCanvasBtn.style("display", btnDisplay);
}

function updateBlurUIVisibility() {
    const show = ui.blurOn.checked();
    ui.blurAmtWrap.style("display", show ? "grid" : "none");
}

function updateOrganicUIVisibility() {
    const show = ui.organicPtr.checked();
    const style = show ? "grid" : "none";
    if (ui.organicSpeedWrap) ui.organicSpeedWrap.style("display", style);
    if (ui.organicDistortWrap) ui.organicDistortWrap.style("display", style);
}

/* =========================================================
   UI
   ========================================================= */

function buildUI() {
    const wrap = createDiv();
    ui.wrap = wrap;

    wrap.style("position", "fixed");
    wrap.style("left", "16px");
    wrap.style("top", "16px");
    wrap.style("padding", "16px");
    wrap.style("background", "rgba(15, 15, 15, 0.85)");
    wrap.style("backdrop-filter", "blur(12px)");
    wrap.style("border-radius", "16px");
    wrap.style("box-shadow", "0 4px 30px rgba(0, 0, 0, 0.5)");
    wrap.style("color", "#ececec");
    wrap.style("font-family", "Inter, system-ui, -apple-system, sans-serif");
    wrap.style("z-index", "9999");
    wrap.style("max-width", "360px");
    wrap.style("max-height", "90vh");
    wrap.style("overflow-y", "auto");
    wrap.style("overflow-x", "hidden");
    wrap.style("font-size", "13px");

    // Scrollbar styling
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
    `;
    wrap.elt.appendChild(styleSheet);


    const title = createDiv("Particle Type");
    title.style("font-weight", "800");
    title.style("font-size", "16px");
    title.style("letter-spacing", "-0.02em");
    title.style("margin-bottom", "16px");
    title.style("border-bottom", "1px solid rgba(255,255,255,0.15)");
    title.style("padding-bottom", "12px");
    title.parent(wrap);

    // --- CANVAS SECTION ---
    createSectionHeader("Canvas", wrap);

    ui.canvasMode = createSelect();
    ui.canvasMode.option("Window");
    ui.canvasMode.option("Custom Artboard");
    ui.canvasMode.selected(canvasMode);
    label("Mode", ui.canvasMode, wrap);
    styleInput(ui.canvasMode);

    ui.canvasW = createInput(String(windowWidth), "number");
    ui.canvasH = createInput(String(windowHeight), "number");
    ui.canvasWWrap = label("Width", ui.canvasW, wrap);
    ui.canvasHWrap = label("Height", ui.canvasH, wrap);
    styleInput(ui.canvasW);
    styleInput(ui.canvasH);

    ui.applyCanvasBtn = createButton("Apply Artboard Size");
    ui.applyCanvasBtn.parent(wrap);
    ui.applyCanvasBtn.class("btn-primary");
    ui.applyCanvasBtn.style("width", "100%");
    styleButton(ui.applyCanvasBtn);
    ui.applyCanvasBtn.style("margin", "8px 0 2px 0");

    // --- CONTENT SECTION ---
    createDiv("").style("height", "12px").parent(wrap); // Spacer
    createSectionHeader("Content", wrap);

    ui.text = createInput("INK", "text");
    label("Text (| for break)", ui.text, wrap);
    styleInput(ui.text);

    // Font upload row
    const fontRow = createDiv();
    fontRow.parent(wrap);
    fontRow.style("display", "grid");
    fontRow.style("grid-template-columns", "1fr auto");
    fontRow.style("gap", "8px");
    fontRow.style("align-items", "center");
    fontRow.style("margin-top", "6px");

    ui.fontFile = createFileInput(handleFontFile, false);
    ui.fontFile.parent(fontRow);
    ui.fontFile.elt.accept = ".ttf,.otf";
    ui.fontFile.style("color", "#aaa");

    ui.resetFontBtn = createButton("↺ Default");
    ui.resetFontBtn.parent(fontRow);
    styleButton(ui.resetFontBtn);

    // --- LAYOUT SECTION ---
    createDiv("").style("height", "12px").parent(wrap); // Spacer
    createSectionHeader("Layout", wrap);

    ui.size = createSlider(20, 600, 320, 1);
    label("Size", ui.size, wrap);

    ui.tracking = createSlider(-40, 120, 0, 1);
    label("Tracking", ui.tracking, wrap);

    ui.centerX = createSlider(0, 100, 50, 1);
    label("Position X", ui.centerX, wrap);

    ui.centerY = createSlider(0, 100, 55, 1);
    label("Position Y", ui.centerY, wrap);

    // --- PARTICLES SECTION ---
    createDiv("").style("height", "12px").parent(wrap);
    createSectionHeader("Particles", wrap);

    // Spacing (Density)
    ui.spacing = createSlider(4, 50, 8, 1);
    label("Spacing", ui.spacing, wrap);

    // Colors
    const colorRow = createDiv();
    colorRow.parent(wrap);
    colorRow.style("display", "grid");
    colorRow.style("grid-template-columns", "1fr 1fr");
    colorRow.style("gap", "12px");
    colorRow.style("margin", "6px 0");

    const bgGrp = createDiv();
    bgGrp.parent(colorRow);
    bgGrp.style("display", "flex");
    bgGrp.style("flex-direction", "column");
    bgGrp.style("gap", "4px");
    createDiv("Background").parent(bgGrp).style("font-size", "11px").style("opacity", "0.6");
    ui.bg = createColorPicker("#1C1C1C");
    ui.bg.parent(bgGrp);
    styleColorPicker(ui.bg);

    const pColorGrp = createDiv();
    pColorGrp.parent(colorRow);
    pColorGrp.style("display", "flex");
    pColorGrp.style("flex-direction", "column");
    pColorGrp.style("gap", "4px");
    createDiv("Particle").parent(pColorGrp).style("font-size", "11px").style("opacity", "0.6");
    ui.color = createColorPicker("#FFFFFF");
    ui.color.parent(pColorGrp);
    styleColorPicker(ui.color);

    // Shape
    ui.shape = createSelect();
    ui.shape.option("Circle");
    ui.shape.option("Square");
    ui.shape.option("Diamond");
    ui.shape.selected("Circle");
    label("Shape", ui.shape, wrap);
    styleInput(ui.shape);

    ui.pSize = createSlider(1, 20, 4, 0.5);
    label("Point Size", ui.pSize, wrap);

    // --- ANIMATION SECTION ---
    createDiv("").style("height", "12px").parent(wrap);
    createSectionHeader("Animation", wrap);

    ui.noiseScale = createSlider(0.001, 0.1, 0.02, 0.001);
    label("Noise Scale", ui.noiseScale, wrap);

    ui.noiseSpeed = createSlider(0, 0.05, 0.01, 0.001);
    label("Noise Speed", ui.noiseSpeed, wrap);

    ui.interaction = createSlider(0, 800, 50, 10);
    label("Mouse Radius", ui.interaction, wrap);

    ui.organicPtr = createCheckbox("", false);
    ui.organicPtr.style("margin", "0");
    label("Organic Pointer", ui.organicPtr, wrap);

    ui.organicSpeed = createSlider(0.001, 1, 0.02, 0.001);
    ui.organicSpeedWrap = label("Organic Speed", ui.organicSpeed, wrap);

    ui.organicDistort = createSlider(0, 3, 1, 0.1);
    ui.organicDistortWrap = label("Distortion", ui.organicDistort, wrap);

    // Blur (Mask)
    ui.blurOn = createCheckbox("", false);
    ui.blurOn.style("margin", "0");
    label("Blur Mask", ui.blurOn, wrap);

    ui.blurAmt = createSlider(0, 20, 3, 0.1);
    ui.blurAmtWrap = label("Blur Amount", ui.blurAmt, wrap);

    // --- EXPORT SECTION ---
    createDiv("").style("height", "12px").parent(wrap);
    createSectionHeader("Export", wrap);

    ui.recordBtn = createButton("● Record Video");
    ui.recordBtn.parent(wrap);
    styleButton(ui.recordBtn);
    ui.recordBtn.style("width", "100%");
    ui.recordBtn.style("background", "#cc3333");
    ui.recordBtn.style("margin-top", "4px");
    ui.recordBtn.mouseOver(() => {
        if (!isRecording) ui.recordBtn.style("background", "#ff4444");
    });
    ui.recordBtn.mouseOut(() => {
        if (!isRecording) ui.recordBtn.style("background", "#cc3333");
    });

    // --- HOTKEYS HINT ---
    const hr = createDiv("");
    hr.style("height", "1px");
    hr.style("background", "rgba(255,255,255,0.15)");
    hr.style("margin", "16px 0 10px 0");
    hr.parent(wrap);

    const hint = createDiv("<b>Shortcuts:</b> [R] Record · [S] PNG · [H] GUI");
    hint.style("opacity", "0.6");
    hint.style("text-align", "center");
    hint.style("font-size", "11px");
    hint.parent(wrap);

    // --- UI EVENT BINDING ---
    bindEvents();

    // Initial state
    canvasMode = ui.canvasMode.value();
    updateCanvasUIVisibility();
    updateBlurUIVisibility();
    updateOrganicUIVisibility();
}


function createSectionHeader(txt, parent) {
    const h = createDiv(txt);
    h.parent(parent);
    h.style("font-weight", "600");
    h.style("font-size", "11px");
    h.style("text-transform", "uppercase");
    h.style("letter-spacing", "0.05em");
    h.style("opacity", "0.5");
    h.style("margin-bottom", "8px");
}

function label(txt, el, parent, highlight = false) {
    const row = createDiv();
    row.parent(parent);
    row.style("display", "grid");
    row.style("grid-template-columns", "100px 1fr");
    row.style("gap", "12px");
    row.style("align-items", "center");
    row.style("margin", "6px 0");

    const l = createDiv(txt);
    l.style("font-size", "12px");
    l.style("opacity", highlight ? "1.0" : "0.85");
    if (highlight) {
        l.style("font-weight", "700");
        l.style("color", "#fff");
    }
    l.parent(row);

    el.parent(row);
    el.style("width", "100%");
    if (el.elt.type === 'color') el.style("height", "24px");

    return row;
}

function styleButton(btn) {
    btn.style("background", "rgba(255,255,255,0.1)");
    btn.style("border", "none");
    btn.style("padding", "4px 8px");
    btn.style("border-radius", "4px");
    btn.style("color", "white");
    btn.style("cursor", "pointer");
    btn.style("font-size", "11px");
    btn.mouseOver(() => btn.style("background", "rgba(255,255,255,0.2)"));
    btn.mouseOut(() => btn.style("background", "rgba(255,255,255,0.1)"));
}

function styleInput(el) {
    el.style("border-radius", "4px");
    el.style("background", "rgba(0,0,0,0.25)");
    el.style("border", "1px solid rgba(255,255,255,0.15)");
    el.style("color", "white");
    el.style("padding", "4px 8px");
    el.style("outline", "none");
    el.style("font-family", "inherit");

    el.elt.onfocus = () => el.style("border", "1px solid rgba(255,255,255,0.4)");
    el.elt.onblur = () => el.style("border", "1px solid rgba(255,255,255,0.15)");
}

function styleColorPicker(el) {
    el.style("width", "100%");
    el.style("height", "28px");
    el.style("border", "none");
    el.style("padding", "0");
    el.style("background", "none");
    el.style("cursor", "pointer");
}

function bindEvents() {
    // Canvas Resize
    ui.canvasMode.changed(() => {
        canvasMode = ui.canvasMode.value();
        updateCanvasUIVisibility();
        if (canvasMode === "Window") applyCanvasSize();
    });

    ui.applyCanvasBtn.mousePressed(() => {
        canvasMode = "Custom Artboard";
        ui.canvasMode.selected(canvasMode);
        applyCanvasSize();
    });

    // Font reset
    ui.resetFontBtn.mousePressed(() => {
        currentFont = null;
        renderTextToBuffer();
        spawnParticles();
    });

    // Text changes
    ui.text.input(() => {
        renderTextToBuffer();
        spawnParticles();
    });

    // Toggle Visibility
    ui.organicPtr.changed(() => {
        updateOrganicUIVisibility();
    });

    ui.blurOn.changed(() => {
        updateBlurUIVisibility();
    });

    // Param changes that affect spawn
    const spawnTriggers = [ui.size, ui.tracking, ui.centerX, ui.centerY, ui.spacing, ui.blurOn, ui.blurAmt];
    spawnTriggers.forEach(el => {
        el.input(() => {
            renderTextToBuffer();
            spawnParticles();
            // Also need to update blur visibility
            if (el === ui.blurOn) updateBlurUIVisibility();
        });
    });

    // Recording
    ui.recordBtn.mousePressed(() => {
        toggleRecording();
    });
}

function handleFontFile(file) {
    if (!file) return;
    if (file.type !== "font" && !isFontName(file.name)) return;

    const blob = file.file;
    const url = URL.createObjectURL(blob);

    loadFont(url, (f) => {
        currentFont = f;
        renderTextToBuffer();
        spawnParticles();
    }, (err) => console.log("Font load error:", err));
}
function isFontName(name) {
    const n = (name || "").toLowerCase();
    return n.endsWith(".ttf") || n.endsWith(".otf");
}


/* =========================================================
   PARTICLE SYSTEM
   ========================================================= */

class Particle {
    constructor(x, y) {
        this.origin = createVector(x, y);
        this.pos = this.origin.copy();
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
    }

    update() {
        // Perlin Noise
        const nScale = ui.noiseScale.value();
        const time = frameCount * ui.noiseSpeed.value();
        // Use origin for noise field stability or pos for flow?
        // Using pos makes them follow a flow. Using origin makes them wiggle in place.
        // User asked for "randomizing the movement around the text".
        // Let's use pos for flow-like wiggle.
        const n = noise(this.pos.x * nScale, this.pos.y * nScale, time);

        // Map noise to angle
        const angle = n * TWO_PI * 4; // 4 loops of rotation
        const force = p5.Vector.fromAngle(angle);
        force.mult(0.1);

        this.acc.add(force);

        // Mouse Interaction (Push away)
        let mouse = createVector(mouseX, mouseY);
        // Correct mouse coord if pan/zoom
        if (canvasMode === "Custom Artboard") {
            mouse.x = (mouseX - view.x) / view.zoom;
            mouse.y = (mouseY - view.y) / view.zoom;
        }

        let d = this.pos.dist(mouse);
        let radius = ui.interaction.value();

        if (ui.organicPtr.checked()) {
            const dx = this.pos.x - mouse.x;
            const dy = this.pos.y - mouse.y;
            const angle = atan2(dy, dx);
            const time = frameCount * ui.organicSpeed.value();

            // Polar noise wrap with rotation
            // noise(cos(angle + time), sin(angle + time), time)
            // Adding time to angle makes it rotate/swirl
            const noiseVal = noise(cos(angle + time) + 10, sin(angle + time) + 10, time);

            // Map noise to multiplier based on distortion
            const distort = ui.organicDistort.value();
            const multiplier = map(noiseVal, 0, 1, 1 - distort * 0.5, 1 + distort * 0.5);

            radius *= multiplier;
        }

        if (d < radius && radius > 0) {
            let push = p5.Vector.sub(this.pos, mouse);
            push.normalize();
            let strength = map(d, 0, radius, 2, 0);
            push.mult(strength);
            this.acc.add(push);
        }

        // Return to origin (Spring)
        let dir = p5.Vector.sub(this.origin, this.pos);
        let dist = dir.mag();
        if (dist > 0) {
            dir.normalize();
            // Spring force proportional to distance
            // But we want them to float a bit, so weak spring
            dir.mult(dist * 0.02);
            this.acc.add(dir);
        }

        // Physics
        this.vel.add(this.acc);
        this.vel.mult(0.92); // Friction
        this.pos.add(this.vel);
        this.acc.mult(0);
    }

    draw(shape, size) {
        if (shape === "Circle") {
            circle(this.pos.x, this.pos.y, size);
        } else if (shape === "Square") {
            square(this.pos.x, this.pos.y, size);
        } else if (shape === "Diamond") {
            push();
            translate(this.pos.x, this.pos.y);
            rotate(PI / 4);
            square(0, 0, size * 0.8);
            pop();
        }
    }
}

function spawnParticles() {
    particles = [];
    const spacing = ui.spacing.value();

    pg.loadPixels();

    // We only scan based on spacing
    for (let x = 0; x < artboard.w; x += spacing) {
        for (let y = 0; y < artboard.h; y += spacing) {
            const idx = 4 * (Math.floor(y) * pg.width + Math.floor(x));
            const a = pg.pixels[idx + 3];

            if (a > 20) { // Threshold
                particles.push(new Particle(x, y));
            }
        }
    }
}

function renderTextToBuffer() {
    pg.clear();
    pg.push();
    pg.background(0, 0);
    pg.noStroke();
    pg.fill(255);

    if (currentFont) pg.textFont(currentFont);
    pg.textSize(ui.size.value());
    pg.textAlign(LEFT, CENTER);

    const tracking = Number(ui.tracking.value()) || 0;
    const tx = artboard.w * (ui.centerX.value() / 100);
    const ty = artboard.h * (ui.centerY.value() / 100);
    const raw = String(ui.text.value() || "");
    const lines = raw.split("|");
    const lineH = ui.size.value() * 1.05;

    const blockH = (lines.length - 1) * lineH;
    const yStart = ty - blockH / 2;

    for (let li = 0; li < lines.length; li++) {
        const lineStr = lines[li];
        let totalW = 0;
        for (let i = 0; i < lineStr.length; i++) {
            totalW += pg.textWidth(lineStr[i]);
            if (i < lineStr.length - 1) totalW += tracking;
        }

        let x = tx - totalW / 2;
        const y = yStart + li * lineH;

        for (let i = 0; i < lineStr.length; i++) {
            const ch = lineStr[i];
            pg.text(ch, x, y);
            x += pg.textWidth(ch) + tracking;
        }
    }

    // Apply blur if set
    if (ui.blurOn.checked()) {
        const amt = Number(ui.blurAmt.value());
        if (amt > 0) pg.filter(BLUR, amt);
    }

    pg.pop();
    pg.loadPixels(); // Ensure pixels are ready for spawnParticles
}

/* =========================================================
   DRAW LOOP
   ========================================================= */

function draw() {
    let bg = color(ui.bg.value());

    // Clear background
    if (canvasMode === "Window") {
        background(bg);
    } else {
        background(20); // Workspace bg
    }

    // Transform for View
    push();
    if (canvasMode === "Custom Artboard") {
        translate(view.x, view.y);
        scale(view.zoom);

        // Draw Artboard bounds
        noStroke();
        fill(bg);
        rect(0, 0, artboard.w, artboard.h);

        // Clip to artboard? Optional, but looks nicer
        // But clipping in p5 can be slow. Let's just draw on top.
    }

    // Render Particles
    noStroke();
    fill(ui.color.value());

    // Shape Mode
    // CENTER is good for all
    rectMode(CENTER);

    const pSize = ui.pSize.value();
    const pShape = ui.shape.value();

    for (let p of particles) {
        p.update();
        p.draw(pShape, pSize);
    }

    pop();

    // Recording visual indicator
    if (isRecording) {
        push();
        fill(255, 0, 0);
        noStroke();
        if (frameCount % 60 < 30) {
            circle(width - 30, 30, 20);
        }
        pop();
    }
}

// Organic Pointer Visualization Removed

/* =========================================================
   VIDEO RECORDING
   ========================================================= */

function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

function startRecording() {
    chunks = [];
    const canvas = document.querySelector('canvas');
    const stream = canvas.captureStream(60); // 60 fps

    let mimeType = 'video/webm';
    try {
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            recorder = new MediaRecorder(stream, { mimeType: mimeType });
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
            mimeType = 'video/webm;codecs=h264';
            recorder = new MediaRecorder(stream, { mimeType: mimeType });
        } else {
            recorder = new MediaRecorder(stream, { mimeType: mimeType });
        }
    } catch (e) {
        console.error("MediaRecorder error:", e);
        alert("Recording failed to start.");
        return;
    }

    recorder.mimeType = mimeType; // Store for export

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => exportVideo(mimeType);

    recorder.start();
    isRecording = true;
    ui.recordBtn.html("■ Stop Recording");
    ui.recordBtn.style("background", "#ff0000"); // bright red
    ui.recordBtn.style("animation", "pulse 1s infinite");
}

function stopRecording() {
    recorder.stop();
    isRecording = false;
    ui.recordBtn.html("● Record Video");
    ui.recordBtn.style("background", "#cc3333");
    ui.recordBtn.style("animation", "none");
}

function exportVideo(mimeType) {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    a.download = `particle-anim-${timestampString()}.${ext}`;

    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

function timestampString() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${YYYY}${MM}${DD}-${hh}${mm}${ss}`;
}

/* =========================================================
   INTERACTION
   ========================================================= */

function mouseWheel(event) {
    if (isTypingInUI()) return;
    if (canvasMode !== "Custom Artboard") return;

    const zoomSensitivity = 0.001;
    const newZoom = constrain(view.zoom - event.delta * zoomSensitivity, 0.05, 5.0);

    const mouseXWorld = (mouseX - view.x) / view.zoom;
    const mouseYWorld = (mouseY - view.y) / view.zoom;

    view.x = mouseX - mouseXWorld * newZoom;
    view.y = mouseY - mouseYWorld * newZoom;
    view.zoom = newZoom;

    return false;
}

function mousePressed() {
    if (isTypingInUI()) return;
    if (canvasMode !== "Custom Artboard") return;

    isPanning = true;
    startPan.x = mouseX - view.x;
    startPan.y = mouseY - view.y;
}

function mouseDragged() {
    if (isPanning && canvasMode === "Custom Artboard") {
        view.x = mouseX - startPan.x;
        view.y = mouseY - startPan.y;
    }
}

function mouseReleased() {
    isPanning = false;
}

function toggleGUI() {
    guiVisible = !guiVisible;
    ui.wrap.style("display", guiVisible ? "block" : "none");
}

function isTypingInUI() {
    const ae = document.activeElement;
    if (!ae) return false;
    const tag = (ae.tagName || "").toUpperCase();
    return (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ae.isContentEditable);
}

function keyPressed() {
    if (isTypingInUI()) return;

    if (key === "h" || key === "H") toggleGUI();
    if (key === "s" || key === "S") save("capture.png");
    if (key === "r" || key === "R") toggleRecording();
}