import os
import tempfile
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp

app = Flask(__name__)

DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), 'video_downloader')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def get_ydl_opts(url, download=False, format_str=None):
    """
    Returns yt_dlp options. If the URL is for Instagram, adds login credentials.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': not download,
    }
    
    # Automatically add Instagram login credentials if URL is for Instagram
    if 'instagram.com' in url:
        # Using the provided credentials:
        # Instagram email: therealpeekinq@gmail.com (if needed), username: therealpeekinq, password: Nabil123
        ydl_opts['username'] = 'therealpeekinq'
        ydl_opts['password'] = 'Nabil123'
        # Some cases might require the email; uncomment the next line if necessary.
        # ydl_opts['email'] = 'therealpeekinq@gmail.com'
    
    # For downloads, allow passing a specific format if provided
    if download and format_str:
        ydl_opts['format'] = format_str

    return ydl_opts

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    url = request.form.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    ydl_opts = get_ydl_opts(url, download=False)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])

            # Determine audio availability
            audio_format = None
            best_audio_bitrate = 0.0
            for f in formats:
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    abr = f.get('abr', 0.0) or 0.0
                    if abr > best_audio_bitrate:
                        best_audio_bitrate = abr
                        audio_format = f

            # Process video formats into two groups
            progressive_formats = {}
            separate_videos = {}
            for f in formats:
                ext = f.get('ext')
                vcodec = f.get('vcodec', 'none')
                acodec = f.get('acodec', 'none')
                height = f.get('height')
                if isinstance(height, int) and height > 0:
                    resolution = f"{height}p"
                    tbr = f.get('tbr', 0.0) or 0.0
                    if (ext == 'mp4' and vcodec != 'none' and acodec != 'none' and '+' not in f.get('format_id', '')):
                        # Progressive MP4 format
                        if (resolution not in progressive_formats) or (tbr > progressive_formats[resolution]['tbr']):
                            progressive_formats[resolution] = {
                                'format_id': f['format_id'],
                                'resolution': resolution,
                                'tbr': tbr,
                                'progressive': True
                            }
                    else:
                        # Video-only streams (separate video)
                        if vcodec != 'none' and acodec == 'none':
                            if (resolution not in separate_videos) or (tbr > separate_videos[resolution]['tbr']):
                                separate_videos[resolution] = {
                                    'format_id': f['format_id'],
                                    'resolution': resolution,
                                    'tbr': tbr,
                                    'progressive': False
                                }

            chosen_formats = list(progressive_formats.values())
            for res, vid in separate_videos.items():
                if res not in progressive_formats:
                    chosen_formats.append(vid)

            # Sort formats by resolution (highest first)
            chosen_formats.sort(key=lambda x: int(x['resolution'].replace('p', '')), reverse=True)

            response = {
                'video_formats': chosen_formats,
                'audio_available': audio_format is not None
            }
            return jsonify(response)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['GET'])
def download():
    url = request.args.get('url', '').strip()
    mode = request.args.get('mode', '').strip()  # 'video' or 'audio'
    format_id = request.args.get('format_id', '').strip()

    if not url:
        return "No URL provided", 400

    # Remove any old files from the download directory
    for f in os.listdir(DOWNLOAD_DIR):
        file_path = os.path.join(DOWNLOAD_DIR, f)
        if os.path.isfile(file_path):
            os.remove(file_path)

    if mode == 'audio':
        # Download audio and convert to MP3
        ydl_opts = get_ydl_opts(url, download=True)
        ydl_opts.update({
            'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
            'format': 'bestaudio',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        })
        ext = 'mp3'
    else:
        # Download video. If a format_id is provided, use it; otherwise, use the best MP4 available.
        if format_id:
            format_str = format_id
        else:
            format_str = 'best[ext=mp4]'
        ydl_opts = get_ydl_opts(url, download=True, format_str=format_str)
        ydl_opts.update({
            'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
        })
        ext = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'video') or 'video'

            downloaded_file = None
            for file in os.listdir(DOWNLOAD_DIR):
                if file.lower().endswith(ext):
                    downloaded_file = os.path.join(DOWNLOAD_DIR, file)
                    break

            if not downloaded_file:
                return "File not found after download.", 500

            safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
            if not safe_title:
                safe_title = "video"

            mimetype = 'video/mp4' if ext == 'mp4' else 'audio/mpeg'

            return send_file(
                downloaded_file,
                as_attachment=False,
                download_name=f"{safe_title}.{ext}",
                mimetype=mimetype
            )

    except Exception as e:
        return f"Error downloading: {str(e)}", 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
