#!/bin/env node

import express from 'express';
import { interactWithAgents } from './api.mjs';

const app = express();
const port = 8080;

app.get('/agents/status', async (req, res) => {
    const status = await interactWithAgents();
    res.json({ agents: status });
});

app.listen(port, () => {
    console.log(`API Server running on http://localhost:${port}`);
});

