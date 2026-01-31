/**
 * MERGED AUDIO-REACTIVE 3D MODEL VISUAL (p5.js) — single-file sketch.js
 * Files required in the same folder:
 *   - model.obj
 *   - music.mp3
 *
 * Controls:
 *   - SPACE: Play / Pause
 *   - Mouse click: strong smooth tilt impulse
 */

let myModel = null;
let song = null;
let fft = null;

// smoothed band energies (0..1)
let eBass = 0, eMid = 0, eTreb = 0;
let eBassT = 0, eMidT = 0, eTrebT = 0;

// time
let t = 0;

// model motion
let rotY = 0;
let tiltX = 0, tiltZ = 0;
let tiltXT = 0, tiltZT = 0;

// mouse tilt impulse
let mouseTilt = 0;
let mouseTiltT = 0;

// particles (pooled)
let P_N = 1400;
let pAng, pAngV, pRad, pY0, pType, pSize, pPhase;

// camera
let camDist = 680;

function preload() {
  // Normalize keeps model in a consistent size domain
  myModel = loadModel("model.obj", true);
  song = loadSound("music.mp3");
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);

  fft = new p5.FFT(0.85, 1024);
  fft.setInput(song);

  allocParticles(P_N);

  // Small UX: avoid selection cursor
  noCursor();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ------------------------- AUDIO -------------------------

function updateAudioBands() {
  const hasAudio = song && song.isLoaded() && song.isPlaying();

  if (hasAudio) {
    fft.analyze(); // p5 internal allocations; acceptable
    eBassT = fft.getEnergy("bass") / 255;
    eMidT  = fft.getEnergy("mid") / 255;
    eTrebT = fft.getEnergy("treble") / 255;
  } else {
    eBassT = eMidT = eTrebT = 0;
  }

  // smoothing
  const a = 0.14;
  eBass += (eBassT - eBass) * a;
  eMid  += (eMidT  - eMid ) * a;
  eTreb += (eTrebT - eTreb) * a;
}

// ------------------------- PARTICLES (pooled) -------------------------

function allocParticles(n) {
  P_N = n | 0;

  pAng   = new Float32Array(P_N);
  pAngV  = new Float32Array(P_N);
  pRad   = new Float32Array(P_N);
  pY0    = new Float32Array(P_N);
  pType  = new Uint8Array(P_N);     // 0 sphere, 1 box, 2 “chunky sphere”
  pSize  = new Float32Array(P_N);
  pPhase = new Float32Array(P_N);

  for (let i = 0; i < P_N; i++) {
    const u = i / max(1, P_N - 1);
    pAng[i] = u * TWO_PI * 21.0;

    // base angular velocity with variation
    pAngV[i] = 0.0022 + (i % 13) * 0.00018;

    // radii distributed in bands (galaxy rings)
    const band = i % 7;
    pRad[i] = 140 + band * 85 + (i % 97) * 1.2;

    // vertical distribution
    pY0[i] = -180 + (i % 361) * 1.0;

    // type mix
    const r = i % 12;
    pType[i] = (r < 6) ? 0 : (r < 10) ? 1 : 2;

    // sizes: “sempre più o meno quella dimensione”, ma con variazione
    const base = 2.2 + (i % 5) * 0.55;
    pSize[i] = base + (band * 0.18);

    pPhase[i] = (i % 997) * 0.013;
  }
}

// ------------------------- DRAW -------------------------

function draw() {
  background(10, 6, 8);

  updateAudioBands();

  // overall energy used to drive speed + dynamics
  const energy = clamp01(0.55 * eBass + 0.30 * eMid + 0.65 * eTreb);

  // camera autopan (kept, but controlled so nothing “hits” the camera)
  const autopan = t * (0.00068 + energy * 0.00065);
  const cx = cos(autopan) * camDist;
  const cz = sin(autopan) * camDist;
  const cy = -90 + sin(t * 0.00033) * (55 + energy * 45);
  camera(cx, cy, cz, 0, 0, 0, 0, 1, 0);

  // lights (brown–reddish, atmospheric)
  ambientLight(40, 18, 16);
  pointLight(255, 140, 90, 0, -240, 260);
  directionalLight(120, 55, 40, -0.35, -0.55, -1);

  // --- HARD TILT logic (rare, treble-driven) ---
  // spike probability: rarer when low treble, more likely with peaks
  const spikeProb = 0.006 + pow(eTreb, 2.2) * 0.028;
  if (eTreb > 0.72 && random() < spikeProb) {
    // “hard”: bigger target, then snap-ish approach
    tiltXT = random(-0.85, 0.85);
    tiltZT = random(-0.85, 0.85);
  }

  // decay targets back to 0 (so it recenters)
  tiltXT *= 0.92;
  tiltZT *= 0.92;

  // fast approach (harder feel)
  tiltX += (tiltXT - tiltX) * 0.14;
  tiltZ += (tiltZT - tiltZ) * 0.14;

  // mouse tilt impulse (strong but smooth)
  mouseTilt += (mouseTiltT - mouseTilt) * 0.10;
  mouseTiltT *= 0.90;

  // --- GALAXY SPEED: reactive (requested) ---
  // treble makes it “nervous”, bass adds mass/drag feel
  const galaxySpeed = 1.0 + pow(eTreb, 1.6) * 2.6 + pow(energy, 1.2) * 1.2;

  // --- draw particles first (so model reads clearly on top) ---
  push();
  drawGalaxy(galaxySpeed, energy);
  pop();

  // --- central model ---
  push();

  // faster rotation (requested) + audio-driven
  const rotBase = 0.010 + energy * 0.060;
  rotY += rotBase;

  rotateY(rotY);
  rotateX(0.18 + tiltX + mouseTilt);
  rotateZ(tiltZ * 0.75);

  // zoom / bounce: bass gives controlled pulsing
  const baseScale = computeSafeModelScale();
  const zoom = 1.0 + pow(eBass, 2.8) * 0.90;      // controlled but noticeable
  const zoomClamped = constrain(zoom, 1.0, 1.85); // safety: keep in frame
  scale(baseScale * zoomClamped);

  // material brown–reddish palette, slightly shifting with audio
  const r = 140 + eBass * 120 + eTreb * 30;
  const g = 42  + eMid  * 55;
  const b = 28  + eTreb * 22;

  noStroke();
  specularMaterial(r, g, b);
  shininess(22);

  if (myModel) {
    rotateX(PI)
    model(myModel);
  } else {
    // fallback
    ambientMaterial(180, 80, 60);
    box(190, 190, 190);
  }

  pop();

  // overlay minimal (optional but helpful): play state
  drawTinyOverlay();

  t++;
}

// ------------------------- GALAXY RENDER -------------------------

function drawGalaxy(speed, energy) {
  // particles keep away from the “camera zone” by limiting z-near
  // (not perfect, but avoids the annoying “in your face” moments)
  const zNearSoft = -120; // in camera space it varies, but this helps

  // ring breathing (bass) + lift (mid)
  const ringBase = 240 + eBass * 230;
  const lift = (eMid - 0.35) * 170;

  // palette: brown/reddish with some heterogeneity
  // some particles react more, others stay subdued
  const hot = pow(eTreb, 1.25);

  for (let i = 0; i < P_N; i++) {
    const ang = pAng[i];
    const rr  = ringBase + pRad[i] * (0.70 + eBass * 0.75);

    // vertical wobble
    const yy = (pY0[i] + lift) * (0.62 + eMid * 0.85)
             + sin(t * 0.004 + pPhase[i]) * (10 + eMid * 48);

    // slight radial turbulence (not lines, just position)
    const wob = sin(t * 0.003 + pPhase[i]) * (12 + eMid * 55);
    const rr2 = rr + wob * (0.55 + eBass * 1.25);

    let x = cos(ang) * rr2;
    let z = sin(ang) * rr2;

    // soften near zone: pull back if too close (avoid “annoying” proximity)
    if (z > zNearSoft) z = lerp(z, zNearSoft, 0.65);

    push();
    translate(x, yy, z);

    // subtle self-rotation for “articolato”
    rotateY(ang * 0.10 + t * 0.002);
    rotateX(sin(pPhase[i] + t * 0.003) * 0.35);

    const s = pSize[i] * (0.95 + energy * 0.85);

    // heterogeneous color: a subset becomes “hot bodies”
    const hotPick = (i % 11 === 0) ? 1 : 0;
    const rrCol = 110 + eBass * 120 + hotPick * 90 * hot;
    const ggCol = 35  + eMid  * 55  + hotPick * 20 * hot;
    const bbCol = 25  + hot   * 18;

    // no big straight orange lines: just solid bodies
    noStroke();
    ambientMaterial(rrCol, ggCol, bbCol);

    if (pType[i] === 1) {
      // cube
      box(s * 1.35, s * 1.35, s * 1.35);
    } else if (pType[i] === 2) {
      // chunkier sphere (slightly higher detail)
      sphere(s * 0.95, 10, 8);
    } else {
      // sphere
      sphere(s * 0.9, 8, 6);
    }

    pop();

    // update angles (speed is music-reactive)
    pAng[i] = ang + pAngV[i] * speed * (0.92 + (i % 5) * 0.05);
  }
}

// ------------------------- UTILS / INPUT -------------------------

function keyPressed() {
  // avoid messing while typing in inputs (if any exist)
  const ae = document.activeElement;
  if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;

  if (key === " ") {
    userStartAudio();

    if (!song) return;
    if (!song.isLoaded()) return;

    if (song.isPlaying()) song.pause();
    else song.loop();
  }
}

function mousePressed() {
  // strong but smooth tilt impulse
  mouseTiltT = -PI * 0.45;   // “hard”
  // also add a bit of Z impulse for a more physical feel
  tiltZT += random([-1, 1]) * 0.35;
}

function computeSafeModelScale() {
  // model normalized ~100 units; pick a conservative scale so it stays framed.
  // tuned to land roughly in the 40%..80% range with the zoom clamp.
  const m = min(width, height);
  // 100 units model -> scale factor relative to canvas size
  // slightly smaller baseline so zoom has room
  return (m * 0.36) / 230.0;
}

function drawTinyOverlay() {
  push();
  resetMatrix();
  translate(-width / 2, -height / 2, 0);

  const playing = song && song.isLoaded() && song.isPlaying();

  noStroke();
  fill(0, 0, 0, 90);
  rect(12, 12, 210, 34, 10);

  fill(235, 220, 210, 220);
  textSize(12);
  textFont("monospace");
  text(`SPACE: ${playing ? "PAUSE" : "PLAY"}`, 22, 34);

  pop();
}

function clamp01(x) {
  return constrain(x, 0, 1);
}