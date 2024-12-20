#!/bin/bash
echo "Updating package list..."
apt-get update

echo "Installing FFmpeg..."
apt-get install -y ffmpeg

echo "FFmpeg installation complete!"
