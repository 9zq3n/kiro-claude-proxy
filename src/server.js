/**
 * Express Server - Anthropic-compatible API
 * Proxies to AWS CodeWhisperer via Kiro
 */

import express from 'express';
import cors from 'cors';
import { 
    sendKiroMessage, 
    sendKiroMessageStream, 
    listKiroModels 
} from './kiro/index.js';
import { isKiroAuthenticated, isKiroDatabaseAccessible } from './auth/kiro-token-extractor.js';
import { REQUEST_BODY_LIMIT } from './constants.js';
import { logger } from './utils/logger.js';

const app = express();

/**
 * Ensure Kiro is authenticated and accessible
 */
async function ensureKiroReady() {
    if (!isKiroDatabaseAccessible()) {
        throw new Error('Kiro CLI database not accessible. Please install and authenticate with Kiro CLI.');
    }
    
    if (!isKiroAuthenticated()) {
        throw new Error('Kiro CLI not authenticated. Please run "kiro auth" to authenticate.');
    }
}

/**
 * Parse error message to extract error type, status code, and user-friendly message
 */
function parseError(error) {
    let errorType = 'api_error';
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes('401') || error.message.includes('UNAUTHENTICATED')) {
        errorType = 'authentication_error';
        statusCode = 401;
        errorMessage = 'Authentication failed. Make sure Kiro CLI is authenticated.';
    } else if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('QUOTA_EXHAUSTED')) {
        errorType = 'invalid_request_error';
        statusCode = 400;

        const resetMatch = error.message.match(/quota will reset after (\d+h\d+m\d+s|\d+m\d+s|\d+s)/i);
        const modelMatch = error.message.match(/"model":\s*"([^"]+)"/);
        const model = modelMatch ? modelMatch[1] : 'the model';

        if (resetMatch) {
            errorMessage = `You have exhausted your capacity on ${model}. Quota will reset after ${resetMatch[1]}.`;
        } else {
            errorMessage = `You have exhausted your capacity on ${model}. Please wait for your quota to reset.`;
        }
    } else if (error.message.includes('invalid_request_error') || error.message.includes('INVALID_ARGUMENT')) {
        errorType = 'invalid_request_error';
        statusCode = 400;
        const msgMatch = error.message.match(/"message":"([^"]+)"/);
        if (msgMatch) errorMessage = msgMatch[1];
    } else if (error.message.includes('PERMISSION_DENIED')) {
        errorType = 'permission_error';
        statusCode = 403;
        errorMessage = 'Permission denied. Check your Kiro CLI authentication.';
    }

    return { errorType, statusCode, errorMessage };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`[${req.method}] ${req.path}`);
    next();
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
    try {
        await ensureKiroReady();
        res.json({
            status: 'ok',
            backend: 'kiro',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            backend: 'kiro',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * List models endpoint (OpenAI-compatible format)
 */
app.get('/v1/models', async (req, res) => {
    try {
        await ensureKiroReady();
        const models = await listKiroModels();
        res.json(models);
    } catch (error) {
        logger.error('[API] Error listing models:', error);
        res.status(500).json({
            type: 'error',
            error: {
                type: 'api_error',
                message: error.message
            }
        });
    }
});

/**
 * Count tokens endpoint (not supported)
 */
app.post('/v1/messages/count_tokens', (req, res) => {
    res.status(501).json({
        type: 'error',
        error: {
            type: 'not_implemented',
            message: 'Token counting is not implemented. Use /v1/messages with max_tokens or configure your client to skip token counting.'
        }
    });
});

/**
 * Main messages endpoint - Anthropic Messages API compatible
 */
app.post('/v1/messages', async (req, res) => {
    try {
        await ensureKiroReady();

        const {
            model,
            messages,
            max_tokens,
            stream,
            system,
            tools,
            tool_choice,
            thinking,
            top_p,
            top_k,
            temperature
        } = req.body;

        // Validate required fields
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                type: 'error',
                error: {
                    type: 'invalid_request_error',
                    message: 'messages is required and must be an array'
                }
            });
        }

        // Build the request object
        const request = {
            model: model || 'claude-3-5-sonnet-20241022',
            messages,
            max_tokens: max_tokens || 4096,
            stream,
            system,
            tools,
            tool_choice,
            thinking,
            top_p,
            top_k,
            temperature
        };

        logger.info(`[API] Request for model: ${request.model}, stream: ${!!stream}`);

        if (stream) {
            // Handle streaming response
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            // Flush headers immediately to start the stream
            res.flushHeaders();

            try {
                const streamGenerator = sendKiroMessageStream(request);
                    
                for await (const event of streamGenerator) {
                    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
                    // Flush after each event for real-time streaming
                    if (res.flush) res.flush();
                }
                res.end();

            } catch (streamError) {
                logger.error('[API] Stream error:', streamError);

                const { errorType, errorMessage } = parseError(streamError);

                res.write(`event: error\ndata: ${JSON.stringify({
                    type: 'error',
                    error: { type: errorType, message: errorMessage }
                })}\n\n`);
                res.end();
            }

        } else {
            // Handle non-streaming response
            const response = await sendKiroMessage(request);
            res.json(response);
        }

    } catch (error) {
        logger.error('[API] Error:', error);

        let { errorType, statusCode, errorMessage } = parseError(error);

        logger.warn(`[API] Returning error response: ${statusCode} ${errorType} - ${errorMessage}`);

        // Check if headers have already been sent (for streaming that failed mid-way)
        if (res.headersSent) {
            logger.warn('[API] Headers already sent, writing error as SSE event');
            res.write(`event: error\ndata: ${JSON.stringify({
                type: 'error',
                error: { type: errorType, message: errorMessage }
            })}\n\n`);
            res.end();
        } else {
            res.status(statusCode).json({
                type: 'error',
                error: {
                    type: errorType,
                    message: errorMessage
                }
            });
        }
    }
});

/**
 * Catch-all for unsupported endpoints
 */
app.use('*', (req, res) => {
    if (logger.isDebugEnabled) {
        logger.debug(`[API] 404 Not Found: ${req.method} ${req.originalUrl}`);
    }
    res.status(404).json({
        type: 'error',
        error: {
            type: 'not_found_error',
            message: `Endpoint ${req.method} ${req.originalUrl} not found`
        }
    });
});

export default app;
