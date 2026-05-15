#!/usr/bin/env bash
set -e

# Start PulseAudio
pulseaudio --start --exit-idle-time=-1 --daemon || true
sleep 1

# Create a virtual null sink (loopback)
pactl load-module module-null-sink sink_name=loopback sink_properties=device.description=Loopback 2>/dev/null || true
pactl set-default-sink loopback 2>/dev/null || true
pactl set-default-source loopback.monitor 2>/dev/null || true

# Clean up stale Xvfb lock files from previous runs
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

# Start Xvfb and keep it running in background
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
export DISPLAY=:99

# Wait for Xvfb to be ready
sleep 2

# Watchdog: restart Xvfb if it dies
(while true; do
  if ! kill -0 $XVFB_PID 2>/dev/null; then
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
    Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &
    XVFB_PID=$!
  fi
  sleep 10
done) &

exec "$@"
