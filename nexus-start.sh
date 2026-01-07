#!/usr/bin/env bash
# nexus-start.sh — full one-click NEXUS startup bundle with visual tail view

HOME_DIR="${HOME:-/home/loop}"
RUNLEVEL_DIR="$HOME_DIR/.repository/wsl-systemd"
LOGS_DIR="$RUNLEVEL_DIR/logs"
SOCKETS_DIR="$RUNLEVEL_DIR/sockets"
OLLAMA_LATCH="$SOCKETS_DIR/ollama_ready.latch"
AI_SCRIPT="$RUNLEVEL_DIR/ai-runlevel.mjs"
PM2_NAME="ai-runlevel"

AGENTS=("COIN" "WAVE" "LOOP" "SIGN" "CORE" "WORK" "CUBE" "CODE" "LINE")

# --- Step 1: Prepare directories ---
mkdir -p "$RUNLEVEL_DIR" "$LOGS_DIR" "$SOCKETS_DIR"

# --- Step 2: Generate agent scripts ---
echo "[nexus-start] Generating NEXUS agents..."
for AGENT in "${AGENTS[@]}"; do
    SCRIPT="$RUNLEVEL_DIR/nexus-${AGENT,,}.mjs"
    cat > "$SCRIPT" <<EOF
#!/usr/bin/env node
import fs from "fs";
import path from "path";

const AGENT_NAME="${AGENT}"
const HOME_DIR=process.env.HOME || "/home/loop"
const LOGS_DIR=path.join(HOME_DIR, ".repository/wsl-systemd", "logs")
const LOG_FILE=path.join(LOGS_DIR, "\${AGENT_NAME}.log")

fs.mkdirSync(LOGS_DIR, { recursive: true })

function log(msg) {
  const ts = new Date().toISOString()
  const line = \`[\${ts}] [\${AGENT_NAME}] \${msg}\\n\`
  fs.appendFileSync(LOG_FILE, line)
  process.stdout.write(line)
}

log("Starting agent...")

setInterval(() => {
  log("Alive and running.")
}, 3000)
EOF
    chmod +x "$SCRIPT"
done
echo "[nexus-start] All agents generated."

# --- Step 3: Create 2π Ollama readiness latch ---
if [ ! -f "$OLLAMA_LATCH" ]; then
    echo "OK" > "$OLLAMA_LATCH"
    echo "[nexus-start] Ollama readiness latch created (2π signal)."
fi

# --- Step 4: Create ai-runlevel.mjs if missing ---
if [ ! -f "$AI_SCRIPT" ]; then
cat > "$AI_SCRIPT" <<'EOF'
#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "fs";
import path from "path";

const HOME_DIR=process.env.HOME || "/home/loop"
const RUNLEVEL_DIR=path.join(HOME_DIR, ".repository/wsl-systemd")
const LOGS_DIR=path.join(RUNLEVEL_DIR, "logs")
const SOCKETS_DIR=path.join(RUNLEVEL_DIR, "sockets")
const OLLAMA_LATCH=path.join(SOCKETS_DIR, "ollama_ready.latch")

const AGENTS=["COIN","WAVE","LOOP","SIGN","CORE","WORK","CUBE","CODE","LINE"]

fs.mkdirSync(LOGS_DIR,{recursive:true})
fs.mkdirSync(SOCKETS_DIR,{recursive:true})

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const randomInt=(min,max)=>Math.floor(Math.random()*(max-min+1))+min

function startAgent(agentName){
  const script=path.join(RUNLEVEL_DIR,`nexus-${agentName.toLowerCase()}.mjs`)
  const spawnLoop=async ()=>{
    while(true){
      if(!fs.existsSync(script)){
        console.error(\`[${agentName}] Script missing: \${script}\`)
        await sleep(5000)
        continue
      }

      const proc=spawn("node",[script],{stdio:["ignore","pipe","pipe"]})
      proc.stdout.on("data",d=>process.stdout.write(\`[\${agentName}] \${d}\`))
      proc.stderr.on("data",d=>process.stderr.write(\`[\${agentName}-ERR] \${d}\`))

      await new Promise(resolve=>proc.on("exit",code=>{
        console.log(\`[\${agentName}] Exited with code \${code}. Restarting in 1s...\`);
        setTimeout(resolve,1000)
      }))
    }
  }
  spawnLoop()
}

async function main(){
  console.log("[ai-runlevel] Starting NEXUS cockpit...");

  if(!fs.existsSync(OLLAMA_LATCH)) fs.writeFileSync(OLLAMA_LATCH,"OK")

  for(const a of AGENTS){
    startAgent(a)
    await sleep(randomInt(200,800))
  }

  console.log("[ai-runlevel] All NEXUS agents started with dynamic restart.");

  process.stdin.resume();
}

main().catch(err=>console.error(err))
EOF
    chmod +x "$AI_SCRIPT"
fi

# --- Step 5: Start ai-runlevel under PM2 ---
pm2 describe "$PM2_NAME" &>/dev/null
if [ $? -ne 0 ]; then
    pm2 start "$AI_SCRIPT" --name "$PM2_NAME"
    echo "[nexus-start] PM2 process started: $PM2_NAME"
else
    echo "[nexus-start] PM2 process already running: $PM2_NAME"
fi

# --- Step 6: Save PM2 process list ---
pm2 save
echo "[nexus-start] PM2 process list saved."

# --- Step 7: Tail all agent logs with color-coding ---
TAIL_FILES=()
for AGENT in "${AGENTS[@]}"; do
    FILE="$LOGS_DIR/${AGENT}.log"
    [ ! -f "$FILE" ] && touch "$FILE"
    TAIL_FILES+=("$FILE")
done

# Define color codes for each agent
declare -A AGENT_COLORS=(
    [COIN]="\033[1;32m"   # Green
    [WAVE]="\033[1;34m"   # Blue
    [LOOP]="\033[1;33m"   # Yellow
    [SIGN]="\033[1;35m"   # Magenta
    [CORE]="\033[1;36m"   # Cyan
    [WORK]="\033[1;31m"   # Red
    [CUBE]="\033[1;37m"   # White
    [CODE]="\033[1;30m"   # Black
    [LINE]="\033[1;32m"   # Green (again)
)

echo "[nexus-start] Tailing all agent logs with color-coding..."

# Combine logs with color-coding and tail
for FILE in "${TAIL_FILES[@]}"; do
    AGENT_NAME=$(basename "$FILE" .log)
    COLOR=${AGENT_COLORS[$AGENT_NAME]}
    tail -f "$FILE" | while read -r line; do
        echo -e "${COLOR}${line}\033[0m"  # Add color and reset
    done &
done

wait

