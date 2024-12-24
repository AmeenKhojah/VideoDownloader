# app.py
import os
import tempfile
import logging
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp
import requests
from io import BytesIO
import uuid
app = Flask(__name__)

# Configure logging to show more details
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create a secure temporary directory with unique name
DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), f'video_downloader_{uuid.uuid4().hex}')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
logger.info(f"Download directory created at: {DOWNLOAD_DIR}")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    url = request.form.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
        'merge_output_format': 'mp4',
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }],
        'prefer_ffmpeg': True,
        'outtmpl': os.path.join(DOWNLOAD_DIR, 'video_%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])

            # Enhanced Thumbnail Extraction
            extractor_key = info.get('extractor_key', '').lower()
            if 'instagram' in extractor_key:
                thumbnails = info.get('thumbnails', [])
                if thumbnails:
                    # Assuming the last thumbnail is the highest resolution
                    thumbnail = thumbnails[-1].get('url', '')
                else:
                    thumbnail = ''
                # Enhanced Title Extraction
                title = info.get('description') or info.get('title') or 'Instagram Video'
            else:
                thumbnail = info.get('thumbnail', '')
                title = info.get('title') or 'No Title'

            webpage_url = info.get('webpage_url') or '#'

            # Check audio availability
            audio_format = None
            best_audio_bitrate = 0.0
            for f in formats:
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    abr = f.get('abr', 0.0) or 0.0
                    if abr > best_audio_bitrate:
                        best_audio_bitrate = abr
                        audio_format = f

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
                        # Progressive MP4
                        if (resolution not in progressive_formats) or (tbr > progressive_formats[resolution]['tbr']):
                            progressive_formats[resolution] = {
                                'format_id': f['format_id'],
                                'resolution': resolution,
                                'tbr': tbr,
                                'progressive': True
                            }
                    else:
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

            chosen_formats.sort(key=lambda x: int(x['resolution'].replace('p','')), reverse=True)

            response = {
                'video_formats': chosen_formats,
                'audio_available': audio_format is not None,
                'thumbnail': thumbnail,  # Add thumbnail to response
                'title': title,  # Add title to response
                'webpage_url': webpage_url  # Add webpage URL to response
            }
            logging.info(f"Extractor: {extractor_key}")
            logging.info(f"Title: {title}")
            logging.info(f"Thumbnail URL: {thumbnail}")
            return jsonify(response)

    except Exception as e:
        logging.error(f"Error in /analyze: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/fetch_image')
def fetch_image():
    image_url = request.args.get('url')
    if not image_url:
        return 'No image URL provided.', 400
    try:
        response = requests.get(image_url)
        response.raise_for_status()
        return send_file(
            BytesIO(response.content),
            mimetype=response.headers.get('Content-Type'),
            as_attachment=False
        )
    except requests.exceptions.RequestException as e:
        return str(e), 500


@app.route('/download', methods=['GET'])
def download():
    url = request.args.get('url', '').strip()
    mode = request.args.get('mode', '').strip()
    format_id = request.args.get('format_id', '').strip()

    if not url:
        return "No URL provided", 400

    unique_id = uuid.uuid4().hex  # Generate unique ID
    output_template = os.path.join(DOWNLOAD_DIR, f'video_{unique_id}.%(ext)s')

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'outtmpl': output_template,
        'prefer_ffmpeg': True,
        'merge_output_format': 'mp4',
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }],
    }

    if mode == 'audio':
        ydl_opts.update({
            'format': 'bestaudio',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        })
        ext = 'mp3'
    elif mode == 'video' and format_id:
        ydl_opts['format'] = f"{format_id}+bestaudio[ext=m4a]/best[ext=mp4]"
        ext = 'mp4'
    else:
        return "Invalid download mode or format.", 400

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'video') or 'video'
            safe_title = "".join(c for c in title if c.isalnum() or c in ('_', '-')).strip() or "video"

            downloaded_file = None
            for file in os.listdir(DOWNLOAD_DIR):
                if file.startswith(f"video_{unique_id}") and file.endswith(ext):
                    downloaded_file = os.path.join(DOWNLOAD_DIR, file)
                    break

            if not downloaded_file:
                return "File not found after download.", 500

            # Send file with appropriate headers
            return send_file(
                downloaded_file,
                mimetype='video/mp4' if ext == 'mp4' else 'audio/mpeg',
                as_attachment=True,
                download_name=f"{safe_title}.{ext}",
                conditional=True
            )
    except Exception as e:
        logging.error(f"Error downloading: {str(e)}")
        return f"Error downloading: {str(e)}", 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
