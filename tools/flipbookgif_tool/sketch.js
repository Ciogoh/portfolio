/**
 * FLIPBOOK TOOL (p5.js)
 * - Full canvas drawing
 * - Multi onion skins
 * - Fast-stroke interpolation fix
 * - saveGif export + PNG export
 * - ✅ Added: Color picker (all colors), default black
 * - ✅ Added: Commented code
 */

"use strict";

// ====== CONFIG ======
const UI_W = 220; // UI panel width
const UI_PAD = 8; // UI padding

// Onion settings (fixed, no slider)
const ONION_COUNT = 3;              // how many previous frames to show
const ONION_OPACITY_START = 0.16;   // opacity of newest onion skin
const ONION_OPACITY_DECAY = 0.55;   // each older frame fades by this factor

// Stroke quality
const INTERP_SPACING_PX = 2.5;      // spacing between interpolated segments (smaller = smoother, slower)

// saveGif stability: warmup + delay
const GIF_DELAY_SEC = 0.35;         // delay before capture begins (prevents UI/onion leaking)
const RECORD_WARMUP_FRAMES = 2;     // render a couple clean frames before capture counts

const DEFAULTS = {
    brush: 6,
    fps: 12,
};

// ====== STATE ======
let baseW, baseH;                   // “base” size for drawing layers (kept stable, canvas can resize)
let frames = [];                    // committed frames (array of p5.Graphics)
let currentFrame;                   // current drawing layer (p5.Graphics)
let strokes = [];                   // list of strokes for current frame (used for undo/redraw)
let currentStroke = null;           // stroke currently being drawn
let currentHasContent = false;      // used to block committing empty frames

let mode = "DRAW";                  // DRAW | PLAY | RECORD
let playIndex = 0;                  // index in playback sequence
let lastPlayMs = 0;                 // last playback tick time

// Recording state
let recordTotalFrames = 0;
let recordFramesDone = 0;
let recordWasPlaying = false;
let recordWarmup = 0;

// Unified status (no overlapping)
let statusMsg = "Ready.";
let statusHoldUntil = 0;            // millis until which we keep showing the status message

// Commit debounce (avoid double commits)
let lastCommitMs = -9999;
const COMMIT_DEBOUNCE_MS = 250;

// ====== UI ======
let ui = {
    panel: null,

    // sliders
    brushSlider: null,
    brushVal: null,
    fpsSlider: null,
    fpsVal: null,

    // buttons
    playBtn: null,
    gifBtn: null,
    pngBtn: null,
    clearCurrentBtn: null,
    clearAllBtn: null,

    // ✅ color picker
    colorPicker: null,

    // status element
    status: null,
};

function setup() {
    pixelDensity(1);
    createCanvas(windowWidth, windowHeight);

    // Base resolution = current window at startup (keeps strokes consistent even after resize)
    baseW = max(1, windowWidth);
    baseH = max(1, windowHeight);

    // Current drawing layer
    currentFrame = makeLayer();
    clearLayer(currentFrame);

    buildUI();
    syncUI();

    setStatus("Draw. ENTER commit • SPACE play • S GIF • Export PNGs • C clear current • Q clear all", 3000);
}

function draw() {
    // Clear visible canvas (not the drawing layer)
    background(255);

    // Render depending on mode
    if (mode === "PLAY") renderPlay();
    else if (mode === "RECORD") renderRecord();
    else renderDraw();

    // Cosmetic border around viewport
    drawBorder();
}

function windowResized() {
    // Only resize the *view*; layers remain in baseW/baseH and are scaled on render
    resizeCanvas(windowWidth, windowHeight);
    setStatus("Window resized — drawing is scaled.", 1800);
}

// ====== RENDERING ======
function renderDraw() {
    // Onion skins behind current frame
    drawOnionSkins();

    // Current frame on top
    drawLayerScaled(currentFrame, 1.0);
}

function renderPlay() {
    const seq = getSequence();
    if (seq.length === 0) {
        drawLayerScaled(currentFrame, 1.0);
        return;
    }

    const fps = ui.fpsSlider.value();
    const dt = 1000 / fps;
    const now = millis();

    // Advance animation index based on fps
    if (now - lastPlayMs >= dt) {
        lastPlayMs = now;
        playIndex = (playIndex + 1) % seq.length;
    }

    drawLayerScaled(seq[playIndex], 1.0);
}

function renderRecord() {
    const seq = getSequence();
    if (seq.length === 0) {
        endRecording("Nothing to export.");
        return;
    }

    // IMPORTANT:
    // During RECORD we NEVER draw onion skins.
    // This guarantees onion cannot leak into capture.
    const idx = recordFramesDone % seq.length;
    drawLayerScaled(seq[idx], 1.0);

    // Warmup frames: render but don't count yet
    if (recordWarmup > 0) {
        recordWarmup--;
        return;
    }

    recordFramesDone++;

    // Stop recording after all frames are “played”
    if (recordFramesDone >= recordTotalFrames) {
        endRecording("GIF capture finished.");
    } else {
        setStatus(`Recording GIF… ${recordFramesDone}/${recordTotalFrames}`, 0);
    }
}

function endRecording(msg) {
    mode = recordWasPlaying ? "PLAY" : "DRAW";
    frameRate(60); // go back to normal
    setStatus(msg, 1800);
}

function drawOnionSkins() {
    const n = min(ONION_COUNT, frames.length);
    if (n <= 0) return;

    // Draw from older to newer (newer is more visible)
    for (let k = n; k >= 1; k--) {
        const idx = frames.length - k;         // among last n committed frames
        const recency = (k - 1);               // 0 = newest, bigger = older
        const alpha = ONION_OPACITY_START * Math.pow(ONION_OPACITY_DECAY, recency);
        drawLayerScaled(frames[idx], alpha);
    }
}

function drawLayerScaled(layer, alpha01) {
    // Draw a p5.Graphics layer onto the visible canvas, scaled to current window size
    push();
    if (alpha01 < 1) tint(255, 255 * alpha01);
    else noTint();
    image(layer, 0, 0, width, height);
    pop();
}

function drawBorder() {
    noFill();
    stroke(0, 30);
    rect(0.5, 0.5, width - 1, height - 1);
}

// ====== INPUT: DRAWING ======
function mousePressed() {
    if (mode !== "DRAW") return;
    if (isOverUI()) return;

    // Start a new stroke in base coordinates
    beginStroke(screenToBaseX(mouseX), screenToBaseY(mouseY));
}

function mouseDragged() {
    if (mode !== "DRAW") return;
    if (!currentStroke) return;
    if (isOverUI()) return;

    const x = screenToBaseX(mouseX);
    const y = screenToBaseY(mouseY);

    // Add point to stroke (with tiny distance filter)
    addPoint(x, y);

    // Incremental draw (fast + smooth)
    drawStrokeIncrementInterpolated(currentFrame, currentStroke);
}

function mouseReleased() {
    if (mode !== "DRAW") return;
    if (!currentStroke) return;
    endStroke();
}

function beginStroke(x, y) {
    const size = ui.brushSlider.value();

    // ✅ IMPORTANT:
    // Save the color inside the stroke, so undo/redraw keeps the correct colors.
    const col = ui.colorPicker.color(); // p5.Color

    currentStroke = { size, col, pts: [{ x, y }] };
}

function addPoint(x, y) {
    const pts = currentStroke.pts;
    const last = pts[pts.length - 1];

    // Small movement filter to reduce redundant points
    const dx = x - last.x;
    const dy = y - last.y;
    if (dx * dx + dy * dy < 0.8) return;

    pts.push({ x, y });
}

function drawStrokeIncrementInterpolated(g, s) {
    const pts = s.pts;
    if (pts.length < 2) return;

    // Only draw the last segment (from second-last to last)
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    // Interpolate to avoid “gaps” on fast movements
    const steps = Math.max(1, Math.floor(d / INTERP_SPACING_PX));

    g.push();
    g.stroke(s.col);            // ✅ use stroke color
    g.strokeWeight(s.size);
    g.strokeCap(ROUND);
    g.strokeJoin(ROUND);
    g.noFill();

    let px = a.x, py = a.y;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        g.line(px, py, x, y);
        px = x; py = y;
    }

    g.pop();
    currentHasContent = true;
}

function endStroke() {
    // Single-point stroke (tap): draw a dot
    if (currentStroke.pts.length === 1) {
        const p = currentStroke.pts[0];

        currentFrame.push();
        currentFrame.noStroke();
        currentFrame.fill(currentStroke.col); // ✅ dot uses chosen color
        currentFrame.circle(p.x, p.y, currentStroke.size);
        currentFrame.pop();

        currentHasContent = true;
    }

    // Store stroke for undo/redraw
    strokes.push(currentStroke);
    currentStroke = null;
}

// ====== KEYS ======
function keyPressed() {
    // Avoid shortcuts while recording (prevents capture interference)
    if (mode === "RECORD") return false;

    // ENTER commit
    if (keyCode === ENTER || keyCode === RETURN) {
        const now = millis();
        if (now - lastCommitMs > COMMIT_DEBOUNCE_MS) {
            lastCommitMs = now;
            commitFrame();
        }
        return false;
    }

    // BACKSPACE undo
    if (keyCode === BACKSPACE) {
        undoStroke();
        return false;
    }

    // SPACE play/pause
    if (keyCode === 32) {
        togglePlay();
        return false;
    }

    const k = key;

    // Z delete last committed frame
    if (k === "z" || k === "Z") { deleteLastFrame(); return false; }

    // C clear current
    if (k === "c" || k === "C") { clearCurrentOnly(); return false; }

    // Q clear all with confirmation
    if (k === "q" || k === "Q") { confirmClearAll(); return false; }

    // S export GIF (your UI says GIF (S))
    if (k === "s" || k === "S") { exportGIF(); return false; }

    return true;
}

// ====== ACTIONS ======
function commitFrame() {
    if (mode !== "DRAW") return;

    // Don’t commit empty frames
    if (!currentHasContent) {
        setStatus("Current frame empty — nothing committed.", 1400);
        return;
    }

    // Copy currentFrame into a new layer and push into committed frames
    const g = makeLayer();
    clearLayer(g);
    g.image(currentFrame, 0, 0);
    frames.push(g);

    // Clear current drawing
    clearCurrentOnly(true);
    setStatus(`Committed. Total frames: ${frames.length}`, 1200);
}

function undoStroke() {
    if (mode !== "DRAW") return;
    if (strokes.length === 0) {
        setStatus("Nothing to undo.", 1000);
        return;
    }

    // Remove last stroke and rebuild layer from scratch
    strokes.pop();
    redrawFromStrokes();
    setStatus("Undo.", 800);
}

function redrawFromStrokes() {
    // Rebuild currentFrame by replaying saved strokes (keeps color + size)
    clearLayer(currentFrame);
    currentHasContent = strokes.length > 0;

    for (const s of strokes) {
        const pts = s.pts;
        if (!pts || pts.length === 0) continue;

        // Tap stroke: dot
        if (pts.length === 1) {
            const p = pts[0];
            currentFrame.push();
            currentFrame.noStroke();
            currentFrame.fill(s.col); // ✅ stroke’s own color
            currentFrame.circle(p.x, p.y, s.size);
            currentFrame.pop();
            continue;
        }

        // Multi-point stroke: draw with interpolation again
        currentFrame.push();
        currentFrame.stroke(s.col); // ✅ stroke’s own color
        currentFrame.strokeWeight(s.size);
        currentFrame.strokeCap(ROUND);
        currentFrame.strokeJoin(ROUND);
        currentFrame.noFill();

        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.max(1, Math.floor(d / INTERP_SPACING_PX));

            let px = a.x, py = a.y;
            for (let j = 1; j <= steps; j++) {
                const t = j / steps;
                const x = a.x + dx * t;
                const y = a.y + dy * t;
                currentFrame.line(px, py, x, y);
                px = x; py = y;
            }
        }

        currentFrame.pop();
    }
}

function deleteLastFrame() {
    if (frames.length === 0) {
        setStatus("No committed frames to delete.", 1200);
        return;
    }
    frames.pop();
    playIndex = 0;
    setStatus(`Deleted last frame. Total: ${frames.length}`, 1400);
}

function clearCurrentOnly(silent = false) {
    if (mode === "PLAY") {
        setStatus("Stop PLAY to clear current.", 1400);
        return;
    }

    clearLayer(currentFrame);
    strokes = [];
    currentStroke = null;
    currentHasContent = false;

    if (!silent) setStatus("Cleared current frame.", 1200);
}

function confirmClearAll() {
    if (mode === "PLAY") togglePlay();

    const ok = window.confirm("You really want to delete all?");
    if (!ok) {
        setStatus("Clear ALL annullato.", 1200);
        return;
    }
    clearAllAndRestart();
}

function clearAllAndRestart() {
    frames = [];
    playIndex = 0;

    clearLayer(currentFrame);
    strokes = [];
    currentStroke = null;
    currentHasContent = false;

    mode = "DRAW";
    ui.playBtn.html("Play");

    setStatus("Reset completo: tutto cancellato.", 1600);
}

function togglePlay() {
    if (mode === "PLAY") {
        mode = "DRAW";
        ui.playBtn.html("Play");
        setStatus("DRAW mode.", 900);
    } else if (mode === "DRAW") {
        mode = "PLAY";
        playIndex = 0;
        lastPlayMs = millis();
        ui.playBtn.html("Pause");
        setStatus("PLAY mode.", 900);
    }
}

function getSequence() {
    // Playback/export sequence:
    // committed frames + currentFrame (if it has content)
    const seq = frames.slice();
    if (currentHasContent) seq.push(currentFrame);
    return seq;
}

// ====== EXPORTS ======
function exportGIF() {
    if (typeof saveGif !== "function") {
        setStatus("saveGif() non disponibile: aggiorna p5.js (>= 1.5.0).", 2600);
        return;
    }

    const seq = getSequence();
    if (seq.length === 0) {
        setStatus("Nessun frame da esportare.", 1500);
        return;
    }

    const fps = ui.fpsSlider.value();
    const totalFrames = seq.length;

    // Prepare record state
    recordTotalFrames = totalFrames;
    recordFramesDone = 0;
    recordWasPlaying = (mode === "PLAY");
    recordWarmup = RECORD_WARMUP_FRAMES;

    mode = "RECORD";
    playIndex = 0;

    // Make capture stable
    frameRate(fps);

    const name = `flipbook_${timestampString()}`;
    setStatus("Avvio export GIF…", 0);

    // IMPORTANT:
    // Safer delay so RECORD mode is visible before capture begins
    saveGif(name, totalFrames, {
        units: "frames",
        silent: true,        // avoid p5 overlay UI
        delay: GIF_DELAY_SEC,
    });

    setStatus(`Export GIF in corso… (${totalFrames} frames)`, 0);
}

function exportPNGs() {
    const seq = getSequence();
    if (seq.length === 0) {
        setStatus("Nessun frame da salvare.", 1500);
        return;
    }

    const base = `flipbook_${timestampString()}`;

    // Offscreen canvas to compose each frame with white background
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const ctx = off.getContext("2d");

    for (let i = 0; i < seq.length; i++) {
        ctx.clearRect(0, 0, off.width, off.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, off.width, off.height);

        // Draw the p5.Graphics canvas into the offscreen canvas
        ctx.drawImage(seq[i].canvas, 0, 0, off.width, off.height);

        // Download as PNG
        const url = off.toDataURL("image/png");
        triggerDownloadDataURL(url, `${base}_frame_${nf(i, 3)}.png`);
    }

    setStatus(`Salvati ${seq.length} PNG.`, 1800);
}

// ====== UI ======
function buildUI() {
    // Main panel container
    ui.panel = createDiv();
    ui.panel.position(10, 10);
    ui.panel.style("width", UI_W + "px");
    ui.panel.style("padding", UI_PAD + "px");
    ui.panel.style("background", "rgba(255,255,255,0.9)");
    ui.panel.style("border", "1px solid rgba(0,0,0,0.12)");
    ui.panel.style("border-radius", "12px");
    ui.panel.style("box-shadow", "0 6px 18px rgba(0,0,0,0.08)");
    ui.panel.style("font-family", "system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
    ui.panel.style("font-size", "11px");
    ui.panel.style("line-height", "1.15");
    ui.panel.elt.style.userSelect = "none";

    // Header
    const header = createDiv(`<b>Flipbook</b> <span style="opacity:.55;">(SPACE play)</span>`);
    header.parent(ui.panel);
    header.style("margin-bottom", "8px");

    // Brush size slider
    makeSliderRow("Brush (Backspace = undo)", 1, 30, DEFAULTS.brush, 1, (s, v) => {
        ui.brushSlider = s;
        ui.brushVal = v;
    });

    // FPS slider
    makeSliderRow("FPS", 4, 24, DEFAULTS.fps, 1, (s, v) => {
        ui.fpsSlider = s;
        ui.fpsVal = v;
    });

    // ✅ Color picker row
    const colorLabel = createDiv("Color");
    colorLabel.parent(ui.panel);
    colorLabel.style("margin", "6px 0 2px 0");
    colorLabel.style("opacity", "0.85");

    const colorRow = createDiv();
    colorRow.parent(ui.panel);
    colorRow.style("display", "flex");
    colorRow.style("align-items", "center");
    colorRow.style("gap", "8px");

    // p5 Color Picker = “all colors”, default black
    ui.colorPicker = createColorPicker("#000000");
    ui.colorPicker.parent(colorRow);

    const colorHint = createSpan("#000000");
    colorHint.parent(colorRow);
    colorHint.style("opacity", "0.75");

    // Update status text when color changes (purely informative)
    ui.colorPicker.input(() => {
        colorHint.html(ui.colorPicker.value());
        refreshStatus();
    });

    // Row 1: play/export buttons
    const row1 = createDiv();
    row1.parent(ui.panel);
    row1.style("display", "flex");
    row1.style("gap", "6px");
    row1.style("flex-wrap", "wrap");
    row1.style("margin-top", "8px");

    ui.playBtn = makeBtn("Play", togglePlay);
    ui.playBtn.parent(row1);

    ui.gifBtn = makeBtn("GIF (S)", exportGIF);
    ui.gifBtn.parent(row1);

    ui.pngBtn = makeBtn("Export PNGs", exportPNGs);
    ui.pngBtn.parent(row1);

    // Row 2: clear buttons
    const row2 = createDiv();
    row2.parent(ui.panel);
    row2.style("display", "flex");
    row2.style("gap", "6px");
    row2.style("flex-wrap", "wrap");
    row2.style("margin-top", "6px");

    ui.clearCurrentBtn = makeBtn("Clear (C)", clearCurrentOnly);
    ui.clearCurrentBtn.parent(row2);

    ui.clearAllBtn = makeBtn("Clear ALL (Q)", confirmClearAll);
    ui.clearAllBtn.parent(row2);
    ui.clearAllBtn.style("border", "1px solid rgba(160,0,0,0.28)");

    // Status area
    ui.status = createDiv("");
    ui.status.parent(ui.panel);
    ui.status.style("margin-top", "8px");
    ui.status.style("padding-top", "6px");
    ui.status.style("border-top", "1px solid rgba(0,0,0,0.08)");
    ui.status.style("opacity", "0.95");
    ui.status.style("word-break", "break-word");

    // Stop propagation so clicks on UI don't start strokes
    ui.panel.elt.addEventListener("pointerdown", (e) => e.stopPropagation());
    ui.panel.elt.addEventListener("pointermove", (e) => e.stopPropagation());
}

function makeSliderRow(label, min, max, val, step, bind) {
    // Slider label
    const labelEl = createDiv(label);
    labelEl.parent(ui.panel);
    labelEl.style("margin", "6px 0 2px 0");
    labelEl.style("opacity", "0.85");

    // Slider row
    const row = createDiv();
    row.parent(ui.panel);
    row.style("display", "flex");
    row.style("align-items", "center");
    row.style("gap", "8px");

    // Slider
    const s = createSlider(min, max, val, step);
    s.parent(row);
    s.style("width", "130px");
    s.style("height", "12px");

    // Value label
    const v = createSpan(String(val));
    v.parent(row);
    v.style("min-width", "48px");
    v.style("text-align", "right");
    v.style("opacity", "0.75");

    // Update value label on input
    s.input(() => {
        v.html(String(s.value()));
        refreshStatus();
    });

    bind(s, v);
}

function makeBtn(text, fn) {
    const b = createButton(text);
    b.mousePressed(fn);
    b.style("padding", "5px 8px");
    b.style("border-radius", "10px");
    b.style("border", "1px solid rgba(0,0,0,0.18)");
    b.style("background", "white");
    b.style("cursor", "pointer");
    b.style("font-size", "11px");
    return b;
}

function syncUI() {
    // Force UI labels to reflect defaults
    ui.brushVal.html(String(ui.brushSlider.value()));
    ui.fpsVal.html(String(ui.fpsSlider.value()));
    refreshStatus();
}

function setStatus(msg, holdMs = 1200) {
    // Set a status message with an optional time-to-live
    statusMsg = msg || "";
    statusHoldUntil = holdMs > 0 ? millis() + holdMs : 0;
    refreshStatus();
}

function refreshStatus() {
    if (!ui.status) return;

    const now = millis();
    const showMsg = statusHoldUntil === 0 || now <= statusHoldUntil ? statusMsg : "";

    const fps = ui.fpsSlider.value();
    const brush = ui.brushSlider.value();
    const seqLen = getSequence().length;

    const modeLabel = (mode === "RECORD") ? "RECORDING" : mode;

    // ✅ show selected color in status too
    const colHex = ui.colorPicker ? ui.colorPicker.value() : "#000000";

    ui.status.html(`
    <div><b>${modeLabel}</b> · frames: ${seqLen} · fps: ${fps} · brush: ${brush} · color: ${colHex}</div>
    <div style="margin-top:6px; opacity:.9;">${escapeHTML(showMsg)}</div>
  `);
}

function isOverUI() {
    // Returns true if mouse is inside the UI panel bounding box
    if (!ui.panel) return false;
    const r = ui.panel.elt.getBoundingClientRect();
    return mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom;
}

// ====== UTILS ======
function makeLayer() {
    // Create a graphics layer at base resolution
    const g = createGraphics(baseW, baseH);
    g.pixelDensity(1);
    return g;
}

function clearLayer(g) {
    // Clear to transparent (not white)
    g.clear();
}

function screenToBaseX(x) {
    // Convert screen coords to base layer coords
    return (x / max(1, width)) * baseW;
}
function screenToBaseY(y) {
    return (y / max(1, height)) * baseH;
}

function triggerDownloadDataURL(dataURL, filename) {
    // Force browser download from a data URL
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function timestampString() {
    // Build a sortable timestamp string YYYYMMDD_HHMMSS
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
        d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        "_" +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

function escapeHTML(str) {
    // Prevent HTML injection inside ui.status.html(...)
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}