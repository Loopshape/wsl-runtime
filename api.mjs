#!/bin/env node

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
const DEFAULT_MODEL = 'llama3'; // Adjust based on available models

// Configuration: Prefer Environment Variables
const OLLAMA_HOST = process.env.OLLAMA_HOST || DEFAULT_HOST;
const OLLAMA_PORT = process.env.OLLAMA_PORT || DEFAULT_PORT;
const USE_SOCKET = process.env.OLLAMA_USE_SOCKET === 'true'; // Set to true to force socket usage

/**
 * Sends a request to the Ollama API.
 * @param {string} endpoint - API endpoint (e.g., '/api/generate')
 * @param {object} payload - JSON payload
 * @param {function} [onChunk] - Optional callback for streaming data
 * @returns {Promise<object>} - The JSON response (or final object if streaming)
 */
function post(endpoint, payload, onChunk) {
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
            let data = '';

            res.on('data', (chunk) => {
                if (onChunk) {
                    onChunk(chunk);
                } else {
                    data += chunk;
                }
            });

            res.on('end', () => {
                if (onChunk) {
                    resolve({ done: true });
                    return;
                }
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const json = JSON.parse(data);
                        resolve(json);
                    } else {
                        reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage} - ${data}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Network Error: ${e.message}`));
        });

        // Write data to request body
        req.write(postData);
        req.end();
    });
}

/**
 * Generates text completion using a specified model.
 * @param {string} prompt - The input prompt.
 * @param {string} [model] - The model to use (defaults to config).
 * @param {object} [options] - Additional options (temperature, system prompt, etc.)
 * @param {function} [onToken] - Callback for streaming tokens
 * @returns {Promise<string>} - The generated text.
 */
export async function generate(prompt, model = DEFAULT_MODEL, options = {}, onToken) {
    try {
        const payload = {
            model: model,
            prompt: prompt,
            stream: !!onToken || options.stream || false,
            ...options
        };

        let fullResponse = "";
        
        await post('/api/generate', payload, onToken ? (chunk) => {
             const str = chunk.toString();
             // Ollama streams multiple JSON objects in one chunk sometimes
             const lines = str.split('\n').filter(line => line.trim() !== '');
             for (const line of lines) {
                 try {
                     const json = JSON.parse(line);
                     if (json.response) {
                         onToken(json.response);
                         fullResponse += json.response;
                     }
                     if (json.done) {
                         // stream ended
                     }
                 } catch (e) {
                     // Partial JSON, ignore or buffer (simple implementation assumes line integrity)
                 }
             }
        } : undefined);
        
        if (onToken) return fullResponse;

        const response = await post('/api/generate', payload);
        return response.response; 
    } catch (error) {
        console.error(`[API] Generate failed: ${error.message}`);
        throw error;
    }
}

/**
 * Chats with the model (maintaining context is up to the caller or handled here if extended).
 * @param {Array} messages - Array of message objects [{role: 'user', content: '...'}]
 * @param {string} [model]
 * @returns {Promise<object>} - The full message object {role: 'assistant', content: '...'}
 */
export async function chat(messages, model = DEFAULT_MODEL) {
    try {
        const payload = {
            model: model,
            messages: messages,
            stream: false,
        };

        const response = await post('/api/chat', payload);
        return response.message;
    } catch (error) {
        console.error(`[API] Chat failed: ${error.message}`);
        throw error;
    }
}

/**
 * Checks if the API is reachable (Health Check).
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
    try {
        await new Promise((resolve, reject) => {
            const options = {
                method: 'GET',
                path: '/', // Ollama root often returns "Ollama is running"
            };

            if (USE_SOCKET) {
                options.socketPath = DEFAULT_SOCKET_PATH;
            } else {
                options.hostname = OLLAMA_HOST;
                options.port = OLLAMA_PORT;
            }

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
 * Dispatches a control signal to the AI agent.
 * @param {object} payload - The control payload (e.g. { agent: 'CORE', phase: 0 })
 * @param {function} [onToken] - Optional streaming callback
 * @returns {Promise<string>} - The generated response
 */
export async function dispatchControl(payload, onToken = null) {
    // Pipeline extension: Fasten up parallel tokenizes
    // We treat this as a signal to the model to 'think' or 'reason' about its state
    const prompt = `[SYSTEM: CONTROL_SIGNAL] Agent: ${payload.agent}, Phase: ${payload.phase}, Angle: ${payload.angle}\nTASK: ${payload.prompt || 'Maintain Entropy'}`;
    // Return the promise so the caller (nexus-control) can handle the data
    return generate(prompt, DEFAULT_MODEL, { num_predict: 100 }, onToken);
}

export default {
    generate,
    chat,
    checkHealth,
    dispatchControl
};
