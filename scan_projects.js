//node scan_projects.js
const fs = require('fs');
const path = require('path');
const { marked } = require('marked'); // Import marked

const PROJECTS_DIR = path.join(__dirname, 'projects');
const OUTPUT_FILE = path.join(__dirname, 'data.json');

// Allowed image extensions
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4', '.webm', '.mov'];

function scanProjects() {
    if (!fs.existsSync(PROJECTS_DIR)) {
        console.error(`Error: Projects directory not found at ${PROJECTS_DIR}`);
        return;
    }

    const projects = [];
    const items = fs.readdirSync(PROJECTS_DIR);

    items.forEach(item => {
        const itemPath = path.join(PROJECTS_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) {
            // It's a folder, let's process it
            const projectData = {
                id: item,
                title: item.replace(/[-_]/g, ' '), // Default title: replace separators with spaces
                description: "",
                images: [],
                date: "",
                tags: []
            };

            // Check for info.json
            const infoPath = path.join(itemPath, 'info.json');
            if (fs.existsSync(infoPath)) {
                try {
                    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                    projectData.title = info.title || projectData.title;
                    projectData.description = info.description || ""; // fallback
                    projectData.date = info.date || "";
                    projectData.tags = info.tags || [];
                } catch (err) {
                    console.warn(`Warning: Invalid info.json in ${item}`);
                }
            }

            // Look for description.md (preferred) or description.txt
            const mdPath = path.join(itemPath, 'description.md');
            const txtPath = path.join(itemPath, 'description.txt');
            const legacyTxtPath = path.join(itemPath, 'text.txt');

            if (fs.existsSync(mdPath)) {
                const mdContent = fs.readFileSync(mdPath, 'utf8');
                projectData.description = marked.parse(mdContent); // Convert MD to HTML
            } else if (fs.existsSync(txtPath)) {
                // Wrap plain text in simple paragraphs or just keep as string (but we'll stick to HTML standard now)
                const txtContent = fs.readFileSync(txtPath, 'utf8');
                // Simple conversion: newlines to <br> or wrap in <p>
                projectData.description = `<p>${txtContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
            } else if (fs.existsSync(legacyTxtPath)) {
                const txtContent = fs.readFileSync(legacyTxtPath, 'utf8');
                projectData.description = `<p>${txtContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
            }

            // Scan for images
            const files = fs.readdirSync(itemPath);
            const images = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return IMAGE_EXTS.includes(ext);
            }).sort(); // Alphabetical sort ensures order if named 01.jpg, 02.jpg

            projectData.images = images.map(img => `projects/${item}/${img}`);

            // only add if it has images
            if (projectData.images.length > 0) {
                projects.push(projectData);
            }
        }
    });

    // Sort projects: newest first? or alphabetical?
    // Let's rely on info.json date if present, otherwise create time?
    // For now, let's keep filesystem order or reverse it (newest usually added last)
    // or maybe simple alphabetical.
    // Let's try to reverse them so "newest" folder (if named sequentially) comes first?
    // Actually, explicit sort is better.
    // We'll leave as scanned order for now, but valid requirement for later.

    // ... (previous code) ...

    // Scan About.md
    let aboutHtml = "";
    const aboutPath = path.join(__dirname, 'about.md');
    if (fs.existsSync(aboutPath)) {
        aboutHtml = marked.parse(fs.readFileSync(aboutPath, 'utf8'));
    }

    const outputData = {
        projects: projects,
        about: aboutHtml
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    console.log(`Successfully generated data.json with ${projects.length} projects and About section.`);
}

scanProjects();
