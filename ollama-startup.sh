#!/usr/bin/env bash
set -e

SOCKET_DIR="$HOME/ai-runlevel/sockets"
LATCH_FILE="$SOCKET_DIR/ollama_ready.latch"

mkdir -p "$SOCKET_DIR"

echo "[ollama-startup] Waiting for Ollama on 127.0.0.1:11435..."

while ! curl -sf http://127.0.0.1:11435/api/tags >/dev/null; do
    sleep 1
done

touch "$LATCH_FILE"
echo "[ollama-startup] Ollama ready. Latch set."

# Keep PM2 process alive forever
tail -f /dev/null

