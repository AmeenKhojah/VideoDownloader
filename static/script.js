// static/script.js

document.addEventListener('DOMContentLoaded', () => {
  // Existing element references and event listeners
  const youtubeBtn = document.getElementById('youtube-btn');
  const instagramBtn = document.getElementById('instagram-btn');
  const urlInput = document.getElementById('url-input');
  const pasteBtn = document.getElementById('paste-btn');
  let searchForm = document.getElementById('search-form');
  let searchBtn = document.getElementById('search-btn');
  let searchIcon = document.getElementById('search-static-icon');
  let loaderIcon = document.getElementById('loader-icon');
  let previewSection = document.getElementById('preview-section');
  let videoThumbnail = document.getElementById('video-thumbnail');
  let thumbnailLink = document.getElementById('thumbnail-link');
  let videoIframe = document.getElementById('video-iframe');
  let videoTitle = document.getElementById('video-title');
  let formatSelect = document.getElementById('format-select');
  let downloadBtn = document.getElementById('download-btn');
  let downloadSpinner = document.getElementById('download-spinner');
  let toastContainer = document.getElementById('toast-container');
  let formatError = document.getElementById('format-error');

  let platform = null;
  let loading = false;
  let downloading = false;
  let formatSelected = false;
  let webpageUrl = '';

  // Platform Selection Handlers
  youtubeBtn.addEventListener('click', () => {
    if (platform !== 'youtube') {
      platform = 'youtube';
      updatePlatformSelection();
      resetForm();
    }
    // If already on YouTube, do nothing
  });

  instagramBtn.addEventListener('click', () => {
    if (platform !== 'instagram') {
      platform = 'instagram';
      updatePlatformSelection();
      resetForm();
    }
    // If already on Instagram, do nothing
  });

  function updatePlatformSelection() {
    // Remove active classes from both buttons
    youtubeBtn.classList.remove('bg-gradient-to-r', 'from-red-500', 'to-red-600', 'text-white', 'shadow-lg', 'shadow-red-500/30');
    instagramBtn.classList.remove('bg-gradient-to-r', 'from-pink-500', 'to-purple-600', 'text-white', 'shadow-lg', 'shadow-pink-500/30');

    // Add active classes based on selected platform
    if (platform === 'youtube') {
      youtubeBtn.classList.add('bg-gradient-to-r', 'from-red-500', 'to-red-600', 'text-white', 'shadow-lg', 'shadow-red-500/30');
      youtubeBtn.classList.remove('bg-white/10', 'text-purple-100', 'hover:bg-white/20');
      instagramBtn.classList.add('bg-white/10', 'text-purple-100', 'hover:bg-white/20');
    } else if (platform === 'instagram') {
      instagramBtn.classList.add('bg-gradient-to-r', 'from-pink-500', 'to-purple-600', 'text-white', 'shadow-lg', 'shadow-pink-500/30');
      instagramBtn.classList.remove('bg-white/10', 'text-purple-100', 'hover:bg-white/20');
      youtubeBtn.classList.add('bg-white/10', 'text-purple-100', 'hover:bg-white/20');
    }

    // Update placeholder text based on selected platform
    urlInput.placeholder = `Paste ${platform || 'video'} URL here...`;

    // Reveal the search form with transition
    if (platform) {
      searchForm.classList.remove('hidden', 'opacity-0', 'scale-95');
      searchForm.classList.add('opacity-100', 'scale-100');
    } else {
      searchForm.classList.add('hidden', 'opacity-0', 'scale-95');
      searchForm.classList.remove('opacity-100', 'scale-100');
    }
  }

  // Handle Paste from Clipboard Automatically
  pasteBtn.addEventListener('click', () => {
    console.log("Paste button clicked"); // Debugging
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText()
        .then((text) => {
          console.log("Clipboard content:", text); // Debugging
          if (text) {
            urlInput.value = text.trim();
            urlInput.focus(); // Automatically focus on the input after pasting
          } else {
            showToast('Clipboard is empty.');
          }
        })
        .catch((err) => {
          console.error('Failed to read clipboard:', err); // Debugging
          showToast('Error: Unable to access clipboard.');
        });
    } else {
      console.error('Clipboard API not supported'); // Debugging
      showToast('Clipboard API not supported by your browser.');
    }
  });

  // Handle Form Submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      showToast('Please enter a valid URL.');
      return;
    }

    loading = true;
    toggleLoading(true);
    searchBtn.disabled = true;

    // Show Loader and Hide Static Icon
    loaderIcon.classList.remove('hidden');
    searchIcon.classList.add('hidden');

    // Send POST request to /analyze
    fetch('/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })
      .then(response => response.json())
      .then(data => {
        loading = false;
        toggleLoading(false);
        searchBtn.disabled = false;

        // Hide Loader and Show Static Icon
        loaderIcon.classList.add('hidden');
        searchIcon.classList.remove('hidden');

        if (data.error) {
          showToast(`Error: ${data.error}`);
          previewSection.classList.add('hidden');
          return;
        }

        const videoFormats = data.video_formats || [];
        const audioAvailable = data.audio_available;
        const thumbnail = data.thumbnail || '';
        const title = data.title || 'Video';
        webpageUrl = data.webpage_url || url;

        if (videoFormats.length === 0 && !audioAvailable) {
          previewSection.innerHTML = `<p class="text-red-500">No MP4 or MP3 formats available for this video.</p>`;
          previewSection.classList.remove('hidden');
          return;
        }

        // Update Thumbnail and Title
        videoThumbnail.src = thumbnail;
        videoTitle.textContent = title;
        thumbnailLink.href = webpageUrl;

        // Populate Format Select
        populateFormatSelect(videoFormats, audioAvailable);

        // Show Preview Section
        previewSection.classList.remove('hidden');
      })
      .catch(err => {
        console.error('Error:', err);
        showToast('An error occurred. Please try again.');
        loading = false;
        toggleLoading(false);
        searchBtn.disabled = false;
        loaderIcon.classList.add('hidden');
        searchIcon.classList.remove('hidden');
      });
  });

  // Toggle Loading State for Search Button
  function toggleLoading(show) {
    if (show) {
      searchBtn.classList.add('cursor-not-allowed');
    } else {
      searchBtn.classList.remove('cursor-not-allowed');
    }
  }

  // Populate Format Select Dropdown with Video and Audio Options
  function populateFormatSelect(formats, audioAvailable) {
    const videoOptGroup = formatSelect.querySelector('optgroup[label="Video"]');
    const audioOptGroup = formatSelect.querySelector('optgroup[label="Audio"]');

    videoOptGroup.innerHTML = ''; // Clear existing video formats
    audioOptGroup.innerHTML = ''; // Clear existing audio options

    // Reset formatSelected state
    formatSelected = false;
    formatError.classList.add('hidden'); // Hide any existing error message

    // Populate Video Formats
    formats.forEach(format => {
      const option = document.createElement('option');
      option.value = `video:${format.format_id}`; // Prefix to identify as video
      option.textContent = `${format.resolution} MP4`;
      videoOptGroup.appendChild(option);
    });

    // Populate Audio Option if Available
    if (audioAvailable) {
      const audioOption = document.createElement('option');
      audioOption.value = 'audio:mp3'; // Value indicating audio download
      audioOption.textContent = 'Audio Only (MP3)';
      audioOptGroup.appendChild(audioOption);
    }

    // Add event listener to track format selection
    formatSelect.addEventListener('change', () => {
      if (formatSelect.value) {
        formatSelected = true;
        formatError.classList.add('hidden'); // Hide error message if any
      } else {
        formatSelected = false;
      }
    });
  }

  // Download Button Handler with Spinner
  downloadBtn.addEventListener('click', () => {
    if (!formatSelected) {
      // Display inline error message
      formatError.classList.remove('hidden');
      return;
    }

    const selectedValue = formatSelect.value;
    if (!selectedValue) {
      // This should not occur as formatSelected ensures a value is chosen
      formatError.classList.remove('hidden');
      return;
    }

    const [type, format_id] = selectedValue.split(':');
    const url = urlInput.value.trim();

    if (!url) {
      showToast('No URL provided.');
      return;
    }

    let downloadUrl = '';
    if (type === 'video') {
      downloadUrl = `/download?url=${encodeURIComponent(url)}&mode=video&format_id=${encodeURIComponent(format_id)}`;
    } else if (type === 'audio') {
      downloadUrl = `/download?url=${encodeURIComponent(url)}&mode=audio`;
    }

    // Show Spinner and Disable Download Button
    downloadSpinner.classList.remove('hidden');
    downloadBtn.disabled = true;

    // Initiate Download using Fetch API
    fetch(downloadUrl)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok.');
        return response.blob().then(blob => {
          // Create a temporary URL for the downloaded blob
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;

          // Extract filename from response headers or set a default
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'download';
          if (contentDisposition && contentDisposition.includes('filename=')) {
            filename = contentDisposition.split('filename=')[1].replace(/["';]/g, '').trim();
          }
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        });
      })
      .then(() => {
        // Hide Spinner and Enable Download Button
        downloadSpinner.classList.add('hidden');
        downloadBtn.disabled = false;
      })
      .catch(err => {
        showToast(`Error downloading file: ${err.message}`);
        console.error(err);
        // Hide Spinner and Enable Download Button
        downloadSpinner.classList.add('hidden');
        downloadBtn.disabled = false;
      });
  });

  // Accessibility Enhancements (Optional)
  // Add ARIA labels for better accessibility
  downloadBtn.setAttribute('aria-label', 'Download selected format');

  // Ensure that pressing Enter on the format select doesn't submit the form
  formatSelect.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  });

  // Function to show toast notifications
  function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Remove the toast after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Reset Form Function
  function resetForm() {
    // Clear the URL input field
    urlInput.value = '';

    // Hide the preview section
    previewSection.classList.add('hidden');

    // Reset the format selection dropdown
    formatSelect.innerHTML = `
      <option value="" disabled selected>Select format</option>
      <optgroup label="Video"></optgroup>
      <optgroup label="Audio"></optgroup>
    `;
    formatSelect.value = '';
    formatSelected = false;
    formatError.classList.add('hidden'); // Hide error message

    // Remove existing event listeners on formatSelect to prevent duplicate listeners
    const newFormatSelect = formatSelect.cloneNode(true);
    formatSelect.parentNode.replaceChild(newFormatSelect, formatSelect);
    formatSelect = newFormatSelect;

    // Re-populate event listeners after cloning
    newFormatSelect.addEventListener('change', () => {
      if (newFormatSelect.value) {
        formatSelected = true;
        formatError.classList.add('hidden'); // Hide error message if any
      } else {
        formatSelected = false;
      }
    });

    // Reset the thumbnail and title
    videoThumbnail.src = '';
    videoTitle.textContent = 'Sample Video Title';
    thumbnailLink.href = '#';
    videoIframe.src = '';
    videoIframe.classList.add('hidden');
    videoThumbnail.classList.remove('hidden');

    // Show a toast notification
    showToast(`Switched to ${platform.charAt(0).toUpperCase() + platform.slice(1)} platform. Please enter a new URL.`);
  }

  // Thumbnail Click Handler
  thumbnailLink.addEventListener('click', (e) => {
    if (platform === 'youtube') {
      if (formatSelected) {
        e.preventDefault();
        const embedUrl = getYoutubeEmbedUrl(webpageUrl);
        if (embedUrl) {
          videoIframe.src = embedUrl;
          videoIframe.classList.remove('hidden');
          videoThumbnail.classList.add('hidden');
        } else {
          showToast('Unable to embed video.');
        }
      } else {
        // Update the href to the actual webpageUrl
        thumbnailLink.href = webpageUrl;
        // Let the link proceed to redirect to webpageUrl
      }
    } else if (platform === 'instagram') {
      // For Instagram, always redirect to the webpage URL
      // Even if a format is selected, ensure it redirects
      thumbnailLink.href = webpageUrl;
      // No need to preventDefault, allow redirection
    }
  });

  // Utility Function to Convert YouTube URL to Embed URL
  function getYoutubeEmbedUrl(url) {
    try {
      const urlObj = new URL(url);
      let videoId = '';
      if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v');
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      } else {
        return '';
      }
    } catch (error) {
      console.error('Invalid YouTube URL:', error);
      return '';
    }
  }

  // --- Particle Background Integration ---
  const canvas = document.getElementById('bgCanvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    const particleCount = 40; // Adjust as needed

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
          vx: (Math.random() - 0.5) * 0.3, // Velocity X
          vy: (Math.random() - 0.5) * 0.3, // Velocity Y
          r: Math.random() * 2.5 + 1.5   // Radius
        });
      }
    }
    window.addEventListener('resize', initCanvas);
    initCanvas();

    function animateParticles() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce particles off the edges
        if (p.x < 0 || p.x > width) p.vx = -p.vx;
        if (p.y < 0 || p.y > height) p.vy = -p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();
      });
      requestAnimationFrame(animateParticles);
    }
    animateParticles();
  } else {
    console.error('Canvas not found or not supported.');
  }
});
