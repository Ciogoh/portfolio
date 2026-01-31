// Image Merger Logic
let imgA, imgB;
let canvas;
// Overlay state
let possX = 0, possY = 0;
let scaleB = 1.0;
// DOM elements
let uploadA, uploadB, modeSelect, opacitySlider, scaleSlider, downloadBtn, statusMsg;

function setup() {
    // Create a responsive canvas that fits the container
    let container = select('#canvas-container');
    canvas = createCanvas(container.width, container.height);
    canvas.parent('canvas-container');

    // UI Connections
    uploadA = select('#uploadA');
    uploadB = select('#uploadB');
    modeSelect = select('#modeSelect');
    opacitySlider = select('#opacitySlider');
    scaleSlider = select('#scaleSlider');
    downloadBtn = select('#downloadBtn');
    statusMsg = select('#statusMsg');

    // Event Listeners
    uploadA.elt.onchange = (e) => handleFile(e, 'A');
    uploadB.elt.onchange = (e) => handleFile(e, 'B');
    downloadBtn.mousePressed(exportHighRes);

    background(30);
    textAlign(CENTER, CENTER);
    fill(100);
    text("Upload images to start", width / 2, height / 2);
}

function handleFile(e, target) {
    let file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        let url = URL.createObjectURL(file);
        loadImage(url, (img) => {
            if (target === 'A') imgA = img;
            else imgB = img;
            statusMsg.html(`Loaded Image ${target}`);
        });
    }
}

function draw() {
    background(30);

    if (!imgA) {
        fill(100); noStroke();
        text("Waiting for Image A...", width / 2, height / 2);
        return;
    }

    let mode = modeSelect.value();

    // Calculate aspect ratio fit for PREVIEW only
    // We want the preview to fit nicely in the canvas
    let scaleFactor = min(width / imgA.width, height / imgA.height) * 0.9;

    push();
    translate(width / 2, height / 2);

    if (mode === 'OVERLAY') {
        // Draw A centered
        imageMode(CENTER);
        // Draw Base A
        let wA = imgA.width * scaleFactor;
        let hA = imgA.height * scaleFactor;
        image(imgA, 0, 0, wA, hA);

        if (imgB) {
            // Overlay B
            let op = opacitySlider.value();
            let sc = scaleSlider.value();
            tint(255, op);

            // Apply Manual Position (scaled visually)
            // Interaction logic will update possX/possY
            translate(possX, possY);

            let wB = imgB.width * scaleFactor * sc;
            let hB = imgB.height * scaleFactor * sc;
            image(imgB, 0, 0, wB, hB);
        }
    }
    else if (mode === 'STITCH_H') {
        imageMode(CORNER);
        // Helper: Simple fit. If B exists, width is A.w + B.w
        // For preview, we scale the WHOLE composite
        let totalW = imgA.width + (imgB ? imgB.width : 0);
        let maxH = max(imgA.height, (imgB ? imgB.height : 0));

        // Recalculate scale for the combined width
        let stitchScale = min(width / totalW, height / maxH) * 0.9;

        // Center the whole thing
        translate(- (totalW * stitchScale) / 2, - (maxH * stitchScale) / 2);

        image(imgA, 0, 0, imgA.width * stitchScale, imgA.height * stitchScale);
        if (imgB) {
            image(imgB, imgA.width * stitchScale, 0, imgB.width * stitchScale, imgB.height * stitchScale);
        }
    }
    else if (mode === 'STITCH_V') {
        imageMode(CORNER);
        let totalH = imgA.height + (imgB ? imgB.height : 0);
        let maxW = max(imgA.width, (imgB ? imgB.width : 0));

        let stitchScale = min(width / maxW, height / totalH) * 0.9;

        translate(- (maxW * stitchScale) / 2, - (totalH * stitchScale) / 2);

        image(imgA, 0, 0, imgA.width * stitchScale, imgA.height * stitchScale);
        if (imgB) {
            image(imgB, 0, imgA.height * stitchScale, imgB.width * stitchScale, imgB.height * stitchScale);
        }
    }

    pop();

    // UI Update (hide Overlay controls if not in overlay mode)
    let overlayDiv = select('#overlayControls');
    if (mode === 'OVERLAY') overlayDiv.style('display', 'block');
    else overlayDiv.style('display', 'none');
}

function mouseDragged() {
    if (imgB && modeSelect.value() === 'OVERLAY') {
        // Update position deltas
        // We accumulate raw pixel delta, but usually for preview feel
        possX += (mouseX - pmouseX);
        possY += (mouseY - pmouseY);
        return false; // Prevent default
    }
}

function mouseWheel(e) {
    if (imgB && modeSelect.value() === 'OVERLAY') {
        // Adjust scale slider
        let currentS = parseFloat(scaleSlider.value());
        let newS = currentS - (e.delta * 0.001);
        scaleSlider.value(newS);
        return false;
    }
}

function windowResized() {
    let container = select('#canvas-container');
    resizeCanvas(container.width, container.height);
}

// --- CORE EXPORT LOGIC ---
function exportHighRes() {
    if (!imgA) { alert("Please upload at least Image A"); return; }

    statusMsg.html("Generating High-Res...");
    setTimeout(() => {
        let mode = modeSelect.value();
        let pg; // Offscreen buffer

        if (mode === 'OVERLAY') {
            // For overlay, canvas size = Base Image A size
            // Note: This crops B if it goes outside A. Or should we expand? 
            // Standard "merge" usually implies using A as base canvas.
            pg = createGraphics(imgA.width, imgA.height);

            pg.imageMode(CENTER);
            pg.translate(pg.width / 2, pg.height / 2);

            // Draw A
            pg.image(imgA, 0, 0);

            if (imgB) {
                // Draw B
                // Need to map PREVIEW coordinates (screen pixels) to REAL coordinates (original pixels)
                // Preview Logic was: 
                // Draw at scaleFactor * w
                // Translate by possX (screen pixels)

                // Real Logic:
                // We need to un-apply scaleFactor to possX
                let scaleFactor = min(width / imgA.width, height / imgA.height) * 0.9;

                let realOffsetX = possX / scaleFactor;
                let realOffsetY = possY / scaleFactor;

                let op = opacitySlider.value();
                let sc = scaleSlider.value(); // Explicit scale B relative to A-space

                pg.push();
                pg.tint(255, op);
                pg.translate(realOffsetX, realOffsetY);
                // B size relative to A? No, B has its own intrinsic size.
                // In preview, we drew it at: imgB.width * scaleFactor * sc
                // So in normalized space (where scaleFactor is 1): imgB.width * sc
                pg.image(imgB, 0, 0, imgB.width * sc, imgB.height * sc);
                pg.pop();
            }
        }
        else if (mode === 'STITCH_H') {
            let totalW = imgA.width + (imgB ? imgB.width : 0);
            let maxH = max(imgA.height, (imgB ? imgB.height : 0));
            pg = createGraphics(totalW, maxH);

            pg.background(0); // or transparent/white? Standard JPEGS don't support trans, but PNG does.
            // Draw A
            pg.image(imgA, 0, 0);
            // Draw B
            if (imgB) pg.image(imgB, imgA.width, 0);
        }
        else if (mode === 'STITCH_V') {
            let totalH = imgA.height + (imgB ? imgB.height : 0);
            let maxW = max(imgA.width, (imgB ? imgB.width : 0));
            pg = createGraphics(maxW, totalH);

            pg.image(imgA, 0, 0);
            if (imgB) pg.image(imgB, 0, imgA.height);
        }

        // Save
        let timestamp = year() + "-" + month() + "-" + day() + "_" + millis();
        // Saving as PNG ensures lossless merge (user provided jpegs, but re-encoding as jpg adds gens loss. PNG is safer for "No Quality Loss")
        save(pg, `merged_image_${timestamp}.png`);

        statusMsg.html("Download Started!");
        pg.remove();
    }, 100);
}