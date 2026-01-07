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
})();