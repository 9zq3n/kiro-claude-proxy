/**
 * Response Converter for Kiro/AWS CodeWhisperer
 *
 * Converts CodeWhisperer responses back to Anthropic format.
 */

import crypto from 'crypto';

/**
 * Convert a CodeWhisperer chat response to Anthropic format
 * @param {Object} kiroResponse - The CodeWhisperer response
 * @param {string} requestModel - The original model requested
 * @returns {Object} Anthropic-format response
 */
export function convertKiroToAnthropic(kiroResponse, requestModel) {
    // Handle streaming response format
    if (kiroResponse.assistantResponseEvent) {
        return convertStreamingResponse(kiroResponse, requestModel);
    }
    
    // Handle non-streaming response
    const content = extractContent(kiroResponse);
    const thinking = extractThinking(kiroResponse);
    
    const contentBlocks = [];
    
    // Add thinking block if present
    if (thinking) {
        contentBlocks.push({
            type: 'thinking',
            thinking: thinking
        });
    }
    
    // Add text content
    if (content) {
        contentBlocks.push({
            type: 'text',
            text: content
        });
    }
    
    // Handle tool use if present
    const toolUses = extractToolUses(kiroResponse);
    for (const tool of toolUses) {
        contentBlocks.push({
            type: 'tool_use',
            id: tool.id || `toolu_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`,
            name: tool.name,
            input: tool.input || {}
        });
    }
    
    return {
        id: `msg_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`,
        type: 'message',
        role: 'assistant',
        model: requestModel,
        content: contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }],
        stop_reason: determineStopReason(kiroResponse, toolUses),
        stop_sequence: null,
        usage: extractUsage(kiroResponse)
    };
}

/**
 * Convert streaming response chunk to Anthropic format
 * @param {Object} chunk - The streaming chunk
 * @param {string} requestModel - The original model requested
 * @returns {Object} Anthropic-format streaming event
 */
export function convertStreamingResponse(chunk, requestModel) {
    const event = chunk.assistantResponseEvent;
    
    if (!event) {
        return null;
    }
    
    // Handle different event types
    if (event.messageMetadataEvent) {
        // Start of response
        return {
            type: 'message_start',
            message: {
                id: `msg_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`,
                type: 'message',
                role: 'assistant',
                model: requestModel,
                content: [],
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
            }
        };
    }
    
    if (event.contentBlockStart) {
        return {
            type: 'content_block_start',
            index: event.contentBlockStart.index || 0,
            content_block: {
                type: 'text',
                text: ''
            }
        };
    }
    
    if (event.contentBlockDelta) {
        return {
            type: 'content_block_delta',
            index: event.contentBlockDelta.index || 0,
            delta: {
                type: 'text_delta',
                text: event.contentBlockDelta.delta || ''
            }
        };
    }
    
    if (event.contentBlockStop) {
        return {
            type: 'content_block_stop',
            index: event.contentBlockStop.index || 0
        };
    }
    
    if (event.assistantResponseMessageEvent) {
        const message = event.assistantResponseMessageEvent;
        return {
            type: 'content_block_delta',
            index: 0,
            delta: {
                type: 'text_delta',
                text: message.content || ''
            }
        };
    }
    
    if (event.codeEvent) {
        // Code generation event
        return {
            type: 'content_block_delta',
            index: 0,
            delta: {
                type: 'text_delta',
                text: event.codeEvent.content || ''
            }
        };
    }
    
    if (event.messageEndEvent || event.supplementaryWebLinks) {
        // End of response
        return {
            type: 'message_delta',
            delta: {
                stop_reason: 'end_turn',
                stop_sequence: null
            },
            usage: { output_tokens: 0 }
        };
    }
    
    return null;
}

/**
 * Extract main text content from response
 */
function extractContent(response) {
    if (typeof response === 'string') {
        return response;
    }
    
    if (response.content) {
        return response.content;
    }
    
    if (response.assistantResponseMessage?.content) {
        return response.assistantResponseMessage.content;
    }
    
    if (response.message) {
        return response.message;
    }
    
    return '';
}

/**
 * Extract thinking/reasoning content from response
 */
function extractThinking(response) {
    if (response.thinking) {
        return response.thinking;
    }
    
    if (response.reasoning) {
        return response.reasoning;
    }
    
    // Check for thinking in content blocks
    if (Array.isArray(response.content)) {
        for (const block of response.content) {
            if (block.type === 'thinking') {
                return block.thinking;
            }
        }
    }
    
    return null;
}

/**
 * Extract tool uses from response
 */
function extractToolUses(response) {
    const toolUses = [];
    
    if (response.toolUses) {
        return response.toolUses;
    }
    
    if (Array.isArray(response.content)) {
        for (const block of response.content) {
            if (block.type === 'tool_use') {
                toolUses.push({
                    id: block.id,
                    name: block.name,
                    input: block.input
                });
            }
        }
    }
    
    return toolUses;
}

/**
 * Determine stop reason based on response
 */
function determineStopReason(response, toolUses) {
    if (toolUses && toolUses.length > 0) {
        return 'tool_use';
    }
    
    if (response.stopReason) {
        const reason = response.stopReason.toLowerCase();
        if (reason.includes('length') || reason.includes('max')) {
            return 'max_tokens';
        }
        if (reason.includes('stop')) {
            return 'stop_sequence';
        }
    }
    
    return 'end_turn';
}

/**
 * Extract usage statistics from response
 */
function extractUsage(response) {
    return {
        input_tokens: response.inputTokens || response.usage?.input_tokens || 0,
        output_tokens: response.outputTokens || response.usage?.output_tokens || 0
    };
}

export default {
    convertKiroToAnthropic,
    convertStreamingResponse
};
