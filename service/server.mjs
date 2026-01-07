// server.mjs ---------------------------------------------------------
import http from 'http';
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { generate, dispatchControl, checkHealth } from '../api.mjs'; 

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ---------- SSE endpoint ------------------------------------------------ */
let sseClients = [];

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('\n');

  const client = { id: Date.now(), res };
  sseClients.push(client);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== client);
  });
});

function broadcast(eventObj) {
  const payload = `data: ${JSON.stringify(eventObj)}\n\n`;
  sseClients.forEach(c => c.res.write(payload));
}

/* ---------- Prompt → Ollama & Agents ---------------------------------- */
app.post('/api/interact', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'empty prompt' });

  // Respond immediately to UI
  res.json({ status: 'processing', message: 'Quest dispatched to Nexus.' });

  try {
    // 1. Main System Response (Ollama)
    broadcast({ type: 'TOKEN_STREAM', agent: 'SYSTEM', token: 'Analyzing Request...' });
    
    await generate(prompt, undefined, { stream: true }, (token) => {
        broadcast({ type: 'TOKEN_STREAM', agent: 'Ollama', token: token });
    });
    broadcast({ type: 'TOKEN_STREAM_END', agent: 'Ollama' });

    // 2. Execute System Trigger (~/_/ai/ai.sh)
    // We run this in background
    exec(`${process.env.HOME}/_/ai/ai.sh "${prompt}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            broadcast({ type: 'TOKEN_STREAM', agent: 'SYSTEM', token: `\n[Error executing ai.sh: ${error.message}]` });
            return;
        }
        if (stdout) broadcast({ type: 'TOKEN_STREAM', agent: 'SYSTEM', token: `\n[ai.sh]: ${stdout}` });
        if (stderr) broadcast({ type: 'TOKEN_STREAM', agent: 'SYSTEM', token: `\n[ai.sh-err]: ${stderr}` });
    });

    // 3. Cycle Agents (2Pi/8 Entropy)
    // Agents from nexus-start.sh: COIN, WAVE, LOOP, SIGN, CORE, WORK, CUBE, CODE, LINE
    // We use 8 positions, 9th might overlay or be center.
    const agents = ["COIN", "WAVE", "LOOP", "SIGN", "CORE", "WORK", "CUBE", "CODE"];
    const TWO_PI = 2 * Math.PI;
    const PHASE_STEP = TWO_PI / 8;

    const agentPromises = agents.map(async (agent, index) => {
        const angle = index * PHASE_STEP;
        // Delay each agent slightly for visual effect "shifted along a cycled entropy"
        await new Promise(r => setTimeout(r, index * 200));

        broadcast({ type: 'TOKEN_STREAM', agent: agent, token: `[Phase ${angle.toFixed(2)}] ` });

        try {
             // We inject the prompt into the agent's context
             await dispatchControl({ 
                 agent, 
                 phase: index, 
                 angle,
                 prompt: prompt 
             }, (token) => {
                 broadcast({ type: 'TOKEN_STREAM', agent: agent, token: token });
             });
        } catch (e) {
             broadcast({ type: 'TOKEN_STREAM', agent: agent, token: `[OFFLINE: ${e.message}]` });
        }
        broadcast({ type: 'TOKEN_STREAM_END', agent: agent });
    });

    await Promise.all(agentPromises);
    
    broadcast({ type: 'TOKEN_INJECTION', agent: 'SYSTEM', response: '[QUEST COMPLETE]' });

  } catch (err) {
    console.error('Interaction error', err);
    broadcast({ type: 'TOKEN_INJECTION', agent: 'SYSTEM', response: `[ERROR] ${err.message}` });
  }
});

/* ---------- Nexus health endpoint --------------------------------------- */
app.get('/api/nexus/health', async (req, res) => {
  try {
    const healthy = await checkHealth();
    res.json({ healthy: healthy, checks: { ollama: healthy } });
  } catch (e) {
    console.error('Nexus health check failed', e);
    res.status(502).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () => {
  console.log(`🚀 WEBTRACON server listening on http://localhost:${PORT}`);
});

