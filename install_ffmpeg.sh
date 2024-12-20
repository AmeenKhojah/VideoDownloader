#!/bin/bash
echo "Starting FFmpeg installation..." > /app/ffmpeg_debug.log
chmod +x ./install_ffmpeg.sh >> /app/ffmpeg_debug.log 2>&1
apt-get update >> /app/ffmpeg_debug.log 2>&1
apt-get install -y ffmpeg >> /app/ffmpeg_debug.log 2>&1
echo "FFmpeg installation complete!" >> /app/ffmpeg_debug.log
