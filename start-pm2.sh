#!/usr/bin/env bash
# start-pm2.sh — NEXUS cockpit PM2 launcher + combined logs + 2π readiness latch

HOME_DIR="${HOME:-/home/loop}"
RUNLEVEL_DIR="$HOME_DIR/ai-runlevel"
LOGS_DIR="$RUNLEVEL_DIR/logs"
SOCKETS_DIR="$RUNLEVEL_DIR/sockets"
OLLAMA_LATCH="$SOCKETS_DIR/ollama_ready.latch"
AI_SCRIPT="$RUNLEVEL_DIR/ai-runlevel.mjs"
PM2_NAME="ai-runlevel"
MAX_RETRIES=15
SLEEP_INTERVAL=2

echo "[start-pm2.sh] NEXUS cockpit starting..."

# Ensure directories exist
mkdir -p "$SOCKETS_DIR" "$LOGS_DIR"

# Wait for Ollama latch (or create if timeout)
RETRY=0
while [ ! -f "$OLLAMA_LATCH" ] && [ $RETRY -lt $MAX_RETRIES ]; do
    echo "[start-pm2.sh] Waiting for Ollama signal... ($RETRY/$MAX_RETRIES)"
    sleep $SLEEP_INTERVAL
    ((RETRY++))
done

if [ ! -f "$OLLAMA_LATCH" ]; then
    echo "[start-pm2.sh] Ollama signal timeout. Forcing readiness..."
    echo "LATCH_FORCED" > "$OLLAMA_LATCH"
fi

echo "[start-pm2.sh] Proceeding with PM2 startup."

# Start ai-runlevel using ecosystem config if available, otherwise script
if [ -f "$RUNLEVEL_DIR/ecosystem.config.cjs" ]; then
    pm2 start "$RUNLEVEL_DIR/ecosystem.config.cjs"
else
    pm2 start "$AI_SCRIPT" --name "$PM2_NAME"
fi

pm2 save

echo "[start-pm2.sh] Orchestrator started. Tailing logs..."
pm2 logs "$PM2_NAME"