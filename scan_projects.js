// node scan_projects.js
// This script scans the 'projects' directory for project folders, processes images (creating thumbnails),
// reads metadata (from info.json or package.json), and generates a 'data.json' file for the frontend.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const sharp = require('sharp');

// Paths
const PROJECTS_DIR = path.join(__dirname, 'projects');
const OUTPUT_FILE = path.join(__dirname, 'data.json');

// Configuration
const CONFIG = {
    imageExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'],
    videoExts: ['.mp4', '.webm', '.mov'],
    thumbSize: 1500, // Width in pixels
    thumbQuality: 72 // PPI
};

/**
 * Compresses/Resizes an image using Sharp.
 * @param {string} sourcePath - Path to the original image.
 * @param {string} destPath - Path to save the processed image.
 */
async function processImage(sourcePath, destPath) {
    try {
        await sharp(sourcePath)
            .resize({ width: CONFIG.thumbSize, withoutEnlargement: true })
            .withMetadata({ density: CONFIG.thumbQuality })
            .toFile(destPath);
        console.log(`Processed: ${path.basename(destPath)}`);
    } catch (err) {
        console.error(`Error processing ${sourcePath}:`, err);
    }
}

/**
 * Main function to scan projects and generate JSON data.
 */
async function scanProjects() {
    if (!fs.existsSync(PROJECTS_DIR)) {
        console.error(`Error: Projects directory not found at ${PROJECTS_DIR}`);
        return;
    }

    const projects = [];
    const items = fs.readdirSync(PROJECTS_DIR);

    for (const item of items) {
        const itemPath = path.join(PROJECTS_DIR, item);

        // Skip non-directory items
        if (!fs.statSync(itemPath).isDirectory()) continue;

        console.log(`Scanning project: ${item}`);

        // --- 1. Image Processing ---
        const compressedDir = path.join(itemPath, 'compressed');
        if (!fs.existsSync(compressedDir)) {
            fs.mkdirSync(compressedDir);
        }

        const files = fs.readdirSync(itemPath);
        const projectImages = []; // Stores { thumb, full, type }
        const validCompressedFiles = new Set(); // Track used compressed files

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const filePath = path.join(itemPath, file);

            // Skip directories (e.g., 'compressed')
            if (fs.statSync(filePath).isDirectory()) continue;

            if (CONFIG.imageExts.includes(ext)) {
                const compressedFilePath = path.join(compressedDir, file);

                // Generate compressed version if it doesn't exist
                if (!fs.existsSync(compressedFilePath)) {
                    await processImage(filePath, compressedFilePath);
                }

                validCompressedFiles.add(file);

                projectImages.push({
                    type: 'image',
                    full: `projects/${item}/${file}`,
                    thumb: `projects/${item}/compressed/${file}`
                });

            } else if (CONFIG.videoExts.includes(ext)) {
                // Videos are not compressed, just linked
                projectImages.push({
                    type: 'video',
                    full: `projects/${item}/${file}`,
                    thumb: `projects/${item}/${file}`
                });
            }
        }

        // --- Cleanup Unused Compressed Files ---
        if (fs.existsSync(compressedDir)) {
            const existingCompressed = fs.readdirSync(compressedDir);
            for (const cFile of existingCompressed) {
                if (!validCompressedFiles.has(cFile)) {
                    const cPath = path.join(compressedDir, cFile);
                    try {
                        fs.unlinkSync(cPath);
                        console.log(`Removed unused file: ${cPath}`);
                    } catch (err) {
                        console.error(`Error removing file ${cPath}:`, err);
                    }
                }
            }
        }

        // Sort media alphabetically
        projectImages.sort((a, b) => {
            return path.basename(a.full).localeCompare(path.basename(b.full));
        });

        // --- 2. Metadata Extraction ---
        const projectData = {
            id: item,
            title: item.replace(/[-_]/g, ' '), // Default title from folder name
            description: "",
            images: projectImages,
            date: "",
            tags: [],
            website: "",
            github: ""
        };

        // Paths for metadata files
        const infoPath = path.join(itemPath, 'info.json');
        const packagePath = path.join(itemPath, 'package.json');

        // A. Try reading package.json (common for code projects)
        if (fs.existsSync(packagePath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                projectData.title = projectData.title || pkg.name;
                projectData.description = pkg.description || "";
                projectData.website = pkg.homepage || "";

                // Extract clean GitHub URL
                if (pkg.repository) {
                    let repoUrl = (typeof pkg.repository === 'string') ? pkg.repository : pkg.repository.url;
                    projectData.github = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '');
                }

                if (pkg.keywords && Array.isArray(pkg.keywords)) {
                    projectData.tags = pkg.keywords;
                }
            } catch (err) {
                console.warn(`Warning: Invalid package.json in ${item}`);
            }
        }

        // B. Try reading info.json (Overwrites package.json if fields exist)
        if (fs.existsSync(infoPath)) {
            try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                if (info.title) projectData.title = info.title;
                if (info.description) projectData.description = info.description;
                if (info.date) projectData.date = info.date;
                if (info.tags) projectData.tags = info.tags;
                if (info.website) projectData.website = info.website;
                if (info.github) projectData.github = info.github;
            } catch (err) {
                console.warn(`Warning: Invalid info.json in ${item}`);
            }
        }

        // --- 3. Description Content (Markdown/Text) ---
        const mdPath = path.join(itemPath, 'description.md');
        // Check for multiple text file variations
        const txtPath = fs.existsSync(path.join(itemPath, 'description.txt')) ?
            path.join(itemPath, 'description.txt') :
            path.join(itemPath, 'text.txt');

        if (fs.existsSync(mdPath)) {
            projectData.description = marked.parse(fs.readFileSync(mdPath, 'utf8'));
        } else if (fs.existsSync(txtPath)) {
            const txt = fs.readFileSync(txtPath, 'utf8');
            // Simple text-to-html conversion
            projectData.description = `<p>${txt.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        }

        // Only add project if it has content (images or description)
        if (projectData.images.length > 0 || projectData.description) {
            projects.push(projectData);
        }
    }

    // --- 4. Global Site Data (About Me) ---
    let aboutHtml = "";
    const aboutPath = path.join(__dirname, 'about.md');
    if (fs.existsSync(aboutPath)) {
        aboutHtml = marked.parse(fs.readFileSync(aboutPath, 'utf8'));
    }

    // --- 5. Save Output ---
    const outputData = {
        projects: projects,
        about: aboutHtml
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    console.log(`Successfully generated data.json with ${projects.length} projects.`);
}

// Run the scan
scanProjects();
