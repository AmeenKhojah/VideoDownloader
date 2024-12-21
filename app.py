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

            # Find best audio-only format for MP3
            audio_format = None
            best_audio_bitrate = 0.0
            for f in formats:
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    abr = f.get('abr', 0.0) or 0.0
                    if abr > best_audio_bitrate:
                        best_audio_bitrate = abr
                        audio_format = f

            # Progressive MP4 formats (no merging needed)
            progressive_formats = {}
            # Non-progressive bestvideo formats (need merging with bestaudio)
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
                        # Progressive format
                        if (resolution not in progressive_formats) or (tbr > progressive_formats[resolution]['tbr']):
                            progressive_formats[resolution] = {
                                'format_id': f['format_id'],
                                'resolution': resolution,
                                'tbr': tbr,
                                'progressive': True
                            }
                    else:
                        # Potential bestvideo format (no audio)
                        if vcodec != 'none' and acodec == 'none':
                            if (resolution not in separate_videos) or (tbr > separate_videos[resolution]['tbr']):
                                separate_videos[resolution] = {
                                    'format_id': f['format_id'],
                                    'resolution': resolution,
                                    'tbr': tbr,
                                    'progressive': False
                                }

            # Combine progressive and separate
            chosen_formats = list(progressive_formats.values())

            # Add separate videos (for merging) if not already available as progressive
            for res, vid in separate_videos.items():
                if res not in progressive_formats:
                    chosen_formats.append(vid)

            # Sort by resolution descending
            chosen_formats.sort(key=lambda x: int(x['resolution'].replace('p','')), reverse=True)

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
    format_id = request.args.get('format_id', '').strip()
    mode = request.args.get('mode', '').strip()  # 'video' or 'audio'
    progressive_str = request.args.get('progressive', 'true')
    progressive = (progressive_str.lower() == 'true')

    if not url:
        return "No URL provided", 400

    # Clean old files
    for f in os.listdir(DOWNLOAD_DIR):
        file_path = os.path.join(DOWNLOAD_DIR, f)
        if os.path.isfile(file_path):
            os.remove(file_path)

    if mode == 'audio':
        # Download best audio and convert to MP3
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
    else:
        # Video download
        if not format_id:
            return "No format_id provided for video download", 400

        if progressive:
            # Progressive MP4, no merging needed
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
                'format': format_id,
            }
            ext = 'mp4'
        else:
            # Merging bestvideo(format_id)+bestaudio
            chosen_format = f"{format_id}+bestaudio"
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
                'format': chosen_format,
                'merge_output_format': 'mp4'
            }
            ext = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'video')

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

            return send_file(downloaded_file, as_attachment=True, download_name=f"{safe_title}.{ext}")

    except Exception as e:
        return f"Error downloading: {str(e)}", 500


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))  # Railway or default port
    # Debug=False ensures fewer logs on production
    app.run(host="0.0.0.0", port=port, debug=False)
