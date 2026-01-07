#!/usr/bin/env node
import fs from "fs";
import path from "path";

const AGENT_NAME = "WAVE"
const RUNLEVEL_DIR = process.env.RUNLEVEL_DIR || path.join(process.env.HOME || "/home/loop", "ai-runlevel")
const LOGS_DIR = path.join(RUNLEVEL_DIR, "logs")
const LOG_FILE = path.join(LOGS_DIR, `${AGENT_NAME}.log`)

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
}

function log(msg) {
  const ts = new Date().toISOString()
  const line = `[${ts}] [${AGENT_NAME}] ${msg}\n`
  fs.appendFileSync(LOG_FILE, line)
  process.stdout.write(line)
}

log("Starting agent...")

setInterval(() => {
  log("Alive and running.")
}, 10000)
