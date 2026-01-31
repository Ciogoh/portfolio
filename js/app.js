/**
 * Portfolio Application Logic
 * Handles interactive elements:
 * - Kinetic/Floating project previews
 * - JSON data fetching (projects & about)
 * - Lightbox for full-screen media
 * - Overlays for Project Details and About section
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const listContainer = document.getElementById('project-list');

    // Preview Overlay Elements
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');

    // Project Overlay Elements
    const overlay = document.getElementById('project-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMeta = document.getElementById('overlay-meta');
    const overlayDesc = document.getElementById('overlay-description');
    const overlayGallery = document.getElementById('overlay-gallery');

    // About Overlay Elements
    const aboutOverlay = document.getElementById('about-overlay');
    const aboutTitle = document.getElementById('about-title');
    const aboutDescContainer = document.getElementById('about-description');

    // Navigation Elements
    const logoLink = document.querySelector('.logo');
    const workLink = document.querySelector('nav a[class="active"]'); // "Work" link

    // --- Kinetic Preview Logic (Floating Image) ---
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let previewPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let isHovering = false;

    // Track mouse position globally
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    /**
     * Animation Loop for fluid movement
     * Interpolates the preview image position towards the mouse cursor
     */
    function animate() {
        const ease = 0.1; // Smoothness factor (lower is slower)

        // Interpolation
        const dx = mouse.x - previewPos.x;
        const dy = mouse.y - previewPos.y;

        previewPos.x += dx * ease;
        previewPos.y += dy * ease;

        // Calculate dynamic tilt based on velocity
        const rotate = Math.max(Math.min(dx * 0.02, 10), -10);

        if (isHovering) {
            previewContainer.classList.add('visible');
            const width = previewContainer.offsetWidth;
            const height = previewContainer.offsetHeight;

            // Apply transform: move to mouse pos (centered) + tilt
            previewContainer.style.transform = `translate(${previewPos.x - width / 2}px, ${previewPos.y - height / 2}px) rotate(${rotate}deg) skewX(${rotate}deg)`;

            // --- Dynamic Text Inversion ---
            // Detect overlap between the floating image and project items
            const imgRect = {
                left: previewPos.x - width / 2,
                right: previewPos.x + width / 2,
                top: previewPos.y - height / 2,
                bottom: previewPos.y + height / 2
            };

            document.querySelectorAll('.project-item').forEach(item => {
                const itemRect = item.getBoundingClientRect();
                // Simple AABB collision detection
                const overlaps = !(itemRect.right < imgRect.left ||
                    itemRect.left > imgRect.right ||
                    itemRect.bottom < imgRect.top ||
                    itemRect.top > imgRect.bottom);

                if (overlaps) {
                    item.classList.add('inverted');
                } else {
                    item.classList.remove('inverted');
                }
            });

        } else {
            previewContainer.classList.remove('visible');
            // Clean up inversion classes when not hovering
            document.querySelectorAll('.project-item.inverted').forEach(item => {
                item.classList.remove('inverted');
            });
        }

        requestAnimationFrame(animate);
    }
    animate(); // Start loop

    // --- Data Loading & Initialization ---

    // Sync About Header with Logo Text
    if (logoLink && aboutTitle) {
        aboutTitle.textContent = logoLink.textContent;
    }

    // Fetch Content
    fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const projectsData = data.projects || [];
            const aboutContent = data.about || "";

            renderList(projectsData);

            if (aboutContent && aboutDescContainer) {
                aboutDescContainer.innerHTML = aboutContent;
            }
        })
        .catch(error => {
            console.error('Error loading project data:', error);
            listContainer.innerHTML = '<p class="error">Could not load projects.</p>';
        });

    /**
     * Renders the list of projects into the main container
     */
    function renderList(projects) {
        listContainer.innerHTML = '';
        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.setAttribute('data-id', project.id);

            // Structure: Title | Date | Tags
            const title = document.createElement('h2');
            title.className = 'project-title';
            title.textContent = project.title;

            const dateEl = document.createElement('div');
            dateEl.className = 'project-date';
            dateEl.textContent = project.date || '';

            const tagsEl = document.createElement('div');
            tagsEl.className = 'project-tags';
            tagsEl.textContent = project.tags && project.tags.length > 0 ? project.tags[0] : '';

            item.appendChild(title);
            item.appendChild(dateEl);
            item.appendChild(tagsEl);

            // --- Interactions ---

            // Hover: Show Preview Image(s)
            let slideshowInterval;
            let currentImageIndex = 0;

            item.addEventListener('mouseenter', () => {
                isHovering = true;
                currentImageIndex = 0;

                if (project.images.length > 0) {
                    previewImage.src = project.images[0].thumb;

                    // Cycle images if multiple exist
                    if (project.images.length > 1) {
                        slideshowInterval = setInterval(() => {
                            currentImageIndex = (currentImageIndex + 1) % project.images.length;
                            previewImage.src = project.images[currentImageIndex].thumb;
                        }, 700);
                    }
                }
            });

            item.addEventListener('mouseleave', () => {
                isHovering = false;
                if (slideshowInterval) {
                    clearInterval(slideshowInterval);
                    slideshowInterval = null;
                }
            });

            // Click: Open Details
            item.addEventListener('click', () => {
                openProject(project);
            });

            listContainer.appendChild(item);
        });
    }

    // --- Overlay Management ---

    function closeAllOverlays(e) {
        if (e) e.preventDefault();
        closeProject();
        closeAbout();
    }

    // 1. Project Overlay
    function openProject(project) {
        closeAbout(); // Ensure only one overlay is open

        // Populate Title
        overlayTitle.textContent = project.title;

        // Populate Metadata (Date + Tags + Links)
        overlayMeta.innerHTML = '';

        const dateEl = document.createElement('span');
        dateEl.className = 'meta-date';
        dateEl.textContent = project.date || '2025';

        const metaRight = document.createElement('div');
        metaRight.style.display = 'flex';
        metaRight.style.alignItems = 'center';

        // Tags
        if (project.tags && project.tags.length > 0) {
            const tagsEl = document.createElement('span');
            tagsEl.className = 'meta-tags';
            tagsEl.textContent = project.tags.join(' • ').toUpperCase();
            metaRight.appendChild(tagsEl);
        }

        // Links (Website / GitHub)
        if (project.website) {
            const webLink = document.createElement('a');
            webLink.href = project.website;
            webLink.target = '_blank';
            webLink.textContent = 'WEBSITE ↗';
            webLink.className = 'meta-link';
            metaRight.appendChild(webLink);
        }

        if (project.github) {
            const gitLink = document.createElement('a');
            gitLink.href = project.github;
            gitLink.target = '_blank';
            gitLink.textContent = 'GITHUB ↗';
            gitLink.className = 'meta-link';
            metaRight.appendChild(gitLink);
        }

        overlayMeta.appendChild(dateEl);
        overlayMeta.appendChild(metaRight);

        // Populate Description
        overlayDesc.innerHTML = project.description;

        // Populate Gallery
        overlayGallery.innerHTML = '';
        const images = project.images;
        let i = 0;

        // Grid logic: mix of 1 or 2 images per row
        while (i < images.length) {
            const row = document.createElement('div');
            row.className = 'gallery-row';

            const remaining = images.length - i;
            // Simple logic: If we have enough, do a pair, otherwise single
            // Could be improved to be random or pattern-based
            const rowSize = remaining >= 2 ? 2 : 1;

            for (let j = 0; j < rowSize && i < images.length; j++, i++) {
                const item = document.createElement('div');
                item.className = 'gallery-item';

                const itemData = images[i];
                const currentIndex = i; // Store for lightbox closure

                let mediaEl;

                if (itemData.type === 'video') {
                    mediaEl = document.createElement('video');
                    mediaEl.src = itemData.thumb; // or full
                    mediaEl.muted = true;
                    mediaEl.loop = true;
                    mediaEl.autoplay = true;
                    mediaEl.playsInline = true;

                    // Calc ratio on load for flex sizing
                    mediaEl.onloadedmetadata = function () {
                        const ratio = this.videoWidth / this.videoHeight;
                        item.style.setProperty('--ratio', ratio.toFixed(3));
                    };
                } else {
                    mediaEl = document.createElement('img');
                    mediaEl.src = itemData.thumb;
                    mediaEl.alt = project.title;

                    mediaEl.onload = function () {
                        const ratio = this.naturalWidth / this.naturalHeight;
                        item.style.setProperty('--ratio', ratio.toFixed(3));
                    };
                }

                // Default ratio fallback
                item.style.setProperty('--ratio', '1.5');

                item.addEventListener('click', () => openLightbox(currentIndex, images));
                item.appendChild(mediaEl);
                row.appendChild(item);
            }
            overlayGallery.appendChild(row);
        }

        overlay.classList.remove('hidden');
    }

    function closeProject() {
        overlay.classList.add('hidden');
    }

    // 2. About Overlay
    const aboutLink = document.querySelector('a[href="#about"]');
    const closeAboutBtn = document.getElementById('close-about');

    function openAbout() {
        closeProject();
        aboutOverlay.classList.remove('hidden');
    }

    function closeAbout() {
        aboutOverlay.classList.add('hidden');
    }

    // --- Event Listeners for Overlays ---

    if (aboutLink) {
        aboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            openAbout();
        });
    }

    if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);

    // Global "Back to Home" triggers
    if (logoLink) logoLink.addEventListener('click', closeAllOverlays);
    if (workLink) workLink.addEventListener('click', closeAllOverlays);

    // Close when clicking outside content (on the dark/white backdrop)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeProject(); });
    aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) closeAbout(); });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('lightbox').classList.contains('active')) {
                closeLightbox();
            } else {
                closeAllOverlays();
            }
        }
    });

    // --- Lightbox Logic ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');

    let currentLightboxIndex = 0;
    let currentProjectImages = [];

    function isVideo(src) {
        return /\.(mp4|webm|mov)$/i.test(src);
    }

    function openLightbox(index, images) {
        currentLightboxIndex = index;
        currentProjectImages = images;
        updateLightboxContent();
        lightbox.classList.add('active');
    }

    function updateLightboxContent() {
        const item = currentProjectImages[currentLightboxIndex];
        const src = item.full;

        if (item.type === 'video' || isVideo(src)) {
            lightboxImg.style.display = 'none';
            lightboxVideo.style.display = 'block';
            lightboxVideo.src = src;
            lightboxVideo.play().catch(e => console.log('Autoplay blocked'));
        } else {
            lightboxVideo.pause();
            lightboxVideo.style.display = 'none';
            lightboxImg.style.display = 'block';
            lightboxImg.src = src;
        }
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        lightboxVideo.pause();
        lightboxVideo.src = "";
        lightboxImg.src = "";
    }

    function nextImage(e) {
        if (e) e.stopPropagation();
        if (currentLightboxIndex < currentProjectImages.length - 1) {
            currentLightboxIndex++;
            updateLightboxContent();
        }
    }

    function prevImage(e) {
        if (e) e.stopPropagation();
        if (currentLightboxIndex > 0) {
            currentLightboxIndex--;
            updateLightboxContent();
        }
    }

    // Lightbox Controls
    const lbClose = document.querySelector('.lightbox-close');
    const lbNext = document.querySelector('.lightbox-next');
    const lbPrev = document.querySelector('.lightbox-prev');

    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lbNext) lbNext.addEventListener('click', nextImage);
    if (lbPrev) lbPrev.addEventListener('click', prevImage);

    // Lightbox Keyboard
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
        // Escape is handled globally
    });

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        const contentWrapper = document.getElementById('lightbox-content-wrapper');
        if (e.target === lightbox || e.target === contentWrapper) {
            closeLightbox();
        }
    });
});
