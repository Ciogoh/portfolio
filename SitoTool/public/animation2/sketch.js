let gridSpacing = 15;
let currentSymbol = 'LINE'; // Options: LINE, SQUARE, TEXT
let inputChar = 'A'; // Default character for text mode
let currentShape = 'CIRCLE'; // Options: CIRCLE, SQUARE

// UI Elements
let densitySlider;
let shapeSelect;
let bgColorPicker;
let fgColorPicker;

function setup() {
  ensureUI(); // Make sketch self-contained

  createCanvas(600, 600); // Default P2D renderer (Fast)
  pixelDensity(2); // Ensure high quality on retina displays
  angleMode(DEGREES);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  // Connect to DOM elements
  densitySlider = select('#densitySlider');
  shapeSelect = select('#shapeSelect');
  bgColorPicker = select('#bgColorPicker');
  fgColorPicker = select('#fgColorPicker');

  // Listen for changes
  if (shapeSelect) {
    shapeSelect.changed(() => {
      currentShape = shapeSelect.value();
    });
  }
}

function ensureUI() {
  // 1. Inject CSS
  if (!select('#custom-styles')) {
    let css = `
      html, body {
        margin: 0; padding: 0; background-color: #f0f0f0;
        display: flex; justify-content: center; align-items: center;
        height: 100vh; overflow: auto; /* Changed to auto for scrolling */
      }
      canvas { display: block; box-shadow: 0 0 20px rgba(0, 0, 0, 0.1); margin: auto; }
      
      /* Modal Styles */
      .modal {
        display: none; position: fixed; z-index: 1000;
        left: 0; top: 0; width: 100%; height: 100%;
        background-color: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(5px);
        justify-content: center; align-items: center;
      }
      .modal-content {
        background-color: #fdfdfd; padding: 40px; border: 1px solid #333;
        text-align: center; font-family: 'Courier New', monospace;
        box-shadow: 10px 10px 0px rgba(0, 0, 0, 0.1);
      }
      .modal-content p {
        margin-top: 0; margin-bottom: 30px; font-size: 14px;
        letter-spacing: 2px; font-weight: bold; color: #333;
      }
      .button-group { display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; }
      button {
        background: white; border: 1px solid #333; padding: 10px 20px;
        font-family: 'Courier New', monospace; cursor: pointer;
        font-size: 12px; transition: all 0.2s;
      }
      button:hover { background: #333; color: white; }
      .cancel-btn {
        border: none; background: transparent; text-decoration: underline; color: #888;
      }
      .cancel-btn:hover { background: transparent; color: #333; }

      /* UI Controls */
      #controls {
        position: absolute; top: 20px; right: 20px;
        display: flex; flex-direction: column; gap: 15px;
        background: rgba(255, 255, 255, 0.5);
        padding: 15px; border: 1px solid #333; backdrop-filter: blur(2px);
      }
      .control-group { display: flex; flex-direction: column; gap: 5px; }
      .control-group label {
        font-family: 'Courier New', monospace; font-size: 10px;
        font-weight: bold; letter-spacing: 1px; color: #555;
      }
      select, input[type="range"], input[type="number"] {
        font-family: 'Courier New', monospace;
        background: transparent; border: 1px solid #333;
        padding: 5px; font-size: 12px; cursor: pointer; outline: none;
      }
      select {
        appearance: none; -webkit-appearance: none; -moz-appearance: none;
        border-radius: 0; padding-right: 20px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><path d="M0 0 L5 5 L10 0" fill="black"/></svg>');
        background-repeat: no-repeat; background-position: right 5px center;
      }
      input[type="range"] {
        -webkit-appearance: none; width: 100%; height: 2px;
        background: #333; border: none; padding: 0;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none; width: 10px; height: 10px;
        background: #333; cursor: pointer;
      }
      /* Color Picker Styles */
      input[type="color"] {
        -webkit-appearance: none; border: 1px solid #333; padding: 0;
        width: 100%; height: 25px; cursor: pointer; background: none;
      }
      input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
      input[type="color"]::-webkit-color-swatch { border: none; }
    `;
    let style = createElement('style', css);
    style.id('custom-styles');
  }

  // 2. Create Controls
  if (!select('#controls')) {
    let controls = createDiv('');
    controls.id('controls');

    // Canvas Size Controls
    let grpSize = createDiv('');
    grpSize.class('control-group');
    let labelSize = createElement('label', 'SIZE (PX)');

    let sizeRow = createDiv('');
    sizeRow.style('display', 'flex');
    sizeRow.style('gap', '5px');

    let inpW = createInput(width.toString(), 'number');
    inpW.style('width', '50px');
    // Prevent key conflicts (e.g. typing '1' triggering 'LINE' mode)
    inpW.elt.addEventListener('keydown', (e) => e.stopPropagation());

    let inpH = createInput(height.toString(), 'number');
    inpH.style('width', '50px');
    // Prevent key conflicts
    inpH.elt.addEventListener('keydown', (e) => e.stopPropagation());

    let btnResize = createButton('SET');
    btnResize.style('padding', '5px 10px');
    btnResize.mousePressed(() => {
      let w = parseInt(inpW.value());
      let h = parseInt(inpH.value());
      if (w > 0 && h > 0) resizeCanvas(w, h);
    });

    sizeRow.child(inpW);
    sizeRow.child(inpH);
    sizeRow.child(btnResize);

    grpSize.child(labelSize);
    grpSize.child(sizeRow);

    controls.child(grpSize);

    // Density
    let grpDensity = createDiv('');
    grpDensity.class('control-group');
    let labelD = createElement('label', 'DENSITY');
    let slider = createSlider(5, 50, 15);
    slider.id('densitySlider');
    grpDensity.child(labelD);
    grpDensity.child(slider);

    // Shape
    let grpShape = createDiv('');
    grpShape.class('control-group');
    let labelS = createElement('label', 'SHAPE');
    let sel = createSelect();
    sel.id('shapeSelect');
    sel.option('CIRCLE');
    sel.option('SQUARE');
    grpShape.child(labelS);
    grpShape.child(sel);

    // BG Color
    let grpBg = createDiv('');
    grpBg.class('control-group');
    let labelBg = createElement('label', 'BG COLOR');
    let pickBg = createColorPicker('#f0f0f0');
    pickBg.id('bgColorPicker');
    grpBg.child(labelBg);
    grpBg.child(pickBg);

    // FG Color
    let grpFg = createDiv('');
    grpFg.class('control-group');
    let labelFg = createElement('label', 'FG COLOR');
    let pickFg = createColorPicker('#1e1e1e');
    pickFg.id('fgColorPicker');
    grpFg.child(labelFg);
    grpFg.child(pickFg);

    controls.child(grpDensity);
    controls.child(grpShape);
    controls.child(grpBg);
    controls.child(grpFg);
  }

  // 3. Create Modal if not present
  if (!select('#saveModal')) {
    let modal = createDiv('');
    modal.id('saveModal');
    modal.class('modal');

    let content = createDiv('');
    content.class('modal-content');

    let p = createElement('p', 'EXPORT DESIGN');

    let btnGroup = createDiv('');
    btnGroup.class('button-group');

    let btnPng = createButton('PNG');
    btnPng.mousePressed(() => { window.exportPNG(); });

    let btnSvg = createButton('SVG');
    btnSvg.mousePressed(() => { window.exportSVG(); });

    btnGroup.child(btnPng);
    btnGroup.child(btnSvg);

    let btnCancel = createButton('CANCEL');
    btnCancel.class('cancel-btn');
    btnCancel.mousePressed(() => { window.closeModal(); });

    content.child(p);
    content.child(btnGroup);
    content.child(btnCancel);
    modal.child(content);
  }
}


function draw() {
  let bg = bgColorPicker ? color(bgColorPicker.value()) : color(240);
  let fg = fgColorPicker ? color(fgColorPicker.value()) : color(30);

  background(bg);

  // Update grid spacing
  if (densitySlider) {
    gridSpacing = densitySlider.value();
  }

  drawPattern(this, fg);
  drawLegend(fg);
}

// Generic drawing function that works on any renderer (screen or SVG buffer)
function drawPattern(pg, fgColor) {
  // Define the shape boundary (Circle or Square)
  let shapeCenterX = width / 2;
  let shapeCenterY = height / 2;
  let shapeRadius = min(width, height) * 0.4; // Responsive radius

  // Interaction center (Mouse or Center if mouse not moved much)
  let interactX = mouseX;
  let interactY = mouseY;

  // Default to center if mouse is at 0,0 (start)
  if (mouseX === 0 && mouseY === 0) {
    interactX = width / 2;
    interactY = height / 2;
  }

  pg.stroke(fgColor);
  pg.fill(fgColor);

  for (let x = 0; x <= width; x += parseInt(gridSpacing)) {
    for (let y = 0; y <= height; y += parseInt(gridSpacing)) {

      let insideShape = false;

      if (currentShape === 'CIRCLE') {
        let d = dist(x, y, shapeCenterX, shapeCenterY);
        if (d < shapeRadius) insideShape = true;
      } else if (currentShape === 'SQUARE') {
        // Square boundary logic
        if (Math.abs(x - shapeCenterX) < shapeRadius && Math.abs(y - shapeCenterY) < shapeRadius) {
          insideShape = true;
        }
      }

      if (insideShape) {
        pg.push();
        pg.translate(x, y);

        // Calculate dynamic properties based on interaction
        let dInteract = dist(x, y, interactX, interactY);

        // Logic to mimic the reference image:
        // The distortion logic:
        // Calculate vector from grid point to mouse
        let dx = x - interactX;
        let dy = y - interactY;

        // This creates a "magnetic" looking field or flow
        let angle = atan2(dy, dx);

        pg.rotate(angle);

        drawSymbol(pg, dInteract, fgColor);

        pg.pop();
      }
    }
  }
}

function drawSymbol(pg, distFactor, fgColor) {
  let size = gridSpacing * 0.8;
  pg.strokeWeight(1.5);
  pg.stroke(fgColor);

  // Note: For SimpleSVG, fill() logic is handled inside classes,
  // but if we call pg.fill here, p5 Graphics handles it, SimpleSVG needs to too.
  pg.fill(fgColor);

  if (currentSymbol === 'LINE') {
    pg.line(-size / 2, 0, size / 2, 0);
  } else if (currentSymbol === 'SQUARE') {
    pg.noFill();
    pg.rect(0, 0, size, size);
  } else if (currentSymbol === 'TEXT') {
    pg.noStroke();
    pg.textSize(size);
    pg.text(inputChar, 0, 0);
  }
}

function drawLegend(c) {
  push();
  resetMatrix();

  fill(c);
  noStroke();
  textAlign(LEFT, BASELINE);
  textSize(12);
  textFont('Courier New');

  let tempX = 20;
  let tempY = height - 80;
  let leading = 16;

  text("[1] LINE", tempX, tempY);
  text("[2] SQUARE", tempX, tempY + leading);
  text("[3] TEXT", tempX, tempY + leading * 2);
  text("[S] SAVE/EXPORT", tempX, tempY + leading * 3);
  pop();
}

function keyPressed() {
  if (key === '1') currentSymbol = 'LINE';
  else if (key === '2') currentSymbol = 'SQUARE';
  else if (key === '3') currentSymbol = 'TEXT';
  // Allow typing characters for the TEXT mode
  else if (key.length === 1 && currentSymbol === 'TEXT') {
    inputChar = key.toUpperCase();
  }

  if (key === 's' || key === 'S') {
    openModal();
  }
}

// Modal & Export Logic
function openModal() {
  document.getElementById('saveModal').style.display = 'flex';
  noLoop(); // Pause rendering
}

function closeModal() {
  document.getElementById('saveModal').style.display = 'none';
  loop(); // Resume
}

function exportPNG() {
  let bg = color(bgColorPicker.value());
  let fg = color(fgColorPicker.value());

  // Create offscreen graphics for PNG to exclude UI
  // Use current width/height
  let pg = createGraphics(width, height);
  pg.background(bg); // Match the paper background
  pg.angleMode(DEGREES);
  pg.rectMode(CENTER);
  pg.textAlign(CENTER, CENTER);

  // Draw only the design
  drawPattern(pg, fg);

  // Save
  pg.save('design.png');
  closeModal();
}

function exportSVG() {
  let fg = color(fgColorPicker.value());

  // Instantiate our custom SVG Exporter
  let svg = new SimpleSVG(width, height);

  // Mimic p5 settings where applicable
  // angleMode is DEGREES by default in SimpleSVG logic below to match sketch

  // Draw the pattern to the SVG
  drawPattern(svg, fg);

  // Save the file
  svg.save('design.svg');

  closeModal();
}

// Expose functions to global scope for HTML buttons
window.exportPNG = exportPNG;
window.exportSVG = exportSVG;
window.closeModal = closeModal;

// --- Custom SimpleSVG Class ---
class SimpleSVG {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.root = { type: 'root', children: [], transform: [] };
    this.currentNode = this.root;
    this.nodeStack = [];

    this.styleStack = [];
    this.currentStyle = {
      fill: 'none', stroke: 'none', strokeWeight: 1,
      hasFill: true, hasStroke: true
    };
  }

  parseColor(c) {
    if (c && c.toString) return c.toString();
    return c;
  }

  push() {
    this.nodeStack.push(this.currentNode);
    this.styleStack.push({ ...this.currentStyle });

    let newNode = { type: 'g', children: [], transform: [] };
    this.currentNode.children.push(newNode);
    this.currentNode = newNode;
  }

  pop() {
    if (this.nodeStack.length > 0) {
      this.currentNode = this.nodeStack.pop();
    }
    if (this.styleStack.length > 0) {
      this.currentStyle = this.styleStack.pop();
    }
  }

  translate(x, y) {
    this.currentNode.transform.push(`translate(${x}, ${y})`);
  }

  rotate(deg) {
    // p5 in this sketch uses DEGREES
    this.currentNode.transform.push(`rotate(${deg})`);
  }

  fill(c) {
    this.currentStyle.fill = this.parseColor(c);
    this.currentStyle.hasFill = true;
  }
  noFill() {
    this.currentStyle.hasFill = false;
  }

  stroke(c) {
    this.currentStyle.stroke = this.parseColor(c);
    this.currentStyle.hasStroke = true;
  }
  noStroke() {
    this.currentStyle.hasStroke = false;
  }
  strokeWeight(w) {
    this.currentStyle.strokeWeight = w;
  }

  // Primitives
  rect(x, y, w, h) {
    // p5 rect is CENTER mode in this sketch
    let rx = x - w / 2;
    let ry = y - h / 2;
    this.addShape('rect', { x: rx, y: ry, width: w, height: h });
  }

  line(x1, y1, x2, y2) {
    this.addShape('line', { x1, y1, x2, y2 });
  }

  text(str, x, y) {
    // Basic text support
    this.addShape('text', { x, y, _content: str });
  }

  textSize(s) {
    // Store in current node style? Or simplified prop.
    // For now, attach to style or just attributes.
    this.currentStyle.fontSize = s;
  }

  addShape(type, attrs) {
    let shape = { type, attrs, style: { ...this.currentStyle } };
    this.currentNode.children.push(shape);
  }

  // Dummy methods to prevent crash if sketch calls them
  background() { }
  angleMode() { }
  rectMode() { }
  textAlign() { }

  // Output
  save(filename) {
    let svgBody = this.renderNode(this.root);
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
      ${svgBody}
    </svg>`;

    let blob = new Blob([svgContent], { type: 'image/svg+xml' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  renderNode(node) {
    if (node.type === 'root') {
      return node.children.map(c => this.renderNode(c)).join('');
    }

    if (node.type === 'g') {
      let t = node.transform.length ? `transform="${node.transform.join(' ')}"` : '';
      let content = node.children.map(c => this.renderNode(c)).join('');
      return `<g ${t}>${content}</g>`;
    }

    // shapes
    let s = node.style;
    let fill = s.hasFill ? s.fill : 'none';
    let stroke = s.hasStroke ? s.stroke : 'none';
    let sw = s.strokeWeight;
    let styles = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
    if (s.fontSize) styles += ` font-family="Courier New" font-size="${s.fontSize}" text-anchor="middle" dominant-baseline="middle"`; // centering hack

    let attrs = Object.entries(node.attrs).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}="${v}"`).join(' ');

    if (node.type === 'text') {
      return `<text ${attrs} ${styles}>${node.attrs._content}</text>`;
    }

    return `<${node.type} ${attrs} ${styles} />`;
  }
}
