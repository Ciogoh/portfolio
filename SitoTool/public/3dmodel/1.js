let myModel = null;
let song = null;
let amp;
let statusMsg;

// Sliders
let sliderSpace, sliderSens, sliderNoiseSpeed, sliderBaseSize;
let playButton;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  
  // --- 1. CONTROLLO SICUREZZA LIBRERIA AUDIO ---
  if (typeof p5.Amplitude === 'undefined') {
    alert("ERRORE: Manca la libreria p5.sound! Aggiungila all'HTML o nel web editor.");
    return; // Blocca tutto se manca l'audio
  }

  // --- 2. INTERFACCIA DI UPLOAD (Ben distanziata) ---
  
  // Etichetta per OBJ
  let labelObj = createP("1. Carica Modello (.obj)");
  labelObj.position(20, 0);
  labelObj.style('color', '#ff9900'); // Arancione
  
  // Input OBJ
  let inputObj = createFileInput(handleObjFile);
  inputObj.position(20, 35);
  inputObj.style('color', 'white');

  // Etichetta per MP3
  let labelAudio = createP("2. Carica Musica (.mp3)");
  labelAudio.position(20, 60);
  labelAudio.style('color', '#0099ff'); // Azzurro
  
  // Input MP3 (Questo è quello che mancava o non si vedeva)
  let inputAudio = createFileInput(handleAudioFile);
  inputAudio.position(20, 95);
  inputAudio.style('color', 'white');

  // --- 3. CONTROLLI LIVE ---
  
  let startY = 140; // Spostiamo tutto più in basso

  createP('Distanza Griglia').position(20, startY).style('color', '#fff');
  sliderSpace = createSlider(50, 800, 400); 
  sliderSpace.position(20, startY + 30);
  
  createP('Reazione Bassi').position(20, startY + 50).style('color', '#fff');
  sliderSens = createSlider(0, 10, 1, 0.1); // Scala rivista per reattività migliore
  sliderSens.position(20, startY + 80);

  createP('Velocità Onda').position(20, startY + 100).style('color', '#fff');
  sliderNoiseSpeed = createSlider(0.001, 0.1, 0.01, 0.001);
  sliderNoiseSpeed.position(20, startY + 130);
  
  createP('Dimensione Oggetti').position(20, startY + 150).style('color', '#fff');
  sliderBaseSize = createSlider(0.1, 5, 1, 0.1);
  sliderBaseSize.position(20, startY + 180);

  // Bottone Play
  playButton = createButton('▶ PLAY / PAUSA');
  playButton.position(20, startY + 230);
  playButton.size(150, 40);
  playButton.style('font-size', '16px');
  playButton.style('cursor', 'pointer');
  playButton.mousePressed(toggleAudio);
  
  // Messaggio Stato
  statusMsg = createP("In attesa dei file...");
  statusMsg.position(200, 20);
  statusMsg.style('color', '#fff');
  statusMsg.style('background', 'rgba(0,0,0,0.7)');
  statusMsg.style('padding', '10px');
  statusMsg.style('font-size', '18px');

  // Audio setup
  amp = new p5.Amplitude();
  
  noStroke();
}

function draw() {
  background(20); 
  
  // Luci
  ambientLight(50);
  pointLight(255, 255, 255, 0, -200, 200);
  directionalLight(255, 100, 100, -1, 0, -0.5); 
  directionalLight(0, 100, 255, 1, 0, -0.5);

  orbitControl();

  if (!myModel) return;

  // Analisi Volume
  let level = 0;
  if (song && song.isPlaying()) {
    level = amp.getLevel(); 
    // Fluidità: interpoliamo il livello per evitare scatti
    // level = lerp(prevLevel, level, 0.1); (Opzionale per dopo)
  }

  let space = sliderSpace.value();
  let sensitivity = sliderSens.value();
  let nSpeed = sliderNoiseSpeed.value();
  let baseScale = sliderBaseSize.value();

  let cols = 6; // Numero colonne
  let rows = 6; // Numero righe
  
  translate(- (cols * space) / 2 + space/2, - (rows * space) / 2 + space/2);

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      push();
      
      let xPos = x * space;
      let yPos = y * space;
      
      // Noise 3D
      let noiseVal = noise(x * 0.15, y * 0.15, frameCount * nSpeed);
      
      // I cubi si muovono sull'asse Z (verso di te) in base al noise
      let zPos = map(noiseVal, 0, 1, -500, 500);
      
      translate(xPos, yPos, zPos);
      
      // Rotazione complessa
      rotateX(frameCount * 0.01 + noiseVal);
      rotateY(frameCount * 0.01 + noiseVal);
      
      // La musica influenza la SCALA
      // sensitivity moltiplica l'effetto della musica
      let musicEffect = level * sensitivity * (1 + noiseVal * 2); 
      let finalScale = baseScale + musicEffect;
      
      scale(finalScale);
      
      // Colore dinamico in base alla musica
      let r = map(level, 0, 0.5, 100, 255);
      let g = 100;
      let b = map(noiseVal, 0, 1, 150, 255);
      specularMaterial(r, g, b);
      shininess(30);
      
      model(myModel);
      pop();
    }
  }
}

// --- GESTIONE FILE ---

function handleObjFile(file) {
  if (file.name.endsWith('.obj')) {
    statusMsg.html("⚙️ Elaborazione OBJ...");
    if (file.file) {
      let url = URL.createObjectURL(file.file);
      loadModel(url, true, (m) => {
        myModel = m;
        statusMsg.html("✅ OBJ Caricato! Ora carica la musica.");
        URL.revokeObjectURL(url);
      }, (e) => console.error(e), '.obj');
    }
  } else {
    alert("Per favore carica un file .obj");
  }
}

function handleAudioFile(file) {
  if (file.type.toString().includes('audio')) {
    statusMsg.html("🎵 Caricamento Audio...");
    if (file.file) {
       song = loadSound(file.file, () => {
         statusMsg.html("✅ Audio Pronto! Premi PLAY.");
       });
    }
  } else {
    alert("Devi caricare un file audio (mp3/wav)");
  }
}

function toggleAudio() {
  if (song) {
    if (song.isPlaying()) {
      song.pause();
      playButton.html('▶ PLAY');
    } else {
      song.loop();
      playButton.html('⏸ PAUSA');
    }
  } else {
    alert("Carica prima un file MP3!");
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}