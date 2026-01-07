/* --------------------------------------------------------------
   app.js – front‑end glue for WEBTRACON
   -------------------------------------------------------------- */
(() => {
  const consoleOutput = document.getElementById('console-output');
  const promptInput   = document.getElementById('ai-prompt');
  const actionBtn    = document.querySelector('.action-btn');
  let evtSource;

  /* ---------- SSE handling ------------------------------------------------ */
  function connectSSE() {
      evtSource = new EventSource('/events');

      evtSource.onmessage = e => {
        const data = JSON.parse(e.data);
        const line = document.createElement('div');

        if (data.type === 'TOKEN_INJECTION') {
          line.innerHTML = `
            <span style="color: var(--neon-blue)">[${data.agent}]</span>
            <span style="color: #ccc">${data.response}</span>`;
        } else if (data.type === 'HEALTH') {
          line.innerHTML = `
            <span style="color: var(--neon-green)">[SYSTEM] Nexus health: ${data.healthy ? '✅ OK' : '❌ PROBLEM'}</span>
            <span style="color: #aaa; font-size: 0.8em">Checks: ${JSON.stringify(data.checks)}</span>
          `;
        } else if (data.type === 'TOKEN_STREAM') {
             // Handle streaming tokens (append to last line if same agent, else new line)
             // For simplicity, we'll just log them as they come, but in a real terminal we'd optimize.
             // Here we use a simpler approach similar to INJECTION for now.
             line.innerHTML = `<span style="color: var(--neon-blue)">[${data.agent}]</span> <span style="color: #ccc">${data.token}</span>`;
        } else if (data.type === 'TOKEN_STREAM_END') {
             // Optional: mark stream end
             return;
        } else {
          line.textContent = JSON.stringify(data);
        }

        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        if (consoleOutput.childElementCount > 100) {
          consoleOutput.removeChild(consoleOutput.firstChild);
        }
      };

      evtSource.onerror = () => {
        console.error('EventSource disconnected');
        const err = document.createElement('div');
        err.textContent = '[SYSTEM] Lost connection to server. Retrying...';
        err.style.color = 'var(--neon-red)';
        consoleOutput.appendChild(err);
        evtSource.close();
        setTimeout(connectSSE, 5000);
      };
  }

  connectSSE();

  /* ---------- Helper: show temporary status on button -------------------- */
  function setButtonLoading(loading) {
    if (loading) {
      actionBtn.textContent = 'PROCESSING…';
      actionBtn.classList.add('loading');
      actionBtn.disabled = true;
    } else {
      actionBtn.textContent = 'RESOLVE';
      actionBtn.classList.remove('loading');
      actionBtn.disabled = false;
    }
  }

  /* ---------- Send prompt to back‑end ------------------------------------ */
  async function submitPrompt() {
    const raw = promptInput.value.trim();
    if (!raw) return;
    setButtonLoading(true);

    try {
      const resp = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: raw })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Server ${resp.status}: ${txt}`);
      }

      // All further tokens will come through the existing EventSource.
      // We only clear the input after the request succeeded.
      promptInput.value = '';
    } catch (err) {
      console.error('Prompt submit error', err);
      const errLine = document.createElement('div');
      errLine.textContent = `[ERROR] ${err.message}`;
      errLine.style.color = 'var(--neon-red)';
      consoleOutput.appendChild(errLine);
    } finally {
      setButtonLoading(false);
    }
  }

  /* ---------- Bind UI events -------------------------------------------- */
  actionBtn.addEventListener('click', submitPrompt);
  promptInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') submitPrompt();
  });

  // Card shortcuts – they just prepend a tag to the input
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode?.toUpperCase() || '';
      promptInput.value = `[${mode}] `;
      promptInput.focus();
    });
  });

  /* ---------- On page load – fetch Nexus health --------------------------- */
  async function loadNexusHealth() {
    try {
      const r = await fetch('/api/nexus/health');
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const { healthy, checks } = await r.json();
      
      // Inject directly into console via DOM to ensure it's seen
      const line = document.createElement('div');
      line.innerHTML = `
            <span style="color: var(--neon-green)">[SYSTEM] Nexus health: ${healthy ? '✅ OK' : '❌ PROBLEM'}</span>
            <span style="color: #aaa; font-size: 0.8em">Checks: ${JSON.stringify(checks)}</span>
      `;
      consoleOutput.appendChild(line);
      consoleOutput.scrollTop = consoleOutput.scrollHeight;

    } catch (e) {
      console.warn('Could not fetch Nexus health', e);
      const err = document.createElement('div');
      err.textContent = `[SYSTEM] Health Check Failed: ${e.message}`;
      err.style.color = 'var(--neon-red)';
      consoleOutput.appendChild(err);
    }
  }

  loadNexusHealth();

  /* ---------- Clean up on unload ------------------------------------------ */
  window.addEventListener('beforeunload', () => {
      if(evtSource) evtSource.close();
  });

  /* ---------- Visualizer Logic -------------------------------------------- */
  const canvas = document.getElementById('agent-graph');
  if (canvas) {
      const ctx = canvas.getContext('2d');
      let width, height;
      
      const agents = [
          { name: 'COIN', color: '#00ff99' }, // Green
          { name: 'WAVE', color: '#00ccff' }, // Blue
          { name: 'LOOP', color: '#ffdd00' }, // Yellow
          { name: 'SIGN', color: '#ff0055' }, // Red
          { name: 'WORK', color: '#ff0055' }, // Red
          { name: 'CUBE', color: '#ffffff' }, // White
          { name: 'CODE', color: '#00ccff' }, // Blue
          { name: 'LINE', color: '#00ff99' }  // Green
      ];
      const centerAgent = { name: 'CORE', color: '#00ccff' }; // Cyan

      let nodes = [];

      function resize() {
          width = canvas.parentElement.offsetWidth;
          height = canvas.parentElement.offsetHeight;
          canvas.width = width;
          canvas.height = height;
          initNodes();
      }
      window.addEventListener('resize', resize);

      function initNodes() {
          nodes = [];
          const cx = width / 2;
          const cy = height / 2;
          const radius = Math.min(width, height) * 0.35;

          // Perimeter Agents
          agents.forEach((agent, i) => {
              const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
              nodes.push({
                  ...agent,
                  x: cx + Math.cos(angle) * radius,
                  y: cy + Math.sin(angle) * radius,
                  baseX: cx + Math.cos(angle) * radius,
                  baseY: cy + Math.sin(angle) * radius,
                  active: 0,
                  radius: 15
              });
          });

          // Center Agent
          nodes.push({
              ...centerAgent,
              x: cx,
              y: cy,
              baseX: cx,
              baseY: cy,
              active: 0,
              radius: 25,
              isCenter: true
          });
      }

      function draw() {
          ctx.clearRect(0, 0, width, height);
          
          // Draw Connections
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          const centerNode = nodes.find(n => n.isCenter);
          
          // Connect perimeter to center
          nodes.forEach(node => {
              if (!node.isCenter) {
                  ctx.moveTo(node.x, node.y);
                  ctx.lineTo(centerNode.x, centerNode.y);
              }
          });
          
          // Connect perimeter ring
          for (let i = 0; i < agents.length; i++) {
              const n1 = nodes[i];
              const n2 = nodes[(i + 1) % agents.length];
              ctx.moveTo(n1.x, n1.y);
              ctx.lineTo(n2.x, n2.y);
          }
          ctx.stroke();

          // Draw Nodes
          nodes.forEach(node => {
              // Activity Pulse
              if (node.active > 0) {
                  node.active -= 0.02; // Decay
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.radius + (node.active * 10), 0, Math.PI * 2);
                  ctx.fillStyle = node.color;
                  ctx.globalAlpha = node.active * 0.5;
                  ctx.fill();
                  ctx.globalAlpha = 1;
              }

              ctx.beginPath();
              ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
              ctx.fillStyle = '#000';
              ctx.strokeStyle = node.color;
              ctx.lineWidth = 2;
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#fff';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.name, node.x, node.y);
          });

          requestAnimationFrame(draw);
      }

      // Initial Setup
      setTimeout(() => {
          resize();
          draw();
      }, 100);

      // Hook into SSE
      const originalOnMessage = evtSource.onmessage;
      evtSource.onmessage = (e) => {
          if (originalOnMessage) originalOnMessage(e);
          
          try {
              const data = JSON.parse(e.data);
              if (data.type === 'TOKEN_STREAM' || data.type === 'TOKEN_INJECTION') {
                  const targetName = data.agent === 'Ollama' ? 'CORE' : data.agent;
                  const node = nodes.find(n => n.name === targetName);
                  if (node) {
                      node.active = 1;
                      // GSAP Animation for "kick"
                      if (window.gsap) {
                          gsap.to(node, {
                              radius: node.isCenter ? 30 : 20,
                              duration: 0.1,
                              yoyo: true,
                              repeat: 1,
                              onComplete: () => { node.radius = node.isCenter ? 25 : 15; }
                          });
                      }
                  }
              }
          } catch(err) {}
      };
  }

})();