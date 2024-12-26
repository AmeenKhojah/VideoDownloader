# app.py
import os
import tempfile
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp
import requests
from bs4 import BeautifulSoup
app = Flask(__name__)

# Directory to store downloaded files temporarily
DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), 'video_downloader')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    url = data.get('url', '').strip()
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

            # Determine thumbnail
            thumbnails = info.get('thumbnails', [])
            if thumbnails:
                # Select the highest resolution thumbnail
                thumbnails_sorted = sorted(thumbnails, key=lambda x: x.get('height', 0), reverse=True)
                thumbnail = thumbnails_sorted[0]['url']
            else:
                thumbnail = info.get('thumbnail', '')

            # Fetch Instagram page content to get the og:image thumbnail
            if 'instagram' in url:
                try:
                    page_response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
                    soup = BeautifulSoup(page_response.content, 'html.parser')
                    meta_tag = soup.find('meta', attrs={'property': 'og:image'})
                    if meta_tag:
                        thumbnail = meta_tag.get('content', thumbnail)
                except Exception as e:
                    print(f"Error fetching Instagram page: {e}")

            # Extract title and webpage URL
            title = info.get('title', 'video') or 'video'
            webpage_url = info.get('webpage_url', url)

            response = {
                'video_formats': chosen_formats,
                'audio_available': audio_format is not None,
                'thumbnail': thumbnail,
                'title': title,
                'webpage_url': webpage_url
            }
            return jsonify(response)

    except Exception as e:
        print(str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['GET'])
def download():
    url = request.args.get('url', '').strip()
    mode = request.args.get('mode', '').strip()  # 'video' or 'audio'
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
            'outtmpl': os.path.join(DOWNLOAD_DIR, 'audio.%(ext)s'),
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        }
        ext = 'mp3'
    else:
        # Video with audio
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'outtmpl': os.path.join(DOWNLOAD_DIR, 'video.%(ext)s'),
            'format': f'{format_id}+bestaudio[ext=m4a]/bestaudio' if format_id else 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }],
            'merge_output_format': 'mp4'
        }
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

            # Set mimetype explicitly for iOS compatibility
            if ext == 'mp4':
                mimetype = 'video/mp4'
            elif ext == 'mp3':
                mimetype = 'audio/mpeg'
            else:
                mimetype = None

            return send_file(
                downloaded_file,
                as_attachment=True,
                download_name=f"{safe_title}.{ext}",
                mimetype=mimetype
            )

    except Exception as e:
        print(f"Download error: {str(e)}")
        return f"Error downloading: {str(e)}", 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Ensure ffmpeg is installed on your server (e.g., `sudo apt-get install ffmpeg`)
    app.run(host="0.0.0.0", port=port, debug=False)
