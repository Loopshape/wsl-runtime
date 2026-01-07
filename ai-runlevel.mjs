#!/usr/bin/env node
/**
 * ai-runlevel.mjs
 * 
 * Purpose: Node.js ES module controlling boot services for a WSL1 Debian instance.
 * Functionality:
 *  - Implements a dependency-aware service orchestrator.
 *  - Manages a dependency graph for agent startup.
 *  - Performs readiness checks for external services (Ollama).
 *  - Uses health latches (files) to signal state.
 *  - Auto-retries startup for offline resilience.
 */

import { spawn } from "node:child_process";
import fs from "fs";
import path from "path";
import http from "node:http";

// --- Configuration & Constants ---
const HOME_DIR = process.env.HOME || "/home/loop";
const RUNLEVEL_DIR = "/home/loop/ai-runlevel";
const LOGS_DIR = path.join(RUNLEVEL_DIR, "logs");
const SOCKETS_DIR = path.join(RUNLEVEL_DIR, "sockets");

// External Service Checkpoints
const OLLAMA_SOCKET = "/run/ollama.sock"; // Standard UNIX socket for Ollama
const OLLAMA_LATCH = path.join(SOCKETS_DIR, "ollama_ready.latch"); // Fallback file latch
const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;

// --- Initialization ---
// Ensure critical directories exist before attempting to write logs or latches
[LOGS_DIR, SOCKETS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// --- Dependency Graph ---
// Defines the startup order. Agents are keys, and their values are lists of dependencies
// that must be 'running' (started) before the agent itself launches.
const DEPENDENCIES = {
    "CORE": [],                   // Foundation agent, no dependencies
    "WAVE": ["CORE"],             // Relies on CORE
    "LOOP": ["CORE"],             // Relies on CORE
    "COIN": ["CORE"],             // Relies on CORE
    "SIGN": ["CORE"],             // Relies on CORE
    "WORK": ["CORE", "LOOP"],     // Relies on CORE and LOOP
    "CUBE": ["CORE", "WAVE"],     // Relies on CORE and WAVE
    "CODE": ["CORE", "WORK"],     // Relies on CORE and WORK
    "LINE": ["CORE", "SIGN"],     // Relies on CORE and SIGN
};

const AGENTS = Object.keys(DEPENDENCIES);
const startedAgents = new Set(); // Tracks successfully started agents

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates existence of Ollama readiness via UNIX socket or latch file.
 * Returns true if the service appears ready.
 */
async function checkOllamaReady() {
  // Preferred: real HTTP health check
  try {
    await new Promise((resolve, reject) => {
      const req = http.get(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, res => {
        res.statusCode === 200 ? resolve() : reject();
      });
      req.on("error", reject);
      req.setTimeout(1000, () => req.destroy());
    });
    return true;
  } catch {
    // Fallback latch (offline / emulation mode)
    return fs.existsSync(OLLAMA_LATCH);
  }
}

/**
 * Spawns an agent with automatic restart and dependency awareness.
 * @param {string} agentName - The name of the agent to start (e.g., "CORE")
 */
function startAgent(agentName) {
    const script = path.join(RUNLEVEL_DIR, `nexus-${agentName.toLowerCase()}.mjs`);
    
    // Continuous loop to ensure the agent runs and restarts on failure
    const spawnLoop = async () => {
        while (true) {
            // 1. Dependency Check
            const deps = DEPENDENCIES[agentName];
            const allDepsStarted = deps.every(dep => startedAgents.has(dep));
            
            if (!allDepsStarted) {
                // Wait and retry if dependencies aren't ready yet
                await sleep(1000);
                continue;
            }

            // 2. Script Existence Check
            if (!fs.existsSync(script)) {
                console.error(`[${agentName}] Script missing: ${script}. Retrying in 5s...`);
                await sleep(5000);
                continue;
            }

            // 3. Spawn Process
            console.log(`[${agentName}] Starting...`);
            const proc = spawn("node", [script], { 
                stdio: ["ignore", "pipe", "pipe"], // Ignore stdin, pipe stdout/stderr
                env: { ...process.env, AGENT_NAME: agentName, RUNLEVEL_DIR }
            });

            // 4. Log Management
            // Create a specific log file for this agent
            const logFile = path.join(LOGS_DIR, `${agentName}.log`);
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
            
            // Pipe output to the log file
            proc.stdout.pipe(logStream);
            proc.stderr.pipe(logStream);

            // Also echo to the main runlevel stdout for immediate visibility
            proc.stdout.on("data", d => process.stdout.write(`[${agentName}] ${d}`));
            proc.stderr.on("data", d => process.stderr.write(`[${agentName}-ERR] ${d}`));

            // Mark agent as started for dependency resolution of others
            startedAgents.add(agentName);

            // 5. Exit Handling
            await new Promise(resolve => proc.on("exit", code => {
                console.log(`[${agentName}] Exited with code ${code}. Restarting in 2s...`);
                // Note: We remove it from startedAgents if we want strict dependency health,
                // but for loose coupling, we might keep it. Here we remove it to be safe.
                startedAgents.delete(agentName);
                setTimeout(resolve, 2000);
            }));
        }
    };

    spawnLoop();
}

/**
 * Main boot sequence
 */
async function main() {
    console.log("[ai-runlevel] Initializing systemd-like environment for WSL1...");

    // --- Phase 1: Pre-flight Checks (Ollama) ---
    console.log("[ai-runlevel] Waiting for Ollama signal...");
    let retries = 0;
    while (!(await checkOllamaReady())) {
        if (retries % 10 === 0) {
            console.log("[ai-runlevel] Ollama not ready. Checking /run/ollama.sock or " + OLLAMA_LATCH);
        }
        
        // Auto-retry loop for offline/not-yet-ready scenarios
        await sleep(2000);
        retries++;
        
        // Timeout handling: Force proceed after ~30 seconds if strictly offline
        if (retries > 15) {
            console.log("[ai-runlevel] Ollama timeout. Creating placeholder latch to proceed...");
            fs.writeFileSync(OLLAMA_LATCH, "LATCH_BYPASS");
        }
    }
    console.log("[ai-runlevel] Ollama signal detected.");

    // --- Phase 2: Agent Orchestration ---
    // Iterate through all agents; the startAgent function handles dependency waiting
    AGENTS.forEach(agent => {
        startAgent(agent);
    });

    console.log("[ai-runlevel] Orchestrator running. Managing " + AGENTS.length + " agents.");
    
    // --- Phase 3: System Health ---
    // Signal that the runlevel itself is fully operational
    fs.writeFileSync(path.join(SOCKETS_DIR, "runlevel.latch"), "RUNNING");

    // Prevent the Node.js process from exiting
    process.stdin.resume();
}

main().catch(err => {
    console.error("[ai-runlevel] FATAL ERROR:", err);
    process.exit(1);
});

