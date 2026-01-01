/**
 * Message Handler for Kiro/AWS CodeWhisperer
 *
 * Handles non-streaming message requests using AWS CodeWhisperer API.
 * Parses AWS binary event stream responses.
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
import { parseEventStream, extractContentFromEvents } from './aws-event-stream.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

/**
 * Send a non-streaming request to Kiro/CodeWhisperer
 *
 * @param {Object} anthropicRequest - The Anthropic-format request
 * @param {string} anthropicRequest.model - Model name to use
 * @param {Array} anthropicRequest.messages - Array of message objects
 * @param {number} [anthropicRequest.max_tokens] - Maximum tokens to generate
 * @returns {Promise<Object>} Anthropic-format response object
 * @throws {Error} If request fails or no token available
 */
export async function sendKiroMessage(anthropicRequest) {
    const model = anthropicRequest.model;
    const kiroModel = mapModelToKiro(model);
    
    logger.debug(`[Kiro] Sending request for model: ${model} -> ${kiroModel}`);
    
    // Get auth data
    const authData = await getKiroAuthData();
    const token = authData.accessToken;
    const region = authData.region || KIRO_DEFAULT_REGION;
    
    if (!token) {
        throw new Error('No Kiro authentication token available. Please log in to Kiro CLI first.');
    }
    
    // Build the request payload
    const payload = buildKiroRequest(anthropicRequest);
    
    // Add model to header
    const headers = {
        ...buildKiroHeaders(token, region, false),
        'x-amzn-access-model': kiroModel
    };
    
    // Get endpoint for this region
    const endpoint = KIRO_ENDPOINTS[region] || KIRO_ENDPOINTS[KIRO_DEFAULT_REGION];
    const url = `${endpoint}${KIRO_API_PATHS.GENERATE_ASSISTANT}`;
    
    logger.debug(`[Kiro] Request URL: ${url}`);
    
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
                logger.warn(`[Kiro] Error ${response.status}: ${errorText}`);
                
                // Handle specific error cases
                if (response.status === 401) {
                    throw new Error('Kiro authentication expired. Please log in again.');
                }
                
                if (response.status === 429) {
                    // Rate limited - extract retry-after if available
                    const retryAfter = response.headers.get('retry-after');
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                    logger.warn(`[Kiro] Rate limited, waiting ${waitMs}ms...`);
                    await sleep(waitMs);
                    continue;
                }
                
                if (response.status >= 500) {
                    // Server error - retry with backoff
                    const waitMs = Math.pow(2, attempt) * 1000;
                    logger.warn(`[Kiro] Server error, retrying in ${waitMs}ms...`);
                    await sleep(waitMs);
                    continue;
                }
                
                throw new Error(`Kiro API error ${response.status}: ${errorText}`);
            }
            
            // Parse AWS event stream response
            const buffer = await response.arrayBuffer();
            const events = parseEventStream(buffer);
            const extracted = extractContentFromEvents(events);
            
            // Build Anthropic-format response
            const contentBlocks = [];
            
            if (extracted.content) {
                contentBlocks.push({
                    type: 'text',
                    text: extracted.content
                });
            }
            
            // Add tool uses if present
            let stopReason = 'end_turn';
            for (const tool of extracted.toolUses) {
                contentBlocks.push({
                    type: 'tool_use',
                    id: tool.id || `toolu_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`,
                    name: tool.name,
                    input: tool.input || {}
                });
                stopReason = 'tool_use';
            }
            
            return {
                id: `msg_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`,
                type: 'message',
                role: 'assistant',
                model: model,
                content: contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }],
                stop_reason: stopReason,
                stop_sequence: null,
                usage: extracted.usage
            };
            
        } catch (error) {
            if (error.message.includes('authentication') || 
                error.message.includes('expired')) {
                throw error; // Don't retry auth errors
            }
            
            if (attempt === MAX_RETRIES - 1) {
                throw error;
            }
            
            logger.warn(`[Kiro] Attempt ${attempt + 1} failed: ${error.message}`);
            await sleep(Math.pow(2, attempt) * 1000);
        }
    }
    
    throw new Error('Max retries exceeded');
}

export default {
    sendKiroMessage
};
