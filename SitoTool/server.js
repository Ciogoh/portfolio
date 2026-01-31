const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const admZip = require('adm-zip');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Configure Upload
const upload = multer({ dest: 'uploads/' });

// --- HELPERS ---
function getDB() {
    if (!fs.existsSync(DB_FILE)) return { tools: [] };
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));
}

// --- API ROUTES ---

// GET /api/tools - Get all tools (optional filter for hidden)
app.get('/api/tools', (req, res) => {
    const db = getDB();
    const isAdmin = req.query.admin === 'true';

    // If not admin, filter out hidden tools
    const tools = isAdmin ? db.tools : db.tools.filter(t => !t.hidden);
    res.json(tools);
});

// POST /api/tools - Add a new tool manually
app.post('/api/tools', (req, res) => {
    const db = getDB();
    const newTool = {
        id: Date.now().toString(),
        title: req.body.title,
        description: req.body.description,
        path: req.body.path,
        date: new Date().toISOString().split('T')[0],
        tags: req.body.tags || [],
        hidden: req.body.hidden || false
    };

    db.tools.unshift(newTool); // Add to top
    saveDB(db);
    res.json(newTool);
});

// POST /api/upload - Upload a ZIP and register tool
app.post('/api/upload', upload.single('zipFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { title, description, tags } = req.body;
    const zipPath = req.file.path;
    const folderName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const extractPath = path.join(PUBLIC_DIR, folderName);

    try {
        // Extract ZIP
        const zip = new admZip(zipPath);
        zip.extractAllTo(extractPath, true); // overwrite true

        // Cleanup zip
        fs.unlinkSync(zipPath);

        // Add to DB
        const db = getDB();
        const newTool = {
            id: folderName,
            title: title,
            description: description || "",
            path: `${folderName}/index.html`, // Assumption: zip contains index.html at root
            date: new Date().toISOString().split('T')[0],
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            hidden: false
        };

        // Remove old if exists
        const idx = db.tools.findIndex(t => t.id === newTool.id);
        if (idx >= 0) db.tools.splice(idx, 1);

        db.tools.unshift(newTool);
        saveDB(db);

        res.json(newTool);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Extraction failed' });
    }
});

// PUT /api/tools/:id - Update tool
app.put('/api/tools/:id', (req, res) => {
    const db = getDB();
    const idx = db.tools.findIndex(t => t.id === req.params.id);

    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    // Update fields
    const tool = db.tools[idx];
    if (req.body.title) tool.title = req.body.title;
    if (req.body.description) tool.description = req.body.description;
    if (req.body.tags) tool.tags = req.body.tags;
    if (req.body.hidden !== undefined) tool.hidden = req.body.hidden;

    saveDB(db);
    res.json(tool);
});

// DELETE /api/tools/:id - Delete tool
app.delete('/api/tools/:id', (req, res) => {
    const db = getDB();
    const idx = db.tools.findIndex(t => t.id === req.params.id);

    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    // Optional: Delete physical folder logic here (skipping to be safe)

    db.tools.splice(idx, 1);
    saveDB(db);
    res.json({ success: true });
});

// Start Server
app.listen(PORT, () => {
    console.log(`SERVER ONLINE: http://localhost:${PORT}`);
    console.log(`ROOT_DIR: ${PUBLIC_DIR}`);
});
