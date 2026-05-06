#!/usr/bin/env bash
set -e

# Start PulseAudio
pulseaudio --start --exit-idle-time=-1 --daemon || true
sleep 1

# Create a virtual null sink (loopback)
# All Chrome audio output goes to this sink
# The sink's monitor captures it back as microphone input
pactl load-module module-null-sink sink_name=loopback sink_properties=device.description=Loopback 2>/dev/null || true
pactl set-default-sink loopback 2>/dev/null || true
pactl set-default-source loopback.monitor 2>/dev/null || true

# Start Xvfb (virtual display)
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99

sleep 1
exec "$@"
