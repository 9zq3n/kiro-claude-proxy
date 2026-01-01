/**
 * Streaming Handler for Kiro/AWS CodeWhisperer
 *
 * Handles streaming message requests using AWS CodeWhisperer API.
 * Yields Anthropic-format SSE events as they arrive.
 */

import crypto from 'crypto';
import {
    KIRO_ENDPOINTS,
    KIRO_API_PATHS,
    KIRO_DEFAULT_REGION,
    MAX_RETRIES
} from '../constants.js';
import { getKiroAuthData } from '../auth/kiro-token-extractor.js';
import { buildKiroRequest, buildKiroHeaders, mapModelToKiro } from './request-builder.js';
import { parseEventStreamAsync } from './aws-event-stream.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

/**
 * Send a streaming request to Kiro/CodeWhisperer
 * Yields Anthropic-format SSE events in real-time
 *
 * @param {Object} anthropicRequest - The Anthropic-format request
 * @param {string} anthropicRequest.model - Model name to use
 * @param {Array} anthropicRequest.messages - Array of message objects
 * @param {number} [anthropicRequest.max_tokens] - Maximum tokens to generate
 * @yields {Object} Anthropic-format SSE events
 * @throws {Error} If request fails or no token available
 */
export async function* sendKiroMessageStream(anthropicRequest) {
    const model = anthropicRequest.model;
    const kiroModel = mapModelToKiro(model);
    
    logger.debug(`[Kiro] Starting stream for model: ${model} -> ${kiroModel}`);
    
    // Get auth data
    const authData = await getKiroAuthData();
    const token = authData.accessToken;
    const region = authData.region || KIRO_DEFAULT_REGION;
    
    if (!token) {
        throw new Error('No Kiro authentication token available. Please log in to Kiro CLI first.');
    }
    
    // Build the request payload
    const payload = buildKiroRequest(anthropicRequest);
    
    // Add model to header and request streaming response
    const headers = {
        ...buildKiroHeaders(token, region, true),
        'x-amzn-access-model': kiroModel,
        'Accept': 'application/vnd.amazon.eventstream'
    };
    
    // Get endpoint for this region
    const endpoint = KIRO_ENDPOINTS[region] || KIRO_ENDPOINTS[KIRO_DEFAULT_REGION];
    const url = `${endpoint}${KIRO_API_PATHS.GENERATE_ASSISTANT}`;
    
    logger.debug(`[Kiro] Stream URL: ${url}`);
    
    // Retry loop
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.warn(`[Kiro] Stream error ${response.status}: ${errorText}`);
                
                if (response.status === 401) {
                    throw new Error('Kiro authentication expired. Please log in again.');
                }
                
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after');
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                    logger.warn(`[Kiro] Rate limited, waiting ${waitMs}ms...`);
                    await sleep(waitMs);
                    continue;
                }
                
                if (response.status >= 500) {
                    const waitMs = Math.pow(2, attempt) * 1000;
                    logger.warn(`[Kiro] Server error, retrying in ${waitMs}ms...`);
                    await sleep(waitMs);
                    continue;
                }
                
                throw new Error(`Kiro API error ${response.status}: ${errorText}`);
            }
            
            // Stream the response
            yield* streamKiroResponse(response, model);
            return; // Success, exit retry loop
            
        } catch (error) {
            if (error.message.includes('authentication') || 
                error.message.includes('expired')) {
                throw error;
            }
            
            if (attempt === MAX_RETRIES - 1) {
                throw error;
            }
            
            logger.warn(`[Kiro] Stream attempt ${attempt + 1} failed: ${error.message}`);
            await sleep(Math.pow(2, attempt) * 1000);
        }
    }
    
    throw new Error('Max retries exceeded');
}

/**
 * Stream and parse Kiro event stream response using AWS binary format
 * @param {Response} response - The fetch response
 * @param {string} requestModel - The original model requested
 * @yields {Object} Anthropic-format SSE events
 */
async function* streamKiroResponse(response, requestModel) {
    const messageId = `msg_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
    let contentBlockIndex = 0;
    let hasStarted = false;
    let hasOpenBlock = false;
    let inputTokens = 0;
    let outputTokens = 0;
    
    try {
        // Use the async event stream parser for streaming
        for await (const event of parseEventStreamAsync(response.body)) {
            // Emit message_start on first event
            if (!hasStarted) {
                hasStarted = true;
                yield {
                    type: 'message_start',
                    message: {
                        id: messageId,
                        type: 'message',
                        role: 'assistant',
                        model: requestModel,
                        content: [],
                        stop_reason: null,
                        stop_sequence: null,
                        usage: { input_tokens: 0, output_tokens: 0 }
                    }
                };
                
                // Start the first content block
                yield {
                    type: 'content_block_start',
                    index: contentBlockIndex,
                    content_block: { type: 'text', text: '' }
                };
                hasOpenBlock = true;
            }
            
            // Convert Kiro event to Anthropic format
            const anthropicEvents = convertKiroEventToAnthropic(event, contentBlockIndex, hasOpenBlock);
            
            for (const evt of anthropicEvents) {
                if (evt) {
                    // Track content block changes
                    if (evt.type === 'content_block_start') {
                        hasOpenBlock = true;
                    }
                    if (evt.type === 'content_block_stop') {
                        hasOpenBlock = false;
                    }
                    
                    // Track token usage
                    if (evt.usage) {
                        inputTokens = evt.usage.input_tokens || inputTokens;
                        outputTokens = evt.usage.output_tokens || outputTokens;
                    }
                    
                    yield evt;
                }
            }
        }
        
        // Close any open content block
        if (hasOpenBlock) {
            yield {
                type: 'content_block_stop',
                index: contentBlockIndex
            };
        }
        
        // Emit message_delta with stop reason
        yield {
            type: 'message_delta',
            delta: {
                stop_reason: 'end_turn',
                stop_sequence: null
            },
            usage: {
                output_tokens: outputTokens
            }
        };
        
        yield { type: 'message_stop' };
        
    } catch (error) {
        logger.error(`[Kiro] Streaming error: ${error.message}`);
        throw error;
    }
}

/**
 * Convert a Kiro/CodeWhisperer event to Anthropic SSE format
 * @param {Object} eventData - The Kiro event data (parsed JSON from binary stream)
 * @param {number} blockIndex - Current content block index
 * @param {boolean} hasOpenBlock - Whether there's an open content block
 * @returns {Array<Object>} Anthropic-format events
 */
function convertKiroEventToAnthropic(eventData, blockIndex, hasOpenBlock) {
    const events = [];
    
    // Direct content (simplified format from test output)
    // Example: {"content":"Hello! How"}
    if (eventData.content !== undefined && typeof eventData.content === 'string') {
        events.push({
            type: 'content_block_delta',
            index: blockIndex,
            delta: { type: 'text_delta', text: eventData.content }
        });
        return events;
    }
    
    // Handle assistantResponseEvent format
    if (eventData.assistantResponseEvent) {
        const content = eventData.assistantResponseEvent.content;
        if (content) {
            events.push({
                type: 'content_block_delta',
                index: blockIndex,
                delta: { type: 'text_delta', text: content }
            });
        }
        return events;
    }
    
    // Usage metadata (e.g., {"unit":"credit","usage":0.0022...})
    if (eventData.usage !== undefined && eventData.unit !== undefined) {
        // This is credit/usage info, not token counts
        // We can log it but don't need to emit an Anthropic event
        logger.debug(`[Kiro] Usage: ${eventData.usage} ${eventData.unitPlural || eventData.unit}`);
        return events;
    }
    
    // Token usage metadata
    if (eventData.metadataEvent?.tokenUsage || eventData.tokenUsage) {
        const usage = eventData.metadataEvent?.tokenUsage || eventData.tokenUsage;
        events.push({
            type: 'message_delta',
            delta: {},
            usage: {
                input_tokens: usage.inputTokens || 0,
                output_tokens: usage.outputTokens || 0
            }
        });
        return events;
    }
    
    // Tool use events
    if (eventData.toolUseEvent || eventData.toolUse) {
        const toolUse = eventData.toolUseEvent || eventData.toolUse;
        
        // Close any open text block first
        if (hasOpenBlock) {
            events.push({
                type: 'content_block_stop',
                index: blockIndex
            });
        }
        
        const newBlockIndex = blockIndex + 1;
        
        events.push({
            type: 'content_block_start',
            index: newBlockIndex,
            content_block: {
                type: 'tool_use',
                id: toolUse.toolUseId || `toolu_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`,
                name: toolUse.name,
                input: {}
            }
        });
        
        if (toolUse.input) {
            events.push({
                type: 'content_block_delta',
                index: newBlockIndex,
                delta: {
                    type: 'input_json_delta',
                    partial_json: JSON.stringify(toolUse.input)
                }
            });
        }
        
        events.push({
            type: 'content_block_stop',
            index: newBlockIndex
        });
        
        return events;
    }
    
    // Code events
    if (eventData.codeEvent) {
        events.push({
            type: 'content_block_delta',
            index: blockIndex,
            delta: { type: 'text_delta', text: eventData.codeEvent.content || '' }
        });
        return events;
    }
    
    return events;
}

export default {
    sendKiroMessageStream
};
