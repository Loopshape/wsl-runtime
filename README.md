# WEBTRACON - AI Resolution Agent

A futuristic, neon-styled single-page application powered by local AI agents for advanced problem solving and content generation.

## 🚀 Quick Start

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Backend:**
    ```bash
    node server/server.mjs
    ```

3.  **Launch the Frontend:**
    Serve the `public` directory using a static file server (e.g., `serve`, `http-server`, or Vite).
    ```bash
    npx serve public
    ```
    Open `http://localhost:3000` (or the port provided by your static server) in your browser.

## 🛡️ Security & Production Checklist

-   [ ] **CORS Restriction:** Restrict `Access-Control-Allow-Origin` to your specific production domain instead of `*`.
-   [ ] **Content-Security-Policy (CSP):** Implement strict CSP headers to prevent XSS.
-   [ ] **HTTPS:** Serve all traffic over HTTPS (using a reverse proxy like Nginx or Caddy).
-   [ ] **Rate Limiting:** Implement rate limiting on `/api/prompt` (e.g., using `express-rate-limit`) to prevent abuse.
-   [ ] **Authentication:** Add API key or JWT authentication for sensitive endpoints.
-   [ ] **Environment Variables:** Load secrets (`OLLAMA_HOST`, `NEXUS_CREDENTIALS`, etc.) from a `.env` file (do not commit `.env`!).
-   [ ] **Logging:** Use a structured logger like `pino` or `winston` for production logs.
-   [ ] **Graceful Shutdown:** Handle `SIGTERM`/`SIGINT` signals to close server connections cleanly.
-   [ ] **Accessibility:** Ensure `prefers-reduced-motion` and focus visibility styles are maintained.

## 📂 Project Structure

```
project-root/
├─ public/
│   ├─ index.html       # Main UI
│   ├─ css/
│   │    └─ style.css   # Neon styling
│   └─ js/
│        └─ app.js      # Frontend logic (SSE, API calls)
├─ server/
│   ├─ api.mjs          # Ollama & Nexus API Bridge
│   └─ server.mjs       # Express Server & SSE
├─ .env                 # Environment config (git-ignored)
├─ package.json
└─ README.md
```
