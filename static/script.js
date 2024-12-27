document.addEventListener('DOMContentLoaded', () => {
    const homeSection = document.getElementById('homeSection');
    const instagramSection = document.getElementById('instagramSection');
    const youtubeSection = document.getElementById('youtubeSection');
    const tiktokSection = document.getElementById('tiktokSection');

    const homeTab = document.getElementById('homeTab');
    const instagramTab = document.getElementById('instagramTab');
    const youtubeTab = document.getElementById('youtubeTab');
    const tiktokTab = document.getElementById('tiktokTab');

    const backFromInstagram = document.getElementById('backFromInstagram');
    const backFromYouTube = document.getElementById('backFromYouTube');
    const backFromTiktok = document.getElementById('backFromTiktok');

    const instagramUrlInput = document.getElementById('instagramUrl');
    const youtubeUrlInput = document.getElementById('youtubeUrl');
    const tiktokUrlInput = document.getElementById('tiktokUrl');

    const instagramAnalyzeBtn = document.getElementById('instagramAnalyzeBtn');
    const youtubeAnalyzeBtn = document.getElementById('youtubeAnalyzeBtn');
    const tiktokAnalyzeBtn = document.getElementById('tiktokAnalyzeBtn');

    const instagramLoader = document.getElementById('instagramLoader');
    const youtubeLoader = document.getElementById('youtubeLoader');
    const tiktokLoader = document.getElementById('tiktokLoader');

    const instagramResults = document.getElementById('instagramResults');
    const youtubeResults = document.getElementById('youtubeResults');
    const tiktokResults = document.getElementById('tiktokResults');

    // PASTE BUTTONS
    const pasteClipboardBtnInstagram = document.getElementById('pasteClipboardBtnInstagram');
    const pasteClipboardBtnYouTube = document.getElementById('pasteClipboardBtnYouTube');
    const pasteClipboardBtnTiktok = document.getElementById('pasteClipboardBtnTiktok');

    // Function to handle paste actions
    async function handlePaste(pasteBtn, urlInput) {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
        } catch (err) {
            alert('Failed to access clipboard: ' + err.message);
        }
    }

    // Add event listeners for the Paste Clipboard buttons
    if (pasteClipboardBtnInstagram) {
        pasteClipboardBtnInstagram.addEventListener('click', () => {
            handlePaste(pasteClipboardBtnInstagram, instagramUrlInput);
        });
    }

    if (pasteClipboardBtnYouTube) {
        pasteClipboardBtnYouTube.addEventListener('click', () => {
            handlePaste(pasteClipboardBtnYouTube, youtubeUrlInput);
        });
    }

    if (pasteClipboardBtnTiktok) {
        pasteClipboardBtnTiktok.addEventListener('click', () => {
            handlePaste(pasteClipboardBtnTiktok, tiktokUrlInput);
        });
    }

    // Add event listeners for the Analyze buttons
    if (instagramAnalyzeBtn) {
        instagramAnalyzeBtn.addEventListener('click', () => {
            const url = instagramUrlInput.value.trim();
            if (url) {
                analyzeVideo(url, instagramLoader, instagramResults);
            } else {
                alert('Please enter a valid Instagram URL.');
            }
        });
    }

    if (youtubeAnalyzeBtn) {
        youtubeAnalyzeBtn.addEventListener('click', () => {
            const url = youtubeUrlInput.value.trim();
            if (url) {
                analyzeVideo(url, youtubeLoader, youtubeResults);
            } else {
                alert('Please enter a valid YouTube URL.');
            }
        });
    }

    if (tiktokAnalyzeBtn) {
        tiktokAnalyzeBtn.addEventListener('click', () => {
            const url = tiktokUrlInput.value.trim();
            if (url) {
                analyzeVideo(url, tiktokLoader, tiktokResults);
            } else {
                alert('Please enter a valid TikTok URL.');
            }
        });
    }

    // Allow pressing Enter to trigger Analyze
    instagramUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            instagramAnalyzeBtn.click();
        }
    });
    youtubeUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            youtubeAnalyzeBtn.click();
        }
    });
    tiktokUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            tiktokAnalyzeBtn.click();
        }
    });

    // Function to analyze video
    function analyzeVideo(url, loader, results) {
        results.innerHTML = '';
        loader.style.display = 'block';
        results.style.display = 'none';
        results.style.opacity = '0';

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

                if (videoFormats.length === 0 && !audioAvailable) {
                    results.innerHTML = `<p>No MP4 or MP3 formats available for this video.</p>`;
                } else {
                    results.innerHTML = generateResults(url, videoFormats, audioAvailable);
                }

                results.style.display = 'flex';
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

    // Function to generate results
    function generateResults(url, videoFormats, audioAvailable) {
        let html = '';

        videoFormats.forEach(f => {
            const progressive = f.progressive !== false;
            html += `
                <div class="download-card">
                    <h3>${f.resolution} MP4</h3>
                    <div class="format-buttons">
                        <button class="format-btn" onclick="initiateDownload(event, '${url}','${f.format_id}','video', ${progressive})">
                            Download MP4 ${f.resolution}
                        </button>
                    </div>
                </div>
            `;
        });

        if (audioAvailable) {
            html += `
                <div class="download-card">
                    <h3>MP3 (Audio Only)</h3>
                    <div class="format-buttons">
                        <button class="format-btn" onclick="initiateDownload(event, '${url}','','audio', true)">
                            Download MP3
                        </button>
                    </div>
                </div>
            `;
        }

        return html;
    }

    let currentSection = homeSection;
    currentSection.classList.add('active');
    currentSection.style.display = 'block';

    function showSection(sectionToShow) {
        if (sectionToShow === currentSection) return;

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
    tiktokTab.addEventListener('click', () => {
        resetTiktok();
        showSection(tiktokSection);
    });

    // BACK BUTTONS
    backFromInstagram.addEventListener('click', () => showSection(homeSection));
    backFromYouTube.addEventListener('click', () => showSection(homeSection));
    backFromTiktok.addEventListener('click', () => showSection(homeSection));

    // Reset functions
    function resetInstagram() {
        instagramUrlInput.value = '';
        instagramResults.innerHTML = '';
        instagramResults.style.display = 'none';
        instagramResults.style.opacity = '0';
    }

    function resetYouTube() {
        youtubeUrlInput.value = '';
        youtubeResults.innerHTML = '';
        youtubeResults.style.display = 'none';
        youtubeResults.style.opacity = '0';
    }

    function resetTiktok() {
        tiktokUrlInput.value = '';
        tiktokResults.innerHTML = '';
        tiktokResults.style.display = 'none';
        tiktokResults.style.opacity = '0';
    }

    // DOWNLOAD FUNCTION
    window.initiateDownload = function(e, url, format_id, mode, progressive) {
        e.preventDefault();
        const downloadUrl = `/download?url=${encodeURIComponent(url)}&mode=${encodeURIComponent(mode)}${format_id ? '&format_id=' + encodeURIComponent(format_id) : ''}`;

        const btn = e.currentTarget;
        const originalHTML = btn.innerHTML;
        // Show spinner while downloading
        btn.innerHTML = '<span class="download-spinner"></span> Downloading...';
        btn.disabled = true;

        fetch(downloadUrl)
        .then(response => {
            if(!response.ok) throw new Error('Network response was not ok.');
            const cd = response.headers.get('Content-Disposition');
            let filename = 'download';
            if(cd && cd.includes('filename=')) {
                filename = cd.split('filename=')[1].replace(/["';]/g, '').trim();
            }
            return response.blob().then(blob => ({ blob, filename }));
        })
        .then(({blob, filename}) => {
            const link = document.createElement('a');
            const objectUrl = URL.createObjectURL(blob);
            link.href = objectUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);

            // Revert button state
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        })
        .catch(err => {
            alert('Error downloading file: ' + err.message);
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    };

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
});
