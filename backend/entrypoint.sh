#!/usr/bin/env bash
set -e

# Start PulseAudio with a null sink (virtual audio device for Chromium)
pulseaudio --start --exit-idle-time=-1 --daemon || true

# Start Xvfb (virtual framebuffer) so headed Chromium has a display
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99

exec "$@"
