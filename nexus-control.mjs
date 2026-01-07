#!/usr/bin/env node

/**
 * nexus-control.mjs
 * 
 * Purpose: 
 *  - Orchestrates the 2Pi/8-Agents cycle.
 *  - Acts as the Central "Bidirectional Tokenize-Server".
 *  - Manages SQLite3 memory.
 *  - Hosts the live website on localhost:8080.
 *  - Injects verbose tokens into the UI.
 */

import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import api from './api.mjs';

// --- Configuration ---
const PORT = 8080;
const DB_PATH = './memory/nexus.db';
const AGENTS = ["CORE","WAVE","LOOP","COIN","SIGN","WORK","CUBE","CODE"];

// --- Setup Directory for DB ---
const memoryDir = path.dirname(DB_PATH);
if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
}

// --- Express App ---
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(express.json());
app.use(express.static(__dirname)); // Serve index.html and other static files

// --- SSE Setup ---
// We use Server-Sent Events to inject tokens into the live website
let clients = [];

function sendToClients(data) {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(data)}
\n`));
}

app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

// --- Database Init ---
let db;
(async () => {
    try {
        db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent TEXT,
                phase INTEGER,
                prompt TEXT,
                response TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('[NEXUS] Database initialized.');
    } catch (err) {
        console.error('[NEXUS] DB Init Failed:', err);
    }
})();

// --- API Endpoints ---
app.post('/api/interact', async (req, res) => {
    const { prompt, mode, source } = req.body;
    console.log(`[API] Interaction received: [${mode}] ${prompt}`);

    try {
        // 1. Store User Input in DB
        if (db) {
            await db.run(
                'INSERT INTO memory (agent, phase, prompt, response) VALUES (?, ?, ?, ?)',
                'USER',
                -1, // Special phase for user
                `[${mode}] ${prompt}`,
                'PENDING_RESOLUTION'
            );
        }

        // 2. Broadcast to UI (Feedback)
        const packet = {
            type: 'USER_INTERACTION',
            agent: 'USER',
            response: `[${mode}] ${prompt}`,
            timestamp: Date.now()
        };
        sendToClients(packet);

        // 3. Trigger immediate AI analysis (Optional/Parallel)
        // We can ask the 'CORE' agent to acknowledge this
        api.dispatchControl({
            agent: 'CORE',
            phase: 99,
            angle: 0,
            prompt: `User says: ${prompt}. Mode: ${mode}. Acknowledge and plan.`
        }, (token) => {
             sendToClients({
                type: 'TOKEN_STREAM',
                agent: 'CORE',
                token: token
            });
        }).then(response => {
             // Store the acknowledgement
             if (db) {
                db.run(
                    'INSERT INTO memory (agent, phase, prompt, response) VALUES (?, ?, ?, ?)',
                    'CORE',
                    99,
                    `[ACK] ${prompt}`,
                    response
                );
            }
            sendToClients({
                type: 'TOKEN_STREAM_END',
                agent: 'CORE',
                response: response
            });
        });

        res.json({ status: 'ok', message: 'Interaction processed' });
    } catch (err) {
        console.error('[API] Interaction error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Agent Logic ---
let entropyTick = 0;

async function broadcast(payload) {
    try {
        // 1. Dispatch to AI (Reasoning/Thinking)
        let fullResponse = "";
        const responseText = await api.dispatchControl(payload, (token) => {
            fullResponse += token;
            sendToClients({
                type: 'TOKEN_STREAM',
                agent: payload.agent,
                token: token
            });
        });
        
        // 2. Store in Memory (SQLite)
        if (db) {
            await db.run(
                'INSERT INTO memory (agent, phase, prompt, response) VALUES (?, ?, ?, ?)',
                payload.agent,
                payload.phase,
                `[ANGLE ${payload.angle.toFixed(2)}]`,
                responseText || fullResponse
            );
        }

        // 3. Signal End
        sendToClients({
            type: 'TOKEN_STREAM_END',
            agent: payload.agent,
            response: responseText || fullResponse,
            timestamp: Date.now()
        });

        process.stdout.write(`[${payload.agent}] `);

    } catch (err) {
        console.error(`[NEXUS] Broadcast error for ${payload.agent}:`, err.message);
    }
}

// --- Heartbeat Loop ---
setInterval(() => {
  entropyTick = (entropyTick + 1) % AGENTS.length;

  // Fire the agent cycle
  broadcast({
    type: "entropy",
    phase: entropyTick,
    agent: AGENTS[entropyTick],
    angle: (2 * Math.PI / 8) * entropyTick
  });

}, 250); // 4Hz global pulse

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`[NEXUS] Bidirectional Tokenize-Server running at http://localhost:${PORT}/#`);
    console.log(`[NEXUS] Serving 8-Agent Cycle...`);
});