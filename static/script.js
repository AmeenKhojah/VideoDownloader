// script.js

document.addEventListener('DOMContentLoaded', () => {
    const homeSection = document.getElementById('homeSection');
    const instagramSection = document.getElementById('instagramSection');
    const youtubeSection = document.getElementById('youtubeSection');

    const homeTab = document.getElementById('homeTab');
    const instagramTab = document.getElementById('instagramTab');
    const youtubeTab = document.getElementById('youtubeTab');

    const backFromInstagram = document.getElementById('backFromInstagram');
    const backFromYouTube = document.getElementById('backFromYouTube');

    const instagramUrlInput = document.getElementById('instagramUrl');
    const youtubeUrlInput = document.getElementById('youtubeUrl');

    const instagramAnalyzeBtn = document.getElementById('instagramAnalyzeBtn');
    const youtubeAnalyzeBtn = document.getElementById('youtubeAnalyzeBtn');

    const instagramLoader = document.getElementById('instagramLoader');
    const youtubeLoader = document.getElementById('youtubeLoader');

    const instagramResults = document.getElementById('instagramResults');
    const youtubeResults = document.getElementById('youtubeResults');

    const youtubeThumbnailContainer = document.getElementById('youtubeThumbnailContainer');
    const youtubeVideoThumbnail = document.getElementById('youtubeVideoThumbnail');
    const youtubeFinalDownloadBtn = document.getElementById('youtubeFinalDownloadBtn');
    const youtubeVideoLink = document.getElementById('youtubeVideoLink');
    const youtubeVideoPlayer = document.getElementById('youtubeVideoPlayer');

    const instagramThumbnailContainer = document.getElementById('instagramThumbnailContainer');
    const instagramVideoThumbnail = document.getElementById('instagramVideoThumbnail');
    const instagramFinalDownloadBtn = document.getElementById('instagramFinalDownloadBtn');
    const instagramVideoLink = document.getElementById('instagramVideoLink');

    const pasteInstagramBtn = document.getElementById('pasteInstagramBtn');
    const pasteYouTubeBtn = document.getElementById('pasteYouTubeBtn');

    let currentSection = homeSection;
    currentSection.classList.add('active');
    currentSection.style.display = 'block';

    // Object to store original video URLs
    const originalVideoUrls = {
        youtube: null,
        instagram: null
    };

    function showSection(sectionToShow) {
        if (sectionToShow === currentSection) return;

        // Stop YouTube video playback if navigating away from YouTube section
        if (currentSection === youtubeSection) {
            stopYouTubeVideo();
        }

        // Fade out current section
        if (currentSection) {
            const oldSection = currentSection;
            oldSection.classList.remove('active');

            // When transition ends on old section, hide it
            oldSection.addEventListener('transitionend', function onTransitionEnd() {
                oldSection.removeEventListener('transitionend', onTransitionEnd);
                oldSection.style.display = 'none';

                // Now show the new section
                sectionToShow.style.display = 'block';
                requestAnimationFrame(() => {
                    sectionToShow.classList.add('active');
                });
            }, { once: true });
        } else {
            // If no current section (first load)
            sectionToShow.style.display = 'block';
            requestAnimationFrame(() => {
                sectionToShow.classList.add('active');
            });
        }

        currentSection = sectionToShow;
    }

    // NAVIGATION
    homeTab.addEventListener('click', () => {
        showSection(homeSection);
    });
    instagramTab.addEventListener('click', () => {
        resetInstagram();
        showSection(instagramSection);
    });
    youtubeTab.addEventListener('click', () => {
        resetYouTube();
        showSection(youtubeSection);
    });

    backFromInstagram.addEventListener('click', () => showSection(homeSection));
    backFromYouTube.addEventListener('click', () => showSection(homeSection));

    // ANALYZE BUTTONS
    instagramAnalyzeBtn.addEventListener('click', () => {
        const url = instagramUrlInput.value.trim();
        if (url) {
            analyzeVideo(url, instagramLoader, instagramResults, 'instagram');
        } else {
            alert('Please enter a valid Instagram URL.');
        }
    });

    youtubeAnalyzeBtn.addEventListener('click', () => {
        const url = youtubeUrlInput.value.trim();
        if (url) {
            analyzeVideo(url, youtubeLoader, youtubeResults, 'youtube');
        } else {
            alert('Please enter a valid YouTube URL.');
        }
    });

    // PASTE BUTTONS
    pasteInstagramBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            instagramUrlInput.value = text;
            initiateSearch('instagram');
        } catch (err) {
            alert('Failed to paste: ' + err);
        }
    });

    pasteYouTubeBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            youtubeUrlInput.value = text;
            initiateSearch('youtube');
        } catch (err) {
            alert('Failed to paste: ' + err);
        }
    });

    function initiateSearch(platform) {
        if (platform === 'instagram') {
            const url = instagramUrlInput.value.trim();
            if (url) {
                analyzeVideo(url, instagramLoader, instagramResults, 'instagram');
            }
        } else if (platform === 'youtube') {
            const url = youtubeUrlInput.value.trim();
            if (url) {
                analyzeVideo(url, youtubeLoader, youtubeResults, 'youtube');
            }
        }
    }

    function resetInstagram() {
        instagramUrlInput.value = '';
        instagramResults.innerHTML = '';
        instagramResults.style.display = 'none';
        instagramResults.style.opacity = '0';
        instagramThumbnailContainer.style.display = 'none';
        instagramFinalDownloadBtn.classList.remove('loading');
    }

    function resetYouTube() {
        youtubeUrlInput.value = '';
        youtubeResults.innerHTML = '';
        youtubeResults.style.display = 'none';
        youtubeResults.style.opacity = '0';
        youtubeThumbnailContainer.style.display = 'none';
        youtubeVideoPlayer.style.display = 'none';
        youtubeVideoPlayer.src = '';
        youtubeFinalDownloadBtn.classList.remove('loading');
    }

    // ANALYZE VIDEO
    function analyzeVideo(url, loader, results, platform) {
        results.innerHTML = '';
        loader.style.display = 'block';
        results.style.display = 'none';
        results.style.opacity = '0';
        if (platform === 'youtube') {
            youtubeThumbnailContainer.style.display = 'none';
            youtubeVideoPlayer.style.display = 'none';
            youtubeVideoPlayer.src = '';
        } else if (platform === 'instagram') {
            instagramThumbnailContainer.style.display = 'none';
        }

        const formData = new FormData();
        formData.append('url', url);

        fetch('/analyze', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            loader.style.display = 'none';
            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            const videoFormats = data.video_formats || [];
            const audioAvailable = data.audio_available;
            const thumbnail = data.thumbnail || '';
            const webpage_url = data.webpage_url || '#';
            const video_title = data.title || 'Video Title';

            if (videoFormats.length === 0 && !audioAvailable) {
                results.innerHTML = '<p>No MP4 or MP3 formats available for this video.</p>';
            } else {
                results.innerHTML = generateDropdown(videoFormats, audioAvailable, platform);
                originalVideoUrls[platform] = webpage_url;
                displayThumbnail(thumbnail, webpage_url, platform, video_title);
            }

            results.style.display = 'block';
            requestAnimationFrame(() => {
                results.style.opacity = '1';
            });
        })
        .catch(err => {
            loader.style.display = 'none';
            alert('An error occurred. Please try again.');
            console.error(err);
        });
    }

    function generateDropdown(videoFormats, audioAvailable, platform) {
        let html = `
            <div class="dropdown">
                <select id="formatSelect_${platform}" aria-label="Select format for ${platform.charAt(0).toUpperCase() + platform.slice(1)} video">
                    <option value="" disabled selected>Select format</option>
        `;

        if (videoFormats.length > 0) {
            html += `<optgroup label="Video">`;
            videoFormats.forEach(f => {
                html += `<option value="${f.format_id}" data-mode="video">${f.resolution} MP4</option>`;
            });
            html += `</optgroup>`;
        }

        if (audioAvailable) {
            html += `<optgroup label="Audio">`;
            html += `<option value="audio" data-mode="audio">MP3 Audio</option>`;
            html += `</optgroup>`;
        }

        html += `
                </select>
            </div>
        `;

        return html;
    }

    // Display Thumbnail and Setup Download
    function displayThumbnail(thumbnail, webpage_url, platform, video_title) {
        if (platform === 'youtube') {
            youtubeVideoThumbnail.src = thumbnail;
            youtubeVideoLink.href = webpage_url;
            document.getElementById('youtubeVideoTitle').innerText = video_title;
            youtubeThumbnailContainer.style.display = 'flex';
        } else if (platform === 'instagram') {
            instagramVideoThumbnail.src = '/fetch_image?url=' + encodeURIComponent(thumbnail);
            instagramVideoLink.href = webpage_url;
            instagramThumbnailContainer.style.display = 'flex';
        }
    }

    // Event Delegation for Dropdown Selection
    document.body.addEventListener('change', function(event) {
        if (event.target && event.target.id.startsWith('formatSelect_')) {
            const platform = event.target.id.split('_')[1];
            const selectedOption = event.target.options[event.target.selectedIndex];
            const formatId = selectedOption.value;
            const mode = selectedOption.getAttribute('data-mode');

            if (platform === 'youtube') {
                handleDownload(platform, mode, formatId, youtubeFinalDownloadBtn);
            } else if (platform === 'instagram') {
                handleDownload(platform, mode, formatId, instagramFinalDownloadBtn);
            }
        }
    });

    async function handleDownload(platform, mode, formatId, downloadBtn) {
        let webpage_url;
        if (platform === 'youtube') {
            webpage_url = document.getElementById('youtubeVideoLink').href;
        } else if (platform === 'instagram') {
            webpage_url = document.getElementById('instagramVideoLink').href;
        }

        // Construct download URL
        let downloadUrl = `/download?url=${encodeURIComponent(webpage_url)}&mode=${encodeURIComponent(mode)}`;
        if (formatId && mode === 'video') {
            downloadUrl += `&format_id=${encodeURIComponent(formatId)}`;
        }

        // Set data attributes on download button
        downloadBtn.dataset.downloadUrl = downloadUrl;
        downloadBtn.dataset.mode = mode;

        // No need to add multiple event listeners
    }

    // Single Event Listener for All Download Buttons
    // YouTube Download Button
    youtubeFinalDownloadBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        const downloadUrl = this.dataset.downloadUrl;
        const mode = this.dataset.mode;

        if (!downloadUrl) {
            alert('No download URL found. Please select a format first.');
            return;
        }

        this.classList.add('loading');
        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Extract filename from Content-Disposition or set based on mode
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'download';
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            } else {
                // Fallback to platform and mode
                if (mode === 'audio') {
                    filename = 'youtube_audio.mp3';
                } else {
                    filename = 'youtube_video.mp4';
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Download failed: ' + err);
            console.error(err);
        } finally {
            this.classList.remove('loading');
        }
    });

    // Instagram Download Button
    instagramFinalDownloadBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        const downloadUrl = this.dataset.downloadUrl;
        const mode = this.dataset.mode;

        if (!downloadUrl) {
            alert('No download URL found. Please select a format first.');
            return;
        }

        this.classList.add('loading');
        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Extract filename from Content-Disposition or set based on mode
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'download';
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            } else {
                // Fallback to platform and mode
                if (mode === 'audio') {
                    filename = 'instagram_audio.mp3';
                } else {
                    filename = 'instagram_video.mp4';
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Download failed: ' + err);
            console.error(err);
        } finally {
            this.classList.remove('loading');
        }
    });

    // Function to extract YouTube Video ID from URL
    function extractYouTubeVideoID(url) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // Handle Thumbnail Click to Play Video
    function setupThumbnailClick(platform) {
        if (platform === 'youtube') {
            youtubeVideoThumbnail.addEventListener('click', function(e) {
                e.preventDefault();
                const videoId = extractYouTubeVideoID(youtubeVideoLink.href);
                if (videoId) {
                    youtubeVideoPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                    youtubeVideoPlayer.style.display = 'block';
                }
            }, { once: true }); // Ensure the event is only bound once
        }
        // Removed Instagram video preview handling as it's no longer needed
    }

    // Handle Enter Key Press for Search
    function handleEnterKey(inputElement, platform) {
        inputElement.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (platform === 'instagram') {
                    const url = instagramUrlInput.value.trim();
                    if (url) {
                        analyzeVideo(url, instagramLoader, instagramResults, 'instagram');
                    } else {
                        alert('Please enter a valid Instagram URL.');
                    }
                } else if (platform === 'youtube') {
                    const url = youtubeUrlInput.value.trim();
                    if (url) {
                        analyzeVideo(url, youtubeLoader, youtubeResults, 'youtube');
                    } else {
                        alert('Please enter a valid YouTube URL.');
                    }
                }
            }
        });
    }

    // Attach Enter Key Handlers
    handleEnterKey(instagramUrlInput, 'instagram');
    handleEnterKey(youtubeUrlInput, 'youtube');

    // PARTICLE BACKGROUND
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    const particleCount = 40;

    function initCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 2.5 + 1.5
            });
        }
    }
    window.addEventListener('resize', initCanvas);
    initCanvas();

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Bounce at edges
            if (p.x < 0 || p.x > width) p.vx = -p.vx;
            if (p.y < 0 || p.y > height) p.vy = -p.vy;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();

    // Function to stop YouTube video playback
    function stopYouTubeVideo() {
        youtubeVideoPlayer.src = '';
        youtubeVideoPlayer.style.display = 'none';
    }

    // Ensure YouTube video stops when navigating away via back buttons
    backFromYouTube.addEventListener('click', () => {
        stopYouTubeVideo();
    });

    backFromInstagram.addEventListener('click', () => {
        stopYouTubeVideo();
    });

    // Also, stop YouTube video when navigating to Home or Instagram via tabs
    homeTab.addEventListener('click', () => {
        stopYouTubeVideo();
    });

    instagramTab.addEventListener('click', () => {
        stopYouTubeVideo();
    });
});
