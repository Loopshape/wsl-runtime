// server.mjs
import http from 'http';
import express from 'express';
import cors from 'cors';
import { generate, checkNexusHealth, isNexusFullyHealthy } from './api.mjs';

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
  const payload = `data: ${JSON.stringify(eventObj)}

`;
  sseClients.forEach(c => c.res.write(payload));
}

/* ---------- Prompt → Ollama ------------------------------------------- */
app.post('/api/prompt', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'empty prompt' });

  try {
    const stream = await generate(prompt, undefined, { stream: true });

    // Respond immediately so client knows we started
    res.json({ status: 'queued' });

    for await (const chunk of stream) {
      if (chunk.done) break;
      broadcast({ type: 'TOKEN_INJECTION', agent: 'Ollama', response: chunk.response });
    }

    broadcast({ type: 'TOKEN_INJECTION', agent: 'Ollama', response: '[DONE]' });

  } catch (err) {
    console.error('Prompt handling error', err);
    // Since we already responded with json, we can't send status 500. 
    // We broadcast the error.
    broadcast({ type: 'TOKEN_INJECTION', agent: 'SYSTEM', response: `[ERROR] ${err.message}` });
  }
});

/* ---------- Nexus health endpoint --------------------------------------- */
app.get('/api/nexus/health', async (req, res) => {
  try {
    const health = await checkNexusHealth();   
    const ok = await isNexusFullyHealthy();     
    res.json({ healthy: ok, checks: health });
  } catch (e) {
    console.error('Nexus health check failed', e);
    // Return false instead of 502 to allow frontend to show "Problem" instead of error
    res.json({ healthy: false, error: e.message });
  }
});

/* ---------- Server start ------------------------------------------------ */
const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () => {
  console.log(`🚀 WEBTRACON server listening on http://localhost:${PORT}`);
});
