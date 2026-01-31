//node scan_projects.js
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const sharp = require('sharp');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const ORIGINALS_DIR = path.join(__dirname, 'originals'); // Old originals location
const OUTPUT_FILE = path.join(__dirname, 'data.json');

// Allowed image extensions
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov'];

async function processImage(sourcePath, destPath) {
    try {
        await sharp(sourcePath)
            .resize({ width: 1500, withoutEnlargement: true }) // Good size for previews
            .withMetadata({ density: 72 }) // 72 PPI
            .toFile(destPath);
        console.log(`Compressed: ${path.basename(destPath)}`);
    } catch (err) {
        console.error(`Error processing ${sourcePath}:`, err);
    }
}

async function restoreOriginalsAndScan() {
    if (!fs.existsSync(PROJECTS_DIR)) {
        console.error(`Error: Projects directory not found at ${PROJECTS_DIR}`);
        return;
    }

    // --- MIGRATION: Restore files from 'originals' to 'projects' ---
    if (fs.existsSync(ORIGINALS_DIR)) {
        console.log("Migrating originals back to project folders...");
        const originalProjects = fs.readdirSync(ORIGINALS_DIR);

        for (const proj of originalProjects) {
            const srcDir = path.join(ORIGINALS_DIR, proj);
            const destDir = path.join(PROJECTS_DIR, proj);

            if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                const files = fs.readdirSync(srcDir);
                for (const file of files) {
                    const srcFile = path.join(srcDir, file);
                    const destFile = path.join(destDir, file);
                    // Overwrite whatever is in destination (the old optimized version) with this original
                    fs.renameSync(srcFile, destFile);
                    console.log(`Restored original: ${file}`);
                }
                fs.rmdirSync(srcDir); // Remove project folder in originals
            }
        }
        fs.rmdirSync(ORIGINALS_DIR); // Remove root originals folder
        console.log("Migration complete. 'originals' folder removed.");
    }
    // ---------------------------------------------------------------

    const projects = [];
    const items = fs.readdirSync(PROJECTS_DIR);

    for (const item of items) {
        const itemPath = path.join(PROJECTS_DIR, item);

        if (fs.statSync(itemPath).isDirectory()) {
            console.log(`Scanning project: ${item}`);

            // Prepare 'compressed' folder inside project
            const compressedDir = path.join(itemPath, 'compressed');
            if (!fs.existsSync(compressedDir)) {
                fs.mkdirSync(compressedDir);
            }

            const files = fs.readdirSync(itemPath);
            const projectImages = []; // Stores { thumb, full, type }

            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                const filePath = path.join(itemPath, file); // This IS the original now

                // Skip directories (like 'compressed')
                if (fs.statSync(filePath).isDirectory()) continue;

                if (IMAGE_EXTS.includes(ext)) {
                    const compressedFilePath = path.join(compressedDir, file);

                    // Generate compressed version if not exists (or logic to force? assume sync for now)
                    if (!fs.existsSync(compressedFilePath)) {
                        await processImage(filePath, compressedFilePath);
                    }

                    projectImages.push({
                        type: 'image',
                        full: `projects/${item}/${file}`,
                        thumb: `projects/${item}/compressed/${file}`
                    });

                } else if (VIDEO_EXTS.includes(ext)) {
                    projectImages.push({
                        type: 'video',
                        full: `projects/${item}/${file}`,
                        thumb: `projects/${item}/${file}` // No compression for video yet
                    });
                }
            }

            // Sort images alphabetically by filename
            projectImages.sort((a, b) => {
                const nameA = path.basename(a.full);
                const nameB = path.basename(b.full);
                return nameA.localeCompare(nameB);
            });


            // Build project data
            const projectData = {
                id: item,
                title: item.replace(/[-_]/g, ' '),
                description: "",
                images: projectImages, // Now array of objects
                date: "",
                tags: []
            };

            // Read Metadata
            const infoPath = path.join(itemPath, 'info.json');
            const packagePath = path.join(itemPath, 'package.json');

            // Initialize with defaults
            projectData.website = "";
            projectData.github = "";

            // Try reading package.json first (standard node/github metadata)
            if (fs.existsSync(packagePath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                    projectData.title = projectData.title || pkg.name;
                    projectData.description = pkg.description || "";
                    projectData.website = pkg.homepage || "";
                    if (pkg.repository) {
                        projectData.github = (typeof pkg.repository === 'string') ?
                            pkg.repository : pkg.repository.url;
                        // Clean up git+https or .git
                        projectData.github = projectData.github.replace(/^git\+/, '').replace(/\.git$/, '');
                    }
                    if (pkg.keywords && Array.isArray(pkg.keywords)) {
                        projectData.tags = pkg.keywords;
                    }
                } catch (err) { console.warn(`Warning: Invalid package.json in ${item}`); }
            }

            // info.json overrides package.json if present (custom manual override)
            if (fs.existsSync(infoPath)) {
                try {
                    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                    projectData.title = info.title || projectData.title;
                    projectData.description = info.description || projectData.description;
                    projectData.date = info.date || projectData.date;
                    projectData.tags = info.tags || projectData.tags;
                    projectData.website = info.website || projectData.website;
                    projectData.github = info.github || projectData.github;
                } catch (err) { console.warn(`Warning: Invalid info.json in ${item}`); }
            }

            // Read Description
            const mdPath = path.join(itemPath, 'description.md');
            const txtPath = path.join(itemPath, 'description.txt');
            const legacyTxtPath = path.join(itemPath, 'text.txt');

            if (fs.existsSync(mdPath)) {
                projectData.description = marked.parse(fs.readFileSync(mdPath, 'utf8'));
            } else if (fs.existsSync(txtPath)) {
                const txt = fs.readFileSync(txtPath, 'utf8');
                projectData.description = `<p>${txt.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
            } else if (fs.existsSync(legacyTxtPath)) {
                const txt = fs.readFileSync(legacyTxtPath, 'utf8');
                projectData.description = `<p>${txt.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
            }

            if (projectData.images.length > 0) {
                projects.push(projectData);
            }
        }
    }

    // About
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
    console.log(`Successfully generated data.json with ${projects.length} projects.`);
}

restoreOriginalsAndScan();
