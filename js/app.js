document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('project-list');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');

    const overlay = document.getElementById('project-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMeta = document.getElementById('overlay-meta');
    const overlayDesc = document.getElementById('overlay-description');
    const overlayGallery = document.getElementById('overlay-gallery');

    // Sync About title with logo (dynamic)
    const logo = document.querySelector('.logo');
    const aboutTitle = document.getElementById('about-title');
    if (logo && aboutTitle) {
        aboutTitle.textContent = logo.textContent;
    }

    let projectsData = [];

    // Fetch the generated data
    fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            // Handle new structure { projects: [], about: "" }
            projectsData = data.projects || []; // Fallback if array (for safety)
            const aboutContent = data.about || "";

            // Render Projects
            renderList(projectsData);

            // Render About
            if (aboutContent) {
                const aboutDescContainer = document.getElementById('about-description');
                if (aboutDescContainer) {
                    aboutDescContainer.innerHTML = aboutContent;
                }
            }
        })
        .catch(error => {
            console.error('Error loading project data:', error);
            listContainer.innerHTML = '<p class="error">Could not load projects.</p>';
        });

    // --- Kinetic Logic ---
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let previewPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let velocity = { x: 0, y: 0 };
    // previewContainer is already declared above, no need to re-declare with let
    let isHovering = false;

    // Track Mouse
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Animation Loop
    function animate() {
        const ease = 0.1;

        const targetX = mouse.x;
        const targetY = mouse.y;

        const dx = targetX - previewPos.x;
        const dy = targetY - previewPos.y;

        previewPos.x += dx * ease;
        previewPos.y += dy * ease;

        const rotate = Math.max(Math.min(dx * 0.02, 10), -10);

        if (isHovering) {
            previewContainer.classList.add('visible');
            const width = previewContainer.offsetWidth;
            const height = previewContainer.offsetHeight;

            previewContainer.style.transform = `translate(${previewPos.x - width / 2}px, ${previewPos.y - height / 2}px) rotate(${rotate}deg) skewX(${rotate}deg)`;

            // --- DYNAMIC TEXT COLOR INVERSION ---
            const imgRect = {
                left: previewPos.x - width / 2,
                right: previewPos.x + width / 2,
                top: previewPos.y - height / 2,
                bottom: previewPos.y + height / 2
            };

            // Check all project items for overlap
            document.querySelectorAll('.project-item').forEach(item => {
                const itemRect = item.getBoundingClientRect();
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
            // Reset all to normal
            document.querySelectorAll('.project-item.inverted').forEach(item => {
                item.classList.remove('inverted');
            });
        }

        requestAnimationFrame(animate);
    }

    // Start Loop
    animate();

    function renderList(projects) {
        listContainer.innerHTML = '';
        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.setAttribute('data-id', project.id); // For reference

            const title = document.createElement('h2');
            title.className = 'project-title';
            title.textContent = project.title;

            // Date (middle column)
            const dateEl = document.createElement('div');
            dateEl.className = 'project-date';
            dateEl.textContent = project.date || '';

            // Tags (right column)
            const tagsEl = document.createElement('div');
            tagsEl.className = 'project-tags';
            tagsEl.textContent = project.tags && project.tags.length > 0 ? project.tags[0] : '';

            item.appendChild(title);
            item.appendChild(dateEl);
            item.appendChild(tagsEl);

            // Desktop Hover Interaction
            let slideshowInterval;
            let currentImageIndex = 0;

            item.addEventListener('mouseenter', () => {
                isHovering = true;
                currentImageIndex = 0; // Reset

                // Show first image immediately
                if (project.images.length > 0) {
                    previewImage.src = project.images[0].thumb;

                    // Start Slideshow if more than 1 image
                    if (project.images.length > 1) {
                        slideshowInterval = setInterval(() => {
                            currentImageIndex = (currentImageIndex + 1) % project.images.length;
                            previewImage.src = project.images[currentImageIndex].thumb;
                        }, 700); // Change every 1 second
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

            // Click to Open
            item.addEventListener('click', () => {
                openProject(project);
            });

            listContainer.appendChild(item);
        });
    }

    // Lightbox elements
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');
    const lightboxContent = document.getElementById('lightbox-content-wrapper'); // Wrapper if needed, or just toggle img/video

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
            lightboxVideo.play().catch(e => console.log('Autoplay blocked', e));
        } else {
            lightboxVideo.pause();
            lightboxVideo.style.display = 'none';
            lightboxImg.style.display = 'block';
            lightboxImg.src = src;
        }

        // Toggle arrows
        if (lightboxPrev) {
            lightboxPrev.style.display = currentLightboxIndex > 0 ? 'block' : 'none';
        }
        if (lightboxNext) {
            lightboxNext.style.display = currentLightboxIndex < currentProjectImages.length - 1 ? 'block' : 'none';
        }
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        lightboxVideo.pause();
        lightboxVideo.src = ""; // Stop buffering
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

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxNext) lightboxNext.addEventListener('click', nextImage);
    if (lightboxPrev) lightboxPrev.addEventListener('click', prevImage);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'Escape') closeLightbox();
    });

    lightbox.addEventListener('click', (e) => {
        // Close if clicking the background (lightbox container) or the content wrapper itself (if padding/centering area is clicked)
        // But NOT if clicking the image, video, or nav buttons (unless buttons have their own handlers, which they do)
        // Actually, nav buttons have their own handlers.
        // We want to avoid closing if clicking image or video.
        if (e.target === lightbox || e.target === lightboxContent) {
            closeLightbox();
        }
    });

    function openProject(project) {
        closeAbout();
        overlayTitle.textContent = project.title;

        // Clear and rebuild meta
        overlayMeta.innerHTML = '';

        const dateEl = document.createElement('span');
        dateEl.className = 'meta-date';
        dateEl.textContent = project.date || '2025'; // Default or empty

        const tagsEl = document.createElement('span');
        tagsEl.className = 'meta-tags';
        tagsEl.textContent = project.tags.join(' • ').toUpperCase();

        overlayMeta.appendChild(dateEl);
        overlayMeta.appendChild(tagsEl);

        overlayDesc.innerHTML = project.description;

        overlayGallery.innerHTML = '';

        // Create rows of 2-3 images with aspect ratios
        const images = project.images;
        let i = 0;
        while (i < images.length) {
            const row = document.createElement('div');
            row.className = 'gallery-row';

            // Max 2 images per row
            const remaining = images.length - i;
            const rowSize = remaining >= 2 ? 2 : 1;

            for (let j = 0; j < rowSize && i < images.length; j++, i++) {
                const item = document.createElement('div');
                item.className = 'gallery-item';

                const itemData = images[i];
                const src = itemData.thumb; // Use thumb for gallery
                const currentIndex = i; // Closure capture

                let mediaEl;
                if (itemData.type === 'video') {
                    mediaEl = document.createElement('video');
                    mediaEl.src = src;
                    mediaEl.muted = true;
                    mediaEl.loop = true;
                    mediaEl.autoplay = true;
                    mediaEl.playsInline = true;

                    // Video aspect ratio handling
                    mediaEl.onloadedmetadata = function () {
                        const ratio = this.videoWidth / this.videoHeight;
                        item.style.setProperty('--ratio', ratio.toFixed(3));
                    };
                } else {
                    mediaEl = document.createElement('img');
                    mediaEl.src = src;
                    mediaEl.alt = project.title;

                    mediaEl.onload = function () {
                        const ratio = this.naturalWidth / this.naturalHeight;
                        item.style.setProperty('--ratio', ratio.toFixed(3));
                    };
                }

                // Default ratio
                item.style.setProperty('--ratio', '1.5');

                // Click to open lightbox with specific index
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
        document.body.style.overflow = '';
    }

    // Logo and Work links close project/about overlays (Back to Home)
    const logoLink = document.querySelector('.logo');
    const workLink = document.querySelector('nav a[class="active"]'); // Select the Work link

    function closeAllOverlays(e) {
        e.preventDefault();
        closeProject();
        closeAbout();
    }

    if (logoLink) logoLink.addEventListener('click', closeAllOverlays);
    if (workLink) workLink.addEventListener('click', closeAllOverlays);

    // Close on click outside content
    overlay.addEventListener('click', (e) => {
        // The overlay has a child .overlay-content. We only want to close if clicking the overlay itself (dark background)
        if (e.target === overlay) closeProject();
    });

    // Close on Escape key
    // --- About Overlay ---
    const aboutOverlay = document.getElementById('about-overlay');
    const aboutLink = document.querySelector('a[href="#about"]');
    const closeAboutBtn = document.getElementById('close-about');

    function openAbout() {
        closeProject(); // Ensure project is closed
        aboutOverlay.classList.remove('hidden');
    }

    function closeAbout() {
        aboutOverlay.classList.add('hidden');
    }

    if (aboutLink) {
        aboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            openAbout();
        });
    }

    if (closeAboutBtn) {
        closeAboutBtn.addEventListener('click', closeAbout);
    }

    aboutOverlay.addEventListener('click', (e) => {
        if (e.target === aboutOverlay) closeAbout();
    });

    function closeAllOverlays(e) {
        if (e) e.preventDefault();
        closeProject();
        closeAbout();
    }

    // Logo and Work links close EVERYTHING
    if (logoLink) logoLink.addEventListener('click', closeAllOverlays);
    if (workLink) workLink.addEventListener('click', closeAllOverlays);

    // Close on Escape key (after all overlays are defined)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!overlay.classList.contains('hidden')) closeProject();
            if (!aboutOverlay.classList.contains('hidden')) closeAbout();
        }
    });
});
