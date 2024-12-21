import os
import tempfile
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp

app = Flask(__name__)

DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), 'video_downloader')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

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

            # Separate audio and video formats
            audio_format = None
            video_formats = []

            for f in formats:
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    audio_format = f
                elif f.get('vcodec') != 'none':
                    video_formats.append({
                        'format_id': f['format_id'],
                        'resolution': f.get('height', 'Unknown'),
                        'progressive': f.get('acodec') != 'none'
                    })

            return jsonify({
                'video_formats': video_formats,
                'audio_available': bool(audio_format)
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '').strip()
    mode = data.get('mode', '').strip()  # 'video' or 'audio'

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
        'format': format_id if mode == 'video' else 'bestaudio',
    }

    if mode == 'audio':
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
        }]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file_path = next((f for f in os.listdir(DOWNLOAD_DIR) if f.startswith('video')), None)

            if file_path:
                return send_file(
                    os.path.join(DOWNLOAD_DIR, file_path),
                    as_attachment=True
                )
            return jsonify({'error': 'Download failed. File not found.'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
