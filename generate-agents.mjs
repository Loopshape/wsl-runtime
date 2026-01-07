#!/usr/bin/env node
// generate-agents.mjs
// Fully Node.js-based NEXUS dummy agent generator

import fs from "fs";
import path from "path";

const HOME_DIR = process.env.HOME || "/home/loop";
const RUNLEVEL_DIR = path.join(HOME_DIR, ".repository/wsl-systemd");
const LOGS_DIR = path.join(RUNLEVEL_DIR, "logs");

// List of agent names
const AGENTS = ["COIN", "WAVE", "LOOP", "SIGN", "CORE", "WORK", "CUBE", "CODE", "LINE"];

// Ensure directories exist
fs.mkdirSync(RUNLEVEL_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

AGENTS.forEach(agent => {
  const filename = path.join(RUNLEVEL_DIR, `nexus-${agent.toLowerCase()}.mjs`);

  const content = `#!/usr/bin/env node
import fs from "fs";
import path from "path";

const AGENT_NAME = "${agent}";
const HOME_DIR = process.env.HOME || "/home/loop";
const LOGS_DIR = path.join(HOME_DIR, ".repository/wsl-systemd", "logs");
const LOG_FILE = path.join(LOGS_DIR, \`\${AGENT_NAME}.log\`);

fs.mkdirSync(LOGS_DIR, { recursive: true });

function log(message) {
  const timestamp = new Date().toISOString();
  const line = \`[\${timestamp}] [\${AGENT_NAME}] \${message}\\n\`;
  fs.appendFileSync(LOG_FILE, line);
  process.stdout.write(line);
}

log("Starting agent...");

setInterval(() => {
  log("Alive and running.");
}, 3000);
`;

  fs.writeFileSync(filename, content, { mode: 0o755 });
  console.log(`[generate-agents] Created ${filename}`);
});

console.log("[generate-agents] All NEXUS agents generated successfully.");

