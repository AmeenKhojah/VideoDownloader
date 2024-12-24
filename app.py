import os
import tempfile
import logging
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp
import requests
from io import BytesIO

app = Flask(__name__)

DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), 'video_downloader')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    url = request.form.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
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

    # Clean old files
    for f in os.listdir(DOWNLOAD_DIR):
        file_path = os.path.join(DOWNLOAD_DIR, f)
        if os.path.isfile(file_path):
            os.remove(file_path)

    if mode == 'audio':
        # MP3 Audio
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
            'format': 'bestaudio',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        }
        ext = 'mp3'
    elif mode == 'video' and format_id:
        # Specific Video Format
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
            'format': format_id,
        }
        ext = 'mp4'  # Assuming mp4, adjust if necessary
    else:
        return "Invalid download mode or format.", 400

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

            # Set mimetype explicitly for iOS compatibility
            if ext == 'mp4':
                mimetype = 'video/mp4'
            elif ext == 'mp3':
                mimetype = 'audio/mpeg'
            else:
                mimetype = None

            # Serve the file with appropriate headers for streaming
            try:
                response = send_file(
                    downloaded_file,
                    mimetype=mimetype,
                    as_attachment=True,
                    download_name=f"{safe_title}.{ext}",  # Flask 2.2+
                    conditional=True  # Enable range requests
                )
            except TypeError:
                # Likely using Flask < 2.2
                response = send_file(
                    downloaded_file,
                    mimetype=mimetype,
                    as_attachment=True,
                    attachment_filename=f"{safe_title}.{ext}",  # For Flask < 2.2
                    conditional=True
                )

            return response

    except Exception as e:
        logging.error(f"Error in /download: {str(e)}")
        return f"Error downloading: {str(e)}", 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Ensure ffmpeg is installed on your server (e.g., sudo apt-get install ffmpeg)
    app.run(host="0.0.0.0", port=port, debug=False)
