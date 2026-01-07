/**
 * api.mjs
 * 
 * Purpose: Centralized API bridge for interacting with the local Ollama instance.
 * Provides a robust interface for agents to query LLMs via HTTP or UNIX socket.
 */

import http from 'http';
import { Buffer } from 'buffer';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 11434;
const DEFAULT_SOCKET_PATH = '/run/ollama.sock';
const DEFAULT_MODEL = 'llama3'; 

// Configuration: Prefer Environment Variables
const OLLAMA_HOST = process.env.OLLAMA_HOST || DEFAULT_HOST;
const OLLAMA_PORT = process.env.OLLAMA_PORT || DEFAULT_PORT;
const USE_SOCKET = process.env.OLLAMA_USE_SOCKET === 'true'; 

// Nexus Config
const NEXUS_HOST = process.env.NEXUS_HOST || '127.0.0.1';
const NEXUS_PORT = process.env.NEXUS_PORT || 8081;
const NEXUS_USER = process.env.NEXUS_USER;
const NEXUS_PASS = process.env.NEXUS_PASS;

function _basicAuthHeader() {
    if (NEXUS_USER && NEXUS_PASS) {
        const token = Buffer.from(`${NEXUS_USER}:${NEXUS_PASS}`).toString('base64');
        return { Authorization: `Basic ${token}` };
    }
    return {};
}

/**
 * Sends a request to the Ollama API.
 * @param {string} endpoint - API endpoint
 * @param {object} payload - JSON payload
 * @param {boolean} [stream] - Whether to return a stream (async iterator)
 * @returns {Promise<object|AsyncIterator>} - JSON response or async iterator
 */
function post(endpoint, payload, stream = false) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);

        const options = {
            method: 'POST',
            path: endpoint,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        if (USE_SOCKET) {
            options.socketPath = DEFAULT_SOCKET_PATH;
        } else {
            options.hostname = OLLAMA_HOST;
            options.port = OLLAMA_PORT;
        }

        const req = http.request(options, (res) => {
            if (stream) {
                // Return an async iterator for streaming
                resolve((async function* () {
                    res.setEncoding('utf8');
                    for await (const chunk of res) {
                        // Ollama can send multiple JSON objects in one chunk
                        const lines = chunk.split('\n').filter(line => line.trim() !== '');
                        for (const line of lines) {
                            try {
                                yield JSON.parse(line);
                            } catch (e) {
                                console.error('JSON parse error in stream:', e);
                            }
                        }
                    }
                })());
            } else {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage} - ${data}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            }
        });

        req.on('error', (e) => reject(new Error(`Network Error: ${e.message}`)));
        req.write(postData);
        req.end();
    });
}

/**
 * Generates text completion.
 */
export async function generate(prompt, model = DEFAULT_MODEL, options = {}) {
    const payload = {
        model: model,
        prompt: prompt,
        stream: options.stream || false,
        ...options
    };

    if (options.stream) {
        return post('/api/generate', payload, true);
    } else {
        const response = await post('/api/generate', payload, false);
        return response.response; 
    }
}

/**
 * Chats with the model.
 */
export async function chat(messages, model = DEFAULT_MODEL) {
    const payload = {
        model: model,
        messages: messages,
        stream: false,
    };
    const response = await post('/api/chat', payload, false);
    return response.message;
}

/**
 * Checks Ollama health.
 */
export async function checkHealth() {
    try {
        await new Promise((resolve, reject) => {
            const options = {
                method: 'GET',
                path: '/',
                hostname: OLLAMA_HOST,
                port: OLLAMA_PORT
            };
            if (USE_SOCKET) options.socketPath = DEFAULT_SOCKET_PATH;
            
            const req = http.request(options, (res) => {
                if (res.statusCode === 200) resolve(true);
                else reject(new Error('Status not 200'));
            });
            req.on('error', (e) => reject(e));
            req.end();
        });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Nexus Health Check
 */
export async function checkNexusHealth() {
    // For now, if Nexus isn't actually running, we simulate or check connectivity
    // Adapting the provided logic to use http.request
    const path = '/service/rest/v1/status/check';
    const headers = {
        Accept: 'application/json',
        ..._basicAuthHeader(),
    };

    const options = {
        method: 'GET',
        path,
        hostname: NEXUS_HOST,
        port: NEXUS_PORT,
        headers,
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    // Nexus might return non-JSON on some errors, or we might not be reaching Nexus
                    // For the sake of this demo, if it fails, we return a mock object or throw
                     reject(new Error(`Failed to parse Nexus health JSON: ${e.message}`));
                }
            });
        });
        req.on('error', e => reject(e));
        req.end();
    });
}

export async function isNexusFullyHealthy() {
    try {
        const data = await checkNexusHealth();
        return Object.values(data).every((chk) => chk && chk.healthy === true);
    } catch (_) {
        return false;
    }
}

export default {
    generate,
    chat,
    checkHealth,
    checkNexusHealth,
    isNexusFullyHealthy
};
