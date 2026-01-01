/**
 * Request Builder for Kiro/AWS CodeWhisperer
 *
 * Builds request payloads and headers for the AWS CodeWhisperer API.
 * Converts Anthropic format to AWS CodeWhisperer format.
 */

import crypto from 'crypto';
import {
    KIRO_MODEL_MAPPING,
    KIRO_HEADERS,
    isThinkingModel
} from '../constants.js';

/**
 * Map an Anthropic model name to Kiro's internal model ID
 * @param {string} anthropicModel - The Anthropic-format model name
 * @returns {string} The Kiro/CodeWhisperer model ID
 */
export function mapModelToKiro(anthropicModel) {
    const lower = (anthropicModel || '').toLowerCase();
    
    // Check direct mappings first
    if (KIRO_MODEL_MAPPING[lower]) {
        return KIRO_MODEL_MAPPING[lower];
    }
    
    // Fuzzy matching for common patterns
    if (lower.includes('opus')) {
        return 'claude-opus-4.5';
    }
    if (lower.includes('sonnet') && lower.includes('4.5')) {
        return 'claude-sonnet-4.5';
    }
    if (lower.includes('sonnet') && lower.includes('4')) {
        return 'claude-sonnet-4';
    }
    if (lower.includes('haiku')) {
        return 'claude-haiku-4.5';
    }
    
    // Default to claude-opus-4.5 for unknown models
    return 'claude-opus-4.5';
}

/**
 * Convert Anthropic message format to Kiro/CodeWhisperer format
 * @param {Object} anthropicRequest - The Anthropic-format request
 * @returns {Object} The CodeWhisperer-format request
 */
export function convertAnthropicToKiro(anthropicRequest) {
    const messages = anthropicRequest.messages || [];
    const system = anthropicRequest.system || '';
    
    // Build conversation history for CodeWhisperer
    const conversationHistory = [];
    
    // Add system message if present
    if (system) {
        conversationHistory.push({
            role: 'system',
            content: typeof system === 'string' ? system : JSON.stringify(system)
        });
    }
    
    // Convert messages
    for (const msg of messages) {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        let content = '';
        
        if (typeof msg.content === 'string') {
            content = msg.content;
        } else if (Array.isArray(msg.content)) {
            // Handle content blocks (text, images, tool_use, etc.)
            const textParts = [];
            for (const block of msg.content) {
                if (block.type === 'text') {
                    textParts.push(block.text);
                } else if (block.type === 'thinking') {
                    // Include thinking blocks as context
                    textParts.push(`<thinking>${block.thinking}</thinking>`);
                } else if (block.type === 'tool_use') {
                    textParts.push(`<tool_use name="${block.name}">${JSON.stringify(block.input)}</tool_use>`);
                } else if (block.type === 'tool_result') {
                    textParts.push(`<tool_result tool_use_id="${block.tool_use_id}">${
                        typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
                    }</tool_result>`);
                } else if (block.type === 'image') {
                    // Images would need special handling for CodeWhisperer
                    textParts.push('[Image attached]');
                }
            }
            content = textParts.join('\n');
        }
        
        conversationHistory.push({ role, content });
    }
    
    return {
        conversationHistory,
        maxTokens: anthropicRequest.max_tokens || 8192,
        temperature: anthropicRequest.temperature,
        topP: anthropicRequest.top_p
    };
}

/**
 * Build the CodeWhisperer chat request payload
 * @param {Object} anthropicRequest - The Anthropic-format request
 * @returns {Object} The CodeWhisperer API request payload
 */
export function buildKiroRequest(anthropicRequest) {
    const model = mapModelToKiro(anthropicRequest.model);
    const converted = convertAnthropicToKiro(anthropicRequest);
    
    // Get the last user message as the prompt
    const lastUserMessage = converted.conversationHistory
        .filter(m => m.role === 'user')
        .pop();
    
    const prompt = lastUserMessage?.content || '';
    
    // Build conversation state (excluding the last user message)
    const previousMessages = converted.conversationHistory.slice(0, -1);
    
    return {
        conversationState: {
            conversationId: crypto.randomUUID(),
            chatTriggerType: 'MANUAL',
            customizationArn: null,
            currentMessage: {
                userInputMessage: {
                    content: prompt,
                    userInputMessageContext: {
                        editorState: {
                            cursorState: null
                        }
                    }
                }
            },
            history: previousMessages.map(msg => ({
                [msg.role === 'assistant' ? 'assistantResponseMessage' : 'userInputMessage']: {
                    content: msg.content
                }
            }))
        },
        profileArn: null,
        source: 'AI_EDITOR',
        modelId: model,
        origin: 'AI_EDITOR'
    };
}

/**
 * Build headers for CodeWhisperer API requests
 * @param {string} token - AWS access token
 * @param {string} region - AWS region
 * @param {boolean} streaming - Whether this is a streaming request
 * @returns {Object} Headers object
 */
export function buildKiroHeaders(token, region = 'us-east-1', streaming = false) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': streaming ? 'application/vnd.amazon.eventstream' : 'application/json',
        'X-Amz-Region': region,
        ...KIRO_HEADERS
    };
    
    return headers;
}

/**
 * Build a simple chat completion request for testing
 * @param {string} prompt - The user prompt
 * @param {string} model - Model ID
 * @returns {Object} Simple request payload
 */
export function buildSimpleKiroRequest(prompt, model = 'auto') {
    return {
        conversationState: {
            conversationId: crypto.randomUUID(),
            chatTriggerType: 'MANUAL',
            currentMessage: {
                userInputMessage: {
                    content: prompt,
                    modelId: model,
                    origin: 'AI_EDITOR'
                }
            }
        },
        source: 'AI_EDITOR',
        modelId: model,
        origin: 'AI_EDITOR'
    };
}

export default {
    mapModelToKiro,
    convertAnthropicToKiro,
    buildKiroRequest,
    buildKiroHeaders,
    buildSimpleKiroRequest
};
