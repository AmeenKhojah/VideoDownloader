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

    let currentSection = homeSection;

    // NAVIGATION TABS
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

    // BACK BUTTONS
    backFromInstagram.addEventListener('click', () => showSection(homeSection));
    backFromYouTube.addEventListener('click', () => showSection(homeSection));

    // ANALYZE BUTTONS
    instagramAnalyzeBtn.addEventListener('click', () => {
        const url = instagramUrlInput.value.trim();
        if(url) {
            analyzeVideo(url, instagramLoader, instagramResults);
        } else {
            alert('Please enter a valid Instagram URL.');
        }
    });

    youtubeAnalyzeBtn.addEventListener('click', () => {
        const url = youtubeUrlInput.value.trim();
        if(url) {
            analyzeVideo(url, youtubeLoader, youtubeResults);
        } else {
            alert('Please enter a valid YouTube URL.');
        }
    });

    function showSection(sectionToShow) {
        const sections = [homeSection, instagramSection, youtubeSection];
        sections.forEach(sec => {
            if (sec === sectionToShow) {
                sec.style.display = 'block';
                requestAnimationFrame(() => {
                    sec.classList.add('active');
                });
            } else {
                sec.classList.remove('active');
                setTimeout(() => {
                    if(!sec.classList.contains('active')) {
                        sec.style.display = 'none';
                    }
                }, 500);
            }
        });
        currentSection = sectionToShow;
    }

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

    // ANALYZE VIDEO (Fetch format info)
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
            if(data.error) {
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

    // INITIATE DOWNLOAD - fetch the file and trigger browser download
    window.initiateDownload = function(e, url, format_id, mode, progressive) {
        const downloadUrl = `/download?url=${encodeURIComponent(url)}&mode=${encodeURIComponent(mode)}${format_id ? '&format_id=' + encodeURIComponent(format_id) : ''}&progressive=${progressive}`;

        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = 'Downloading...';
        btn.disabled = true;

        fetch(downloadUrl)
        .then(response => {
            if(!response.ok) throw new Error('Network response was not ok.');
            // Extract filename from Content-Disposition if possible
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

            btn.innerText = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            alert('Error downloading file: ' + err.message);
            btn.innerText = originalText;
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
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                r: Math.random() * 3 + 2
            });
        }
    }
    window.addEventListener('resize', initCanvas);
    initCanvas();

    let mouseX = width / 2;
    let mouseY = height / 2;

    canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            let dx = mouseX - p.x;
            let dy = mouseY - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                p.vx += dx / (150 * 150);
                p.vy += dy / (150 * 150);
            }
            p.x += p.vx;
            p.y += p.vy;

            // bounce off edges
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
